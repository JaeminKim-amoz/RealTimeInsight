import { describe, it, expect } from 'vitest';
import { EVENTS } from './events';

describe('mock/events', () => {
  it('exposes 9 events from the prototype data.jsx', () => {
    expect(EVENTS).toHaveLength(9);
  });

  it('contains the HYD.SPIKE high-severity anomaly anchor at t=182.340s', () => {
    const ev = EVENTS.find((e) => e.code === 'HYD.SPIKE');
    expect(ev).toBeDefined();
    expect(ev?.severity).toBe('high');
    expect(ev?.channelId).toBe(1205);
    expect(ev?.timestampSec).toBeCloseTo(182.34, 3);
  });

  it('contains CRC.BURST event with null channelId (system-wide)', () => {
    const ev = EVENTS.find((e) => e.code === 'CRC.BURST');
    expect(ev?.channelId).toBeNull();
  });

  it('every event has a non-empty message', () => {
    for (const ev of EVENTS) {
      expect(typeof ev.message).toBe('string');
      expect(ev.message.length).toBeGreaterThan(0);
    }
  });
});
