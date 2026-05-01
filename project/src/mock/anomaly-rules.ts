/**
 * anomaly-rules.ts — US-2-005b canonical rules fixture.
 *
 * 5 rules covering the main telemetry domains: hydraulics, power, RF, pose.
 */

import type { AnomalyRule } from '../anomaly/detector';

export type { AnomalyRule };

export const ANOMALY_RULES: AnomalyRule[] = [
  {
    id: 'hyd-pressure-spike',
    name: 'Hydraulic Pressure Spike',
    channelId: 1205,
    pattern: 'delta-spike',
    deltaThreshold: 20,
    severity: 'high',
    label: 'Hydraulic pressure sudden spike (>20 bar delta)',
  },
  {
    id: 'voltage-dip',
    name: 'Bus Voltage Dip',
    channelId: 1001,
    pattern: 'threshold-breach',
    thresholdLow: 27,
    severity: 'medium',
    label: 'Bus voltage below 27V',
  },
  {
    id: 'rssi-low',
    name: 'RSSI Sustained Low',
    channelId: 5002,
    pattern: 'sustained-deviation',
    windowSamples: 20,
    deviationLimit: 0.15,
    severity: 'medium',
    label: 'Link RSSI sustained deviation (>15%)',
  },
  {
    id: 'aoa-high',
    name: 'Angle of Attack High',
    channelId: 2218,
    pattern: 'threshold-breach',
    thresholdHigh: 14,
    severity: 'high',
    label: 'Angle of attack exceeds 14 deg',
  },
  {
    id: 'bus-current-burst',
    name: 'Bus Current Burst',
    channelId: 1002,
    pattern: 'delta-spike',
    deltaThreshold: 10,
    severity: 'medium',
    label: 'Bus current sudden burst (>10A delta)',
  },
];
