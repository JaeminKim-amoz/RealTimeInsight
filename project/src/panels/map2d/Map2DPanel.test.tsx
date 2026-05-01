/**
 * Map2DPanel (US-017b) — RTL tests.
 *
 * maplibre-gl is heavy in jsdom and pulls in WebGL; we mock it to a no-op
 * Map class. The pure GeoJSON helper has its own coverage in geojson.test.ts.
 *
 * Critic E3: assert no remote URL is referenced in the inline style passed
 * to maplibre.Map.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const mapInstances: Array<{ options: Record<string, unknown>; remove: () => void; on: () => void; addSource: () => void; addLayer: () => void; getSource: () => null; isStyleLoaded: () => boolean }> = [];

vi.mock('maplibre-gl', () => {
  class Map {
    options: Record<string, unknown>;
    constructor(opts: Record<string, unknown>) {
      this.options = opts;
      mapInstances.push(this as never);
    }
    on() {}
    once() {}
    remove() {}
    addSource() {}
    addLayer() {}
    getSource() {
      return null;
    }
    isStyleLoaded() {
      return true;
    }
    setStyle() {}
  }
  return { default: { Map }, Map };
});

import { Map2DPanel } from './Map2DPanel';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-map',
    kind: 'map2d',
    title: 'Map Test',
    layoutNodeId: 'ln-1',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/map2d/Map2DPanel (US-017b)', () => {
  beforeEach(() => {
    mapInstances.length = 0;
  });

  it('renders a panel-body map root container', () => {
    const { container } = render(
      <Map2DPanel panel={makePanel()} mode="live" />
    );
    expect(container.querySelector('.panel-body.map')).not.toBeNull();
  });

  it('mounts a maplibre-gl Map instance', () => {
    render(<Map2DPanel panel={makePanel()} mode="live" />);
    expect(mapInstances.length).toBe(1);
  });

  it('passes an inline style with no remote URLs (Critic E3)', () => {
    render(<Map2DPanel panel={makePanel()} mode="live" />);
    const style = mapInstances[0].options.style;
    const styleJson = JSON.stringify(style);
    expect(styleJson).not.toMatch(/https?:\/\//);
  });

  it('inline style contains a track-line layer (offline GeoJSON)', () => {
    render(<Map2DPanel panel={makePanel()} mode="live" />);
    const style = mapInstances[0].options.style as { layers: Array<{ id: string }> };
    const ids = style.layers.map((l) => l.id);
    expect(ids).toContain('track-line');
    expect(ids).toContain('bg');
  });
});
