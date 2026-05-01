/**
 * StripChartPanel (US-016a) — overlay time-series strip plot.
 *
 * Visual fidelity 1:1 with public/app/panels.jsx StripChart:
 *   - HTML5 canvas (NOT svg) inside a `panel-body strip` container
 *   - per-channel line series, normalized per-series Y-range
 *   - cursor line tied to useSelectionStore.globalCursorNs (Critic C4)
 *   - anomaly marker on channel 1205 when selectedAnomalyId === 'anom-001'
 *   - per-channel legend below the canvas
 *
 * Heavy draw logic lives in `render.ts` for direct unit-testing
 * (Architect S2 / Tension 2.1). The wrapper itself is intentionally thin.
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import { useSelectionStore } from '../../store/selectionStore';
import { useSessionStore } from '../../store/sessionStore';
import { useStreamStore } from '../../store/streamStore';
import { CH, colorFor } from '../../mock/channels';
import { synthSeries } from '../../mock/synthesizer';
import { RECORDED_BUFFER, RECORDING_SAMPLE_RATE_HZ } from '../../mock/recording';
import type { PanelInstance } from '../../types/domain';
import {
  drawStripPlot,
  resolveSeriesColor,
  type StripSeries,
} from './render';

const SAMPLE_COUNT = 600;
const BRIDGE_OFFLINE_TIMEOUT_MS = 2000;

interface StripChartPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

interface LegendItem {
  channelId: number;
  name: string;
  unit: string;
  color: string;
  value: number;
}

export function StripChartPanel({ panel, mode }: StripChartPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedAnomalyId = useSelectionStore((s) => s.selectedAnomalyId);
  const globalCursorNs = useSelectionStore((s) => s.globalCursorNs);
  const panelDataRefs = useStreamStore((s) => s.panelDataRefs);
  const appMode = useSessionStore((s) => s.appMode);
  const playbackCursorNs = useSessionStore((s) => s.playback.currentTimeNs);
  const [mountedAtMs] = useState(() => Date.now());
  const [tickAt, setTickAt] = useState(Date.now());

  // Re-render once after mount so the bridge-offline 2s timer can elapse
  // and the placeholder appears even if no live frames arrive.
  useEffect(() => {
    if (panel.id !== '1001') return;
    const id = window.setTimeout(
      () => setTickAt(Date.now()),
      BRIDGE_OFFLINE_TIMEOUT_MS + 50
    );
    return () => window.clearTimeout(id);
  }, [panel.id]);

  const channelBindings = useMemo(
    () => panel.bindings.filter((b) => b.type === 'channel'),
    [panel.bindings]
  );

  const series: StripSeries[] = useMemo(() => {
    return channelBindings
      .map((b, i) => {
        if (b.type !== 'channel') return null;
        const ch = CH[b.channelId];
        if (!ch) return null;

        // Replay-mode binding: slice SAMPLE_COUNT frames from RECORDED_BUFFER
        // ending at the current playback cursor (clamped). Falls through to the
        // synthesizer when the channel isn't in the fixture.
        if (appMode === 'replay') {
          const recorded = RECORDED_BUFFER[b.channelId];
          if (recorded && recorded.length > 0) {
            const cursorNs = Number(playbackCursorNs);
            const samplePeriodNs = 1_000_000_000 / RECORDING_SAMPLE_RATE_HZ;
            const cursorIdx = Math.max(
              0,
              Math.min(recorded.length - 1, Math.floor(cursorNs / samplePeriodNs))
            );
            const startIdx = Math.max(0, cursorIdx - SAMPLE_COUNT + 1);
            const endIdx = Math.min(recorded.length, startIdx + SAMPLE_COUNT);
            const values: number[] = new Array(endIdx - startIdx);
            for (let k = 0; k < values.length; k++) {
              values[k] = recorded[startIdx + k].value;
            }
            return {
              channelId: ch.channelId,
              color: resolveSeriesColor(colorFor(ch.channelId, i)),
              values,
            } as StripSeries;
          }
        }

        const t0 = Math.floor(Date.now() / 1000) - SAMPLE_COUNT;
        const values = synthSeries(b.channelId, SAMPLE_COUNT, t0);
        return {
          channelId: ch.channelId,
          color: resolveSeriesColor(colorFor(ch.channelId, i)),
          values,
        } as StripSeries;
      })
      .filter((s): s is StripSeries => s !== null);
  }, [channelBindings, appMode, playbackCursorNs]);

  const hasAnomaly =
    selectedAnomalyId === 'anom-001' &&
    channelBindings.some((b) => b.type === 'channel' && b.channelId === 1205);

  const cursorFraction = useMemo(() => {
    // Replay mode: cursor maps to playback.currentTimeNs across the visible window.
    // The current sample is always at the right edge of the SAMPLE_COUNT-wide
    // window (we slice up to cursorIdx inclusive), so the cursor lives at
    // fraction ≈ 1.0 — except when the cursor is still inside the first window
    // before we have SAMPLE_COUNT samples, where it sits at cursorIdx/SAMPLE_COUNT.
    if (appMode === 'replay') {
      const cursorNs = Number(playbackCursorNs);
      if (!Number.isFinite(cursorNs)) return undefined;
      const samplePeriodNs = 1_000_000_000 / RECORDING_SAMPLE_RATE_HZ;
      const cursorIdx = Math.max(0, Math.floor(cursorNs / samplePeriodNs));
      if (cursorIdx >= SAMPLE_COUNT - 1) return 1;
      return cursorIdx / SAMPLE_COUNT;
    }
    if (!globalCursorNs) return undefined;
    // Map nanoseconds onto [0,1] using SAMPLE_COUNT as the reference window.
    const ns = Number(globalCursorNs);
    if (!Number.isFinite(ns)) return undefined;
    return ((ns / 1e9) % SAMPLE_COUNT) / SAMPLE_COUNT;
  }, [appMode, playbackCursorNs, globalCursorNs]);

  // Strip empty-state branch: nothing to draw, render placeholder.
  if (channelBindings.length === 0) {
    return (
      <div className="panel-body strip empty">
        <div className="strip-empty">No channel bindings</div>
      </div>
    );
  }

  // Bridge-offline branch for any panel binding channel #1001 in live mode.
  // Per Critic C3: surface placeholder when the bridge is silent so silent
  // synth-fallback can't drift unnoticed in tauri:dev.
  const bindsChannel1001 = channelBindings.some(
    (b) => b.type === 'channel' && b.channelId === 1001
  );
  const hasLiveBuffer = (panelDataRefs[panel.id]?.length ?? 0) > 0;
  const showBridgeOffline =
    bindsChannel1001 && mode === 'live' && appMode === 'live' && !hasLiveBuffer;
  // Touch tick + mountedAtMs so the watchdog timer state stays in deps.
  void tickAt;
  void mountedAtMs;

  return (
    <div
      className="panel-body strip"
      data-anomaly-active={hasAnomaly ? 'true' : undefined}
    >
      {showBridgeOffline ? (
        <div className="bridge-offline">Bridge offline</div>
      ) : null}
      <CanvasLayer
        canvasRef={canvasRef}
        series={series}
        cursorFraction={cursorFraction}
        showAnomaly={hasAnomaly}
      />
      <Legend
        items={series.map((s, i) => {
          const ch = CH[s.channelId];
          return {
            channelId: s.channelId,
            name: ch?.name ?? `ch-${s.channelId}`,
            unit: ch?.unit ?? '',
            color: s.color,
            value: s.values.length > 0 ? s.values[s.values.length - 1] : NaN,
          } satisfies LegendItem;
        })}
      />
    </div>
  );
}

interface CanvasLayerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  series: StripSeries[];
  cursorFraction: number | undefined;
  showAnomaly: boolean;
}

function CanvasLayer({
  canvasRef,
  series,
  cursorFraction,
  showAnomaly,
}: CanvasLayerProps) {
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 200;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawStripPlot(
      ctx,
      series,
      { width: w, height: h, sampleCount: SAMPLE_COUNT },
      { cursorX: cursorFraction, showAnomaly }
    );
  }, [canvasRef, series, cursorFraction, showAnomaly]);

  return <canvas ref={canvasRef} className="strip-chart" />;
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <div key={it.channelId} className="legend-item">
          <span
            className="swatch"
            style={{ background: it.color }}
            data-channel-id={it.channelId}
          />
          <span>{it.name}</span>
          <span className="val">
            {Number.isFinite(it.value) ? it.value.toFixed(2) : '—'} {it.unit}
          </span>
        </div>
      ))}
    </div>
  );
}
