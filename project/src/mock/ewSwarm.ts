/**
 * Mock 1247-UAV swarm for the EW theater (US-019c).
 *
 * Deterministic — same seed yields the same fleet so render snapshots stay
 * stable. 6 squadrons mirror public/app/ew.jsx makeSwarm distribution
 * (RECON, EW JAM, STRIKE, SEAD, DECOY, ISR LOITER).
 */

export interface EwUavPoint {
  id: string;
  squad: string;
  mission: string;
  x: number;
  y: number;
  alt: number;
  heading: number;
}

export interface EwSquadDef {
  id: string;
  mission: string;
  count: number;
  cx: number;
  cy: number;
  spread: number;
}

const THEATER_W = 1600;
const THEATER_H = 900;

function squads(total: number): EwSquadDef[] {
  return [
    { id: 'ALPHA-RECON', mission: 'RECON', count: Math.floor(total * 0.18), cx: THEATER_W * 0.22, cy: THEATER_H * 0.30, spread: 90 },
    { id: 'BRAVO-EW', mission: 'EW JAM', count: Math.floor(total * 0.22), cx: THEATER_W * 0.40, cy: THEATER_H * 0.45, spread: 110 },
    { id: 'CHARLIE-STRK', mission: 'STRIKE', count: Math.floor(total * 0.20), cx: THEATER_W * 0.55, cy: THEATER_H * 0.60, spread: 70 },
    { id: 'DELTA-SEAD', mission: 'SEAD', count: Math.floor(total * 0.15), cx: THEATER_W * 0.65, cy: THEATER_H * 0.40, spread: 80 },
    { id: 'ECHO-DECOY', mission: 'DECOY', count: Math.floor(total * 0.15), cx: THEATER_W * 0.30, cy: THEATER_H * 0.65, spread: 100 },
    { id: 'FOXTROT-ISR', mission: 'ISR LOITER', count: Math.floor(total * 0.10), cx: THEATER_W * 0.78, cy: THEATER_H * 0.70, spread: 65 },
  ];
}

/**
 * Deterministic seeded RNG (mulberry32). Returns numbers in [0,1).
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build the EW swarm. Default total is 1247 to match the prototype banner.
 */
export function buildEwSwarmMock(seed = 7, total = 1247): EwUavPoint[] {
  const rand = mulberry32(seed);
  const list: EwUavPoint[] = [];
  let id = 0;
  for (const sq of squads(total)) {
    for (let i = 0; i < sq.count; i++) {
      const a = (i / Math.max(sq.count, 1)) * Math.PI * 2 + rand() * 0.4;
      const r = sq.spread * (0.3 + rand() * 0.7);
      list.push({
        id: 'UAV-' + (1000 + id).toString(36).toUpperCase(),
        squad: sq.id,
        mission: sq.mission,
        x: sq.cx + Math.cos(a) * r,
        y: sq.cy + Math.sin(a) * r,
        alt: 1500 + Math.floor(rand() * 4500),
        heading: a + Math.PI / 2,
      });
      id++;
    }
  }
  return list;
}

export const EW_SQUAD_LIST = squads(1247);

export const EW_THEATER_DIMENSIONS = { width: THEATER_W, height: THEATER_H };
