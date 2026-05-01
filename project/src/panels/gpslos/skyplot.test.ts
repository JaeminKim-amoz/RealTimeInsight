/**
 * Pure skyplot helpers (US-018d) — polar projection + mock constellation.
 */

import { describe, it, expect } from 'vitest';
import {
  mockGpsConstellation,
  polarToSvg,
  SLICE1_PDOP,
} from './skyplot';

describe('panels/gpslos/skyplot polarToSvg', () => {
  it('elevation=90 (zenith) returns center (0, 0)', () => {
    const { x, y } = polarToSvg(90, 0, 100);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it('elevation=0, azimuth=0 (north horizon) returns (0, -radius)', () => {
    const { x, y } = polarToSvg(0, 0, 100);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-100, 5);
  });

  it('elevation=0, azimuth=90 (east horizon) returns (radius, 0)', () => {
    const { x, y } = polarToSvg(0, 90, 100);
    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it('elevation=0, azimuth=180 (south horizon) returns (0, radius)', () => {
    const { x, y } = polarToSvg(0, 180, 100);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(100, 5);
  });

  it('elevation=0, azimuth=270 (west horizon) returns (-radius, 0)', () => {
    const { x, y } = polarToSvg(0, 270, 100);
    expect(x).toBeCloseTo(-100, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it('elevation=45, azimuth=90 maps inside the circle', () => {
    const { x, y } = polarToSvg(45, 90, 100);
    const r = Math.hypot(x, y);
    expect(r).toBeCloseTo(50, 3);
  });

  it('result distance from center is monotonic with (90 - elevation)', () => {
    const a = polarToSvg(90, 0, 100);
    const b = polarToSvg(45, 0, 100);
    const c = polarToSvg(0, 0, 100);
    expect(Math.hypot(a.x, a.y)).toBeLessThan(Math.hypot(b.x, b.y));
    expect(Math.hypot(b.x, b.y)).toBeLessThan(Math.hypot(c.x, c.y));
  });
});

describe('panels/gpslos/skyplot mockGpsConstellation', () => {
  it('produces 21 satellites', () => {
    expect(mockGpsConstellation(0)).toHaveLength(21);
  });

  it('mix is 8 GPS + 4 GLO + 5 GAL + 4 BDS', () => {
    const list = mockGpsConstellation(0);
    expect(list.filter((s) => s.system === 'GPS')).toHaveLength(8);
    expect(list.filter((s) => s.system === 'GLO')).toHaveLength(4);
    expect(list.filter((s) => s.system === 'GAL')).toHaveLength(5);
    expect(list.filter((s) => s.system === 'BDS')).toHaveLength(4);
  });

  it('every satellite has elevation in [0..90]', () => {
    for (const s of mockGpsConstellation(0)) {
      expect(s.elevationDeg).toBeGreaterThanOrEqual(0);
      expect(s.elevationDeg).toBeLessThanOrEqual(90);
    }
  });

  it('every satellite has azimuth in [0..360)', () => {
    for (const s of mockGpsConstellation(0)) {
      expect(s.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(s.azimuthDeg).toBeLessThan(360);
    }
  });

  it('signal strength is in a realistic range (typically 30..55 dB-Hz)', () => {
    for (const s of mockGpsConstellation(0)) {
      expect(s.signalStrength).toBeGreaterThan(25);
      expect(s.signalStrength).toBeLessThan(60);
    }
  });

  it('is deterministic: same t → same output', () => {
    const a = mockGpsConstellation(42);
    const b = mockGpsConstellation(42);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].elevationDeg).toBeCloseTo(b[i].elevationDeg, 10);
      expect(a[i].azimuthDeg).toBeCloseTo(b[i].azimuthDeg, 10);
    }
  });

  it('"used" flag is true only for high-elevation strong-signal sats', () => {
    for (const s of mockGpsConstellation(0)) {
      if (s.used) {
        expect(s.elevationDeg).toBeGreaterThan(12);
        expect(s.signalStrength).toBeGreaterThan(35);
      }
    }
  });
});

describe('panels/gpslos/skyplot SLICE1_PDOP', () => {
  it('exposes the slice-1 fixed PDOP value 1.42', () => {
    expect(SLICE1_PDOP).toBeCloseTo(1.42, 5);
  });
});
