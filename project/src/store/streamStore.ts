/**
 * StreamStore — owns panel data subscriptions, ring buffers, and the RAF
 * coalescer that ensures ≤1 React notification per RAF tick.
 *
 * Spec §8.4. Critic E1 (RAF-budget) + Architect Tension 2.6 mitigation: pushFrame
 * appends to an internal pending queue WITHOUT notifying zustand subscribers;
 * tickRaf drains the queue into the buffers and triggers exactly one notification.
 *
 * Slice 1 schemas:
 *  - timeseries-v1 (Strip / Numeric / Discrete simple binding)
 *  - waterfall-v1 (Spectrum panel)
 *  - discrete-v1 (DiscretePanel)
 *  - xy-v1 (XYPlot)
 */

import { create } from 'zustand';
import { detectAnomalies } from '../anomaly/detector';
import type { AnomalyRule } from '../anomaly/detector';
import type { AnomalyDescriptor } from '../types/domain';

export type PanelSchema = 'timeseries-v1' | 'waterfall-v1' | 'discrete-v1' | 'xy-v1';

export interface SubscriptionHandle {
  subscriptionId: string;
}

export interface StreamSubscription {
  subscriptionId: string;
  panelId: string;
  channelIds: number[];
  schema: PanelSchema;
  createdAtMs: number;
}

export interface StreamFrame {
  timestampNs: string;
  value: number | null;
  raw?: number | string;
  qualityFlags?: string[];
}

export interface StreamBuffer {
  subscriptionId: string;
  /** Append-only; trimmed to MAX_BUFFER on overflow */
  frames: StreamFrame[];
  length: number;
}

export interface StreamPerformance {
  uiFps: number;
  renderLatencyMsP95: number;
  eventQueueDepth: number;
}

export interface StreamStoreState {
  subscriptions: Record<string, StreamSubscription>;
  buffers: Record<string, StreamBuffer>;
  panelDataRefs: Record<string, string[]>;
  performance: StreamPerformance;
  detectedAnomalies: AnomalyDescriptor[];

  subscribe: (panelId: string, channelIds: number[], schema: PanelSchema) => SubscriptionHandle;
  unsubscribe: (subscriptionId: string) => void;
  pushFrame: (subscriptionId: string, frame: StreamFrame) => void;
  /**
   * Bulk-write an entire pre-built frame array into a subscription's buffer in
   * a single set(). Bypasses the RAF coalescer for hydration paths
   * (e.g. replay-mode fixture load) where per-frame pushFrame would cost
   * O(n²) due to array copy-on-write. Replaces any existing frames.
   */
  hydrateBuffer: (subscriptionId: string, frames: StreamFrame[]) => void;
  tickRaf: () => void;
  updatePerformance: (patch: Partial<StreamPerformance>) => void;
  /**
   * US-2-005c: Run anomaly detection rules against buffered channel data.
   * Merges results into detectedAnomalies (deduplicated by anomalyId).
   * Called from UI at low frequency (e.g. once per second); NOT invoked on pushFrame.
   */
  runDetectors: (rules: AnomalyRule[]) => void;
  reset: () => void;
}

const MAX_BUFFER = 60_000; // ~5 minutes at 200 Hz
let SUB_COUNTER = 0;

interface PendingEntry {
  subscriptionId: string;
  frame: StreamFrame;
}
let PENDING: PendingEntry[] = [];

const INITIAL = {
  subscriptions: {} as Record<string, StreamSubscription>,
  buffers: {} as Record<string, StreamBuffer>,
  panelDataRefs: {} as Record<string, string[]>,
  performance: { uiFps: 0, renderLatencyMsP95: 0, eventQueueDepth: 0 } as StreamPerformance,
  detectedAnomalies: [] as AnomalyDescriptor[],
};

