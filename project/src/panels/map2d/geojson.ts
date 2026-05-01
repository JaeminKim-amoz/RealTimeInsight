/**
 * Map2D GeoJSON / inline-style helpers (US-017b).
 *
 * Architect F4 + Critic E3 (offline-first): the panel must NOT request remote
 * tiles. We build a fully inline maplibre style.json with:
 *   - background-color layer (no raster tiles)
 *   - geojson source for the sortie track polyline
 *   - geojson source for the cursor marker
 *
 * The pure helpers live here so coverage targets ≥85% without rendering a
 * real map.
 */

import { TRACK_POINTS } from '../../mock/trackPoints';
import type { TrackPoint } from '../../types/domain';

/** Reference center used by the prototype map (Korea-ish). */
const REF_LNG = 127.5432;
const REF_LAT = 36.1234;

/** Pixel→degree scale (rough deterministic mapping for slice 1). */
const PIXEL_TO_DEG_X = 0.0010;
const PIXEL_TO_DEG_Y = 0.0008;

/**
 * Map a synthesized pixel-space TrackPoint to a deterministic lng/lat tuple
 * around the reference center. Slice 1 doesn't need real geodesy.
 */
export function trackPointToLngLat(p: TrackPoint): [number, number] {
  // Centre the pixel space around (360, 270) → (REF_LNG, REF_LAT)
  const lng = REF_LNG + (p.x - 360) * PIXEL_TO_DEG_X;
  const lat = REF_LAT - (p.y - 270) * PIXEL_TO_DEG_Y;
  return [lng, lat];
}

export interface GeoJsonLineFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: Record<string, unknown>;
}

export interface GeoJsonPointFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: number[] };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<GeoJsonLineFeature | GeoJsonPointFeature>;
}

/** Build a FeatureCollection containing the sortie track as a LineString. */
export function buildTrackGeoJson(
  points: ReadonlyArray<TrackPoint>
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points.map((p) => trackPointToLngLat(p)),
        },
        properties: { kind: 'track' },
      },
    ],
  };
}

/**
 * Build a FeatureCollection containing the cursor marker — a Point at the
 * track location closest to globalCursorNs. Empty input yields empty FC.
 */
export function buildCursorMarkerGeoJson(
  points: ReadonlyArray<TrackPoint>,
  globalCursorNs: string | null
): GeoJsonFeatureCollection {
  if (points.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }
  // Map cursor (ns since start) to t ∈ [0,1] using a 60s reference window.
  let t = 0;
  if (globalCursorNs != null) {
    const ns = Number(globalCursorNs);
    if (Number.isFinite(ns)) {
      t = ((ns / 1e9) % 60) / 60;
    }
  }
  const idx = Math.max(0, Math.min(points.length - 1, Math.floor(t * (points.length - 1))));
  const lngLat = trackPointToLngLat(points[idx]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: lngLat },
        properties: { kind: 'cursor' },
      },
    ],
  };
}

export interface MaplibreLayer {
  id: string;
  type: string;
  source?: string;
  paint?: Record<string, unknown>;
}

export interface MaplibreSource {
  type: 'geojson';
  data: GeoJsonFeatureCollection;
}

export interface MaplibreOfflineStyle {
  version: 8;
  sources: { track: MaplibreSource; cursor: MaplibreSource };
  layers: MaplibreLayer[];
}

/**
 * Build the offline maplibre style. Per Architect F4 / Critic E3 there must
 * be NO remote URLs — only inline geojson sources and a background layer.
 */
export function buildOfflineMapStyle(
  points: ReadonlyArray<TrackPoint> = TRACK_POINTS,
  cursorNs: string | null = null
): MaplibreOfflineStyle {
  return {
    version: 8,
    sources: {
      track: { type: 'geojson', data: buildTrackGeoJson(points) },
      cursor: { type: 'geojson', data: buildCursorMarkerGeoJson(points, cursorNs) },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0e1418' } },
      {
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: { 'line-color': '#e5a24a', 'line-width': 2 },
      },
      {
        id: 'cursor-point',
        type: 'circle',
        source: 'cursor',
        paint: {
          'circle-radius': 5,
          'circle-color': '#f0b44a',
          'circle-stroke-color': '#1a1614',
          'circle-stroke-width': 1.5,
        },
      },
    ],
  };
}
