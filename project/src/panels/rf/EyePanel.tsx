/**
 * EyePanel (US-2-006c) — eye diagram with persistence overlay.
 *
 * Visual fidelity 1:1 with public/app/rf.jsx EyePanel:
 *   - HTML5 canvas inside a `panel-body eye` container with `eye-canvas` class.
 *   - 50 mock traces overlaid with alpha=0.2 for persistence.
 *
 * Heavy draw lives in `eye-render.ts` (Architect S2 / Tension 2.1).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { PanelInstance } from '../../types/domain';
import { drawEyeDiagram, generateEyeTraces } from './eye-render';

interface EyePanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

const N_TRACES = 50;
const SAMPLES_PER_TRACE = 80;

export function EyePanel({ panel, mode }: EyePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  void mode;

  // Deterministic seeded rng based on panel.id so the same panel always
  // shows the same eye pattern across re-renders.
  const traces = useMemo(() => {
    let seed = panel.id.split('').reduce((a, c) => a + c.charCodeAt(0), 13);
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return generateEyeTraces(N_TRACES, SAMPLES_PER_TRACE, 0, rng);
  }, [panel.id]);

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
    drawEyeDiagram(ctx, traces, { width: w, height: h }, { persistenceAlpha: 0.2 });
  }, [traces]);

  return (
    <div className="panel-body eye">
      <div className="eye-header">
        <span>Eye Diagram</span>
        <span className="eye-rate">10 Mbps · NRZ · {N_TRACES} traces folded</span>
      </div>
      <canvas ref={canvasRef} className="eye-canvas" />
    </div>
  );
}