export const useStreamStore = create<StreamStoreState>((set) => ({
  ...INITIAL,

  subscribe: (panelId, channelIds, schema) => {
    SUB_COUNTER += 1;
    const subscriptionId = `sub-${SUB_COUNTER}`;
    set((s) => ({
      subscriptions: {
        ...s.subscriptions,
        [subscriptionId]: {
          subscriptionId,
          panelId,
          channelIds: channelIds.slice(),
          schema,
          createdAtMs: Date.now(),
        },
      },
      buffers: {
        ...s.buffers,
        [subscriptionId]: { subscriptionId, frames: [], length: 0 },
      },
      panelDataRefs: {
        ...s.panelDataRefs,
        [panelId]: [...(s.panelDataRefs[panelId] ?? []), subscriptionId],
      },
    }));
    return { subscriptionId };
  },

  unsubscribe: (subscriptionId) =>
    set((s) => {
      const sub = s.subscriptions[subscriptionId];
      if (!sub) return s;
      const nextSubs = { ...s.subscriptions };
      delete nextSubs[subscriptionId];
      const nextBuffers = { ...s.buffers };
      delete nextBuffers[subscriptionId];
      const refs = (s.panelDataRefs[sub.panelId] ?? []).filter((id) => id !== subscriptionId);
      const nextRefs = { ...s.panelDataRefs };
      if (refs.length === 0) {
        delete nextRefs[sub.panelId];
      } else {
        nextRefs[sub.panelId] = refs;
      }
      // Also drop pending frames bound to this subscription
      PENDING = PENDING.filter((p) => p.subscriptionId !== subscriptionId);
      return {
        subscriptions: nextSubs,
        buffers: nextBuffers,
        panelDataRefs: nextRefs,
        performance: { ...s.performance, eventQueueDepth: PENDING.length },
      };
    }),

  pushFrame: (subscriptionId, frame) => {
    // Append to module-level queue WITHOUT zustand set() — per Critic E1, the
    // RAF coalescer must guarantee 0 React notifications per pushFrame and
    // exactly 1 per tickRaf. queueDepth is mutated in place so getState() reads
    // the current count without triggering subscribers.
    PENDING.push({ subscriptionId, frame });
    const perf = useStreamStore.getState().performance as { eventQueueDepth: number };
    perf.eventQueueDepth = PENDING.length;
  },

  hydrateBuffer: (subscriptionId, frames) =>
    set((s) => {
      const buf = s.buffers[subscriptionId];
      if (!buf) return s;
      const trimmed =
        frames.length > MAX_BUFFER ? frames.slice(frames.length - MAX_BUFFER) : frames.slice();
      return {
        buffers: {
          ...s.buffers,
          [subscriptionId]: {
            subscriptionId,
            frames: trimmed,
            length: trimmed.length,
          },
        },
      };
    }),

  tickRaf: () =>
    set((s) => {
      if (PENDING.length === 0) {
        if (s.performance.eventQueueDepth === 0) return s;
        return { performance: { ...s.performance, eventQueueDepth: 0 } };
      }
      // Drain pending into buffers
      const buffersNext: Record<string, StreamBuffer> = { ...s.buffers };
      const drained = PENDING;
      PENDING = [];
      for (const { subscriptionId, frame } of drained) {
        const buf = buffersNext[subscriptionId];
        if (!buf) continue;
        const nextFrames =
          buf.frames.length >= MAX_BUFFER
            ? [...buf.frames.slice(buf.frames.length - MAX_BUFFER + 1), frame]
            : [...buf.frames, frame];
        buffersNext[subscriptionId] = {
          subscriptionId,
          frames: nextFrames,
          length: nextFrames.length,
        };
      }
      return {
        buffers: buffersNext,
        performance: { ...s.performance, eventQueueDepth: 0 },
      };
    }),

  updatePerformance: (patch) =>
    set((s) => ({ performance: { ...s.performance, ...patch } })),

  runDetectors: (rules) =>
    set((s) => {
      if (rules.length === 0) return s;

      // Build a map: channelId → latest 200 sample values extracted from all subscriptions
      const channelValues = new Map<number, number[]>();
      for (const sub of Object.values(s.subscriptions)) {
        for (const channelId of sub.channelIds) {
          if (!channelValues.has(channelId)) {
            const buf = s.buffers[sub.subscriptionId];
            if (buf && buf.frames.length > 0) {
              const frames = buf.frames.slice(-200);
              const values = frames
                .map((f) => f.value)
                .filter((v): v is number => v !== null);
              channelValues.set(channelId, values);
            }
          }
        }
      }

      // Run detection and collect all new anomalies
      const existingIds = new Set(s.detectedAnomalies.map((a) => a.anomalyId));
      const newAnomalies: AnomalyDescriptor[] = [];

      for (const rule of rules) {
        const values = channelValues.get(rule.channelId);
        if (!values || values.length === 0) continue;
        const found = detectAnomalies(rule.channelId, values, [rule]);
        for (const anomaly of found) {
          if (!existingIds.has(anomaly.anomalyId)) {
            existingIds.add(anomaly.anomalyId);
            newAnomalies.push(anomaly);
          }
        }
      }

      if (newAnomalies.length === 0) return s;
      return { detectedAnomalies: [...s.detectedAnomalies, ...newAnomalies] };
    }),

  reset: () => {
    PENDING = [];
    SUB_COUNTER = 0;
    set({
      subscriptions: {},
      buffers: {},
      panelDataRefs: {},
      performance: { uiFps: 0, renderLatencyMsP95: 0, eventQueueDepth: 0 },
      detectedAnomalies: [],
    });
  },
}));

/** React hook helper — slice 1 minimal version. Slice 2 will add memoization. */
export function useStreamSubscription(
  panelId: string,
  channelIds: number[],
  schema: PanelSchema = 'timeseries-v1',
): SubscriptionHandle | null {
  // For slice 1 we expose the handle synchronously; full lifecycle (mount/unmount)
  // wiring lands with US-016 panel ports via a thin React useEffect wrapper.
  if (!panelId || channelIds.length === 0) return null;
  return useStreamStore.getState().subscribe(panelId, channelIds, schema);
}

/** Test-only: explicit drain helper for hermetic tests. */
export const __testInternals = {
  flushPendingForTest(): number {
    const n = PENDING.length;
    PENDING = [];
    return n;
  },
};
