/**
 * IQ constellation pure renderer (US-2-006b).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 *
 * Visual fidelity: drawConstellation mirrors public/app/rf.jsx IQPanel — grid,
 * unit circle, I/Q axes, persistence-style sample dots, ideal points overlay.
 */

export type IQPoint = [number, number];
export type ModulationKind = '16-QAM' | 'QPSK' | '8-PSK';

export interface ConstellationOptions {
  width: number;
  height: number;
  /** Canonical reference points (drawn as overlay). */
  idealPoints: IQPoint[];
}

const SAMPLE_COLOR = 'rgba(79,179,182,0.7)';
const IDEAL_COLOR = '#f4d65a';
const GRID_COLOR = 'rgba(255,255,255,0.06)';
const AXIS_COLOR = 'rgba(255,255,255,0.35)';
const LABEL_COLOR = 'rgba(255,255,255,0.5)';

/**
 * Generate canonical M-QAM constellation. M must be a perfect square (4, 16,
 * 64, 256). Returns normalized points roughly within [-1, 1] x [-1, 1].
 */
export function qamConstellation(M: number): IQPoint[] {
  const k = Math.sqrt(M);
  if (!Number.isInteger(k))
    throw new Error(`qamConstellation: M=${M} is not a perfect square`);
  const out: IQPoint[] = [];
  // For M=16 → side=4, levels = -3, -1, 1, 3 (normalized to /3)
  const side = k;
  const norm = side - 1;
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      const I = (2 * i - (side - 1)) / norm;
      const Q = (2 * j - (side - 1)) / norm;
      out.push([I, Q]);
    }
  }
  return out;
}

/**
 * Generate canonical M-PSK constellation. Points lie on the unit circle,
 * starting at angle 0 and incrementing by 2π/M.
 */
export function pskConstellation(M: number): IQPoint[] {
  const out: IQPoint[] = [];
  for (let k = 0; k < M; k++) {
    const theta = (k * 2 * Math.PI) / M;
    out.push([Math.cos(theta), Math.sin(theta)]);
  }
  return out;
}

/**
 * Apply Gaussian-ish noise to a set of points. Uses Box-Muller from the
 * supplied rng (which yields uniform [0,1)) so tests can pass a deterministic
 * rng. Edge case: rng=0 produces NaN via log(0); we clamp.
 */
export function addNoise(
  points: IQPoint[],
  sigma: number,
  rng: () => number = Math.random
): IQPoint[] {
  if (sigma === 0) return points.map(([i, q]) => [i, q] as IQPoint);
  const out: IQPoint[] = [];
  for (const [i, q] of points) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    const ni = r * Math.cos(2 * Math.PI * u2) * sigma;
    const nq = r * Math.sin(2 * Math.PI * u2) * sigma;
    out.push([i + ni, q + nq]);
  }
  return out;
}

/** Modulation preset → ideal canonical constellation points. */
export function getIdealPoints(modulation: ModulationKind): IQPoint[] {
  switch (modulation) {
    case '16-QAM':
      return qamConstellation(16);
    case 'QPSK':
      return pskConstellation(4);
    case '8-PSK':
      return pskConstellation(8);
    default:
      throw new Error(`getIdealPoints: unsupported modulation ${modulation}`);
  }
}

/**
 * Generate `count` noisy samples by uniformly sampling ideal constellation
 * points and adding Gaussian noise. Used by the IQPanel to produce a trail.
 */
export function generateConstellationSamples(
  modulation: ModulationKind,
  count: number,
  sigma: number,
  rng: () => number = Math.random
): IQPoint[] {
  const ideal = getIdealPoints(modulation);
  const out: IQPoint[] = [];
  for (let k = 0; k < count; k++) {
    const idx = Math.floor(rng() * ideal.length) % ideal.length;
    const [i, q] = ideal[idx];
    out.push([i, q]);
  }
  return addNoise(out, sigma, rng);
}

/** Pure draw function — IQ constellation scatter plot. */
export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  samples: IQPoint[],
  options: ConstellationOptions
): void {
  const { width: W, height: H, idealPoints } = options;
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = '#0f1113';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) / 2 - 16;

  // grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + (R * i) / 4, cy - R);
    ctx.lineTo(cx + (R * i) / 4, cy + R);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy + (R * i) / 4);
    ctx.lineTo(cx + R, cy + (R * i) / 4);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = AXIS_COLOR;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.stroke();

  // axis labels
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = '10px "JetBrains Mono"';
  ctx.textAlign = 'right';
  ctx.fillText('I', cx + R - 4, cy - 4);
  ctx.textAlign = 'left';
  ctx.fillText('Q', cx + 4, cy - R + 10);

  // sample persistence dots
  const scale = R * 0.7;
  ctx.fillStyle = SAMPLE_COLOR;
  for (let i = 0; i < samples.length; i++) {
    const [si, sq] = samples[i];
    ctx.fillRect(cx + si * scale - 1.2, cy - sq * scale - 1.2, 2.4, 2.4);
  }

  // ideal points (overlay)
  ctx.fillStyle = IDEAL_COLOR;
  for (const [pi, pq] of idealPoints) {
    ctx.beginPath();
    ctx.arc(cx + pi * scale, cy - pq * scale, 3.5, 0, 2 * Math.PI);
    ctx.fill();
  }
}
