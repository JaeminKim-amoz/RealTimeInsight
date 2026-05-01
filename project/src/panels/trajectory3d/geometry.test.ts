/**
 * Pure-math tests for the Trajectory3D track geometry builder (US-017e).
 *
 * The R3F Canvas wrapper is mocked in jsdom; geometry math (xy projected
 * track → 3D vertex array) is pure and gets ≥85% coverage here.
 */

import { describe, it, expect } from 'vitest';
import { buildTrackGeometry, projectTrackPoint } from './geometry';
import { TRACK_POINTS } from '../../mock/trackPoints';

describe('panels/trajectory3d/geometry projectTrackPoint', () => {
  it('returns a [x, y, z] tuple for any TrackPoint', () => {
    const p = projectTrackPoint({ x: 360, y: 270, t: 0.5 });
    expect(p).toHaveLength(3);
    expect(p.every(Number.isFinite)).toBe(true);
  });

  it('y axis encodes progress (t) so output rises with t', () => {
    const a = projectTrackPoint({ x: 100, y: 100, t: 0 });
    const b = projectTrackPoint({ x: 100, y: 100, t: 1 });
    expect(b[1]).toBeGreaterThan(a[1]);
  });

  it('x scales with input x in pixel space', () => {
    const a = projectTrackPoint({ x: 0, y: 200, t: 0.3 });
    const b = projectTrackPoint({ x: 600, y: 200, t: 0.3 });
    expect(b[0]).toBeGreaterThan(a[0]);
  });
});

describe('panels/trajectory3d/geometry buildTrackGeometry', () => {
  it('produces a Float32Array sized 3 * N for N points', () => {
    const arr = buildTrackGeometry(TRACK_POINTS);
    expect(arr).toBeInstanceOf(Float32Array);
    expect(arr.length).toBe(TRACK_POINTS.length * 3);
  });

  it('returns an empty Float32Array for empty input', () => {
    const arr = buildTrackGeometry([]);
    expect(arr).toBeInstanceOf(Float32Array);
    expect(arr.length).toBe(0);
  });

  it('all entries are finite numbers', () => {
    const arr = buildTrackGeometry(TRACK_POINTS);
    for (let i = 0; i < arr.length; i++) {
      expect(Number.isFinite(arr[i])).toBe(true);
    }
  });

  it('first vertex equals projectTrackPoint(points[0])', () => {
    const arr = buildTrackGeometry(TRACK_POINTS);
    const p0 = projectTrackPoint(TRACK_POINTS[0]);
    expect(arr[0]).toBeCloseTo(p0[0], 5);
    expect(arr[1]).toBeCloseTo(p0[1], 5);
    expect(arr[2]).toBeCloseTo(p0[2], 5);
  });

  it('last vertex equals projectTrackPoint of the last point', () => {
    const arr = buildTrackGeometry(TRACK_POINTS);
    const last = TRACK_POINTS[TRACK_POINTS.length - 1];
    const pL = projectTrackPoint(last);
    const i = arr.length - 3;
    expect(arr[i]).toBeCloseTo(pL[0], 5);
    expect(arr[i + 1]).toBeCloseTo(pL[1], 5);
    expect(arr[i + 2]).toBeCloseTo(pL[2], 5);
  });
});
