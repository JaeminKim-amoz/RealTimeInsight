/**
 * Waterfall pure renderer (US-017a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 *
 * Visual fidelity: drawWaterfall mirrors public/app/panels.jsx WaterfallPanel's
 * canvas draw block — amber colormap (dark→amber→white), per-cell fillRect,
 * frequency band labels at the bottom. Spectrum frame synthesis ports the
 * prototype's freq/time-driven peaks formula to a pure helper.
 */

export interface WaterfallFrame {
  /** Spectrum row, length = viewport.cols. Values typically in [0..2]. */
  values: number[];
}

export interface WaterfallViewport {
  width: number;
  height: number;
  rows: number;
  cols: number;
}

export interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

const FREQ_LABELS = ['1.2 GHz', '1.4 GHz', '1.6 GHz', '1.8 GHz'];

/** Amber colormap: dark→amber→white. k clamped to [0,1]. Matches prototype. */
export function amberColormap(k: number): ColorRgb {
  const c = k <= 0 ? 0 : k >= 1 ? 1 : k;
  const r = Math.floor(c < 0.5 ? c * 2 * 230 : 230 + (c - 0.5) * 2 * 25);
  const g = Math.floor(c < 0.5 ? c * 2 * 162 : 162 + (c - 0.5) * 2 * 90);
  const b = Math.floor(c < 0.5 ? c * 2 * 50 : 50 + (c - 0.5) * 2 * 180);
  return { r, g, b };
}

/**
 * Pure spectrum-frame synthesis. Mirrors prototype's per-row formula but
 * deterministic (no random noise) so tests can assert peaks reliably.
 */
export function synthSpectrumFrame(time: number, cols: number): number[] {
  const out = new Array<number>(cols);
  for (let c = 0; c < cols; c++) {
    const freq = c / cols;
    const v =
      Math.exp(-Math.pow(freq - 0.2, 2) / 0.005) *
        (0.7 + Math.sin(time * 0.1) * 0.2) +
      Math.exp(-Math.pow(freq - 0.55, 2) / 0.002) * 0.9 +
      Math.exp(-Math.pow(freq - 0.78, 2) / 0.01) *
        (0.5 + Math.cos(time * 0.07) * 0.3);
    out[c] = v < 0 ? 0 : v;
  }
  return out;
}

/** Pure draw function. Wrapper supplies sized ctx + frames; we paint cells. */
export function drawWaterfall(
  ctx: CanvasRenderingContext2D,
  frames: WaterfallFrame[],
  viewport: WaterfallViewport
): void {
  const { width, height, rows, cols } = viewport;
  ctx.clearRect(0, 0, width, height);
  const cw = width / cols;
  const rh = height / rows;

  for (let r = 0; r < rows; r++) {
    const frame = frames[r];
    for (let c = 0; c < cols; c++) {
      const v = frame && c < frame.values.length ? frame.values[c] : 0;
      const k = v > 1 ? 1 : v < 0 ? 0 : v;
      const { r: R, g: G, b: B } = amberColormap(k);
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(c * cw, r * rh, cw + 1, rh + 1);
    }
  }

  // Frequency labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px "JetBrains Mono"';
  for (let i = 0; i < FREQ_LABELS.length; i++) {
    ctx.fillText(FREQ_LABELS[i], ((i + 1) / 5) * width, height - 4);
  }
}
