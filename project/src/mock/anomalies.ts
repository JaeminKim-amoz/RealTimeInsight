/**
 * Mock anomaly fixture ported from public/app/data.jsx ANOMALY constant.
 * Spec §13 (knowledge flow). Slice-1 scope: a single canonical anomaly anchor
 * for the InsightPane demo flow.
 */

import type { AnomalyDescriptor } from '../types/domain';

/** Cursor timestamp 182.340s expressed as nanoseconds (frame-aligned at 200 Hz). */
const SPIKE_TIMESTAMP_NS = '182340000000';

export const ANOMALY: AnomalyDescriptor = {
  anomalyId: 'anom-001',
  channelId: 1205,
  channelDisplay: 'Hydraulic Pressure A',
  timestampNs: SPIKE_TIMESTAMP_NS,
  severity: 'high',
  score: 0.93,
  label: 'Pressure spike with correlated current disturbance',
  windowSec: [182.28, 182.44],
  candidates: [
    {
      rank: 1,
      title: 'Bus current transient on CH 1002 — 120ms lead',
      confidence: 0.86,
      evidenceKinds: ['temporal-lead', 'shared-subsystem', 'formula-dependency'],
      rationale:
        'Current spike preceded pressure rise by 120ms; both on Power→Hydraulic bridge formula.',
    },
    {
      rank: 2,
      title: 'PDU BIT fault bit set on CH 1007',
      confidence: 0.72,
      evidenceKinds: ['alarm-cooccur', 'shared-frame'],
      rationale: 'Fault bit fired within 80ms window; same decoder frame locality.',
    },
    {
      rank: 3,
      title: 'Hyd bypass valve state transition CH 1210',
      confidence: 0.58,
      evidenceKinds: ['state-change', 'operator-bookmark'],
      rationale: 'Valve opened just before spike; previously bookmarked in run 0918.',
    },
    {
      rank: 4,
      title: 'Vibration burst on Accel Z CH 2215',
      confidence: 0.41,
      evidenceKinds: ['correlation', 'weak'],
      rationale: 'Weak correlation (r=0.41) with accel Z envelope in window.',
    },
  ],
  relatedChannelIds: [1002, 1007, 1210, 2215, 1206, 5003],
};

export const ALL_ANOMALIES: AnomalyDescriptor[] = [ANOMALY];

export function lookupAnomaly(anomalyId: string): AnomalyDescriptor | undefined {
  return ALL_ANOMALIES.find((a) => a.anomalyId === anomalyId);
}
