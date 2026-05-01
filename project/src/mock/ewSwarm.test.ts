/**
 * ewSwarm mock — tests.
 */

import { describe, it, expect } from 'vitest';
import { buildEwSwarmMock, EW_SQUAD_LIST } from './ewSwarm';

describe('mock/ewSwarm (US-019c)', () => {
  it('builds a swarm of close-to-1247 UAVs by default', () => {
    const swarm = buildEwSwarmMock();
    // floor() per squad means we may lose 1-3 due to rounding
    expect(swarm.length).toBeGreaterThanOrEqual(1240);
    expect(swarm.length).toBeLessThanOrEqual(1247);
  });

  it('is deterministic for the same seed', () => {
    const a = buildEwSwarmMock(42);
    const b = buildEwSwarmMock(42);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
    expect(a[a.length - 1]).toEqual(b[b.length - 1]);
  });

  it('different seeds produce different positions', () => {
    const a = buildEwSwarmMock(1);
    const b = buildEwSwarmMock(2);
    expect(a[0].x).not.toBe(b[0].x);
  });

  it('exposes 6 squad definitions', () => {
    expect(EW_SQUAD_LIST).toHaveLength(6);
    expect(EW_SQUAD_LIST.map((s) => s.id)).toEqual([
      'ALPHA-RECON', 'BRAVO-EW', 'CHARLIE-STRK', 'DELTA-SEAD', 'ECHO-DECOY', 'FOXTROT-ISR',
    ]);
  });

  it('every UAV has finite x/y/alt/heading and a UAV- prefix id', () => {
    const swarm = buildEwSwarmMock();
    for (const u of swarm.slice(0, 10)) {
      expect(Number.isFinite(u.x)).toBe(true);
      expect(Number.isFinite(u.y)).toBe(true);
      expect(Number.isFinite(u.alt)).toBe(true);
      expect(Number.isFinite(u.heading)).toBe(true);
      expect(u.id.startsWith('UAV-')).toBe(true);
    }
  });
});
