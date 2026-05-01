/**
 * GlobePanel (US-3-001 / US-3-002 / US-3-005) — RTL tests.
 *
 * Three.js is real but we run in jsdom which has no WebGL — the panel detects
 * this and renders an SVG fallback inside .globe-canvas. HUD overlays render
 * unconditionally and are the primary assertion surface.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobePanel } from './GlobePanel';
import { latLonToVec3, buildOrbitPath } from './geometry';
import { SATELLITES, THREAT_SITES, FRIENDLY_EW } from './globe-data';
import { CONTINENT_COUNT, MOUNTAIN_RANGE_COUNT } from './globe-textures';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-globe',
    kind: 'globe',
    title: 'Globe Test',
    layoutNodeId: 'ln-gl',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/globe/GlobePanel (US-3-001 FULL fidelity)', () => {
  it('renders globe-wrap root + globe-canvas mount + globe-credits', () => {
    const { container } = render(<GlobePanel panel={makePanel()} />);
    expect(container.querySelector('.globe-wrap')).not.toBeNull();
    expect(container.querySelector('.globe-canvas')).not.toBeNull();
    expect(container.querySelector('.globe-credits')).not.toBeNull();
  });

  it('renders all four HUD overlays', () => {
    render(<GlobePanel panel={makePanel()} />);
    expect(screen.getByTestId('globe-hud-tl')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-tr')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-bl')).toBeInTheDocument();
    expect(screen.getByTestId('globe-hud-br')).toBeInTheDocument();
  });

  it('top-left HUD shows SATS / THREAT SITES / FRIENDLY EW counters', () => {
    render(<GlobePanel panel={makePanel()} />);
    const tl = screen.getByTestId('globe-hud-tl');
    expect(tl.textContent).toContain('SPACE · ORBITAL VIEW');
    expect(tl.textContent).toContain(`SATS · ${SATELLITES.length}`);
    expect(tl.textContent).toContain(`THREAT SITES · ${THREAT_SITES.length}`);
    expect(tl.textContent).toContain(`FRIENDLY EW · ${FRIENDLY_EW.length}`);
  });

  it('top-right HUD renders 9 layer toggle checkboxes', () => {
    render(<GlobePanel panel={makePanel()} />);
    const tr = screen.getByTestId('globe-hud-tr');
    expect(tr.querySelectorAll('input[type="checkbox"]').length).toBe(9);
  });

  it('bottom-left HUD shows first 8 satellites + "+N more"', () => {
    render(<GlobePanel panel={makePanel()} />);
    const bl = screen.getByTestId('globe-hud-bl');
    const rows = bl.querySelectorAll('.sat-row');
    expect(rows.length).toBe(8);
    expect(bl.textContent).toContain(`+ ${SATELLITES.length - 8} more`);
  });

  it('bottom-right HUD shows all 7 threat sites', () => {
    render(<GlobePanel panel={makePanel()} />);
    const br = screen.getByTestId('globe-hud-br');
    const rows = br.querySelectorAll('.threat-row');
    expect(rows.length).toBe(THREAT_SITES.length);
    expect(rows.length).toBe(7);
  });

  it('toggle the auto-spin checkbox flips its checked state', async () => {
    const user = userEvent.setup();
    render(<GlobePanel panel={makePanel()} />);
    const cb = screen.getByTestId('globe-toggle-autoSpin') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    await user.click(cb);
    expect(cb.checked).toBe(false);
  });

  it('toggling Terrain off updates globe-credits text', async () => {
    const user = userEvent.setup();
    render(<GlobePanel panel={makePanel()} />);
    expect(screen.getByTestId('globe-credits').textContent).toContain('TERRAIN ON ZOOM');
    await user.click(screen.getByTestId('globe-toggle-showTerrain'));
    expect(screen.getByTestId('globe-credits').textContent).toContain('TERRAIN OFF');
  });

  it('renders SVG fallback inside globe-canvas (jsdom path)', () => {
    render(<GlobePanel panel={makePanel()} />);
    const fallback = screen.getByTestId('globe-canvas-fallback');
    expect(fallback).toBeInTheDocument();
    expect(fallback.tagName.toLowerCase()).toBe('svg');
    // earth circle present
    expect(fallback.querySelector('circle')).not.toBeNull();
  });

  it('mounts in replay mode without throwing', () => {
    expect(() => render(<GlobePanel panel={makePanel()} mode="replay" />)).not.toThrow();
  });
});

describe('panels/globe/globe-data (US-3-001 dataset)', () => {
  it('SATELLITES has exactly 18 entries', () => {
    expect(SATELLITES.length).toBe(18);
  });

  it('THREAT_SITES has exactly 7 entries', () => {
    expect(THREAT_SITES.length).toBe(7);
  });

  it('FRIENDLY_EW has exactly 2 entries', () => {
    expect(FRIENDLY_EW.length).toBe(2);
  });

  it('every satellite has a non-empty id and positive altitude', () => {
    for (const s of SATELLITES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.alt).toBeGreaterThan(0);
      expect(s.period).toBeGreaterThan(0);
    }
  });

  it('every threat site has lat/lon within ±90 / ±180 and positive range', () => {
    for (const t of THREAT_SITES) {
      expect(Math.abs(t.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(t.lon)).toBeLessThanOrEqual(180);
      expect(t.range_km).toBeGreaterThan(0);
    }
  });
});

describe('panels/globe/globe-textures (US-3-001 procedural assets)', () => {
  it('exposes 19 continent meta-blob count and 8 mountain ranges', () => {
    expect(CONTINENT_COUNT).toBe(19);
    expect(MOUNTAIN_RANGE_COUNT).toBe(8);
  });
});

describe('panels/globe/geometry (legacy helpers retained)', () => {
  it('latLonToVec3(0, 0, 1) ≈ (1, 0, 0) within tolerance', () => {
    const [x, y, z] = latLonToVec3(0, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('buildOrbitPath(400, 51.6, 64) produces 64 vertices with magnitude > 1', () => {
    const arr = buildOrbitPath(400, 51.6, 64);
    expect(arr.length).toBe(64 * 3);
    for (let i = 0; i < arr.length; i += 3) {
      const m = Math.hypot(arr[i], arr[i + 1], arr[i + 2]);
      expect(m).toBeGreaterThan(1);
    }
  });

  it('SVG fallback in jsdom does not crash even after fireEvent.dragOver', () => {
    const { container } = render(<GlobePanel panel={makePanel()} />);
    const canvas = container.querySelector('.globe-canvas');
    expect(canvas).not.toBeNull();
    if (canvas) {
      fireEvent.mouseDown(canvas);
      fireEvent.mouseUp(canvas);
    }
  });
});
