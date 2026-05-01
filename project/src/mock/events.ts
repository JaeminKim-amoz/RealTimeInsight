/**
 * Mock event log ported from public/app/data.jsx EVENTS array.
 *
 * Spec: BottomConsole + EventLogPanel data source.
 * Severity codes mapped from prototype: 'high'/'med'/'low'/'info' (we keep `medium` full name).
 */

import type { EventDescriptor, EventSeverity } from '../types/domain';

interface RawEvent {
  t: number;
  sev: 'high' | 'med' | 'low' | 'info';
  code: string;
  ch: number | null;
  msg: string;
}

const SEV_MAP: Record<RawEvent['sev'], EventSeverity> = {
  high: 'high',
  med: 'medium',
  low: 'low',
  info: 'info',
};

const RAW: RawEvent[] = [
  { t: 182.34, sev: 'high', code: 'HYD.SPIKE', ch: 1205, msg: 'Hydraulic pressure transient +28 bar in 0.3s' },
  { t: 182.341, sev: 'med', code: 'PWR.DIP', ch: 1001, msg: 'Bus voltage transient dip to 26.8V' },
  { t: 182.36, sev: 'med', code: 'CRC.BURST', ch: null, msg: 'CRC failure burst on frame-id 0x2A (14 frames)' },
  { t: 181.87, sev: 'low', code: 'SYNC.LOSS', ch: null, msg: 'Decoder sync loss regained after 45ms' },
  { t: 181.12, sev: 'info', code: 'RUN.MARK', ch: null, msg: 'Operator bookmark — "climb segment start"' },
  { t: 180.003, sev: 'med', code: 'RF.RSSI.LOW', ch: 5002, msg: 'Link RSSI below -75 dBm for 2.1s' },
  { t: 179.82, sev: 'high', code: 'AOA.HIGH', ch: 2218, msg: 'AoA exceeded warn threshold (14.2°)' },
  { t: 178.44, sev: 'info', code: 'VID.DISCONT', ch: 7001, msg: 'Video discontinuity on cam_front' },
  { t: 177.001, sev: 'low', code: 'DECODE.STALE', ch: 1007, msg: 'PDU BIT frame stale >250ms' },
];

export const EVENTS: ReadonlyArray<EventDescriptor> = Object.freeze(
  RAW.map((r) => ({
    timestampSec: r.t,
    severity: SEV_MAP[r.sev],
    code: r.code,
    channelId: r.ch,
    message: r.msg,
  }))
);
