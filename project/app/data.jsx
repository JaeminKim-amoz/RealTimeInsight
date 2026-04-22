// Mock flight-test telemetry data for RealTimeInsight

const CHANNEL_GROUPS = [
  {
    id: 'power', name: 'Power', count: 12, children: [
      { id: 1001, name: 'bus_voltage',     display: 'Bus Voltage 28V',    unit: 'V',   type: 'A', group: 'Power', rate: 200, alarm: false, fav: true },
      { id: 1002, name: 'bus_current',     display: 'Bus Current',        unit: 'A',   type: 'A', group: 'Power', rate: 200, alarm: false, fav: true },
      { id: 1003, name: 'batt_voltage',    display: 'Battery Voltage',    unit: 'V',   type: 'A', group: 'Power', rate: 50,  alarm: false },
      { id: 1004, name: 'batt_temp',       display: 'Battery Temp',       unit: '°C',  type: 'A', group: 'Power', rate: 10,  alarm: false },
      { id: 1005, name: 'gen_rpm',         display: 'Generator RPM',      unit: 'rpm', type: 'A', group: 'Power', rate: 50,  alarm: false },
      { id: 1006, name: 'inverter_status', display: 'Inverter Status',    unit: '',    type: 'D', group: 'Power', rate: 1,   alarm: false },
      { id: 1007, name: 'pdu_bit_status',  display: 'PDU BIT',            unit: 'bit', type: 'D', group: 'Power', rate: 1,   alarm: false },
      { id: 1008, name: 'avionics_pwr',    display: 'Avionics Power',     unit: '',    type: 'D', group: 'Power', rate: 1,   alarm: false },
    ]
  },
  {
    id: 'hydraulic', name: 'Hydraulic', count: 8, children: [
      { id: 1205, name: 'hyd_pressure_1',  display: 'Hydraulic Press. A', unit: 'bar', type: 'A', group: 'Hydraulic', rate: 200, alarm: true,  fav: true },
      { id: 1206, name: 'hyd_pressure_2',  display: 'Hydraulic Press. B', unit: 'bar', type: 'A', group: 'Hydraulic', rate: 200, alarm: false },
      { id: 1207, name: 'hyd_temp',        display: 'Hydraulic Temp',     unit: '°C',  type: 'A', group: 'Hydraulic', rate: 10,  alarm: false },
      { id: 1208, name: 'hyd_flow',        display: 'Hydraulic Flow',     unit: 'lpm', type: 'A', group: 'Hydraulic', rate: 50,  alarm: false },
      { id: 1209, name: 'reservoir_level', display: 'Reservoir Level',    unit: '%',   type: 'A', group: 'Hydraulic', rate: 1,   alarm: false },
      { id: 1210, name: 'hyd_bypass',      display: 'Hyd Bypass Valve',   unit: '',    type: 'D', group: 'Hydraulic', rate: 1,   alarm: false },
    ]
  },
  {
    id: 'pose', name: 'Attitude & Pose', count: 9, children: [
      { id: 2210, name: 'rpy_roll',        display: 'Roll',               unit: 'deg', type: 'P', group: 'Pose', rate: 100, alarm: false, fav: true },
      { id: 2211, name: 'rpy_pitch',       display: 'Pitch',              unit: 'deg', type: 'P', group: 'Pose', rate: 100, alarm: false, fav: true },
      { id: 2212, name: 'rpy_yaw',         display: 'Yaw',                unit: 'deg', type: 'P', group: 'Pose', rate: 100, alarm: false },
      { id: 2213, name: 'accel_x',         display: 'Accel X',            unit: 'g',   type: 'A', group: 'Pose', rate: 200, alarm: false },
      { id: 2214, name: 'accel_y',         display: 'Accel Y',            unit: 'g',   type: 'A', group: 'Pose', rate: 200, alarm: false },
      { id: 2215, name: 'accel_z',         display: 'Accel Z',            unit: 'g',   type: 'A', group: 'Pose', rate: 200, alarm: false },
      { id: 2216, name: 'gyro_x',          display: 'Gyro X',             unit: 'dps', type: 'A', group: 'Pose', rate: 200, alarm: false },
      { id: 2217, name: 'mach',            display: 'Mach',               unit: '',    type: 'A', group: 'Pose', rate: 50,  alarm: false },
      { id: 2218, name: 'aoa',             display: 'Angle of Attack',    unit: 'deg', type: 'A', group: 'Pose', rate: 100, alarm: false },
    ]
  },
  {
    id: 'rf', name: 'RF / Comms', count: 6, children: [
      { id: 5001, name: 'rf_spectrum',     display: 'RF Spectrum L-band', unit: 'dBm', type: 'S', group: 'RF', rate: 1,   alarm: false, fav: true },
      { id: 5002, name: 'rf_rssi',         display: 'Link RSSI',          unit: 'dBm', type: 'A', group: 'RF', rate: 10,  alarm: false },
      { id: 5003, name: 'link_snr',        display: 'Link SNR',           unit: 'dB',  type: 'A', group: 'RF', rate: 10,  alarm: false },
      { id: 5004, name: 'crypto_state',    display: 'Crypto State',       unit: '',    type: 'D', group: 'RF', rate: 1,   alarm: false },
      { id: 5005, name: 'antenna_select',  display: 'Antenna Select',     unit: '',    type: 'D', group: 'RF', rate: 1,   alarm: false },
    ]
  },
  {
    id: 'nav', name: 'Navigation', count: 7, children: [
      { id: 3001, name: 'gps_lat',         display: 'GPS Latitude',       unit: 'deg', type: 'A', group: 'Nav', rate: 10, alarm: false },
      { id: 3002, name: 'gps_lon',         display: 'GPS Longitude',      unit: 'deg', type: 'A', group: 'Nav', rate: 10, alarm: false },
      { id: 3003, name: 'gps_alt',         display: 'GPS Altitude',       unit: 'm',   type: 'A', group: 'Nav', rate: 10, alarm: false },
      { id: 3004, name: 'gps_hdop',        display: 'GPS HDOP',           unit: '',    type: 'A', group: 'Nav', rate: 1,  alarm: false },
      { id: 3005, name: 'gps_sats',        display: 'GPS Satellites',     unit: '',    type: 'A', group: 'Nav', rate: 1,  alarm: false },
      { id: 3006, name: 'inertial_drift',  display: 'Inertial Drift',     unit: 'm',   type: 'A', group: 'Nav', rate: 1,  alarm: false },
    ]
  },
  {
    id: 'video', name: 'Video / EO', count: 3, children: [
      { id: 7001, name: 'cam_front',       display: 'Front EO Camera',    unit: '',    type: 'V', group: 'Video', rate: 30, alarm: false },
      { id: 7002, name: 'cam_belly',       display: 'Belly IR Camera',    unit: '',    type: 'V', group: 'Video', rate: 30, alarm: false },
    ]
  },
  {
    id: 'pcm', name: 'PCM Receiver', count: 6, children: [
      { id: 8001, name: 'frame_counter',   display: 'Frame Counter',       unit: '',    type: 'C', group: 'PCM', rate: 200, alarm: false },
      { id: 8004, name: 'subcom_phase',    display: 'Subcom Phase',        unit: '',    type: 'D', group: 'PCM', rate: 200, alarm: false },
      { id: 8005, name: 'bit_slip',        display: 'Recovered Bit Slip',  unit: 'bit', type: 'A', group: 'PCM', rate: 1,   alarm: false },
      { id: 8006, name: 'crc_valid',       display: 'CRC Valid',           unit: '',    type: 'D', group: 'PCM', rate: 200, alarm: false },
      { id: 8007, name: 'sync_matches',    display: 'Sync Matches',        unit: '',    type: 'C', group: 'PCM', rate: 1,   alarm: false },
      { id: 8008, name: 'crc_bad_frames',  display: 'CRC Bad Frames',      unit: '',    type: 'C', group: 'PCM', rate: 1,   alarm: true },
    ]
  },
];

