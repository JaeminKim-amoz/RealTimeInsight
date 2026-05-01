/**
 * IQPanel (US-2-006b) — IQ constellation scatter plot.
 *
 * Visual fidelity 1:1 with public/app/rf.jsx IQPanel:
 *   - HTML5 canvas inside a `panel-body iq` container with `iq-canvas` class.
 *   - Modulation presets via panel.options.modulation: 16-QAM | QPSK | 8-PSK.
 *   - Each preset generates the canonical constellation point grid plus
 *     Gaussian noise for the persistence trail.
 *
 * Heavy draw + math live in `iq-render.ts` (Architect S2 / Tension 2.1).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { PanelInstance } from '../../types/domain';
import {
  drawConstellation,
  generateConstellationSamples,
  getIdealPoints,
  type ModulationKind,
} from './iq-render';

interface IQPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

const SUPPORTED_MODS: ModulationKind[] = ['16-QAM', 'QPSK', '8-PSK'];

function readModulation(panel: PanelInstance): ModulationKind {
  const m = panel.options?.modulation;
  if (typeof m === 'string' && (SUPPORTED_MODS as string[]).includes(m)) {
    return m as ModulationKind;
  }
  return '16-QAM';
}

export function IQPanel({ panel, mode }: IQPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  void mode;

  const modulation = readModulation(panel);

  // Deterministic-ish rng: uses Math.random in live but seeded by panel.id +
  // modulation so re-renders for the same modulation reuse a stable trail.
  const samples = useMemo(() => {
    let seed =
      panel.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) +
      modulation.length;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return generateConstellationSamples(modulation, 400, 0.06, rng);
  }, [modulation, panel.id]);

  const idealPoints = useMemo(() => getIdealPoints(modulation), [modulation]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 400;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawConstellation(ctx, samples, { width: w, height: h, idealPoints });
  }, [samples, idealPoints]);

  return (
    <div className="panel-body iq">
      <div className="iq-header">
        <span className="iq-mod-label">Modulation: {modulation}</span>
        <span className="iq-rate">5.0 Msym/s</span>
      </div>
      <canvas ref={canvasRef} className="iq-canvas" />
    </div>
  );
}
