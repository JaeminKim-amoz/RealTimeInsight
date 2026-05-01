/**
 * GPS LOS / sky-plot pure helpers (US-018d / US-3-003).
 *
 * Sky-plot rendering math (polar → Cartesian) and a deterministic mock
 * GNSS constellation matching the prototype's 21-sat (8 GPS / 4 GLO /
 * 5 GAL / 4 BDS) layout.  DOP estimates are derived from the live count
 * of "used" satellites.
 */

export interface MockGpsSat {
  prn: string;
  system: 'GPS' | 'GLO' | 'GAL' | 'BDS';
  elevationDeg: number;
  azimuthDeg: number;
  signalStrength: number;
  used: boolean;
}

/** Convert (elevationDeg, azimuthDeg) sky-plot coords to SVG x/y. */
export function polarToSvg(
  elevationDeg: number,
  azimuthDeg: number,
  radius: number
): { x: number; y: number } {
  const r = ((90 - elevationDeg) / 90) * radius;
  const az = (azimuthDeg * Math.PI) / 180;
  return {
    x: Math.sin(az) * r,
    y: -Math.cos(az) * r,
  };
}

interface ConstDef {
  sys: MockGpsSat['system'];
  prns: ReadonlyArray<string>;
}

const CONSTELLATIONS: ReadonlyArray<ConstDef> = [
  { sys: 'GPS', prns: ['G02', 'G05', 'G07', 'G12', 'G15', 'G24', 'G29', 'G31'] },
  { sys: 'GLO', prns: ['R03', 'R09', 'R14', 'R22'] },
  { sys: 'GAL', prns: ['E11', 'E19', 'E24', 'E30', 'E36'] },
  { sys: 'BDS', prns: ['C06', 'C11', 'C19', 'C28'] },
];

/**
 * Mocked 21-satellite GNSS constellation. Deterministic given `t` (tick
 * counter).  Sat azimuth/elevation drift slowly, signal strengths pulse —
 * matches the prototype's az/el oscillation curves.
 */
export function mockGpsConstellation(t: number): MockGpsSat[] {
  const out: MockGpsSat[] = [];
  let i = 0;
  for (const c of CONSTELLATIONS) {
    for (const prn of c.prns) {
      const phase = i * 0.7 + t * 0.005;
      const az = ((Math.sin(phase) * 0.5 + 0.5) * 360 + i * 23) % 360;
      const el = 10 + Math.abs(Math.sin(phase * 1.3 + i)) * 70;
      const snr = 32 + Math.abs(Math.sin(phase * 2 + i * 0.3)) * 18;
      const used = el > 12 && snr > 35;
      out.push({
        prn,
        system: c.sys,
        elevationDeg: el,
        azimuthDeg: az,
        signalStrength: snr,
        used,
      });
      i++;
    }
  }
  return out;
}

export interface DopValues {
  pdop: number;
  hdop: number;
  vdop: number;
  tdop: number;
  gdop: number;
}

export function computeDop(usedCount: number): DopValues {
  const pdop = usedCount >= 4 ? Math.max(1.2, 8 / Math.sqrt(usedCount)) : 99;
  const hdop = pdop * 0.7;
  const vdop = pdop * 0.78;
  const tdop = pdop * 0.42;
  const gdop = Math.sqrt(pdop * pdop + tdop * tdop);
  return { pdop, hdop, vdop, tdop, gdop };
}

export interface DopThreshold {
  name: keyof DopValues;
  label: string;
  target: number;
  display: string;
}

export const DOP_THRESHOLDS: ReadonlyArray<DopThreshold> = [
  { name: 'pdop', label: 'PDOP', target: 2.0, display: '< 2.0' },
  { name: 'hdop', label: 'HDOP', target: 1.5, display: '< 1.5' },
  { name: 'vdop', label: 'VDOP', target: 2.0, display: '< 2.0' },
  { name: 'tdop', label: 'TDOP', target: 1.0, display: '< 1.0' },
  { name: 'gdop', label: 'GDOP', target: 2.5, display: '< 2.5' },
];

export const SLICE1_PDOP = 1.42;

export const SYSTEM_COLOR: Record<MockGpsSat['system'], string> = {
  GPS: '#6bb7d9',
  GLO: '#8bbf7a',
  GAL: '#e5a24a',
  BDS: '#c78fd1',
};