const ALL_CHANNELS = CHANNEL_GROUPS.flatMap(g => g.children);
const CH = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, c]));

// Series colors keyed to channel
const SERIES_COLOR = {
  1001: 'var(--s1)', 1002: 'var(--s2)', 1003: 'var(--s6)', 1004: 'var(--s4)',
  1205: 'var(--s4)', 1206: 'var(--s7)', 1207: 'var(--s8)',
  2210: 'var(--s3)', 2211: 'var(--s2)', 2212: 'var(--s5)',
  2213: 'var(--s1)', 2214: 'var(--s3)', 2215: 'var(--s5)',
  5002: 'var(--s6)', 5003: 'var(--s7)',
};
const colorFor = (id, i=0) =>
  SERIES_COLOR[id] || ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)'][i % 8];

// Synthetic series generator — deterministic
function gen(id, n, t0) {
  const out = new Array(n);
  const seed = id * 1.37;
  for (let i = 0; i < n; i++) {
    const t = t0 + i;
    let v;
    switch (id) {
      case 1001: v = 28 + Math.sin(t*0.08 + seed)*0.3 + Math.sin(t*0.03)*0.5 + (Math.random()-0.5)*0.15; break;
      case 1002: v = 42 + Math.sin(t*0.05)*6 + Math.cos(t*0.11)*3 + (Math.random()-0.5)*0.8; break;
      case 1205: // hydraulic pressure spike
        v = 207 + Math.sin(t*0.04)*2.5 + (Math.random()-0.5)*1.2;
        if (Math.abs((t % 220) - 180) < 8) v += 28 * Math.exp(-Math.pow((t%220)-180, 2)/15);
        break;
      case 1206: v = 204 + Math.sin(t*0.04 + 0.3)*2 + (Math.random()-0.5)*0.8; break;
      case 2210: v = Math.sin(t*0.06)*22 + Math.sin(t*0.12)*4; break;
      case 2211: v = Math.cos(t*0.05)*8 + Math.sin(t*0.14)*2; break;
      case 2212: v = ((t*0.8) % 360) - 180; break;
      case 2213: v = Math.sin(t*0.22)*0.4 + (Math.random()-0.5)*0.05; break;
      case 2214: v = Math.cos(t*0.2)*0.3 + (Math.random()-0.5)*0.05; break;
      case 2215: v = 1 + Math.sin(t*0.1)*0.15 + (Math.random()-0.5)*0.04; break;
      case 5002: v = -62 + Math.sin(t*0.03)*4 + (Math.random()-0.5)*2; break;
      case 5003: v = 18 + Math.sin(t*0.04)*3 + (Math.random()-0.5)*1; break;
      default:
        v = Math.sin(t*0.07 + seed) * 10 + Math.cos(t*0.03 + seed*2)*3 + (Math.random()-0.5);
    }
    out[i] = v;
  }
  return out;
}

