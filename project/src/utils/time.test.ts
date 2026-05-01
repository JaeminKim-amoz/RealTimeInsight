import { describe, it, expect } from 'vitest';
import { formatTimeNs } from './time';

describe('utils/time formatTimeNs', () => {
  it('formats zero as 00:00.000', () => {
    expect(formatTimeNs('0')).toBe('00:00.000');
  });

  it('formats one second as 00:01.000', () => {
    expect(formatTimeNs('1000000000')).toBe('00:01.000');
  });

  it('formats 30s mid-fixture as 00:30.000', () => {
    expect(formatTimeNs('30000000000')).toBe('00:30.000');
  });

  it('formats 60s as 01:00.000', () => {
    expect(formatTimeNs('60000000000')).toBe('01:00.000');
  });

  it('formats sub-second with millisecond precision', () => {
    // 1.234s → 1234 ms
    expect(formatTimeNs('1234000000')).toBe('00:01.234');
  });

  it('zero-pads single-digit milliseconds (5ms → .005)', () => {
    expect(formatTimeNs('5000000')).toBe('00:00.005');
  });

  it('zero-pads two-digit milliseconds (42ms → .042)', () => {
    expect(formatTimeNs('42000000')).toBe('00:00.042');
  });

  it('falls back to 00:00.000 for non-numeric input', () => {
    expect(formatTimeNs('abc')).toBe('00:00.000');
  });

  it('clamps negative input to 00:00.000', () => {
    expect(formatTimeNs('-1000')).toBe('00:00.000');
  });

  it('round-trips 10s precisely', () => {
    expect(formatTimeNs('10000000000')).toBe('00:10.000');
  });
});
