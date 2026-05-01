/**
 * Mock channel taxonomy ported from public/app/data.jsx CHANNEL_GROUPS.
 *
 * Schema: spec §10.1 ChannelSummary. The prototype data.jsx schema has
 * single-letter `type` codes (A/D/P/S/V) which we expand to full ChannelType.
 *
 * Slice-1 scope: 36 channels across 6 groups (Power, Hydraulic, Pose, RF, Nav, Video).
 */

import type { ChannelGroup, ChannelSummary, ChannelType, QualityPolicy } from '../types/domain';

interface RawChannelDef {
  id: number;
  name: string;
  display: string;
  unit: string;
  /** prototype single-letter code: A=analog, D=discrete, P=pose3d, S=spectrum, V=video-ref */
  type: 'A' | 'D' | 'P' | 'S' | 'V';
  group: string;
  rate: number;
  alarm?: boolean;
  fav?: boolean;
}

interface RawGroupDef {
  id: string;
  name: string;
  count: number;
  children: RawChannelDef[];
}

const TYPE_MAP: Record<RawChannelDef['type'], ChannelType> = {
  A: 'analog',
  D: 'discrete',
  P: 'pose3d',
  S: 'spectrum',
  V: 'video-ref',
};

function deriveQualityPolicy(raw: RawChannelDef): QualityPolicy {
  if (raw.alarm) return 'good-crc-only';
  if (raw.type === 'V' || raw.type === 'S') return 'keep-all';
  return 'good-crc-only';
}

function deriveTags(raw: RawChannelDef): string[] {
  const tags: string[] = [raw.group.toLowerCase()];
  if (raw.alarm) tags.push('alarmed');
  if (raw.fav) tags.push('favorite');
  if (raw.type === 'A') tags.push('analog');
  if (raw.type === 'D') tags.push('discrete');
  if (raw.type === 'S') tags.push('spectrum');
  if (raw.type === 'V') tags.push('video-linked');
  if (raw.type === 'P') tags.push('pose');
  if (raw.unit === 'V' || raw.unit === 'A' || raw.name.startsWith('bus_')) tags.push('power-related');
  return tags;
}

const RAW_GROUPS: RawGroupDef[] = [
  {
    id: 'power',
    name: 'Power',
    count: 12,
    children: [
      { id: 1001, name: 'bus_voltage', display: 'Bus Voltage 28V', unit: 'V', type: 'A', group: 'Power', rate: 200, fav: true },
      { id: 1002, name: 'bus_current', display: 'Bus Current', unit: 'A', type: 'A', group: 'Power', rate: 200, fav: true },
      { id: 1003, name: 'batt_voltage', display: 'Battery Voltage', unit: 'V', type: 'A', group: 'Power', rate: 50 },
      { id: 1004, name: 'batt_temp', display: 'Battery Temp', unit: '°C', type: 'A', group: 'Power', rate: 10 },
      { id: 1005, name: 'gen_rpm', display: 'Generator RPM', unit: 'rpm', type: 'A', group: 'Power', rate: 50 },
      { id: 1006, name: 'inverter_status', display: 'Inverter Status', unit: '', type: 'D', group: 'Power', rate: 1 },
      { id: 1007, name: 'pdu_bit_status', display: 'PDU BIT', unit: 'bit', type: 'D', group: 'Power', rate: 1 },
      { id: 1008, name: 'avionics_pwr', display: 'Avionics Power', unit: '', type: 'D', group: 'Power', rate: 1 },
    ],
  },
  {
    id: 'hydraulic',
    name: 'Hydraulic',
    count: 8,
    children: [
      { id: 1205, name: 'hyd_pressure_1', display: 'Hydraulic Press. A', unit: 'bar', type: 'A', group: 'Hydraulic', rate: 200, alarm: true, fav: true },
      { id: 1206, name: 'hyd_pressure_2', display: 'Hydraulic Press. B', unit: 'bar', type: 'A', group: 'Hydraulic', rate: 200 },
      { id: 1207, name: 'hyd_temp', display: 'Hydraulic Temp', unit: '°C', type: 'A', group: 'Hydraulic', rate: 10 },
      { id: 1208, name: 'hyd_flow', display: 'Hydraulic Flow', unit: 'lpm', type: 'A', group: 'Hydraulic', rate: 50 },
      { id: 1209, name: 'reservoir_level', display: 'Reservoir Level', unit: '%', type: 'A', group: 'Hydraulic', rate: 1 },
      { id: 1210, name: 'hyd_bypass', display: 'Hyd Bypass Valve', unit: '', type: 'D', group: 'Hydraulic', rate: 1 },
    ],
  },
  {
    id: 'pose',
    name: 'Attitude & Pose',
    count: 9,
    children: [
      { id: 2210, name: 'rpy_roll', display: 'Roll', unit: 'deg', type: 'P', group: 'Pose', rate: 100, fav: true },
      { id: 2211, name: 'rpy_pitch', display: 'Pitch', unit: 'deg', type: 'P', group: 'Pose', rate: 100, fav: true },
      { id: 2212, name: 'rpy_yaw', display: 'Yaw', unit: 'deg', type: 'P', group: 'Pose', rate: 100 },
      { id: 2213, name: 'accel_x', display: 'Accel X', unit: 'g', type: 'A', group: 'Pose', rate: 200 },
      { id: 2214, name: 'accel_y', display: 'Accel Y', unit: 'g', type: 'A', group: 'Pose', rate: 200 },
      { id: 2215, name: 'accel_z', display: 'Accel Z', unit: 'g', type: 'A', group: 'Pose', rate: 200 },
      { id: 2216, name: 'gyro_x', display: 'Gyro X', unit: 'dps', type: 'A', group: 'Pose', rate: 200 },
      { id: 2217, name: 'mach', display: 'Mach', unit: '', type: 'A', group: 'Pose', rate: 50 },
      { id: 2218, name: 'aoa', display: 'Angle of Attack', unit: 'deg', type: 'A', group: 'Pose', rate: 100 },
    ],
  },
  {
    id: 'rf',
    name: 'RF / Comms',
    count: 6,
    children: [
      { id: 5001, name: 'rf_spectrum', display: 'RF Spectrum L-band', unit: 'dBm', type: 'S', group: 'RF', rate: 1, fav: true },
      { id: 5002, name: 'rf_rssi', display: 'Link RSSI', unit: 'dBm', type: 'A', group: 'RF', rate: 10 },
      { id: 5003, name: 'link_snr', display: 'Link SNR', unit: 'dB', type: 'A', group: 'RF', rate: 10 },
      { id: 5004, name: 'crypto_state', display: 'Crypto State', unit: '', type: 'D', group: 'RF', rate: 1 },
      { id: 5005, name: 'antenna_select', display: 'Antenna Select', unit: '', type: 'D', group: 'RF', rate: 1 },
    ],
  },
  {
    id: 'nav',
    name: 'Navigation',
    count: 7,
    children: [
      { id: 3001, name: 'gps_lat', display: 'GPS Latitude', unit: 'deg', type: 'A', group: 'Nav', rate: 10 },
      { id: 3002, name: 'gps_lon', display: 'GPS Longitude', unit: 'deg', type: 'A', group: 'Nav', rate: 10 },
      { id: 3003, name: 'gps_alt', display: 'GPS Altitude', unit: 'm', type: 'A', group: 'Nav', rate: 10 },
      { id: 3004, name: 'gps_hdop', display: 'GPS HDOP', unit: '', type: 'A', group: 'Nav', rate: 1 },
      { id: 3005, name: 'gps_sats', display: 'GPS Satellites', unit: '', type: 'A', group: 'Nav', rate: 1 },
      { id: 3006, name: 'inertial_drift', display: 'Inertial Drift', unit: 'm', type: 'A', group: 'Nav', rate: 1 },
    ],
  },
  {
    id: 'video',
    name: 'Video / EO',
    count: 3,
    children: [
      { id: 7001, name: 'cam_front', display: 'Front EO Camera', unit: '', type: 'V', group: 'Video', rate: 30 },
      { id: 7002, name: 'cam_belly', display: 'Belly IR Camera', unit: '', type: 'V', group: 'Video', rate: 30 },
    ],
  },
];

