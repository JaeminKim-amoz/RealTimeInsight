/**
 * DockGrid + PanelFrame (US-014, US-2-002) — RTL tests.
 *
 * Verifies LayoutNode → CSS grid placement, PanelFrame structure,
 * click-to-select panel wiring, and drop-zone overlay/wiring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DockGrid, PanelFrame } from './DockGrid';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSelectionStore } from '../store/selectionStore';
import { isFlatGridNode, isSplitNode } from '../types/domain';
import type { DragChannelPayload, PanelInstance } from '../types/domain';

describe('shell/DockGrid (US-014)', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useSelectionStore.getState().reset();
    useWorkspaceStore.getState().loadPreset('workstation-default');
  });

  it('renders the dockgrid root with `dockgrid` className', () => {
    const { container } = render(<DockGrid />);
    expect(container.querySelector('.dockgrid')).not.toBeNull();
  });

  it('renders 14 PanelFrame nodes when workstation-default preset is loaded', () => {
    const { container } = render(<DockGrid />);
    const panels = container.querySelectorAll('.panel');
    expect(panels.length).toBe(14);
  });

  it('applies grid template columns/rows from FlatGridNode columns/rows', () => {
    const { container } = render(<DockGrid />);
    const grid = container.querySelector('.dockgrid') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns).toContain('repeat(12');
    expect(grid.style.gridTemplateRows).toContain('repeat(11');
  });

  it('places panel p1 at gridColumn 1 / span 5 and gridRow 1 / span 3', () => {
    const { container } = render(<DockGrid />);
    const cells = container.querySelectorAll<HTMLElement>('.dockgrid > [data-panel-id]');
    const p1 = Array.from(cells).find((c) => c.dataset.panelId === 'p1')!;
    expect(p1).toBeDefined();
    expect(p1.style.gridColumn).toBe('1 / span 5');
    expect(p1.style.gridRow).toBe('1 / span 3');
  });

  it('places panel p2 at gridColumn 6 / span 4 and gridRow 1 / span 3', () => {
    const { container } = render(<DockGrid />);
    const cells = container.querySelectorAll<HTMLElement>('.dockgrid > [data-panel-id]');
    const p2 = Array.from(cells).find((c) => c.dataset.panelId === 'p2')!;
    expect(p2.style.gridColumn).toBe('6 / span 4');
    expect(p2.style.gridRow).toBe('1 / span 3');
  });

  it('places panel p13 at gridColumn 10 / span 3 and gridRow 10 / span 2', () => {
    const { container } = render(<DockGrid />);
    const cells = container.querySelectorAll<HTMLElement>('.dockgrid > [data-panel-id]');
    const p13 = Array.from(cells).find((c) => c.dataset.panelId === 'p13')!;
    expect(p13.style.gridColumn).toBe('10 / span 3');
    expect(p13.style.gridRow).toBe('10 / span 2');
  });

  it('clicking a PanelFrame header sets useSelectionStore.selectedPanelId', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"] .panel-header')!;
    expect(p1).not.toBeNull();
    await user.click(p1);
    expect(useSelectionStore.getState().selectedPanelId).toBe('p1');
  });

  it('selected panel has `selected` className applied', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    const headerP1 = p1.querySelector<HTMLElement>('.panel-header')!;
    await user.click(headerP1);
    // After re-render the same node should now have `selected` class
    const updated = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    expect(updated.className).toContain('selected');
  });

  it('PanelFrame renders header (kind + title), body placeholder, and footer', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    expect(p1.querySelector('.panel-header')).not.toBeNull();
    expect(p1.querySelector('.panel-kind')).not.toBeNull();
    expect(p1.querySelector('.panel-title')).not.toBeNull();
    expect(p1.querySelector('.panel-body')).not.toBeNull();
    expect(p1.querySelector('.panel-body-placeholder')).not.toBeNull();
    expect(p1.querySelector('.panel-footer')).not.toBeNull();
  });

  it('PanelFrame body placeholder renders the panel kind text', () => {
    const { container } = render(<DockGrid />);
    const p5 = container.querySelector<HTMLElement>('[data-panel-id="p5"]')!;
    const placeholder = p5.querySelector('.panel-body-placeholder')!;
    expect(placeholder.textContent).toBe('waterfall');
  });

  it('PanelFrame header includes a close button', () => {
    const { container } = render(<DockGrid />);
    const closeBtns = container.querySelectorAll('.panel-header button[aria-label="Close panel"]');
    expect(closeBtns.length).toBe(14);
  });

  it('PanelFrame header lists panel bindings as chips (≤4 visible)', () => {
    const { container } = render(<DockGrid />);
    // p3 has 6 channel bindings — should clip to 4 + a "+N" chip
    const p3 = container.querySelector<HTMLElement>('[data-panel-id="p3"]')!;
    const bindings = p3.querySelectorAll('.panel-bindings .pb');
    expect(bindings.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a placeholder root when no layoutTree is loaded', () => {
    useWorkspaceStore.getState().reset(); // wipes layoutTree
    const { container } = render(<DockGrid />);
    const root = container.querySelector('.dockgrid');
    expect(root).not.toBeNull();
    // No panels rendered when tree is null
    expect(container.querySelectorAll('.panel').length).toBe(0);
  });

  it('clicking the close button removes the panel from the workspace', async () => {
    const user = userEvent.setup();
    const { container } = render(<DockGrid />);
    const beforeCount = container.querySelectorAll('.panel').length;
    expect(beforeCount).toBe(14);
    const p1Close = container.querySelector<HTMLElement>(
      '[data-panel-id="p1"] button[aria-label="Close panel"]'
    )!;
    await user.click(p1Close);
    expect(useWorkspaceStore.getState().panels['p1']).toBeUndefined();
  });

  it('renders a SplitNode tree with two child PanelNodes', () => {
    useWorkspaceStore.getState().reset();
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
      id: 'pa',
      kind: 'strip',
      title: 'A',
      layoutNodeId: 'pn-a',
      bindings: [],
      options: {},
      uiState: {},
      createdAt: '',
      updatedAt: '',
    });
    useWorkspaceStore.getState().addPanel({
      id: 'pb',
      kind: 'numeric',
      title: 'B',
      layoutNodeId: 'pn-b',
      bindings: [],
      options: {},
      uiState: {},
      createdAt: '',
      updatedAt: '',
    });
    const { container } = render(<DockGrid />);
    expect(container.querySelectorAll('.panel').length).toBe(2);
    expect(container.querySelector('[data-panel-id="pa"]')).not.toBeNull();
    expect(container.querySelector('[data-panel-id="pb"]')).not.toBeNull();
  });

  it('renders a TabNode tree with a single child PanelNode', () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().setLayoutTree({
      type: 'tabs',
      id: 'tabs-root',
      activePanelId: 'pa',
      children: [{ type: 'panel', id: 'pn-a', panelId: 'pa' }],
    });
    useWorkspaceStore.getState().addPanel({
      id: 'pa',
      kind: 'strip',
      title: 'A',
      layoutNodeId: 'pn-a',
      bindings: [],
      options: {},
      uiState: {},
      createdAt: '',
      updatedAt: '',
    });
    const { container } = render(<DockGrid />);
    expect(container.querySelector('[data-panel-id="pa"]')).not.toBeNull();
  });

  it('renders an empty placeholder when a PanelNode points to a missing panel', () => {
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().setLayoutTree({
      type: 'panel',
      id: 'pn-missing',
      panelId: 'missing-id',
    });
    const { container } = render(<DockGrid />);
    expect(container.querySelector('.dockgrid-empty')).not.toBeNull();
  });
});

// ── US-2-002 — drop-zone overlay + drop wiring ──────────────────────────
describe('shell/DockGrid PanelFrame drop wiring (US-2-002)', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useSelectionStore.getState().reset();
    useWorkspaceStore.getState().loadPreset('workstation-default');
  });

  function makePayload(channelId = 1003): DragChannelPayload {
    return {
      kind: 'channel-drag',
      channelId,
      displayName: 'Battery Voltage',
      channelType: 'analog',
      unit: 'V',
    };
  }

  function makeDataTransfer(payload: DragChannelPayload) {
    const json = JSON.stringify(payload);
    return {
      types: ['application/x-channel'],
      getData: (fmt: string) =>
        fmt === 'application/x-channel' ? json : '',
      setData: () => undefined,
      effectAllowed: 'copy' as const,
      dropEffect: 'copy' as const,
    };
  }

  it('PanelFrame renders no drop overlay by default', () => {
    const { container } = render(<DockGrid />);
    expect(container.querySelector('.drop-overlay')).toBeNull();
  });

  it('dragOver with application/x-channel on a PanelFrame reveals the drop overlay with 5 zones', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    fireEvent.dragOver(p1, { dataTransfer: makeDataTransfer(makePayload()) });
    const overlay = p1.querySelector('.drop-overlay');
    expect(overlay).not.toBeNull();
    const zones = p1.querySelectorAll('.drop-zone');
    expect(zones.length).toBe(5);
    expect(p1.querySelector('.drop-zone.z-center')).not.toBeNull();
    expect(p1.querySelector('.drop-zone.z-top')).not.toBeNull();
    expect(p1.querySelector('.drop-zone.z-bottom')).not.toBeNull();
    expect(p1.querySelector('.drop-zone.z-left')).not.toBeNull();
    expect(p1.querySelector('.drop-zone.z-right')).not.toBeNull();
  });

  it('dropping a channel on the center zone calls addBindingToPanel for that panel', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    fireEvent.dragOver(p1, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    const center = p1.querySelector<HTMLElement>('.drop-zone.z-center')!;
    expect(center).not.toBeNull();
    fireEvent.drop(center, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    const bindings = useWorkspaceStore.getState().panels['p1']!.bindings;
    expect(bindings).toContainEqual({ type: 'channel', channelId: 1003 });
  });

  it('dropping a channel on the left zone splits the panel horizontally (cellSubtree → SplitNode)', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    fireEvent.dragOver(p1, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    const left = p1.querySelector<HTMLElement>('.drop-zone.z-left')!;
    fireEvent.drop(left, { dataTransfer: makeDataTransfer(makePayload(1003)) });

    const tree = useWorkspaceStore.getState().layoutTree;
    if (!tree || !isFlatGridNode(tree)) throw new Error('expected flat-grid');
    const cell = tree.cells.find((c) => c.panelId === 'p1');
    expect(cell?.cellSubtree).toBeDefined();
    const sub = cell!.cellSubtree!;
    if (!isSplitNode(sub)) throw new Error('expected SplitNode subtree');
    expect(sub.direction).toBe('horizontal');
  });

  it('dropping a channel on the top zone splits the panel vertically', () => {
    const { container } = render(<DockGrid />);
    const p2 = container.querySelector<HTMLElement>('[data-panel-id="p2"]')!;
    fireEvent.dragOver(p2, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    const top = p2.querySelector<HTMLElement>('.drop-zone.z-top')!;
    fireEvent.drop(top, { dataTransfer: makeDataTransfer(makePayload(1003)) });

    const tree = useWorkspaceStore.getState().layoutTree;
    if (!tree || !isFlatGridNode(tree)) throw new Error('expected flat-grid');
    const cell = tree.cells.find((c) => c.panelId === 'p2');
    expect(cell?.cellSubtree).toBeDefined();
    const sub = cell!.cellSubtree!;
    if (!isSplitNode(sub)) throw new Error('expected SplitNode subtree');
    expect(sub.direction).toBe('vertical');
  });

  it('dragLeave hides the drop overlay', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    fireEvent.dragOver(p1, { dataTransfer: makeDataTransfer(makePayload()) });
    expect(p1.querySelector('.drop-overlay')).not.toBeNull();
    fireEvent.dragLeave(p1, { dataTransfer: makeDataTransfer(makePayload()) });
    expect(p1.querySelector('.drop-overlay')).toBeNull();
  });

  it('dragOver without application/x-channel type does NOT reveal the overlay', () => {
    const { container } = render(<DockGrid />);
    const p1 = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    const dt = {
      types: ['text/plain'],
      getData: () => '',
      setData: () => undefined,
      effectAllowed: 'none' as const,
      dropEffect: 'none' as const,
    };
    fireEvent.dragOver(p1, { dataTransfer: dt });
    expect(p1.querySelector('.drop-overlay')).toBeNull();
  });

  it('PanelFrame supports an injected onDrop callback (DI for testing)', () => {
    const calls: Array<{ zone: string; payload: DragChannelPayload }> = [];
    const panel: PanelInstance = useWorkspaceStore.getState().panels.p1!;
    const { container } = render(
      <PanelFrame
        panel={panel}
        selected={false}
        onSelect={() => undefined}
        onClose={() => undefined}
        onDrop={(zone, payload) => calls.push({ zone, payload })}
      />
    );
    const root = container.querySelector<HTMLElement>('[data-panel-id="p1"]')!;
    fireEvent.dragOver(root, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    const center = root.querySelector<HTMLElement>('.drop-zone.z-center')!;
    fireEvent.drop(center, { dataTransfer: makeDataTransfer(makePayload(1003)) });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.zone).toBe('center');
    expect(calls[0]!.payload.channelId).toBe(1003);
  });
});
