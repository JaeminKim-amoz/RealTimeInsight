/**
 * Map2DPanel (US-017b) — offline MapLibre map with synthesized sortie track.
 *
 * Architect F4 + Critic E3 (offline-first): no remote tile URLs. The inline
 * style.json built by `buildOfflineMapStyle` contains:
 *   - background-color layer
 *   - geojson source for the track LineString
 *   - geojson source for the cursor marker (driven by useSelectionStore.globalCursorNs)
 *
 * The wrapper is intentionally thin — geojson + style construction lives in
 * `geojson.ts` and gets full test coverage.
 */

import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useSelectionStore } from '../../store/selectionStore';
import { TRACK_POINTS } from '../../mock/trackPoints';
import type { PanelInstance } from '../../types/domain';
import {
  buildOfflineMapStyle,
  buildCursorMarkerGeoJson,
} from './geojson';

interface Map2DPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

interface MapHandle {
  // Minimal API surface used here — keeps the test mock easy to satisfy.
  remove: () => void;
  getSource: (id: string) => { setData: (d: unknown) => void } | null;
  isStyleLoaded: () => boolean;
  on: (ev: string, cb: () => void) => void;
}

export function Map2DPanel({ panel, mode }: Map2DPanelProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const globalCursorNs = useSelectionStore((s) => s.globalCursorNs);

  // Touch unused props so eslint stays happy and deps stay accurate.
  void panel;
  void mode;

  const initialStyle = useMemo(() => buildOfflineMapStyle(TRACK_POINTS, null), []);

  useEffect(() => {
    if (!mountRef.current) return;
    // maplibregl is mocked to a no-op Map class in tests.
    const MaplibreMap = (maplibregl as unknown as { Map: new (opts: unknown) => MapHandle }).Map;
    const map = new MaplibreMap({
      container: mountRef.current,
      style: initialStyle,
      center: [127.5432, 36.1234],
      zoom: 9,
      attributionControl: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialStyle]);

  // Cursor → cursor source data (Critic C4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;
    const src = map.getSource('cursor');
    if (!src) return;
    src.setData(buildCursorMarkerGeoJson(TRACK_POINTS, globalCursorNs));
  }, [globalCursorNs]);

  return (
    <div className="panel-body map">
      <div
        ref={mountRef}
        data-testid="map-container"
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
