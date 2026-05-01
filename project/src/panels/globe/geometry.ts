/**
 * Globe pure geometry helpers (US-018c).
 *
 * Slice 1 visualization: a unit sphere with mocked satellite orbits and a
 * single threat hemisphere. Real TLE-derived orbits land slice 2.
 *
 * Pure: no DOM, no Three.js objects, just numbers. R3F mounts these arrays
 * inside `<bufferGeometry>` primitives in the panel.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert geographic lat/lon (degrees) to a 3D Cartesian on a sphere of given
 * radius. Uses the prototype's convention so the unit-sphere result is
 * Three.js-friendly (right-handed, +Y up).
 *
 * (lat=0, lon=0) → (1, 0, 0) on the unit sphere.
 */
export function latLonToVec3(
  latDeg: number,
  lonDeg: number,
  radius: number
): [number, number, number] {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/**
 * Build a closed orbit path of `n` vertices on a circle of radius
 * (1 + altKm/earthRadius) inclined by `inclinationDeg` degrees. Output is a
 * Float32Array of [x0,y0,z0, x1,y1,z1, ...].
 */
export function buildOrbitPath(
  altitudeKm: number,
  inclinationDeg: number,
  n: number
): Float32Array {
  const r = 1 + Math.max(0, altitudeKm) / EARTH_RADIUS_KM;
  const inc = inclinationDeg * (Math.PI / 180);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n)) * Math.PI * 2;
    const x0 = Math.cos(t) * r;
    const y0 = Math.sin(t) * r;
    // Rotate around X by inclination (orbit plane tilt)
    const y = y0 * Math.cos(inc);
    const z = y0 * Math.sin(inc);
    out[i * 3] = x0;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

export interface MockSatellite {
  id: string;
  altitudeKm: number;
  inclinationDeg: number;
  color: string;
}

/**
 * Slice-1 mocked satellite roster — 5 satellites covering GNSS / COMM / EO
 * altitude bands. Real TLE-derived constellation lands slice-2.
 */
export const MOCK_SATELLITES: ReadonlyArray<MockSatellite> = Object.freeze([
  { id: 'GPS-IIIA-3', altitudeKm: 20180, inclinationDeg: 55, color: '#6bb7d9' },
  { id: 'IRIDIUM-115', altitudeKm: 781, inclinationDeg: 86, color: '#c78fd1' },
  { id: 'STARLINK-3221', altitudeKm: 550, inclinationDeg: 53, color: '#9ec5e8' },
  { id: 'KH-11-USA-290', altitudeKm: 264, inclinationDeg: 97, color: '#f0b44a' },
  { id: 'ISS', altitudeKm: 410, inclinationDeg: 51, color: '#ffd166' },
]);

export interface MockThreat {
  id: string;
  latDeg: number;
  lonDeg: number;
  /** dome radius on the unit sphere (arc-length / earthRadius). */
  radius: number;
  color: string;
}

/**
 * Slice-1 mocked threat — a single red SAM hemisphere centered on Seoul-ish
 * coordinates (lat 37.5 / lon 127.0). Real threat overlays land slice-2.
 */
export const MOCK_THREATS: ReadonlyArray<MockThreat> = Object.freeze([
  { id: 'SAM-1', latDeg: 37.5, lonDeg: 127.0, radius: 0.05, color: '#d8634a' },
]);
