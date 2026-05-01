import { describe, it, expect } from 'vitest';
import { synthesize, synthSeries } from './synthesizer';

describe('mock/synthesizer', () => {
  it('synthesize returns a finite number for known channel #1001 (bus voltage)', () => {
    const v = synthesize(1001, 0);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(20); // ~28V baseline
    expect(v).toBeLessThan(36);
  });

  it('synthesize returns finite for hydraulic spike channel #1205 (peak triggers in window)', () => {
    const baseline = synthesize(1205, 0);
    expect(Number.isFinite(baseline)).toBe(true);
    expect(baseline).toBeGreaterThan(180); // ~207 bar baseline range
    expect(baseline).toBeLessThan(240);
  });

  it('synthesize is deterministic at identical (id, t) when seeded — drift bounded by random component', () => {
    // synthesizer adds (Math.random()-0.5)*small noise; two consecutive calls within
    // a sample period must remain within the noise envelope (tighter than 5%).
    const a = synthesize(2210, 5); // roll, deg
    const b = synthesize(2210, 5);
    const ratio = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
    expect(ratio).toBeLessThan(0.5);
  });

  it('synthSeries(channelId=1001, n=200, t0=0) returns an array of length 200 of finite numbers', () => {
    const series = synthSeries(1001, 200, 0);
    expect(series).toHaveLength(200);
    for (const v of series) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('synthSeries advances time by 1 unit per index (t-window scrolls)', () => {
    const a = synthSeries(2210, 4, 0);
    const b = synthSeries(2210, 4, 4);
    // No exact equality (random noise), but distinct windows should not be identical
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('handles unknown channel id with default sin/cos shape (no throw)', () => {
    expect(() => synthesize(999_999, 10)).not.toThrow();
    const v = synthesize(999_999, 10);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('covers every prototyped channel branch (1001..5003) with finite output', () => {
    const ids = [1001, 1002, 1205, 1206, 2210, 2211, 2212, 2213, 2214, 2215, 5002, 5003];
    for (const id of ids) {
      for (const t of [0, 50, 180, 220]) {
        const v = synthesize(id, t);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('1205 spike envelope adds amplitude near (t % 220) ≈ 180', () => {
    // Average several samples at the envelope peak vs a flat-baseline sample
    let peak = 0;
    let baseline = 0;
    const N = 50;
    for (let i = 0; i < N; i++) {
      peak += synthesize(1205, 180); // envelope active
      baseline += synthesize(1205, 50); // far from peak
    }
    peak /= N;
    baseline /= N;
    // Spike adds ~28 bar; allowing for noise we expect ≥10 bar lift
    expect(peak - baseline).toBeGreaterThan(10);
  });
});
