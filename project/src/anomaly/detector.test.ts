/**
 * detector.test.ts — US-2-005e pure detector logic tests (10 minimum).
 */

import { describe, it, expect } from 'vitest';
import { detectAnomalies } from './detector';
import type { AnomalyRule } from './detector';

// ── helpers ────────────────────────────────────────────────────────────────

const THRESHOLD_HIGH_RULE: AnomalyRule = {
  id: 'r-th-high',
  name: 'Threshold High',
  channelId: 1205,
  pattern: 'threshold-breach',
  thresholdHigh: 250,
  severity: 'high',
  label: 'Pressure too high',
};

const THRESHOLD_LOW_RULE: AnomalyRule = {
  id: 'r-th-low',
  name: 'Threshold Low',
  channelId: 1001,
  pattern: 'threshold-breach',
  thresholdLow: 27,
  severity: 'medium',
  label: 'Voltage dip',
};

const SUSTAINED_DEV_RULE: AnomalyRule = {
  id: 'r-sust',
  name: 'Sustained Deviation',
  channelId: 5002,
  pattern: 'sustained-deviation',
  windowSamples: 10,
  deviationLimit: 0.15,
  severity: 'medium',
  label: 'RSSI low sustained',
};

const DELTA_SPIKE_RULE: AnomalyRule = {
  id: 'r-delta',
  name: 'Delta Spike',
  channelId: 1205,
  pattern: 'delta-spike',
  deltaThreshold: 20,
  severity: 'high',
  label: 'Hydraulic spike',
};

// ── threshold-breach high ──────────────────────────────────────────────────

describe('detectAnomalies / threshold-breach high', () => {
  it('positive case: value exceeds thresholdHigh emits anomaly', () => {
    const values = [200, 210, 260, 205]; // 260 > 250
    const results = detectAnomalies(1205, values, [THRESHOLD_HIGH_RULE]);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const ids = results.map((r) => r.anomalyId);
    expect(ids.some((id) => id.startsWith('r-th-high-'))).toBe(true);
    expect(results[0].severity).toBe('high');
    expect(results[0].channelId).toBe(1205);
  });

  it('negative case: value AT threshold (not above) does not emit anomaly', () => {
    const values = [200, 210, 250, 205]; // 250 == threshold, NOT >
    const results = detectAnomalies(1205, values, [THRESHOLD_HIGH_RULE]);
    expect(results).toHaveLength(0);
  });
});

// ── threshold-breach low ───────────────────────────────────────────────────

describe('detectAnomalies / threshold-breach low', () => {
  it('positive case: value below thresholdLow emits anomaly', () => {
    const values = [28, 28.5, 26.5, 28]; // 26.5 < 27
    const results = detectAnomalies(1001, values, [THRESHOLD_LOW_RULE]);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].severity).toBe('medium');
    expect(results[0].label).toBe('Voltage dip');
  });

  it('negative case: all values at or above thresholdLow does not emit', () => {
    const values = [28, 27, 27.5, 28.2]; // 27 == threshold, not below
    const results = detectAnomalies(1001, values, [THRESHOLD_LOW_RULE]);
    expect(results).toHaveLength(0);
  });
});

// ── sustained-deviation ────────────────────────────────────────────────────

describe('detectAnomalies / sustained-deviation', () => {
  it('positive case: mean deviation exceeds limit for full window emits anomaly', () => {
    // RSSI baseline around -70, deviationLimit=0.15, so deviation > 15% of baseline
    // Use values that are clearly deviated from their mean by > 15%
    // 10 samples alternating high-low to ensure mean deviation > 15%
    const baseline = 100;
    // Each sample deviates by 20% → mean deviation = 20% > 15%
    const values = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? baseline * 1.2 : baseline * 0.8));
    const results = detectAnomalies(5002, values, [SUSTAINED_DEV_RULE]);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].severity).toBe('medium');
  });

  it('negative case: deviation drops out before window full does not emit', () => {
    // First 5 samples are steady, second 5 also steady — no sustained deviation
    const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const results = detectAnomalies(5002, values, [SUSTAINED_DEV_RULE]);
    expect(results).toHaveLength(0);
  });
});

// ── delta-spike ────────────────────────────────────────────────────────────

describe('detectAnomalies / delta-spike', () => {
  it('positive case: jump of 28 bar (207→235) exceeds deltaThreshold=20', () => {
    const values = [207, 207, 207, 235, 207]; // delta=28 > 20
    const results = detectAnomalies(1205, values, [DELTA_SPIKE_RULE]);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].anomalyId).toMatch(/^r-delta-/);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  it('negative case: jump within deltaThreshold does not emit', () => {
    const values = [207, 215, 207, 210]; // max delta = 15 < 20
    const results = detectAnomalies(1205, values, [DELTA_SPIKE_RULE]);
    expect(results).toHaveLength(0);
  });
});

// ── multiple rules on same channel ────────────────────────────────────────

describe('detectAnomalies / multiple rules', () => {
  it('emits anomalies for each matching rule independently', () => {
    const rules: AnomalyRule[] = [THRESHOLD_HIGH_RULE, DELTA_SPIKE_RULE];
    // 260 exceeds threshold-high AND 207→260 = 53 exceeds delta-spike
    const values = [207, 207, 260];
    const results = detectAnomalies(1205, values, rules);
    // Must have at least 2 anomalies from 2 different rules
    const ruleIds = new Set(results.map((r) => r.anomalyId.split('-').slice(0, -1).join('-')));
    expect(ruleIds.size).toBeGreaterThanOrEqual(2);
  });
});

// ── no false positives on stable signal ───────────────────────────────────

describe('detectAnomalies / stable signal', () => {
  it('synthetic stable signal produces no anomalies across all pattern types', () => {
    const stableValues = Array.from({ length: 50 }, () => 200); // perfectly flat 200
    const allRules: AnomalyRule[] = [
      { ...THRESHOLD_HIGH_RULE, thresholdHigh: 300 }, // well above
      { ...THRESHOLD_LOW_RULE, thresholdLow: 100, channelId: 1205 }, // well below
      { ...DELTA_SPIKE_RULE, deltaThreshold: 50 }, // far above any delta
      { ...SUSTAINED_DEV_RULE, channelId: 1205, deviationLimit: 0.5 }, // very tolerant
    ];
    const results = detectAnomalies(1205, stableValues, allRules);
    expect(results).toHaveLength(0);
  });
});
