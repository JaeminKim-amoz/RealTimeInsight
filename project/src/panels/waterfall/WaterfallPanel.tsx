/**
 * WaterfallPanel (US-017a) — scrolling color-mapped spectrum image.
 *
 * Visual fidelity 1:1 with public/app/panels.jsx WaterfallPanel:
 *   - HTML5 canvas inside a `panel-body waterfall` container
 *   - amber colormap, 80×120 cell grid
 *   - frequency band labels at the bottom
 *
 * Heavy draw logic + colormap math lives in `render.ts` for direct unit
 * testing (Architect S2 / Tension 2.1). The wrapper itself is intentionally
 * thin.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { PanelInstance } from '../../types/domain';
import {
  drawWaterfall,
  synthSpectrumFrame,
  type WaterfallFrame,
} from './render';

const ROWS = 80;
const COLS = 120;

interface WaterfallPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

export function WaterfallPanel({ panel, mode }: WaterfallPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Touch panel + mode so React deps stay accurate even though slice 1
  // doesn't read panel-specific options or distinguish modes for draw.
  void panel;
  void mode;

  const frames: WaterfallFrame[] = useMemo(() => {
    const t0 = Math.floor(Date.now() / 100);
    const out: WaterfallFrame[] = new Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      out[r] = { values: synthSpectrumFrame(t0 + r * 0.3, COLS) };
    }
    return out;
  }, []);

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
    drawWaterfall(ctx, frames, { width: w, height: h, rows: ROWS, cols: COLS });
  }, [frames]);

  return (
    <div className="panel-body waterfall">
      <canvas ref={canvasRef} className="waterfall-body" />
    </div>
  );
}
