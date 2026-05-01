/**
 * Eye-diagram pure renderer (US-2-006c).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 *
 * Visual fidelity: drawEyeDiagram mirrors public/app/rf.jsx EyePanel —
 * 10x10 grid, dashed UI markers, persistence overlay (alpha=0.2 default),
 * axis labels (-1 UI / 0 / +1 UI).
 */

export interface EyeTrace {
  /** Amplitude samples spanning roughly two unit intervals. */
  samples: number[];
}

export interface EyeViewport {
  width: number;
  height: number;
}

export interface EyeRenderOptions {
  /** Per-trace alpha (persistence). Default 0.2. */
  persistenceAlpha?: number;
}

const TRACE_COLOR_RGB = '244,214,90'; // amber

/**
 * Generate `nTraces` mock eye-diagram traces. Each trace simulates a smooth
 * level transition (NRZ-style) with random jitter and amplitude noise. The
 * supplied rng yields uniform [0,1).
 */
export function generateEyeTraces(
  nTraces: number,
  samplesPerTrace: number,
  time: number,
  rng: () => number = Math.random
): EyeTrace[] {
  const out: EyeTrace[] = [];
  for (let tr = 0; tr < nTraces; tr++) {
    const jitterT = (rng() - 0.5) * 0.06;
    const ampJ = (rng() - 0.5) * 0.08;
    const level = rng() > 0.5 ? 1 : -1;
    const prevLevel = rng() > 0.5 ? 1 : -1;
    const samples = new Array<number>(samplesPerTrace);
    for (let s = 0; s < samplesPerTrace; s++) {
      const u = s / Math.max(1, samplesPerTrace - 1);
      const uShift = u + jitterT - 0.5;
      let v: number;
      if (uShift < -0.35) v = prevLevel;
      else if (uShift > 0.35) v = level;
      else {
        const k = (uShift + 0.35) / 0.7;
        const smooth = k * k * (3 - 2 * k);
        v = prevLevel + (level - prevLevel) * smooth;
      }
      v += ampJ + (rng() - 0.5) * 0.025 + Math.sin(time * 0.05) * 0.005;
      samples[s] = v;
    }
    out.push({ samples });
  }
  return out;
}

/** Pure draw function — eye diagram with persistence overlay. */
export function drawEyeDiagram(
  ctx: CanvasRenderingContext2D,
  traces: EyeTrace[],
  viewport: EyeViewport,
  opts: EyeRenderOptions = {}
): void {
  const { width: W, height: H } = viewport;
  const persistenceAlpha = opts.persistenceAlpha ?? 0.2;

  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#0f1113';
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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
  // mid horizontal line
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // 25%/75% UI dashed markers
  ctx.strokeStyle = 'rgba(229,162,74,0.3)';
  if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(W * 0.25, 0);
  ctx.lineTo(W * 0.25, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.75, 0);
  ctx.lineTo(W * 0.75, H);
  ctx.stroke();
  if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

  // traces with persistence overlay
  ctx.strokeStyle = `rgba(${TRACE_COLOR_RGB},${persistenceAlpha})`;
  ctx.lineWidth = 1;
  for (const tr of traces) {
    const N = tr.samples.length;
    if (N === 0) continue;
    ctx.beginPath();
    for (let s = 0; s < N; s++) {
      const u = s / Math.max(1, N - 1);
      const x = u * W;
      const y = H / 2 - tr.samples[s] * H * 0.38;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '9px "JetBrains Mono"';
  ctx.textAlign = 'left';
  ctx.fillText('-1 UI', 4, H - 5);
  ctx.textAlign = 'center';
  ctx.fillText('0', W / 2, H - 5);
  ctx.textAlign = 'right';
  ctx.fillText('+1 UI', W - 4, H - 5);
}
