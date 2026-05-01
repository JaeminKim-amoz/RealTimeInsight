/**
 * Trajectory3D pure geometry (US-017e).
 *
 * The R3F Canvas wrapper is mocked in jsdom; the actual vertex math lives here
 * as pure number-only fns to keep panel coverage ≥85% without WebGL.
 *
 * Pixel-space TrackPoint → 3D scene units. Slice 1 uses a deterministic
 * planar projection where t (progress) drives altitude (Y axis).
 */

import type { TrackPoint } from '../../types/domain';

/** Pixel-x range from data.jsx: ~120..600 → centre at 360, scale to ±20 units. */
const X_CENTER = 360;
const X_SCALE = 20 / 240;

/** Pixel-y range from data.jsx: ~140..420 → centre at 280, scale (z axis). */
const Y_CENTER = 280;
const Y_SCALE = 20 / 140;

/** t ∈ [0,1] → altitude band of [0..6] units. */
const ALT_BAND = 6;

/** Project a single TrackPoint to a [x, y, z] tuple (Three.js scene space). */
export function projectTrackPoint(p: TrackPoint): [number, number, number] {
  const x = (p.x - X_CENTER) * X_SCALE;
  const y = p.t * ALT_BAND;
  const z = (p.y - Y_CENTER) * Y_SCALE;
  return [x, y, z];
}

/**
 * Build a Float32Array of vertex positions for a Three.js BufferGeometry.
 * Layout: [x0, y0, z0, x1, y1, z1, ...]
 */
export function buildTrackGeometry(
  points: ReadonlyArray<TrackPoint>
): Float32Array {
  const out = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = projectTrackPoint(points[i]);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
