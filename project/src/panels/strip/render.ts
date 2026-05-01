/**
 * Strip-chart pure renderer (US-016a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 *
 * Visual fidelity: drawStripPlot mirrors public/app/panels.jsx StripChart's
 * canvas draw block (background grid, per-series normalized lines, anomaly
 * marker on channel 1205, optional cursor / hover overlay).
 */

export interface StripSeries {
  channelId: number;
  /** Resolved color (literal CSS value, not a `var(--sN)` token). */
  color: string;
  /** Time-aligned values for sampleCount samples. */
  values: number[];
  /** Optional sample timestamps (seconds) — used for anomaly placement. */
  timestamps?: number[];
}

export interface StripViewport {
  width: number;
  height: number;
  sampleCount: number;
}

export interface StripDrawOptions {
  cursorX?: number;
  hoverX?: number;
  showAnomaly?: boolean;
  /** Spike timestamp (seconds) used to align anomaly marker. */
  spikeTimestampSec?: number;
}

export interface ValueRange {
  min: number;
  max: number;
}

const DEFAULT_RANGE: ValueRange = { min: 0, max: 1 };
const ANOMALY_CHANNEL_ID = 1205;
const DEFAULT_SPIKE_TS = 182.34;
/** Fallback fixed-position marker used when no timestamp data is available
 *  (matches prototype panels.jsx legacy fixed placement at 72%). */
const ANOMALY_FALLBACK_FRACTION = 0.72;

/** Compute min/max with 12% padding; safe for empty / flat series. */
export function computeRange(values: number[]): ValueRange {
  if (!values || values.length === 0) return { ...DEFAULT_RANGE };
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ...DEFAULT_RANGE };
  const span = max - min;
  const pad = span === 0 ? 1 : span * 0.12;
  return { min: min - pad, max: max + pad };
}

/**
 * Resolves a `var(--sN)` CSS-token color into the actual color string.
 * Falls back to a deterministic amber when the token resolves to empty.
 *
 * `root` and `style` are injected for test isolation; in production both
 * default to `document.documentElement` and `getComputedStyle(root)`.
 */
export function resolveSeriesColor(
  color: string,
  root?: HTMLElement,
  style?: CSSStyleDeclaration
): string {
  const match = color?.match(/--s\d/);
  if (!match) return color;
  let resolved = '';
  if (style) {
    resolved = style.getPropertyValue(match[0]).trim();
  } else if (typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
    const r = root ?? document.documentElement;
    resolved = getComputedStyle(r).getPropertyValue(match[0]).trim();
  }
  return resolved || '#e5a24a';
}

/** Returns the first index where `timestamps[i] >= spikeTs`, or -1 if none. */
export function findAnomalyIndex(timestamps: number[], spikeTs: number): number {
  if (!timestamps || timestamps.length === 0) return -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= spikeTs) return i;
  }
  return -1;
}

/** Sample-index → x in pixels, respecting non-zero-divisor edge case. */
function sampleX(i: number, n: number, width: number): number {
  return n > 1 ? (i / (n - 1)) * width : 0;
}

/** Normalized value → y in pixels. Mirrors prototype's 90% vertical band. */
function valueY(v: number, range: ValueRange, height: number): number {
  const span = range.max - range.min || 1;
  return height - ((v - range.min) / span) * height * 0.9 - height * 0.05;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(120,120,120,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 10, 0);
    ctx.lineTo((w * i) / 10, h);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (h * i) / 4);
    ctx.lineTo(w, (h * i) / 4);
    ctx.stroke();
  }
}

function drawSeriesLine(
  ctx: CanvasRenderingContext2D,
  series: StripSeries,
  range: ValueRange,
  vp: StripViewport
) {
  const n = series.values.length;
  if (n === 0) return;
  ctx.strokeStyle = series.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = sampleX(i, n, vp.width);
    const y = valueY(series.values[i], range, vp.height);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawAnomalyMarker(
  ctx: CanvasRenderingContext2D,
  series: StripSeries,
  range: ValueRange,
  vp: StripViewport,
  spikeTs: number
) {
  if (series.values.length === 0) return;
  const n = series.values.length;
  let xi = -1;
  if (series.timestamps && series.timestamps.length > 0) {
    xi = findAnomalyIndex(series.timestamps, spikeTs);
  }
  if (xi < 0) {
    xi = Math.floor(n * ANOMALY_FALLBACK_FRACTION);
  }
  if (xi < 0 || xi >= n) return;
  const x = sampleX(xi, n, vp.width);
  const y = valueY(series.values[xi], range, vp.height);
  ctx.fillStyle = '#d8634a';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8634a';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, vp.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCursorLine(
  ctx: CanvasRenderingContext2D,
  vp: StripViewport,
  fraction: number,
  color: string
) {
  const x = fraction * vp.width;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, vp.height);
  ctx.stroke();
}

/**
 * Pure draw function. The React wrapper only configures canvas size + DPR,
 * fetches a 2D context, and delegates here.
 */
export function drawStripPlot(
  ctx: CanvasRenderingContext2D,
  series: StripSeries[],
  viewport: StripViewport,
  options: StripDrawOptions = {}
): void {
  const { width, height } = viewport;
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  for (const s of series) {
    const range = computeRange(s.values);
    drawSeriesLine(ctx, s, range, viewport);
    if (options.showAnomaly && s.channelId === ANOMALY_CHANNEL_ID) {
      drawAnomalyMarker(
        ctx,
        s,
        range,
        viewport,
        options.spikeTimestampSec ?? DEFAULT_SPIKE_TS
      );
    }
  }

  if (options.cursorX != null && options.cursorX >= 0 && options.cursorX <= 1) {
    drawCursorLine(ctx, viewport, options.cursorX, 'rgba(240, 180, 74, 0.6)');
  }
  if (options.hoverX != null && options.hoverX >= 0 && options.hoverX <= 1) {
    drawCursorLine(ctx, viewport, options.hoverX, 'rgba(255,255,255,0.25)');
  }
}
