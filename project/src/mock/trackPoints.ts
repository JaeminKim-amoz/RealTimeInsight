/**
 * Mock sortie track ported from public/app/data.jsx TRACK_POINTS IIFE.
 *
 * Slice 1: pre-computed deterministic 80-point synthesized track. The points
 * are in projected pixel space (matching the prototype's SVG coordinate
 * system). Real GPS-projected coordinates land in slice 2 with MapLibre.
 */

import type { TrackPoint } from '../types/domain';

function buildTrack(): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < 80; i++) {
    const t = i / 80;
    const x = 120 + t * 480 + Math.sin(t * 6) * 40;
    const y = 400 - t * 260 + Math.cos(t * 4) * 20;
    out.push({ x, y, t });
  }
  return out;
}

export const TRACK_POINTS: ReadonlyArray<TrackPoint> = Object.freeze(buildTrack());
