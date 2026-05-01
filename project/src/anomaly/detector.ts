/**
 * detector.ts — US-2-005a pure anomaly detection logic.
 *
 * No React, no store imports. Stateless pure functions.
 * Coverage target ≥85%.
 */

import type { AnomalyDescriptor, AnomalySeverity } from '../types/domain';

export interface AnomalyRule {
  id: string;
  name: string;
  channelId: number;
  pattern: 'threshold-breach' | 'sustained-deviation' | 'delta-spike';
  thresholdHigh?: number;
  thresholdLow?: number;
  /** for sustained-deviation: number of consecutive samples in rolling window */
  windowSamples?: number;
  /** for sustained-deviation: fractional deviation limit (e.g. 0.1 = 10%) */
  deviationLimit?: number;
  /** for delta-spike: absolute change between consecutive samples */
  deltaThreshold?: number;
  severity: AnomalySeverity;
  label: string;
}

/**
 * Compute score from pattern strength, clamped to [0, 1].
 */
function scoreThresholdBreach(value: number, high?: number, low?: number): number {
  if (high !== undefined && value > high) {
    return Math.min(1, (value - high) / (Math.abs(high) || 1));
  }
  if (low !== undefined && value < low) {
    return Math.min(1, (low - value) / (Math.abs(low) || 1));
  }
  return 0;
}

function scoreDeltaSpike(delta: number, threshold: number): number {
  return Math.min(1, Math.abs(delta) / threshold);
}

function scoreSustainedDeviation(deviation: number, limit: number): number {
  return Math.min(1, deviation / limit);
}

function detectThresholdBreach(
  channelId: number,
  values: number[],
  rule: AnomalyRule,
): AnomalyDescriptor[] {
  const results: AnomalyDescriptor[] = [];
  let detectIdx = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const breachHigh = rule.thresholdHigh !== undefined && v > rule.thresholdHigh;
    const breachLow = rule.thresholdLow !== undefined && v < rule.thresholdLow;
    if (breachHigh || breachLow) {
      const score = scoreThresholdBreach(v, rule.thresholdHigh, rule.thresholdLow);
      results.push({
        anomalyId: `${rule.id}-${detectIdx}`,
        channelId,
        channelDisplay: '',
        timestampNs: String(i),
        severity: rule.severity,
        score,
        label: rule.label,
        windowSec: [i, i + 1],
        candidates: [],
        relatedChannelIds: [],
      });
      detectIdx++;
    }
  }
  return results;
}

function detectDeltaSpike(
  channelId: number,
  values: number[],
  rule: AnomalyRule,
): AnomalyDescriptor[] {
  if (rule.deltaThreshold === undefined) return [];
  const results: AnomalyDescriptor[] = [];
  let detectIdx = 0;
  for (let i = 0; i < values.length - 1; i++) {
    const delta = values[i + 1] - values[i];
    if (Math.abs(delta) > rule.deltaThreshold) {
      const score = scoreDeltaSpike(delta, rule.deltaThreshold);
      results.push({
        anomalyId: `${rule.id}-${detectIdx}`,
        channelId,
        channelDisplay: '',
        timestampNs: String(i),
        severity: rule.severity,
        score,
        label: rule.label,
        windowSec: [i, i + 2],
        candidates: [],
        relatedChannelIds: [],
      });
      detectIdx++;
    }
  }
  return results;
}

function detectSustainedDeviation(
  channelId: number,
  values: number[],
  rule: AnomalyRule,
): AnomalyDescriptor[] {
  const windowSamples = rule.windowSamples ?? 10;
  const deviationLimit = rule.deviationLimit ?? 0.1;
  if (values.length < windowSamples) return [];

  const results: AnomalyDescriptor[] = [];
  let detectIdx = 0;

  for (let i = 0; i <= values.length - windowSamples; i++) {
    const window = values.slice(i, i + windowSamples);
    const mean = window.reduce((sum, v) => sum + v, 0) / windowSamples;
    if (mean === 0) continue;
    const meanDeviation =
      window.reduce((sum, v) => sum + Math.abs(v - mean), 0) / windowSamples / Math.abs(mean);

    if (meanDeviation > deviationLimit) {
      const score = scoreSustainedDeviation(meanDeviation, deviationLimit);
      results.push({
        anomalyId: `${rule.id}-${detectIdx}`,
        channelId,
        channelDisplay: '',
        timestampNs: String(i),
        severity: rule.severity,
        score,
        label: rule.label,
        windowSec: [i, i + windowSamples],
        candidates: [],
        relatedChannelIds: [],
      });
      detectIdx++;
    }
  }
  return results;
}

/**
 * detectAnomalies — runs all provided rules against the values array for the
 * given channelId. Returns deduplicated AnomalyDescriptor[] (by anomalyId).
 */
export function detectAnomalies(
  channelId: number,
  values: number[],
  rules: AnomalyRule[],
): AnomalyDescriptor[] {
  const seen = new Set<string>();
  const results: AnomalyDescriptor[] = [];

  for (const rule of rules) {
    // Only process rules matching this channel
    if (rule.channelId !== channelId) continue;

    let found: AnomalyDescriptor[];
    switch (rule.pattern) {
      case 'threshold-breach':
        found = detectThresholdBreach(channelId, values, rule);
        break;
      case 'delta-spike':
        found = detectDeltaSpike(channelId, values, rule);
        break;
      case 'sustained-deviation':
        found = detectSustainedDeviation(channelId, values, rule);
        break;
      default:
        found = [];
    }

    for (const anomaly of found) {
      if (!seen.has(anomaly.anomalyId)) {
        seen.add(anomaly.anomalyId);
        results.push(anomaly);
      }
    }
  }

  return results;
}
