/**
 * WorkspaceStore — owns LayoutNode tree, PanelInstance registry, presets, dirty flag.
 *
 * Spec §8.1; Plan v3 §3 phase 3 driver #5 (subscriptions handled by StreamStore,
 * never here). Slice-1 supports FlatGridNode (workstation-default) plus the
 * recursive Split/Tabs/Panel union for future drag-to-split.
 *
 * State shape mirrors spec §8.1 WorkspaceStoreState. Actions deliberately keep
 * preset save/load purely in-memory for slice 1; persistence to disk lands
 * with US-021 app composition (or later via integrationStore.exportJobs).
 *
 * ── US-2-001 (slice 2) ────────────────────────────────────────────────
 * splitPanel now accepts a full PanelInstance (not just an id) so the store
 * can register the new panel AND insert it into the layout tree atomically.
 *
 * Path B for FlatGridNode mutation (chosen for smaller diff): each
 * PanelCellPosition gains an optional `cellSubtree` field. When set, the cell
 * renders that subtree (e.g. a SplitNode) instead of a single PanelNode. The
 * surrounding FlatGridNode frame and other cells are preserved verbatim, so
 * the existing 14-cell prototype geometry is untouched by a single split.
 *
 * localStorage persistence: saveCurrentWorkspaceToLocalStorage /
 * loadCurrentWorkspaceFromLocalStorage round-trip a JSON snapshot under
 * `rti.workspace.current`.
 */

import { create } from 'zustand';
import type {
  FlatGridNode,
  LayoutNode,
  PanelBinding,
  PanelInstance,
  PanelNode,
  SplitNode,
} from '../types/domain';
import { isPanelNode } from '../types/domain';
import {
  buildWorkstationDefaultLayout,
  buildWorkstationDefaultPanels,
} from './presets/workstationDefault';

export interface WorkspacePresetSummary {
  id: string;
  label: string;
  layoutTree: LayoutNode;
  panels: Record<string, PanelInstance>;
}

export interface WorkspaceStoreState {
  workspaceId: string | null;
  workspaceName: string | null;
  layoutTree: LayoutNode | null;
  panels: Record<string, PanelInstance>;
  presets: WorkspacePresetSummary[];
  dirty: boolean;

  // ── actions ────────────────────────────────────────────────────────
  setLayoutTree: (tree: LayoutNode | null) => void;
  addPanel: (panel: PanelInstance) => void;
  removePanel: (panelId: string) => void;
  updatePanel: (panelId: string, patch: Partial<PanelInstance>) => void;
  /**
   * Splits the panel identified by `targetPanelId` along `direction`,
   * registering `newPanel` and inserting it as a sibling. Handles four
   * structural shapes:
   *   1. Root SplitNode/TabNode containing a PanelNode whose panelId
   *      matches → recurse and replace that PanelNode with a SplitNode.
   *   2. Root PanelNode whose panelId matches → replace root with a
   *      SplitNode containing the original + new PanelNode.
   *   3. FlatGridNode whose cell.panelId matches → set that cell's
   *      cellSubtree to a SplitNode containing original + new (path B).
   *   4. FlatGridNode whose cell already has a cellSubtree containing the
   *      target PanelNode → recurse into the subtree.
   */
  splitPanel: (
    targetPanelId: string,
    direction: 'horizontal' | 'vertical',
    newPanel: PanelInstance,
  ) => void;
  /** US-2-002 center-zone drop: append a binding if not already present. */
  addBindingToPanel: (panelId: string, binding: PanelBinding) => void;
  loadPreset: (presetId: string) => void;
  savePreset: (presetId: string, label?: string) => void;
  /** US-2-001 slice-2: persist current workspace under rti.workspace.current. */
  saveCurrentWorkspaceToLocalStorage: () => void;
  /** US-2-001 slice-2: restore workspace from rti.workspace.current. */
  loadCurrentWorkspaceFromLocalStorage: () => boolean;
  markClean: () => void;
  markDirty: () => void;
  reset: () => void;
}

const FACTORY_PRESETS: WorkspacePresetSummary[] = [
  {
    id: 'workstation-default',
    label: 'Workstation Default (14 panels)',
    layoutTree: buildWorkstationDefaultLayout(),
    panels: buildWorkstationDefaultPanels(),
  },
];

