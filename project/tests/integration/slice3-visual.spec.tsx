/**
 * slice3-visual.spec.tsx (US-3-006) — Slice-3 visual fidelity proof.
 *
 * Covers each story US-3-001..US-3-005 with behaviours observable from
 * component mounts.  Same jsdom shim pattern as the slice-2 acceptance spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// jsdom shims (maplibre-gl + r3f no longer used by GlobePanel but other
// panels in App still pull them; keep them mocked for App mounts).
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn(), off: vi.fn(), remove: vi.fn(),
      addControl: vi.fn(), removeControl: vi.fn(),
      addSource: vi.fn(), addLayer: vi.fn(),
      getSource: vi.fn(), setStyle: vi.fn(),
      setCenter: vi.fn(), setZoom: vi.fn(),
      flyTo: vi.fn(), fitBounds: vi.fn(),
      isStyleLoaded: vi.fn().mockReturnValue(true),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
}));

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'r3f-canvas' }, children),
    useFrame: vi.fn(),
    useThree: vi.fn().mockReturnValue({ camera: {}, gl: {}, scene: {} }),
  };
});

vi.mock('@react-three/drei', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return new Proxy({}, { get: () => passthrough });
});

import { App } from '../../src/app/App';
import { GlobePanel } from '../../src/panels/globe/GlobePanel';
import { GpsLosPanel } from '../../src/panels/gpslos/GpsLosPanel';
import { SpaceSheet } from '../../src/sheets/SpaceSheet';
import { SATELLITES, THREAT_SITES, FRIENDLY_EW } from '../../src/panels/globe/globe-data';
import { CONTINENT_COUNT, MOUNTAIN_RANGE_COUNT } from '../../src/panels/globe/globe-textures';
import { useSessionStore } from '../../src/store/sessionStore';
import { useStreamStore } from '../../src/store/streamStore';
import { useWorkspaceStore } from '../../src/store/workspaceStore';
import { useIntegrationStore } from '../../src/store/integrationStore';
import { useUiStore } from '../../src/store/uiStore';
import type { PanelInstance } from '../../src/types/domain';

const globePanel: PanelInstance = {
  id: 'p-globe-test',
  kind: 'globe',
  title: 'Globe',
  layoutNodeId: 'space-sheet',
  bindings: [],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

const gpslosPanel: PanelInstance = {
  ...globePanel,
  id: 'p-gpslos-test',
  kind: 'gpslos',
};

beforeEach(() => {
  useSessionStore.getState().reset();
  useStreamStore.getState().reset();
  useWorkspaceStore.getState().reset();
  useIntegrationStore.getState().reset();
  useUiStore.getState().reset();
});

// ============================================================================
// US-3-001 — Procedural earth + atmosphere + stars + 18 sats + animated orbits
// ============================================================================
describe('US-3-001 — Procedural earth + 18 sats + 7 threats + 2 friendly EW', () => {
  it('SATELLITES dataset has exactly 18 entries', () => {
    expect(SATELLITES.length).toBe(18);
  });

  it('THREAT_SITES dataset has exactly 7 entries', () => {
    expect(THREAT_SITES.length).toBe(7);
  });

  it('FRIENDLY_EW dataset has exactly 2 entries', () => {
    expect(FRIENDLY_EW.length).toBe(2);
  });

  it('GlobePanel renders globe-wrap + globe-canvas root containers', () => {
    const { container } = render(<GlobePanel panel={globePanel} />);
    expect(container.querySelector('.globe-wrap')).not.toBeNull();
    expect(container.querySelector('.globe-canvas')).not.toBeNull();
  });

  it('procedural texture metadata exposes 19 continents and 8 mountain ranges', () => {
    expect(CONTINENT_COUNT).toBe(19);
    expect(MOUNTAIN_RANGE_COUNT).toBe(8);
  });
});

// ============================================================================
// US-3-002 — 4-corner HUD overlays + 9 layer toggles + drag/wheel
// ============================================================================
describe('US-3-002 — 4-corner HUD overlays + layer toggles', () => {
  it('all four globe-hud-* overlays render', () => {
    render(<GlobePanel panel={globePanel} />);
    expect(screen.getByTestId('globe-hud-tl')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-tr')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-bl')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-br')).toBeInTheDocument();
  });

  it('renders 9 layer toggle checkboxes', () => {
    render(<GlobePanel panel={globePanel} />);
    const tr = screen.getByTestId('globe-hud-tr');
    expect(tr.querySelectorAll('input[type="checkbox"]').length).toBe(9);
  });

  it('renders 8 sat rows in bottom-left + 7 threat rows in bottom-right', () => {
    render(<GlobePanel panel={globePanel} />);
    expect(screen.getByTestId('globe-hud-bl').querySelectorAll('.sat-row').length).toBe(8);
    expect(screen.getByTestId('globe-hud-br').querySelectorAll('.threat-row').length).toBe(7);
  });

  it('globe-credits text mentions DRAG and WHEEL controls', () => {
    render(<GlobePanel panel={globePanel} />);
    expect(screen.getByTestId('globe-credits').textContent).toContain('DRAG');
    expect(screen.getByTestId('globe-credits').textContent).toContain('WHEEL');
  });
});

// ============================================================================
// US-3-003 — GpsLos DOP grid + SNR bars + PDOP forecast + 21-sat skyplot
// ============================================================================
describe('US-3-003 — GpsLos DOP grid / SNR bars / PDOP forecast', () => {
  it('skyplot renders 21 satellite dots', () => {
    const { container } = render(<GpsLosPanel panel={gpslosPanel} />);
    expect(container.querySelectorAll('[data-sat-prn]').length).toBe(21);
  });

  it('renders DOP grid with 5 cells (PDOP/HDOP/VDOP/TDOP/GDOP)', () => {
    render(<GpsLosPanel panel={gpslosPanel} />);
    expect(screen.getByTestId('dop-cell-pdop')).toBeInTheDocument();
    expect(screen.getByTestId('dop-cell-gdop')).toBeInTheDocument();
  });

  it('renders SNR bars with 12 rows', () => {
    const { container } = render(<GpsLosPanel panel={gpslosPanel} />);
    expect(container.querySelectorAll('.snr-row').length).toBe(12);
  });

  it('renders PDOP forecast SVG', () => {
    render(<GpsLosPanel panel={gpslosPanel} />);
    expect(screen.getByTestId('gps-pdop-forecast').querySelector('svg')).not.toBeNull();
  });

  it('renders gps-counts USED/VIS/MASKED triplet', () => {
    render(<GpsLosPanel panel={gpslosPanel} />);
    const counts = screen.getByTestId('gps-counts');
    expect(counts.textContent).toContain('USED');
    expect(counts.textContent).toContain('VIS');
    expect(counts.textContent).toContain('MASKED');
  });
});

// ============================================================================
// US-3-004 — SpaceSheet sizing
// ============================================================================
describe('US-3-004 — SpaceSheet sizing chain', () => {
  it('SpaceSheet root + grid + globe + gpslos containers all render', () => {
    render(<SpaceSheet />);
    expect(screen.getByTestId('space-sheet-grid')).toBeInTheDocument();
    expect(screen.getByTestId('space-sheet-globe')).toBeInTheDocument();
    expect(screen.getByTestId('space-sheet-gpslos')).toBeInTheDocument();
  });

  it('grid + globe + gpslos containers each declare height:100%', () => {
    render(<SpaceSheet />);
    expect(screen.getByTestId('space-sheet-grid').style.height).toBe('100%');
    expect(screen.getByTestId('space-sheet-globe').style.height).toBe('100%');
    expect(screen.getByTestId('space-sheet-gpslos').style.height).toBe('100%');
  });

  it('telemetry strip shows 18/7/2 counts', () => {
    render(<SpaceSheet />);
    expect(screen.getByTestId('sat-count').textContent).toBe('18');
    expect(screen.getByTestId('threat-count').textContent).toBe('7');
    expect(screen.getByTestId('friendly-count').textContent).toBe('2');
  });
});

// ============================================================================
// US-3-005 — SVG fallback inside globe-canvas (jsdom path)
// ============================================================================
describe('US-3-005 — SVG fallback for jsdom / WebGL-less environments', () => {
  it('renders globe-canvas-fallback svg in jsdom', () => {
    render(<GlobePanel panel={globePanel} />);
    const fb = screen.getByTestId('globe-canvas-fallback');
    expect(fb).toBeInTheDocument();
    expect(fb.tagName.toLowerCase()).toBe('svg');
    expect(fb.querySelector('circle')).not.toBeNull();
  });

  it('fallback contains role=img and aria-label', () => {
    render(<GlobePanel panel={globePanel} />);
    const fb = screen.getByTestId('globe-canvas-fallback');
    expect(fb.getAttribute('role')).toBe('img');
    expect(fb.getAttribute('aria-label')).toBeTruthy();
  });
});

// ============================================================================
// App composition smoke — Space sheet works inside <App initialSheet="space"/>
// ============================================================================
describe('App composition with Space sheet', () => {
  it('App mounts with initialSheet="space" and renders globe-wrap', () => {
    const { container } = render(<App initialSheet="space" />);
    expect(container.querySelector('.globe-wrap')).not.toBeNull();
  });
});
