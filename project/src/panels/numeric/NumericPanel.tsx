/**
 * NumericPanel (US-016b) — tile grid showing latest sample per binding.
 *
 * Visual fidelity 1:1 with public/app/panels.jsx NumericPanel: each tile shows
 * channel display name, current value (2-dp), unit, sample-rate badge, and
 * status color (good / warn / alarm). Power Bus #1001 gets a stale-indicator
 * when the bridge buffer is empty in live mode (Critic C3).
 */

import { useMemo } from 'react';
import { CH, colorFor } from '../../mock/channels';
import { synthSeries } from '../../mock/synthesizer';
import { useStreamStore } from '../../store/streamStore';
import type { PanelInstance } from '../../types/domain';
import { resolveSeriesColor } from '../strip/render';

interface NumericPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

const SAMPLE_WINDOW = 30;

export function NumericPanel({ panel, mode }: NumericPanelProps) {
  const panelDataRefs = useStreamStore((s) => s.panelDataRefs);
  const channelBindings = useMemo(
    () => panel.bindings.filter((b) => b.type === 'channel'),
    [panel.bindings]
  );

  return (
    <div className="panel-body numeric-grid">
      {channelBindings.map((b, i) => {
        if (b.type !== 'channel') return null;
        const ch = CH[b.channelId];
        if (!ch) return null;
        const t0 = Math.floor(Date.now() / 1000) - SAMPLE_WINDOW;
        const vals = synthSeries(b.channelId, SAMPLE_WINDOW, t0);
        const cur = vals[vals.length - 1];
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, c) => a + c, 0) / vals.length;
        const alarm = ch.alarmArmed && Math.abs(cur - avg) > (max - min) * 0.35;
        const swatchColor = resolveSeriesColor(colorFor(ch.channelId, i));
        const isPanel1001Bridge = ch.channelId === 1001;
        const hasBuffer = (panelDataRefs[panel.id]?.length ?? 0) > 0;
        const showStale = isPanel1001Bridge && mode === 'live' && !hasBuffer;
        const tileCls = [
          'numeric-tile',
          alarm ? 'alarm' : '',
          ch.alarmArmed ? 'alarm-armed' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={ch.channelId}
            className={tileCls}
            data-channel-id={ch.channelId}
          >
            <div className="tile-hd">
              <span
                className="swatch"
                style={{ background: swatchColor }}
              />
              <span className="tile-name">{ch.displayName}</span>
              <span className="rate-badge">
                {ch.sampleRateHz != null ? `${ch.sampleRateHz} Hz` : '—'}
              </span>
            </div>
            <div className="tile-val">
              {Number.isFinite(cur) ? cur.toFixed(2) : '—'}
              <span className="unit">{ch.unit ?? ''}</span>
            </div>
            <div className="tile-meta">
              <span>min {min.toFixed(1)}</span>
              <span>avg {avg.toFixed(1)}</span>
              <span>max {max.toFixed(1)}</span>
            </div>
            {showStale ? (
              <div className="stale-indicator">Bridge offline</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
