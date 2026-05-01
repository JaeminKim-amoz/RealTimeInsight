import { describe, it, expect } from 'vitest';
import { ANOMALY } from './anomalies';

describe('mock/anomalies', () => {
  it('ANOMALY fixture matches deep-interview spec (anom-001 / channel 1205 / high severity)', () => {
    expect(ANOMALY.anomalyId).toBe('anom-001');
    expect(ANOMALY.channelId).toBe(1205);
    expect(ANOMALY.severity).toBe('high');
    expect(ANOMALY.score).toBeCloseTo(0.93, 2);
  });

  it('exposes 4 ranked candidates with confidence and evidence', () => {
    expect(ANOMALY.candidates).toHaveLength(4);
    const top = ANOMALY.candidates[0];
    expect(top.rank).toBe(1);
    expect(top.confidence).toBeGreaterThan(0.8);
    expect(top.evidenceKinds.length).toBeGreaterThan(0);
  });

  it('relatedChannelIds covers cross-system signals (1002 current, 1007 PDU, 2215 accel)', () => {
    expect(ANOMALY.relatedChannelIds).toEqual(
      expect.arrayContaining([1002, 1007, 2215])
    );
  });

  it('window covers a sub-second range around the spike timestamp 182.340s', () => {
    const [t0, t1] = ANOMALY.windowSec;
    expect(t0).toBeLessThan(t1);
    expect(182.340).toBeGreaterThanOrEqual(t0);
    expect(182.340).toBeLessThanOrEqual(t1);
  });
});
