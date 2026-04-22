const CHANNEL_GROUPS = [
  {
    id: 'pcm',
    name: 'PCM Receiver',
    children: [
      { id: 8001, name: 'frame_counter', display: 'Frame Counter', unit: '', type: 'counter', rate: 200 },
      { id: 8004, name: 'subcom_phase', display: 'Subcom Phase', unit: '', type: 'discrete', rate: 200 },
      { id: 8008, name: 'crc_bad_frames', display: 'CRC Bad Frames', unit: '', type: 'counter', rate: 1 },
    ],
  },
  {
    id: 'power',
    name: 'Power',
    children: [
      { id: 1001, name: 'bus_voltage', display: 'Bus Voltage 28V', unit: 'V', type: 'analog', rate: 200 },
      { id: 1002, name: 'bus_current', display: 'Bus Current', unit: 'A', type: 'analog', rate: 200 },
    ],
  },
  {
    id: 'hydraulic',
    name: 'Hydraulic',
    children: [
      { id: 1205, name: 'hyd_pressure_1', display: 'Hydraulic Press. A', unit: 'bar', type: 'analog', rate: 200 },
      { id: 1206, name: 'hyd_pressure_2', display: 'Hydraulic Press. B', unit: 'bar', type: 'analog', rate: 200 },
    ],
  },
  {
    id: 'attitude',
    name: 'Attitude',
    children: [
      { id: 2210, name: 'rpy_roll', display: 'Roll', unit: 'deg', type: 'pose', rate: 100 },
      { id: 2211, name: 'rpy_pitch', display: 'Pitch', unit: 'deg', type: 'pose', rate: 100 },
      { id: 2212, name: 'rpy_yaw', display: 'Yaw', unit: 'deg', type: 'pose', rate: 100 },
    ],
  },
  {
    id: 'rf',
    name: 'RF / Comms',
    children: [
      { id: 5002, name: 'rf_rssi', display: 'Link RSSI', unit: 'dBm', type: 'analog', rate: 10 },
      { id: 5003, name: 'link_snr', display: 'Link SNR', unit: 'dB', type: 'analog', rate: 10 },
    ],
  },
];

const ALL_CHANNELS = CHANNEL_GROUPS.flatMap((group) =>
  group.children.map((channel) => ({ ...channel, group: group.name, groupId: group.id }))
);

function searchChannels(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return ALL_CHANNELS;
  return ALL_CHANNELS.filter((channel) =>
    [channel.name, channel.display, channel.group, channel.unit, channel.type, String(channel.id)]
      .some((value) => value.toLowerCase().includes(q))
  );
}

module.exports = { CHANNEL_GROUPS, ALL_CHANNELS, searchChannels };