// Events / alarms
const EVENTS = [
  { t: 182.340, sev: 'high', code: 'HYD.SPIKE',       ch: 1205, msg: 'Hydraulic pressure transient +28 bar in 0.3s' },
  { t: 182.341, sev: 'med',  code: 'PWR.DIP',         ch: 1001, msg: 'Bus voltage transient dip to 26.8V' },
  { t: 182.360, sev: 'med',  code: 'CRC.BURST',       ch: null, msg: 'CRC failure burst on frame-id 0x2A (14 frames)' },
  { t: 182.352, sev: 'info', code: 'PCM.LOCK',        ch: 8001, msg: 'PCM sync locked on 0xFE6B2840 after bit-slip recovery (+5 bits)' },
  { t: 181.870, sev: 'low',  code: 'SYNC.LOSS',       ch: null, msg: 'Decoder sync loss regained after 45ms' },
  { t: 181.120, sev: 'info', code: 'RUN.MARK',        ch: null, msg: 'Operator bookmark — "climb segment start"' },
  { t: 180.003, sev: 'med',  code: 'RF.RSSI.LOW',     ch: 5002, msg: 'Link RSSI below -75 dBm for 2.1s' },
  { t: 179.820, sev: 'high', code: 'AOA.HIGH',        ch: 2218, msg: 'AoA exceeded warn threshold (14.2°)' },
  { t: 178.440, sev: 'info', code: 'VID.DISCONT',     ch: 7001, msg: 'Video discontinuity on cam_front' },
  { t: 177.001, sev: 'low',  code: 'DECODE.STALE',    ch: 1007, msg: 'PDU BIT frame stale >250ms' },
];

