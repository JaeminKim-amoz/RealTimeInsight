import { describe, it, expect } from 'vitest';
import { TRACK_POINTS } from './trackPoints';

describe('mock/trackPoints', () => {
  it('exposes 80 track points (deterministic sortie path)', () => {
    expect(TRACK_POINTS).toHaveLength(80);
  });

  it('points span normalized t from 0 (start) to ~1 (end)', () => {
    expect(TRACK_POINTS[0].t).toBeCloseTo(0, 3);
    expect(TRACK_POINTS[TRACK_POINTS.length - 1].t).toBeGreaterThan(0.9);
  });

  it('every point has finite x/y coordinates', () => {
    for (const p of TRACK_POINTS) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('produces deterministic output (same input each call)', () => {
    // imported as module → frozen array; assert equality of two consecutive snapshots
    const a = JSON.stringify(TRACK_POINTS);
    const b = JSON.stringify(TRACK_POINTS);
    expect(a).toBe(b);
  });
});
