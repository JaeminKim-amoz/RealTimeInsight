/**
 * Pure geometry tests (US-018c) — globe panel coordinate helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  buildOrbitPath,
  latLonToVec3,
  MOCK_SATELLITES,
  MOCK_THREATS,
} from './geometry';

describe('panels/globe/geometry latLonToVec3', () => {
  it('(lat=0, lon=0, r=1) maps to ~(1, 0, 0)', () => {
    const [x, y, z] = latLonToVec3(0, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('(lat=90, lon=0, r=1) maps to (0, 1, 0) (north pole)', () => {
    const [x, y, z] = latLonToVec3(90, 0, 1);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('(lat=-90, lon=0, r=1) maps to (0, -1, 0) (south pole)', () => {
    const [x, y, z] = latLonToVec3(-90, 0, 1);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-1, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('all results lie on a sphere of given radius', () => {
    for (const r of [1, 1.05, 1.1, 2.6]) {
      for (let lat = -90; lat <= 90; lat += 30) {
        for (let lon = -180; lon <= 180; lon += 60) {
          const [x, y, z] = latLonToVec3(lat, lon, r);
          expect(Math.hypot(x, y, z)).toBeCloseTo(r, 4);
        }
      }
    }
  });

  it('scales with radius linearly', () => {
    const a = latLonToVec3(45, 30, 1);
    const b = latLonToVec3(45, 30, 2);
    expect(b[0]).toBeCloseTo(a[0] * 2, 5);
    expect(b[1]).toBeCloseTo(a[1] * 2, 5);
    expect(b[2]).toBeCloseTo(a[2] * 2, 5);
  });
});

describe('panels/globe/geometry buildOrbitPath', () => {
  it('produces 64 vertices (192 floats) for n=64', () => {
    const arr = buildOrbitPath(400, 51.6, 64);
    expect(arr).toBeInstanceOf(Float32Array);
    expect(arr.length).toBe(64 * 3);
  });

  it('all vertices have magnitude > 1 (orbit is above earth surface)', () => {
    const arr = buildOrbitPath(400, 51.6, 64);
    for (let i = 0; i < arr.length; i += 3) {
      const m = Math.hypot(arr[i], arr[i + 1], arr[i + 2]);
      expect(m).toBeGreaterThan(1);
    }
  });

  it('higher altitude → higher magnitude radius', () => {
    const low = buildOrbitPath(400, 0, 16);
    const high = buildOrbitPath(20000, 0, 16);
    const mLow = Math.hypot(low[0], low[1], low[2]);
    const mHigh = Math.hypot(high[0], high[1], high[2]);
    expect(mHigh).toBeGreaterThan(mLow);
  });

  it('inclination=0 keeps z=0 for all points', () => {
    const arr = buildOrbitPath(400, 0, 32);
    for (let i = 0; i < arr.length; i += 3) {
      expect(Math.abs(arr[i + 2])).toBeLessThan(1e-6);
    }
  });

  it('inclination=90 produces non-zero z values', () => {
    const arr = buildOrbitPath(400, 90, 32);
    let hasZ = false;
    for (let i = 0; i < arr.length; i += 3) {
      if (Math.abs(arr[i + 2]) > 0.01) hasZ = true;
    }
    expect(hasZ).toBe(true);
  });

  it('all entries are finite numbers', () => {
    const arr = buildOrbitPath(550, 53, 64);
    for (let i = 0; i < arr.length; i++) {
      expect(Number.isFinite(arr[i])).toBe(true);
    }
  });
});

describe('panels/globe/geometry MOCK_SATELLITES', () => {
  it('exposes 5 mock satellites for slice-1', () => {
    expect(MOCK_SATELLITES).toHaveLength(5);
  });

  it('every satellite has positive altitude', () => {
    for (const s of MOCK_SATELLITES) {
      expect(s.altitudeKm).toBeGreaterThan(0);
    }
  });
});

describe('panels/globe/geometry MOCK_THREATS', () => {
  it('exposes 1 threat hemisphere at lat=37.5 lon=127.0', () => {
    expect(MOCK_THREATS).toHaveLength(1);
    expect(MOCK_THREATS[0].latDeg).toBeCloseTo(37.5, 5);
    expect(MOCK_THREATS[0].lonDeg).toBeCloseTo(127.0, 5);
  });
});
