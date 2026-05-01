/**
 * Globe panel mock data (US-3-001) — 18 satellites + 7 threat sites + 2 friendly EW.
 *
 * Mirrors public/app/space.jsx SATELLITES / THREAT_SITES / FRIENDLY_EW arrays
 * exactly so visual fidelity matches the prototype.
 */

export type SatClass = 'GNSS' | 'COMM' | 'EO' | 'SAR' | 'GEO' | 'WX' | 'CREW';

export interface Satellite {
  id: string;
  cls: SatClass;
  alt: number;
  inc: number;
  raan: number;
  /** Hex color as 0xRRGGBB number (Three.js native). */
  color: number;
  period: number;
}

export const SATELLITES: ReadonlyArray<Satellite> = Object.freeze([
  { id: 'GPS-IIF-7',     cls: 'GNSS', alt: 20180, inc: 55, raan:  10, color: 0x6bb7d9, period:  718 },
  { id: 'GPS-IIIA-3',    cls: 'GNSS', alt: 20180, inc: 55, raan:  72, color: 0x6bb7d9, period:  718 },
  { id: 'GPS-IIIA-5',    cls: 'GNSS', alt: 20180, inc: 55, raan: 144, color: 0x6bb7d9, period:  718 },
  { id: 'GLO-K2-12',     cls: 'GNSS', alt: 19130, inc: 64, raan: 198, color: 0x8bbf7a, period:  676 },
  { id: 'GAL-FOC-22',    cls: 'GNSS', alt: 23222, inc: 56, raan: 252, color: 0xe5a24a, period:  845 },
  { id: 'IRIDIUM-115',   cls: 'COMM', alt:   781, inc: 86, raan:  20, color: 0xc78fd1, period:  100 },
  { id: 'IRIDIUM-167',   cls: 'COMM', alt:   781, inc: 86, raan:  92, color: 0xc78fd1, period:  100 },
  { id: 'STARLINK-3221', cls: 'COMM', alt:   550, inc: 53, raan: 130, color: 0x9ec5e8, period:   95 },
  { id: 'STARLINK-4090', cls: 'COMM', alt:   550, inc: 53, raan: 175, color: 0x9ec5e8, period:   95 },
  { id: 'STARLINK-4622', cls: 'COMM', alt:   550, inc: 53, raan: 220, color: 0x9ec5e8, period:   95 },
  { id: 'KH-11-USA-290', cls: 'EO',   alt:   264, inc: 97, raan: 318, color: 0xf0b44a, period:   90 },
  { id: 'LACROSSE-5',    cls: 'SAR',  alt:   718, inc: 57, raan:  45, color: 0xf0b44a, period:   99 },
  { id: 'TES-3',         cls: 'EO',   alt:   605, inc: 97, raan: 280, color: 0xf0b44a, period:   97 },
  { id: 'INMARSAT-5',    cls: 'GEO',  alt: 35786, inc:  0, raan:  64, color: 0xd8634a, period: 1436 },
  { id: 'KOREASAT-6',    cls: 'GEO',  alt: 35786, inc:  0, raan: 116, color: 0xd8634a, period: 1436 },
  { id: 'GOES-18',       cls: 'WX',   alt: 35786, inc:  0, raan: 222, color: 0x6bb7d9, period: 1436 },
  { id: 'TIANGONG',      cls: 'CREW', alt:   389, inc: 41, raan:  65, color: 0xff7a30, period:   92 },
  { id: 'ISS',           cls: 'CREW', alt:   410, inc: 51, raan: 158, color: 0xffd166, period:   93 },
]);

export type ThreatTier = 'high' | 'medium' | 'low';

export interface ThreatSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  range_km: number;
  freq: string;
  threat: ThreatTier;
  count: number;
}

export const THREAT_SITES: ReadonlyArray<ThreatSite> = Object.freeze([
  { id: 'SA-21-K1', name: 'SA-21 Growler · Kaliningrad',  lat: 54.7, lon:  20.5, range_km: 400, freq: 'S-band 2.5–3.0 GHz', threat: 'high',   count: 4 },
  { id: 'SA-20-MR', name: 'SA-20 Gargoyle · Moscow ring', lat: 55.7, lon:  37.6, range_km: 200, freq: 'C/X-band',          threat: 'high',   count: 8 },
  { id: 'HQ-9-SH',  name: 'HQ-9 · East China',            lat: 31.2, lon: 121.5, range_km: 250, freq: 'L/S-band',          threat: 'high',   count: 6 },
  { id: 'HQ-22-PY', name: 'HQ-22 · Pyongyang sector',     lat: 39.0, lon: 125.7, range_km: 170, freq: 'X-band',            threat: 'medium', count: 3 },
  { id: 'S-300-CR', name: 'S-300 · Crimea',               lat: 45.0, lon:  34.1, range_km: 195, freq: 'S-band',            threat: 'medium', count: 2 },
  { id: 'S-400-SY', name: 'S-400 · Latakia',              lat: 35.5, lon:  35.7, range_km: 380, freq: 'X/S-band',          threat: 'high',   count: 2 },
  { id: 'BAVAR-IR', name: 'Bavar-373 · Bandar Abbas',     lat: 27.2, lon:  56.3, range_km: 200, freq: 'S-band 3.1 GHz',    threat: 'medium', count: 3 },
]);

export interface FriendlyEw {
  id: string;
  name: string;
  lat: number;
  lon: number;
  range_km: number;
  freq: string;
  color: string;
}

export const FRIENDLY_EW: ReadonlyArray<FriendlyEw> = Object.freeze([
  { id: 'JAM-A1', name: 'Aegis EW · CSG-9',     lat: 36.0, lon: 142.0, range_km: 280, freq: 'L–Ku', color: '#7aa874' },
  { id: 'JAM-G2', name: 'EA-18G Growler RZN-1', lat: 50.5, lon:  30.8, range_km: 150, freq: 'C–X',  color: '#7aa874' },
]);