function toChannelSummary(raw: RawChannelDef): ChannelSummary {
  return {
    channelId: raw.id,
    name: raw.name,
    displayName: raw.display,
    group: raw.group,
    unit: raw.unit || undefined,
    channelType: TYPE_MAP[raw.type],
    sampleRateHz: raw.rate,
    qualityPolicy: deriveQualityPolicy(raw),
    tags: deriveTags(raw),
    favorite: raw.fav === true,
    alarmArmed: raw.alarm === true,
  };
}

export const CHANNEL_GROUPS: ChannelGroup[] = RAW_GROUPS.map((g) => ({
  id: g.id,
  name: g.name,
  count: g.count,
  children: g.children.map(toChannelSummary),
}));

export const ALL_CHANNELS: ChannelSummary[] = CHANNEL_GROUPS.flatMap((g) => g.children);

export const CH: Readonly<Record<number, ChannelSummary>> = Object.freeze(
  Object.fromEntries(ALL_CHANNELS.map((c) => [c.channelId, c]))
);

export function lookupChannel(channelId: number): ChannelSummary | undefined {
  return CH[channelId];
}

/**
 * Series color palette keyed by channel id, mirroring public/app/data.jsx SERIES_COLOR.
 * Uses CSS custom properties (resolved by styles.css :root tokens at runtime).
 */
export const SERIES_COLOR: Readonly<Record<number, string>> = Object.freeze({
  1001: 'var(--s1)',
  1002: 'var(--s2)',
  1003: 'var(--s6)',
  1004: 'var(--s4)',
  1205: 'var(--s4)',
  1206: 'var(--s7)',
  1207: 'var(--s8)',
  2210: 'var(--s3)',
  2211: 'var(--s2)',
  2212: 'var(--s5)',
  2213: 'var(--s1)',
  2214: 'var(--s3)',
  2215: 'var(--s5)',
  5002: 'var(--s6)',
  5003: 'var(--s7)',
});

const FALLBACK_PALETTE = [
  'var(--s1)',
  'var(--s2)',
  'var(--s3)',
  'var(--s4)',
  'var(--s5)',
  'var(--s6)',
  'var(--s7)',
  'var(--s8)',
];

export function colorFor(channelId: number, fallbackIndex = 0): string {
  return SERIES_COLOR[channelId] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length];
}

/**
 * Search helper: case-insensitive substring match against name, display, group, unit, channelType, id.
 * Mirrors prototype shell.jsx ChannelExplorer behavior.
 */
export function searchChannels(query: string): ChannelSummary[] {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return ALL_CHANNELS;
  return ALL_CHANNELS.filter((c) =>
    [
      c.name,
      c.displayName,
      c.group,
      c.unit ?? '',
      c.channelType,
      String(c.channelId),
      ...c.tags,
    ]
      .some((value) => value.toLowerCase().includes(normalized))
  );
}
