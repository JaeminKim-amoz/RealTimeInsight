import { describe, it, expect, beforeEach } from 'vitest';
import {
  RECORDED_BUFFER,
  RECORDED_CHANNEL_IDS,
  RECORDING_DURATION_NS,
  RECORDING_FRAMES_PER_CHANNEL,
  loadRecordingIntoStreamStore,
} from './recording';
import { useStreamStore } from '../store/streamStore';

describe('mock/recording — fixture shape', () => {
  it('exposes RECORDING_DURATION_NS = 60_000_000_000 (60 s)', () => {
    expect(RECORDING_DURATION_NS).toBe(60_000_000_000);
  });

  it('exposes 9 priority slice-2 channel ids', () => {
    const expected = [1001, 1002, 1205, 1206, 2210, 2211, 2212, 5002, 5003];
    expect(Array.from(RECORDED_CHANNEL_IDS)).toEqual(expected);
    expect(RECORDED_CHANNEL_IDS.length).toBe(9);
  });

  it('RECORDED_BUFFER has 9 channel keys, each with 12 000 frames', () => {
    expect(Object.keys(RECORDED_BUFFER).length).toBe(9);
    for (const id of RECORDED_CHANNEL_IDS) {
      const frames = RECORDED_BUFFER[id];
      expect(frames).toBeDefined();
      expect(frames.length).toBe(RECORDING_FRAMES_PER_CHANNEL);
      expect(RECORDING_FRAMES_PER_CHANNEL).toBe(12_000);
    }
  });

  it('frames carry decimal-string timestampNs and finite numeric value', () => {
    const frames = RECORDED_BUFFER[1001];
    const f0 = frames[0];
    expect(typeof f0.timestampNs).toBe('string');
    expect(f0.timestampNs).toBe('0');
    expect(Number.isFinite(f0.value)).toBe(true);

    // Last frame timestamp is at index 11999 → 11999 * 5_000_000 = 59_995_000_000 ns
    const fLast = frames[frames.length - 1];
    expect(fLast.timestampNs).toBe(String(11_999 * 5_000_000));
    expect(Number.isFinite(fLast.value)).toBe(true);
  });

  it('frames are in increasing timestamp order', () => {
    const frames = RECORDED_BUFFER[1205];
    let prev = -1;
    for (let i = 0; i < frames.length; i++) {
      const ns = Number(frames[i].timestampNs);
      expect(ns).toBeGreaterThan(prev);
      prev = ns;
    }
  });
});

describe('mock/recording — loadRecordingIntoStreamStore', () => {
  beforeEach(() => useStreamStore.getState().reset());

  it('subscribes and populates buffers for all 9 channels', () => {
    const idMap = loadRecordingIntoStreamStore();
    const ids = Object.keys(idMap).map((s) => Number(s));
    expect(ids.length).toBe(9);

    const buffers = useStreamStore.getState().buffers;
    for (const channelId of RECORDED_CHANNEL_IDS) {
      const subId = idMap[channelId];
      expect(subId).toBeDefined();
      const buf = buffers[subId];
      expect(buf).toBeDefined();
      expect(buf.length).toBe(RECORDING_FRAMES_PER_CHANNEL);
      expect(buf.frames.length).toBe(RECORDING_FRAMES_PER_CHANNEL);
    }
  });

  it('uses the standard subscribe pattern — registers panelDataRefs entry per channel', () => {
    loadRecordingIntoStreamStore();
    const refs = useStreamStore.getState().panelDataRefs;
    for (const channelId of RECORDED_CHANNEL_IDS) {
      expect(refs[`replay-fixture-${channelId}`]).toBeDefined();
      expect(refs[`replay-fixture-${channelId}`].length).toBe(1);
    }
  });

  it('drains pending queue after load (eventQueueDepth back to 0)', () => {
    loadRecordingIntoStreamStore();
    expect(useStreamStore.getState().performance.eventQueueDepth).toBe(0);
  });
});