// Anomaly (for insight pane demo)
const ANOMALY = {
  id: 'anom-001',
  ch: 1205,
  channelDisplay: 'Hydraulic Pressure A',
  t: 182.340,
  severity: 'HIGH',
  score: 0.93,
  label: 'Pressure spike with correlated current disturbance',
  window: [182.28, 182.44],
  // Candidate root causes
  candidates: [
    { rank: 1, title: 'Bus current transient on CH 1002 — 120ms lead',     confidence: 0.86,
      evidence: ['temporal-lead', 'shared-subsystem', 'formula-dep'],
      why: 'Current spike preceded pressure rise by 120ms; both on Power→Hydraulic bridge formula.' },
    { rank: 2, title: 'PDU BIT fault bit set on CH 1007',                   confidence: 0.72,
      evidence: ['alarm-cooccur', 'same-frame'],
      why: 'Fault bit fired within 80ms window; same decoder frame locality.' },
    { rank: 3, title: 'Hyd bypass valve state transition CH 1210',          confidence: 0.58,
      evidence: ['state-change', 'operator-bookmark'],
      why: 'Valve opened just before spike; previously bookmarked in run 0918.' },
    { rank: 4, title: 'Vibration burst on Accel Z CH 2215',                 confidence: 0.41,
      evidence: ['correlation', 'weak'],
      why: 'Weak correlation (r=0.41) with accel Z envelope in window.' },
  ],
  relatedChannels: [1002, 1007, 1210, 2215, 1206, 5003],
};

// Relation graph nodes & edges (around the anomaly)
const RELGRAPH = {
  root: 'obs-1205',
  nodes: [
    { id: 'obs-1205', kind: 'observation', label: 'Hyd Press. Spike',      score: 0.93 },
    { id: 'ch-1002',  kind: 'channel',     label: 'Bus Current',           score: 0.86 },
    { id: 'ch-1001',  kind: 'channel',     label: 'Bus Voltage',           score: 0.74 },
    { id: 'ch-1007',  kind: 'alarm',       label: 'PDU BIT fault',         score: 0.72 },
    { id: 'ch-1210',  kind: 'channel',     label: 'Hyd Bypass Valve',      score: 0.58 },
    { id: 'ch-2215',  kind: 'channel',     label: 'Accel Z',               score: 0.41 },
    { id: 'ch-1206',  kind: 'channel',     label: 'Hyd Press. B',          score: 0.38 },
    { id: 'crc-2a',   kind: 'crc-cluster', label: 'CRC burst 0x2A',        score: 0.35 },
    { id: 'vid-1',    kind: 'video-event', label: 'Video discontinuity',   score: 0.22 },
    { id: 'rec-1',    kind: 'recommendation', label: 'Compare to run 0918', score: 0.30 },
  ],
  edges: [
    { s: 'obs-1205', t: 'ch-1002',  kind: 'temporal-lead',     w: 0.86, verified: true,  why: '120 ms lead' },
    { s: 'ch-1002',  t: 'ch-1001',  kind: 'formula-dependency',w: 0.74, verified: true,  why: 'P = V·I bridge' },
    { s: 'obs-1205', t: 'ch-1007',  kind: 'shared-frame',      w: 0.72, verified: true,  why: 'same frame 0x2A' },
    { s: 'obs-1205', t: 'ch-1210',  kind: 'shared-subsystem',  w: 0.58, verified: false, why: 'hyd system' },
    { s: 'ch-1210',  t: 'ch-1206',  kind: 'correlation',       w: 0.38, verified: false, why: 'r=0.38' },
    { s: 'obs-1205', t: 'ch-2215',  kind: 'correlation',       w: 0.41, verified: false, why: 'weak r=0.41' },
    { s: 'obs-1205', t: 'crc-2a',   kind: 'shared-frame',      w: 0.35, verified: true,  why: 'frame 0x2A CRC cluster' },
    { s: 'ch-1001',  t: 'vid-1',    kind: 'video-alignment',   w: 0.22, verified: false, why: 't+1.1s' },
    { s: 'obs-1205', t: 'rec-1',    kind: 'operator-bookmark', w: 0.30, verified: true,  why: 'prior run' },
  ]
};

// Platform track for map
const TRACK_POINTS = [];
(function(){
  for (let i = 0; i < 80; i++) {
    const t = i / 80;
    const x = 120 + t*480 + Math.sin(t*6)*40;
    const y = 400 - t*260 + Math.cos(t*4)*20;
    TRACK_POINTS.push({ x, y, t });
  }
})();

Object.assign(window, {
  CHANNEL_GROUPS, ALL_CHANNELS, CH, SERIES_COLOR, colorFor,
  gen, EVENTS, ANOMALY, RELGRAPH, TRACK_POINTS,
});