const INITIAL: Pick<
  WorkspaceStoreState,
  'workspaceId' | 'workspaceName' | 'layoutTree' | 'panels' | 'presets' | 'dirty'
> = {
  workspaceId: null,
  workspaceName: null,
  layoutTree: null,
  panels: {},
  presets: FACTORY_PRESETS.slice(),
  dirty: false,
};

const LOCAL_STORAGE_KEY = 'rti.workspace.current';

/**
 * Recursively replaces the PanelNode whose panelId === `targetPanelId` with a
 * SplitNode containing the original PanelNode plus a new sibling PanelNode
 * pointing at `newPanelId`. Returns a tuple [newTree, didReplace] so callers
 * can detect a no-op.
 */
function splitTreeByPanelId(
  tree: LayoutNode,
  targetPanelId: string,
  direction: 'horizontal' | 'vertical',
  newPanelId: string,
): [LayoutNode, boolean] {
  if (isPanelNode(tree) && tree.panelId === targetPanelId) {
    const newPanelNode: PanelNode = {
      type: 'panel',
      id: `${tree.id}-split-${newPanelId}`,
      panelId: newPanelId,
    };
    const split: SplitNode = {
      type: 'split',
      id: `${tree.id}-split`,
      direction,
      ratio: [0.5, 0.5],
      children: [tree, newPanelNode],
    };
    return [split, true];
  }
  if (tree.type === 'split') {
    let changed = false;
    const next = tree.children.map((c) => {
      const [n, ok] = splitTreeByPanelId(c, targetPanelId, direction, newPanelId);
      if (ok) changed = true;
      return n;
    });
    if (!changed) return [tree, false];
    return [{ ...tree, children: next }, true];
  }
  if (tree.type === 'tabs') {
    let changed = false;
    const next = tree.children.map((c) => {
      const [n, ok] = splitTreeByPanelId(c, targetPanelId, direction, newPanelId);
      if (ok) changed = true;
      return n as PanelNode;
    });
    if (!changed) return [tree, false];
    return [{ ...tree, children: next }, true];
  }
  if (tree.type === 'flat-grid') {
    let changed = false;
    const cells = tree.cells.map((cell) => {
      // If the cell already hosts a subtree, recurse into it.
      if (cell.cellSubtree) {
        const [sub, ok] = splitTreeByPanelId(cell.cellSubtree, targetPanelId, direction, newPanelId);
        if (ok) {
          changed = true;
          return { ...cell, cellSubtree: sub };
        }
        return cell;
      }
      // Otherwise the cell stands for a virtual PanelNode keyed by panelId.
      if (cell.panelId === targetPanelId) {
        changed = true;
        const originalPanelNode: PanelNode = {
          type: 'panel',
          id: `pn-${cell.panelId}`,
          panelId: cell.panelId,
        };
        const newPanelNode: PanelNode = {
          type: 'panel',
          id: `pn-${newPanelId}`,
          panelId: newPanelId,
        };
        const split: SplitNode = {
          type: 'split',
          id: `split-${cell.panelId}`,
          direction,
          ratio: [0.5, 0.5],
          children: [originalPanelNode, newPanelNode],
        };
        return { ...cell, cellSubtree: split };
      }
      return cell;
    });
    if (!changed) return [tree, false];
    return [{ ...tree, cells }, true];
  }
  return [tree, false];
}

function clonePanelMap(src: Record<string, PanelInstance>): Record<string, PanelInstance> {
  const out: Record<string, PanelInstance> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { ...v, bindings: v.bindings.slice(), options: { ...v.options }, uiState: { ...v.uiState } };
  }
  return out;
}

function cloneLayout(tree: LayoutNode): LayoutNode {
  return JSON.parse(JSON.stringify(tree)) as LayoutNode;
}

