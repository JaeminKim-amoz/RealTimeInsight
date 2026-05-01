/**
 * WorkstationSheet (US-019a) — RTL tests.
 *
 * Mocks @react-three/fiber Canvas + maplibre-gl since the sheet mounts
 * the full panel suite (Globe, Trajectory3D, Attitude3D + Map2D).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: () => {},
  useThree: () => ({ camera: {}, gl: {} }),
}));

vi.mock('maplibre-gl', () => {
  class Map {
    constructor() {}
    on() {}
    once() {}
    remove() {}
    addSource() {}
    addLayer() {}
    getSource() { return null; }
    isStyleLoaded() { return true; }
    setStyle() {}
  }
  return { default: { Map }, Map };
});

import { WorkstationSheet } from './WorkstationSheet';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSelectionStore } from '../store/selectionStore';
// Read the source as a Vite raw asset so the assertion has no node:fs / __dirname deps.
// @ts-expect-error — Vite ?raw imports are not modeled in tsconfig
// eslint-disable-next-line import/no-unresolved
import workstationSheetSrc from './WorkstationSheet.tsx?raw';

describe('sheets/WorkstationSheet (US-019a)', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useSelectionStore.getState().reset();
  });

  it('renders sheet workstation-sheet root container', () => {
    const { container } = render(<WorkstationSheet />);
    expect(container.querySelector('.sheet.workstation-sheet')).not.toBeNull();
  });

  it('mounts 14 panel frames with workstation-default preset auto-loaded', () => {
    const { container } = render(<WorkstationSheet />);
    const panels = container.querySelectorAll('.panel');
    expect(panels.length).toBe(14);
  });

  it('renders each panel kind body (strip, numeric, discrete, eventlog, waterfall, map2d, video, attitude3d, trajectory3d, relationgraph, simdisbridge)', () => {
    const { container } = render(<WorkstationSheet />);
    expect(container.querySelector('.panel-body.strip')).not.toBeNull();
    expect(container.querySelector('.panel-body.numeric-grid')).not.toBeNull();
    expect(container.querySelector('.panel-body.discrete-rows')).not.toBeNull();
    expect(container.querySelector('.panel-body.event-log')).not.toBeNull();
    expect(container.querySelector('.panel-body.waterfall')).not.toBeNull();
    expect(container.querySelector('.panel-body.map')).not.toBeNull();
    expect(container.querySelector('.panel-body.video')).not.toBeNull();
    expect(container.querySelector('.panel-body.adi')).not.toBeNull();
    expect(container.querySelector('.panel-body.trajectory3d')).not.toBeNull();
    expect(container.querySelector('.panel-body.relation-graph')).not.toBeNull();
    expect(container.querySelector('.panel-body.simdis')).not.toBeNull();
  });

  it('renders only 2 panels with a 2-panel test layout tree', () => {
    useWorkspaceStore.getState().setLayoutTree({
      type: 'split',
      id: 'split-root',
      direction: 'horizontal',
      ratio: [0.5, 0.5],
      children: [
        { type: 'panel', id: 'pn-a', panelId: 'pa' },
        { type: 'panel', id: 'pn-b', panelId: 'pb' },
      ],
    });
    useWorkspaceStore.getState().addPanel({
      id: 'pa', kind: 'strip', title: 'A', layoutNodeId: 'pn-a',
      bindings: [], options: {}, uiState: {}, createdAt: '', updatedAt: '',
    });
    useWorkspaceStore.getState().addPanel({
      id: 'pb', kind: 'numeric', title: 'B', layoutNodeId: 'pn-b',
      bindings: [], options: {}, uiState: {}, createdAt: '', updatedAt: '',
    });
    const { container } = render(<WorkstationSheet />);
    expect(container.querySelectorAll('.panel').length).toBe(2);
  });

  it('Bridge offline placeholder renders for the panel bound to channel #1001 in live mode', () => {
    const { container } = render(<WorkstationSheet mode="live" />);
    // Panel p1 binds channel 1001 + 1002 → strip should show bridge-offline
    // because no live frames are populated in test environment.
    const p1 = container.querySelector('[data-panel-id="p1"]');
    expect(p1).not.toBeNull();
    expect(p1!.querySelector('.bridge-offline')).not.toBeNull();
  });

  it('Critic C3 lock: WorkstationSheet source contains no NODE_ENV bypass', () => {
    expect(workstationSheetSrc).not.toMatch(/process\.env\.NODE_ENV/);
    expect(workstationSheetSrc).not.toMatch(/import\.meta\.env\.MODE/);
  });

  it('renders empty placeholder when no layoutTree (after reset)', () => {
    // Force layoutTree to remain null by overriding loadPreset behavior.
    // Since the component auto-loads on mount, we instead set a non-grid panel
    // to a missing target.
    useWorkspaceStore.getState().setLayoutTree({
      type: 'panel',
      id: 'pn-missing',
      panelId: 'missing',
    });
    const { container } = render(<WorkstationSheet />);
    expect(container.querySelector('.dockgrid-empty')).not.toBeNull();
  });
});
