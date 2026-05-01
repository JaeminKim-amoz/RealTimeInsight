/**
 * anomaly-rules.test.ts — US-2-005b fixture validity tests (5 minimum).
 */

import { describe, it, expect } from 'vitest';
import { ANOMALY_RULES } from './anomaly-rules';

describe('mock/anomaly-rules', () => {
  it('exports exactly 5 rules', () => {
    expect(ANOMALY_RULES).toHaveLength(5);
  });

  it('rule[0] hyd-pressure-spike targets channelId 1205 with delta-spike pattern', () => {
    const rule = ANOMALY_RULES.find((r) => r.id === 'hyd-pressure-spike');
    expect(rule).toBeDefined();
    expect(rule!.channelId).toBe(1205);
    expect(rule!.pattern).toBe('delta-spike');
    expect(rule!.severity).toBe('high');
    expect(rule!.deltaThreshold).toBe(20);
  });

  it('all rules have valid pattern fields (threshold-breach | sustained-deviation | delta-spike)', () => {
    const validPatterns = new Set(['threshold-breach', 'sustained-deviation', 'delta-spike']);
    for (const rule of ANOMALY_RULES) {
      expect(validPatterns.has(rule.pattern)).toBe(true);
    }
  });

  it('all rules have non-empty id, name, label, and a valid severity', () => {
    const validSeverities = new Set(['low', 'medium', 'high']);
    for (const rule of ANOMALY_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.label.length).toBeGreaterThan(0);
      expect(validSeverities.has(rule.severity)).toBe(true);
    }
  });

  it('rule voltage-dip targets channelId 1001, threshold-breach pattern, thresholdLow=27, medium severity', () => {
    const rule = ANOMALY_RULES.find((r) => r.id === 'voltage-dip');
    expect(rule).toBeDefined();
    expect(rule!.channelId).toBe(1001);
    expect(rule!.pattern).toBe('threshold-breach');
    expect(rule!.thresholdLow).toBe(27);
    expect(rule!.severity).toBe('medium');
  });
});
