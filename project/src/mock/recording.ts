/**
 * Mock 60-second replay-mode recording (US-2-003).
 *
 * Pre-computes 60 seconds of synthesized samples at 200 Hz for the priority
 * slice-2 channel set, packs them as `ReplayFrame[]`, and exposes a hydration
 * helper that loads the buffer into `useStreamStore` via the existing
 * subscribe + pushFrame + tickRaf pattern (Critic E1 path preserved).
 *
 * The fixture is the data source for replay-mode panel binding when
 * `useSessionStore.getState().appMode === 'replay'`.
 */

import { synthSeries } from './synthesizer';
import { useStreamStore, type StreamFrame } from '../store/streamStore';

export interface ReplayFrame {
  timestampNs: string;
  value: number;
}

/** Sample rate of the fixture (matches the highest-rate slice-2 channels). */
export const RECORDING_SAMPLE_RATE_HZ = 200;

/** Length of the fixture in seconds. */
export const RECORDING_DURATION_SEC = 60;

/** Length of the fixture in nanoseconds — exposed for slider bounds. */
export const RECORDING_DURATION_NS = 60_000_000_000;

/** Per-channel frame count: 60s × 200Hz = 12 000 samples. */
export const RECORDING_FRAMES_PER_CHANNEL =
  RECORDING_SAMPLE_RATE_HZ * RECORDING_DURATION_SEC;

/** Channels included in the replay fixture (slice-2 priority subset). */
export const RECORDED_CHANNEL_IDS: ReadonlyArray<number> = Object.freeze([
  1001, 1002, 1205, 1206, 2210, 2211, 2212, 5002, 5003,
]);

const SAMPLE_PERIOD_NS = 1_000_000_000 / RECORDING_SAMPLE_RATE_HZ; // 5_000_000

function buildFramesForChannel(channelId: number): ReplayFrame[] {
  const values = synthSeries(channelId, RECORDING_FRAMES_PER_CHANNEL, 0);
  const out = new Array<ReplayFrame>(RECORDING_FRAMES_PER_CHANNEL);
  for (let i = 0; i < RECORDING_FRAMES_PER_CHANNEL; i++) {
    out[i] = {
      timestampNs: String(Math.round(i * SAMPLE_PERIOD_NS)),
      value: values[i],
    };
  }
  return out;
}

/**
 * The recorded fixture, keyed by channel id. Built lazily on module-init
 * by walking RECORDED_CHANNEL_IDS through the synthesizer.
 */
export const RECORDED_BUFFER: Readonly<Record<number, ReplayFrame[]>> = (() => {
  const acc: Record<number, ReplayFrame[]> = {};
  for (const id of RECORDED_CHANNEL_IDS) {
    acc[id] = buildFramesForChannel(id);
  }
  return Object.freeze(acc);
})();

/**
 * Hydrate the streamStore with the recorded fixture: one subscription per
 * channel under panelId `'replay-fixture'`, schema `'timeseries-v1'`. Returns
 * the map of `channelId → subscriptionId` so callers can resolve buffers.
 *
 * Drains pending frames via `tickRaf()` so callers see populated buffers
 * synchronously after the call.
 */
export function loadRecordingIntoStreamStore(): Record<number, string> {
  const stream = useStreamStore.getState();
  const idMap: Record<number, string> = {};
  for (const channelId of RECORDED_CHANNEL_IDS) {
    const handle = stream.subscribe(
      `replay-fixture-${channelId}`,
      [channelId],
      'timeseries-v1'
    );
    idMap[channelId] = handle.subscriptionId;
    const frames = RECORDED_BUFFER[channelId] ?? [];
    // Convert ReplayFrame → StreamFrame in a single allocation, then bulk-hydrate.
    const streamFrames: StreamFrame[] = frames.map((f) => ({
      timestampNs: f.timestampNs,
      value: f.value,
    }));
    useStreamStore.getState().hydrateBuffer(handle.subscriptionId, streamFrames);
  }
  return idMap;
}
