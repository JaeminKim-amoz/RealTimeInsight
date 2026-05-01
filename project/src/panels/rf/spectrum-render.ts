/**
 * Spectrum pure renderer (US-2-006a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 *
 * Visual fidelity: drawSpectrum mirrors public/app/rf.jsx SpectrumPanel's
 * canvas draw block — Keysight 10x10 grid, dBm axis labels (left), MHz freq
 * labels (bottom), classic yellow trace, marker diamonds.
 */

export interface SpectrumFrame {
  /** Power values in dBm, length = number of trace points. */
  values: number[];
}

export interface SpectrumViewport {
  width: number;
  height: number;
}

export interface SpectrumMarker {
  id: number;
  hz: number;
  dBm: number;
  delta?: number;
}

export interface SpectrumOptions {
  /** Center frequency, Hz. */
  centerHz: number;
  /** Span, Hz. */
  spanHz: number;
  /** Reference level (top of grid), dBm. */
  refLevelDbm: number;
  /** dB/division (default 10). */
  scaleDbDiv?: number;
  /** Optional peak markers (M1/M2). */
  markers?: SpectrumMarker[];
}

const TRACE_COLOR = '#f4d65a';
const GRID_COLOR = 'rgba(255,255,255,0.07)';
const AXIS_COLOR = 'rgba(255,255,255,0.18)';
const LABEL_COLOR = 'rgba(255,255,255,0.55)';

/** Format frequency in Hz to MHz/GHz string for axis labels. */
function fmtMhz(hz: number): string {
  if (hz >= 1e9) return (hz / 1e9).toFixed(3) + ' GHz';
  return (hz / 1e6).toFixed(1) + ' MHz';
}

/**
 * Pure spectrum trace synthesis. Mirrors prototype's per-bin formula but
 * deterministic-ish (uses sin/cos of time for drift). Default 801 pts.
 */
export function synthSpectrumTrace(
  centerHz: number,
  spanHz: number,
  time: number,
  N: number = 801
): number[] {
  const startHz = centerHz - spanHz / 2;
  const stepHz = spanHz / (N - 1);
  const out = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    const f = startHz + i * stepHz;
    // noise floor around -108 dBm (deterministic small ripple from sin)
    let v = -108 + Math.sin(i * 0.137 + time * 0.05) * 1.5;
    // OFDM-ish data carrier shoulder around center
    const dCenter = Math.abs(f - centerHz);
    if (dCenter < 10e6) v += 72 * Math.exp(-Math.pow(dCenter / 6e6, 2)) - 6;
    // strong CW at center + 4 MHz
    if (Math.abs(f - (centerHz + 4e6)) < 50e3)
      v += 50 * Math.exp(-Math.pow((f - (centerHz + 4e6)) / 25e3, 2));
    // spurious at center - 6 MHz
    if (Math.abs(f - (centerHz - 6e6)) < 25e3)
      v += 28 * Math.exp(-Math.pow((f - (centerHz - 6e6)) / 15e3, 2));
    // drifting inter-modulation product
    const drift = centerHz + 12e6 + Math.sin(time * 0.3) * 2e6;
    if (Math.abs(f - drift) < 100e3)
      v += 22 * Math.exp(-Math.pow((f - drift) / 60e3, 2));
    // pilot tones
    const offsets = [-14e6, -8e6, 8e6, 14e6];
    for (let k = 0; k < offsets.length; k++) {
      const off = offsets[k];
      if (Math.abs(f - (centerHz + off)) < 30e3)
        v += 35 * Math.exp(-Math.pow((f - (centerHz + off)) / 18e3, 2));
    }
    out[i] = v;
  }
  return out;
}

/**
 * Pure draw function for the Keysight-style spectrum panel.
 */
export function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  frame: SpectrumFrame,
  viewport: SpectrumViewport,
  options: SpectrumOptions
): void {
  const { width: W, height: H } = viewport;
  const { centerHz, spanHz, refLevelDbm } = options;
  const scaleDbDiv = options.scaleDbDiv ?? 10;
  const yMin = refLevelDbm - scaleDbDiv * 10;

  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#0f1113';
  ctx.fillRect(0, 0, W, H);

  // 10x10 Keysight grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo((W * i) / 10, 0);
    ctx.lineTo((W * i) / 10, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (H * i) / 10);
    ctx.lineTo(W, (H * i) / 10);
    ctx.stroke();
  }
  // center axis emphasis
  ctx.strokeStyle = AXIS_COLOR;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // dBm axis labels (left)
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = '9px "JetBrains Mono"';
  ctx.textAlign = 'left';
  for (let i = 0; i <= 10; i++) {
    const db = refLevelDbm - i * scaleDbDiv;
    ctx.fillText(`${db}`, 4, (H * i) / 10 + 9);
  }
  // MHz freq labels (bottom)
  ctx.textAlign = 'center';
  for (let i = 0; i <= 10; i++) {
    const hz = centerHz - spanHz / 2 + (spanHz * i) / 10;
    ctx.fillText(fmtMhz(hz), (W * i) / 10, H - 4);
  }

  // helper coord transforms
  const toY = (dBm: number) =>
    H - ((dBm - yMin) / (refLevelDbm - yMin)) * H;
  const N = frame.values.length;
  const toX = (i: number) => (N <= 1 ? 0 : (i / (N - 1)) * W);

  // trace
  if (N > 0) {
    ctx.strokeStyle = TRACE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = toX(i);
      const y = toY(frame.values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // markers
  if (options.markers) {
    const startHz = centerHz - spanHz / 2;
    for (const m of options.markers) {
      const frac = (m.hz - startHz) / spanHz;
      if (frac < 0 || frac > 1) continue;
      const x = frac * W;
      const idx = Math.round(frac * Math.max(0, N - 1));
      const dBm = N > 0 ? frame.values[idx] : m.dBm;
      const y = toY(dBm);
      ctx.fillStyle = m.delta ? '#e56b5f' : TRACE_COLOR;
      ctx.strokeStyle = '#0f1113';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // marker label
      ctx.fillStyle = TRACE_COLOR;
      ctx.font = 'bold 9px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(m.delta ? `Δ${m.id}` : `M${m.id}`, x + 17, y - 9);
    }
  }
}
