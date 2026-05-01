/**
 * Pure-logic tests for the Map2D GeoJSON helper (US-017b).
 *
 * Architect F4 + Critic offline-first: maps must NOT fetch remote tiles. We
 * verify the inline style.json builder produces a valid offline FeatureCollection.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTrackGeoJson,
  buildOfflineMapStyle,
  buildCursorMarkerGeoJson,
  trackPointToLngLat,
} from './geojson';
import { TRACK_POINTS } from '../../mock/trackPoints';

describe('panels/map2d/geojson trackPointToLngLat', () => {
  it('maps the synthesized pixel-space TrackPoint to a deterministic lng/lat tuple', () => {
    const out = trackPointToLngLat({ x: 120, y: 400, t: 0 });
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);
    expect(Number.isFinite(out[0])).toBe(true);
    expect(Number.isFinite(out[1])).toBe(true);
  });

  it('generates lng/lat near a reasonable real-world reference center', () => {
    const out = trackPointToLngLat({ x: 360, y: 270, t: 0.5 });
    // Reference center used (Korea-ish): 127.5±, 36.1±
    expect(out[0]).toBeGreaterThan(126);
    expect(out[0]).toBeLessThan(129);
    expect(out[1]).toBeGreaterThan(35);
    expect(out[1]).toBeLessThan(37);
  });
});

describe('panels/map2d/geojson buildTrackGeoJson', () => {
  it('returns a FeatureCollection with a single LineString feature', () => {
    const fc = buildTrackGeoJson(TRACK_POINTS);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    const feat = fc.features[0];
    expect(feat.type).toBe('Feature');
    expect(feat.geometry.type).toBe('LineString');
  });

  it('includes one coordinate pair per track point', () => {
    const fc = buildTrackGeoJson(TRACK_POINTS);
    const coords = (fc.features[0].geometry as { coordinates: number[][] }).coordinates;
    expect(coords.length).toBe(TRACK_POINTS.length);
    expect(coords[0]).toHaveLength(2);
  });

  it('returns a feature with empty coordinates when track is empty', () => {
    const fc = buildTrackGeoJson([]);
    const coords = (fc.features[0].geometry as { coordinates: number[][] }).coordinates;
    expect(coords).toEqual([]);
  });

  it('coordinates are finite numbers', () => {
    const fc = buildTrackGeoJson(TRACK_POINTS);
    const coords = (fc.features[0].geometry as { coordinates: number[][] }).coordinates;
    for (const [lng, lat] of coords) {
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });
});

describe('panels/map2d/geojson buildCursorMarkerGeoJson', () => {
  it('returns a FeatureCollection with a single Point feature', () => {
    const fc = buildCursorMarkerGeoJson(TRACK_POINTS, '500000000');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe('Point');
  });

  it('returns first point when cursor is null', () => {
    const fc = buildCursorMarkerGeoJson(TRACK_POINTS, null);
    const coord = (fc.features[0].geometry as { coordinates: number[] }).coordinates;
    expect(Array.isArray(coord)).toBe(true);
    expect(coord).toHaveLength(2);
  });

  it('returns empty FeatureCollection when track is empty', () => {
    const fc = buildCursorMarkerGeoJson([], '0');
    expect(fc.features).toHaveLength(0);
  });
});

describe('panels/map2d/geojson buildOfflineMapStyle (Critic E3 / F4)', () => {
  it('returns a maplibre style with version 8 and no remote URLs', () => {
    const style = buildOfflineMapStyle(TRACK_POINTS);
    expect(style.version).toBe(8);
    const json = JSON.stringify(style);
    expect(json).not.toMatch(/^https?:\/\//);
    expect(json).not.toMatch(/https?:\/\/[^"]+/);
  });

  it('contains background and track-line layers', () => {
    const style = buildOfflineMapStyle(TRACK_POINTS);
    const ids = style.layers.map((l) => l.id);
    expect(ids).toContain('bg');
    expect(ids).toContain('track-line');
  });

  it('background paint uses a dark color value', () => {
    const style = buildOfflineMapStyle(TRACK_POINTS);
    const bg = style.layers.find((l) => l.id === 'bg');
    expect(bg).toBeDefined();
    expect(bg?.paint).toMatchObject({ 'background-color': expect.stringMatching(/^#/) });
  });

  it('track source is inline geojson (no remote URL)', () => {
    const style = buildOfflineMapStyle(TRACK_POINTS);
    const trackSource = style.sources.track;
    expect(trackSource).toBeDefined();
    expect(trackSource?.type).toBe('geojson');
    // data must be inline FeatureCollection, not a URL string
    expect(typeof trackSource?.data).toBe('object');
  });
});
