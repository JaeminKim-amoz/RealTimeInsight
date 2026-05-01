import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';
import { isFlatGridNode, isPanelNode, isSplitNode } from '../types/domain';
import type { PanelInstance } from '../types/domain';

function makePanel(id: string, overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id,
    kind: 'strip',
    title: id,
    layoutNodeId: 'pn-' + id,
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '2026-04-27T00:00:00Z',
    updatedAt: '2026-04-27T00:00:00Z',
    ...overrides,
  };
}

describe('store/workspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it('initial state is empty/null', () => {
    const s = useWorkspaceStore.getState();
    expect(s.workspaceId).toBeNull();
    expect(s.layoutTree).toBeNull();
    expect(s.panels).toEqual({});
    expect(s.dirty).toBe(false);
  });

  it('loadPreset("workstation-default") populates 14 panels with FlatGridNode geometry', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    const s = useWorkspaceStore.getState();
    expect(s.layoutTree).not.toBeNull();
    expect(s.layoutTree && isFlatGridNode(s.layoutTree)).toBe(true);
    expect(Object.keys(s.panels)).toHaveLength(14);
    expect(s.workspaceId).toBe('workstation-default');
    // dirty is false after preset load (clean state)
    expect(s.dirty).toBe(false);
  });

  it('preset reproduces prototype INITIAL_PANELS geometry exactly', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    const tree = useWorkspaceStore.getState().layoutTree;
    expect(tree).not.toBeNull();
    if (!tree || !isFlatGridNode(tree)) throw new Error('Expected FlatGridNode');
    const cells = Object.fromEntries(tree.cells.map((c) => [c.panelId, c]));
    // Spot check 4 critical cells matching public/app/app.jsx INITIAL_PANELS:
    expect(cells.p1).toEqual({ panelId: 'p1', gx: 1, gy: 1, gw: 5, gh: 3 });
    expect(cells.p2).toEqual({ panelId: 'p2', gx: 6, gy: 1, gw: 4, gh: 3 });
    expect(cells.p8b).toEqual({ panelId: 'p8b', gx: 6, gy: 7, gw: 3, gh: 3 });
    expect(cells.p13).toEqual({ panelId: 'p13', gx: 10, gy: 10, gw: 3, gh: 2 });
    expect(tree.columns).toBe(12);
    expect(tree.rows).toBe(11);
  });

  it('addPanel increments panel registry + marks dirty', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    useWorkspaceStore.getState().addPanel({
      id: 'p99',
      kind: 'numeric',
      title: 'Custom',
      layoutNodeId: 'workstation-default-grid',
      bindings: [],
      options: {},
      uiState: {},
      createdAt: '2026-04-27T01:00:00Z',
      updatedAt: '2026-04-27T01:00:00Z',
    });
    expect(useWorkspaceStore.getState().panels.p99?.title).toBe('Custom');
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it('removePanel deletes from registry + marks dirty', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    useWorkspaceStore.getState().removePanel('p1');
    expect(useWorkspaceStore.getState().panels.p1).toBeUndefined();
    expect(Object.keys(useWorkspaceStore.getState().panels)).toHaveLength(13);
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it('updatePanel mutates an existing panel', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    useWorkspaceStore.getState().updatePanel('p1', { title: 'Renamed Power' });
    expect(useWorkspaceStore.getState().panels.p1?.title).toBe('Renamed Power');
    expect(useWorkspaceStore.getState().dirty).toBe(true);
  });

  it('splitPanel converts a PanelNode into a SplitNode with 2 children', () => {
    // Set up a minimal LayoutNode tree with a single PanelNode
    useWorkspaceStore.getState().setLayoutTree({
      type: 'panel',
      id: 'pn-root',
      panelId: 'p1',
    });
    useWorkspaceStore.getState().addPanel(makePanel('p1', { layoutNodeId: 'pn-root' }));
    useWorkspaceStore.getState().splitPanel('p1', 'horizontal', makePanel('p2'));
    const tree = useWorkspaceStore.getState().layoutTree;
    expect(tree).not.toBeNull();
    if (!tree || !isSplitNode(tree)) throw new Error('Expected SplitNode after split');
    expect(tree.direction).toBe('horizontal');
    expect(tree.children).toHaveLength(2);
    expect(tree.children.every(isPanelNode)).toBe(true);
  });

  it('savePreset + loadPreset roundtrip preserves layout', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    useWorkspaceStore.getState().updatePanel('p1', { title: 'Modified' });
    useWorkspaceStore.getState().savePreset('my-preset');
    // Reset, then reload — title should be preserved
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().loadPreset('my-preset');
    expect(useWorkspaceStore.getState().panels.p1?.title).toBe('Modified');
  });

  it('markClean resets dirty flag', () => {
    useWorkspaceStore.getState().loadPreset('workstation-default');
    useWorkspaceStore.getState().updatePanel('p1', { title: 'X' });
    expect(useWorkspaceStore.getState().dirty).toBe(true);
    useWorkspaceStore.getState().markClean();
    expect(useWorkspaceStore.getState().dirty).toBe(false);
  });

  // ── US-2-001 — drag-to-split FlatGridNode mutation ────────────────────
  describe('US-2-001 splitPanel against FlatGridNode', () => {
    it('splitPanel against a FlatGridNode cell creates a SplitNode subtree at that cell, leaves other cells intact', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      const before = useWorkspaceStore.getState().layoutTree;
      if (!before || !isFlatGridNode(before)) throw new Error('expected flat-grid');
      const beforeCount = before.cells.length;

      useWorkspaceStore.getState().splitPanel('p1', 'horizontal', makePanel('p-new-1'));

      const after = useWorkspaceStore.getState().layoutTree;
      if (!after || !isFlatGridNode(after)) throw new Error('expected flat-grid still');
      // Cell count unchanged — split happens *inside* the cell
      expect(after.cells.length).toBe(beforeCount);
      // The p1 cell now hosts a SplitNode subtree, other cells are untouched
      const p1Cell = after.cells.find((c) => c.panelId === 'p1');
      expect(p1Cell).toBeDefined();
      expect(p1Cell?.cellSubtree).toBeDefined();
      const sub = p1Cell?.cellSubtree;
      if (!sub || !isSplitNode(sub)) throw new Error('expected SplitNode subtree on p1 cell');
      expect(sub.direction).toBe('horizontal');
      // Other cells untouched
      const p2Cell = after.cells.find((c) => c.panelId === 'p2');
      expect(p2Cell?.cellSubtree).toBeUndefined();
      expect(p2Cell).toEqual({ panelId: 'p2', gx: 6, gy: 1, gw: 4, gh: 3 });
    });

    it('splitPanel direction=horizontal produces children = [original-panel-node, new-panel-node] with ratio=[0.5, 0.5]', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      useWorkspaceStore.getState().splitPanel('p1', 'horizontal', makePanel('p-new-2'));
      const t = useWorkspaceStore.getState().layoutTree;
      if (!t || !isFlatGridNode(t)) throw new Error('expected flat-grid');
      const cell = t.cells.find((c) => c.panelId === 'p1')!;
      const sub = cell.cellSubtree!;
      if (!isSplitNode(sub)) throw new Error('expected SplitNode');
      expect(sub.ratio).toEqual([0.5, 0.5]);
      expect(sub.children).toHaveLength(2);
      expect(sub.children.every(isPanelNode)).toBe(true);
      const ids = sub.children.filter(isPanelNode).map((c) => c.panelId);
      expect(ids).toEqual(['p1', 'p-new-2']);
    });

    it('splitPanel auto-registers the new PanelInstance into panels[]', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      const newPanel = makePanel('p-new-3', { kind: 'numeric', title: 'New Numeric' });
      useWorkspaceStore.getState().splitPanel('p1', 'vertical', newPanel);
      const reg = useWorkspaceStore.getState().panels;
      expect(reg['p-new-3']).toBeDefined();
      expect(reg['p-new-3']?.title).toBe('New Numeric');
      expect(reg['p-new-3']?.kind).toBe('numeric');
    });

    it('splitPanel against a non-existent panelId is a no-op', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      const before = JSON.stringify(useWorkspaceStore.getState().layoutTree);
      useWorkspaceStore.getState().splitPanel('does-not-exist', 'horizontal', makePanel('p-x'));
      const after = JSON.stringify(useWorkspaceStore.getState().layoutTree);
      expect(after).toBe(before);
      // The new panel was NOT registered (no matching cell)
      expect(useWorkspaceStore.getState().panels['p-x']).toBeUndefined();
    });
  });

  describe('US-2-001 addBindingToPanel', () => {
    it('adds a channel binding when not present', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      const before = useWorkspaceStore.getState().panels.p1!.bindings.length;
      useWorkspaceStore.getState().addBindingToPanel('p1', { type: 'channel', channelId: 9999 });
      const after = useWorkspaceStore.getState().panels.p1!.bindings;
      expect(after.length).toBe(before + 1);
      expect(after).toContainEqual({ type: 'channel', channelId: 9999 });
    });

    it('is idempotent on duplicate channel binding', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      // p1 already has channelId 1001 in bindings (from preset)
      const before = useWorkspaceStore.getState().panels.p1!.bindings.length;
      useWorkspaceStore.getState().addBindingToPanel('p1', { type: 'channel', channelId: 1001 });
      const after = useWorkspaceStore.getState().panels.p1!.bindings.length;
      expect(after).toBe(before);
    });

    it('marks the workspace dirty', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      expect(useWorkspaceStore.getState().dirty).toBe(false);
      useWorkspaceStore.getState().addBindingToPanel('p1', { type: 'channel', channelId: 7777 });
      expect(useWorkspaceStore.getState().dirty).toBe(true);
    });

    it('is a no-op when the panel does not exist', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      useWorkspaceStore.getState().addBindingToPanel('not-a-panel', { type: 'channel', channelId: 1 });
      // No throw, no dirty flip from the no-op path
      expect(useWorkspaceStore.getState().panels['not-a-panel']).toBeUndefined();
    });
  });

  describe('US-2-001 localStorage persistence', () => {
    let backing: Record<string, string>;
    beforeEach(() => {
      backing = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => (k in backing ? backing[k] : null),
        setItem: (k: string, v: string) => {
          backing[k] = String(v);
        },
        removeItem: (k: string) => {
          delete backing[k];
        },
        clear: () => {
          for (const k of Object.keys(backing)) delete backing[k];
        },
        key: (i: number) => Object.keys(backing)[i] ?? null,
        get length() {
          return Object.keys(backing).length;
        },
      });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('save→localStorage→reset→load roundtrip preserves layoutTree + panels', () => {
      useWorkspaceStore.getState().loadPreset('workstation-default');
      useWorkspaceStore.getState().updatePanel('p1', { title: 'Persisted Power' });
      useWorkspaceStore.getState().saveCurrentWorkspaceToLocalStorage();
      // Backing key matches spec
      expect(backing['rti.workspace.current']).toBeDefined();

      useWorkspaceStore.getState().reset();
      expect(useWorkspaceStore.getState().layoutTree).toBeNull();

      const ok = useWorkspaceStore.getState().loadCurrentWorkspaceFromLocalStorage();
      expect(ok).toBe(true);
      expect(useWorkspaceStore.getState().panels.p1?.title).toBe('Persisted Power');
      const tree = useWorkspaceStore.getState().layoutTree;
      expect(tree && isFlatGridNode(tree)).toBe(true);
    });

    it('loadCurrentWorkspaceFromLocalStorage returns false when no saved data', () => {
      // No save first
      expect(useWorkspaceStore.getState().loadCurrentWorkspaceFromLocalStorage()).toBe(false);
    });

    it('saveCurrentWorkspaceToLocalStorage is a no-op when there is no current workspace', () => {
      // initial state has layoutTree=null
      useWorkspaceStore.getState().saveCurrentWorkspaceToLocalStorage();
      expect(backing['rti.workspace.current']).toBeUndefined();
    });

    it('loadCurrentWorkspaceFromLocalStorage returns false on malformed JSON', () => {
      backing['rti.workspace.current'] = '{not valid json';
      expect(useWorkspaceStore.getState().loadCurrentWorkspaceFromLocalStorage()).toBe(false);
    });
  });
});
