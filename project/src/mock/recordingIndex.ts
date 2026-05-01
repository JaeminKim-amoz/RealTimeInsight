/**
 * Recording library index (US-2-004d) — 12 recordings across 3 missions
 * (Project Apollo / Phoenix / Halcyon). Slice-2 placeholder for the
 * RecordingLibrary modal browse UI.
 */

export interface RecordingEntry {
  id: string;
  mission: string;
  aircraft: string;
  /** YYYY-MM-DD HH:mm */
  date: string;
  /** Total duration in minutes. */
  durationMin: number;
  /** Approximate size in GB. */
  sizeGB: number;
  /** Number of channels recorded. */
  channels: number;
  /** Number of anomalies flagged. */
  anomalyCount: number;
}

export const RECORDING_MISSIONS: ReadonlyArray<string> = [
  'Project Apollo',
  'Phoenix',
  'Halcyon',
];

export const RECORDING_AIRCRAFT: ReadonlyArray<string> = [
  'T-247',
  'T-248',
  'F-201',
  'RQ-180-A',
];

export const RECORDING_INDEX: ReadonlyArray<RecordingEntry> = [
  // Project Apollo (4)
  { id: 'rec-001', mission: 'Project Apollo', aircraft: 'T-247', date: '2026-04-20 16:32',
    durationMin: 84, sizeGB: 12.4, channels: 218, anomalyCount: 3 },
  { id: 'rec-002', mission: 'Project Apollo', aircraft: 'T-247', date: '2026-04-19 11:04',
    durationMin: 62, sizeGB: 9.1, channels: 214, anomalyCount: 0 },
  { id: 'rec-003', mission: 'Project Apollo', aircraft: 'T-248', date: '2026-04-17 07:48',
    durationMin: 121, sizeGB: 18.6, channels: 220, anomalyCount: 1 },
  { id: 'rec-004', mission: 'Project Apollo', aircraft: 'T-247', date: '2026-04-15 09:18',
    durationMin: 45, sizeGB: 6.8, channels: 198, anomalyCount: 2 },
  // Phoenix (4)
  { id: 'rec-005', mission: 'Phoenix', aircraft: 'F-201', date: '2026-04-18 09:22',
    durationMin: 95, sizeGB: 14.2, channels: 264, anomalyCount: 5 },
  { id: 'rec-006', mission: 'Phoenix', aircraft: 'F-201', date: '2026-04-16 19:11',
    durationMin: 28, sizeGB: 4.2, channels: 256, anomalyCount: 0 },
  { id: 'rec-007', mission: 'Phoenix', aircraft: 'F-201', date: '2026-04-14 13:55',
    durationMin: 78, sizeGB: 11.7, channels: 260, anomalyCount: 1 },
  { id: 'rec-008', mission: 'Phoenix', aircraft: 'F-201', date: '2026-04-12 08:01',
    durationMin: 156, sizeGB: 23.3, channels: 268, anomalyCount: 4 },
  // Halcyon (4)
  { id: 'rec-009', mission: 'Halcyon', aircraft: 'RQ-180-A', date: '2026-04-21 14:10',
    durationMin: 210, sizeGB: 31.5, channels: 312, anomalyCount: 2 },
  { id: 'rec-010', mission: 'Halcyon', aircraft: 'RQ-180-A', date: '2026-04-19 22:45',
    durationMin: 188, sizeGB: 28.1, channels: 308, anomalyCount: 0 },
  { id: 'rec-011', mission: 'Halcyon', aircraft: 'RQ-180-A', date: '2026-04-17 16:30',
    durationMin: 142, sizeGB: 21.4, channels: 304, anomalyCount: 1 },
  { id: 'rec-012', mission: 'Halcyon', aircraft: 'RQ-180-A', date: '2026-04-13 10:08',
    durationMin: 96, sizeGB: 14.5, channels: 310, anomalyCount: 3 },
];

export const RECORDING_DATE_RANGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'last-24h', label: 'Last 24 hours' },
  { id: 'last-7d', label: 'Last 7 days' },
  { id: 'last-30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];