function bindingsEqual(a: PanelBinding, b: PanelBinding): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'channel':
      return b.type === 'channel' && a.channelId === b.channelId;
    case 'channelGroup':
      return b.type === 'channelGroup' && a.groupId === b.groupId;
    case 'anomaly':
      return b.type === 'anomaly' && a.anomalyId === b.anomalyId;
    case 'video':
      return b.type === 'video' && a.videoId === b.videoId;
    case 'mapLayer':
      return b.type === 'mapLayer' && a.layerId === b.layerId;
    case 'graphNode':
      return b.type === 'graphNode' && a.nodeId === b.nodeId;
    default:
      return false;
  }
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  ...INITIAL,

  setLayoutTree: (tree) => set({ layoutTree: tree, dirty: true }),

  addPanel: (panel) =>
    set((s) => ({
      panels: { ...s.panels, [panel.id]: panel },
      dirty: true,
    })),

  removePanel: (panelId) =>
    set((s) => {
      const next = { ...s.panels };
      delete next[panelId];
      return { panels: next, dirty: true };
    }),

  updatePanel: (panelId, patch) =>
    set((s) => {
      const cur = s.panels[panelId];
      if (!cur) return s;
      return {
        panels: { ...s.panels, [panelId]: { ...cur, ...patch, updatedAt: new Date().toISOString() } },
        dirty: true,
      };
    }),

  splitPanel: (targetPanelId, direction, newPanel) =>
    set((s) => {
      if (!s.layoutTree) return s;
      const [next, ok] = splitTreeByPanelId(s.layoutTree, targetPanelId, direction, newPanel.id);
      if (!ok) return s;
      return {
        layoutTree: next,
        panels: { ...s.panels, [newPanel.id]: newPanel },
        dirty: true,
      };
    }),

  addBindingToPanel: (panelId, binding) =>
    set((s) => {
      const cur = s.panels[panelId];
      if (!cur) return s;
      if (cur.bindings.some((b) => bindingsEqual(b, binding))) return s;
      return {
        panels: {
          ...s.panels,
          [panelId]: {
            ...cur,
            bindings: [...cur.bindings, binding],
            updatedAt: new Date().toISOString(),
          },
        },
        dirty: true,
      };
    }),

  loadPreset: (presetId) =>
    set((s) => {
      const preset = s.presets.find((p) => p.id === presetId);
      if (!preset) return s;
      return {
        workspaceId: preset.id,
        workspaceName: preset.label,
        layoutTree: cloneLayout(preset.layoutTree),
        panels: clonePanelMap(preset.panels),
        dirty: false,
      };
    }),

  savePreset: (presetId, label) =>
    set((s) => {
      if (!s.layoutTree) return s;
      const next: WorkspacePresetSummary = {
        id: presetId,
        label: label ?? presetId,
        layoutTree: cloneLayout(s.layoutTree),
        panels: clonePanelMap(s.panels),
      };
      const others = s.presets.filter((p) => p.id !== presetId);
      return { presets: [...others, next], dirty: false };
    }),

  saveCurrentWorkspaceToLocalStorage: () => {
    const s = get();
    if (!s.layoutTree) return;
    try {
      const blob = JSON.stringify({
        workspaceId: s.workspaceId,
        workspaceName: s.workspaceName,
        layoutTree: s.layoutTree,
        panels: s.panels,
      });
      // Guard for environments without localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, blob);
      }
    } catch {
      // Quota exceeded / serialization error — silent no-op (slice-2 minimal).
    }
  },

  loadCurrentWorkspaceFromLocalStorage: () => {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw == null) return false;
    try {
      const parsed = JSON.parse(raw) as {
        workspaceId: string | null;
        workspaceName: string | null;
        layoutTree: LayoutNode;
        panels: Record<string, PanelInstance>;
      };
      if (!parsed || !parsed.layoutTree || !parsed.panels) return false;
      set({
        workspaceId: parsed.workspaceId ?? null,
        workspaceName: parsed.workspaceName ?? null,
        layoutTree: parsed.layoutTree,
        panels: parsed.panels,
        dirty: false,
      });
      return true;
    } catch {
      return false;
    }
  },

  markClean: () => set({ dirty: false }),
  markDirty: () => set({ dirty: true }),
  // Reset clears the current workspace but preserves the preset library so
  // user-saved presets survive across resets (savePreset → reset → loadPreset roundtrip).
  reset: () =>
    set((s) => ({
      workspaceId: null,
      workspaceName: null,
      layoutTree: null,
      panels: {},
      presets: s.presets.length > 0 ? s.presets : FACTORY_PRESETS.slice(),
      dirty: false,
    })),
}));

// Re-export for convenience (test imports)
export { buildWorkstationDefaultLayout, buildWorkstationDefaultPanels } from './presets/workstationDefault';

/**
 * Internal helper exposed for tests that need a fresh FlatGridNode tree.
 */
export function asFlatGrid(tree: LayoutNode | null): FlatGridNode | null {
  return tree && tree.type === 'flat-grid' ? tree : null;
}
