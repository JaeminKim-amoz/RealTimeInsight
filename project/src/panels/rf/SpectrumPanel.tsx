/**
 * SpectrumPanel (US-2-006a) — Keysight N9040B-style spectrum display.
 *
 * Visual fidelity 1:1 with public/app/rf.jsx SpectrumPanel:
 *   - HTML5 canvas inside a `panel-body spectrum-rf` container
 *   - Header chrome with center freq, span, ref level, RBW, VBW, sweep time
 *   - Peak markers (M1/M2) below the canvas
 *
 * Heavy draw logic + trace synthesis live in `spectrum-render.ts`
 * (Architect S2 / Tension 2.1).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { PanelInstance } from '../../types/domain';
import {
  drawSpectrum,
  synthSpectrumTrace,
  type SpectrumMarker,
} from './spectrum-render';

interface SpectrumPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

interface SpectrumOpts {
  centerFreqMhz: number;
  spanMhz: number;
  refLevelDbm: number;
}

const DEFAULTS: SpectrumOpts = {
  centerFreqMhz: 1500,
  spanMhz: 500,
  refLevelDbm: -30,
};

function readOpts(panel: PanelInstance): SpectrumOpts {
  const o = panel.options ?? {};
  return {
    centerFreqMhz:
      typeof o.centerFreqMhz === 'number' ? o.centerFreqMhz : DEFAULTS.centerFreqMhz,
    spanMhz: typeof o.spanMhz === 'number' ? o.spanMhz : DEFAULTS.spanMhz,
    refLevelDbm:
      typeof o.refLevelDbm === 'number' ? o.refLevelDbm : DEFAULTS.refLevelDbm,
  };
}

export function SpectrumPanel({ panel, mode }: SpectrumPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  void mode;

  const opts = readOpts(panel);
  const centerHz = opts.centerFreqMhz * 1e6;
  const spanHz = opts.spanMhz * 1e6;

  const trace = useMemo(
    () => synthSpectrumTrace(centerHz, spanHz, 0, 401),
    [centerHz, spanHz]
  );

  // Mock peak markers (M1 = strongest CW at center+4MHz, M2 = spurious).
  const markers: SpectrumMarker[] = useMemo(
    () => [
      { id: 1, hz: centerHz + 4e6, dBm: -45 },
      { id: 2, hz: centerHz - 6e6, dBm: -68 },
    ],
    [centerHz]
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 300;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawSpectrum(
      ctx,
      { values: Array.from(trace) },
      { width: w, height: h },
      {
        centerHz,
        spanHz,
        refLevelDbm: opts.refLevelDbm,
        scaleDbDiv: 10,
        markers,
      }
    );
  }, [trace, centerHz, spanHz, opts.refLevelDbm, markers]);

  return (
    <div className="panel-body spectrum-rf">
      <div className="spectrum-rf-header">
        <span className="readout">
          Center <b>{opts.centerFreqMhz} MHz</b>
        </span>
        <span className="readout">
          Span <b>{opts.spanMhz} MHz</b>
        </span>
        <span className="readout">
          Ref <b>{opts.refLevelDbm} dBm</b>
        </span>
        <span className="readout">
          RBW <b>30 kHz</b>
        </span>
        <span className="readout">
          VBW <b>30 kHz</b>
        </span>
        <span className="readout">
          Sweep <b>33.4 ms</b>
        </span>
      </div>
      <canvas ref={canvasRef} className="spectrum-rf-canvas" />
      <div className="spectrum-rf-markers">
        {markers.map((m) => (
          <span key={m.id} className="marker">
            M{m.id}: {(m.hz / 1e6).toFixed(2)} MHz / {m.dBm} dBm
          </span>
        ))}
      </div>
    </div>
  );
}
