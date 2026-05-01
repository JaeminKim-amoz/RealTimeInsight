import { describe, it, expect } from 'vitest';
import { CHANNEL_GROUPS, ALL_CHANNELS, CH, lookupChannel } from './channels';
import type { ChannelSummary } from '../types/domain';

describe('mock/channels', () => {
  it('exposes 6 channel groups (Power, Hydraulic, Pose, RF, Nav, Video)', () => {
    expect(CHANNEL_GROUPS).toHaveLength(6);
    const ids = CHANNEL_GROUPS.map((g) => g.id);
    expect(ids).toEqual(['power', 'hydraulic', 'pose', 'rf', 'nav', 'video']);
  });

  it('flattens to 36 ChannelSummary records (US-001 acceptance)', () => {
    expect(ALL_CHANNELS).toHaveLength(36);
  });

  it('contains channel #1001 Bus Voltage 28V with analog channelType, V unit, 200 Hz sample rate', () => {
    const ch = ALL_CHANNELS.find((c) => c.channelId === 1001);
    expect(ch).toBeDefined();
    expect(ch).toMatchObject<Partial<ChannelSummary>>({
      channelId: 1001,
      name: 'bus_voltage',
      displayName: 'Bus Voltage 28V',
      group: 'Power',
      unit: 'V',
      channelType: 'analog',
      sampleRateHz: 200,
    });
  });

  it('contains channel #2210 Roll with pose3d channelType, deg unit, 100 Hz sample rate', () => {
    const ch = ALL_CHANNELS.find((c) => c.channelId === 2210);
    expect(ch).toBeDefined();
    expect(ch?.channelType).toBe('pose3d');
    expect(ch?.unit).toBe('deg');
    expect(ch?.sampleRateHz).toBe(100);
  });

  it('contains channel #5001 RF Spectrum L-band with spectrum channelType', () => {
    const ch = ALL_CHANNELS.find((c) => c.channelId === 5001);
    expect(ch?.channelType).toBe('spectrum');
    expect(ch?.unit).toBe('dBm');
  });

  it('contains channel #1007 PDU BIT with discrete channelType', () => {
    const ch = ALL_CHANNELS.find((c) => c.channelId === 1007);
    expect(ch?.channelType).toBe('discrete');
  });

  it('contains channel #7001 Front EO Camera with video-ref channelType', () => {
    const ch = ALL_CHANNELS.find((c) => c.channelId === 7001);
    expect(ch?.channelType).toBe('video-ref');
  });

  it('CH lookup map indexes every channel by channelId', () => {
    expect(Object.keys(CH)).toHaveLength(36);
    expect(CH[1001]?.name).toBe('bus_voltage');
    expect(CH[2210]?.name).toBe('rpy_roll');
  });

  it('lookupChannel returns undefined for unknown id', () => {
    expect(lookupChannel(99999)).toBeUndefined();
    expect(lookupChannel(1001)?.name).toBe('bus_voltage');
  });

  it('every channel has a non-empty tags array', () => {
    for (const ch of ALL_CHANNELS) {
      expect(Array.isArray(ch.tags)).toBe(true);
      expect(ch.tags.length).toBeGreaterThan(0);
    }
  });

  it('alarm-armed channels include hyd_pressure_1 (#1205)', () => {
    const armed = ALL_CHANNELS.filter((c) => c.alarmArmed);
    expect(armed.map((c) => c.channelId)).toContain(1205);
  });

  it('favorite channels include 1001, 1002, 1205, 2210, 2211, 5001', () => {
    const favs = ALL_CHANNELS.filter((c) => c.favorite).map((c) => c.channelId);
    expect(favs).toEqual(expect.arrayContaining([1001, 1002, 1205, 2210, 2211, 5001]));
  });
});
