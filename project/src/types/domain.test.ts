import { describe, it, expect } from 'vitest';
import {
  isSplitNode,
  isTabNode,
  isPanelNode,
  isFlatGridNode,
  type LayoutNode,
  type SplitNode,
  type TabNode,
  type PanelNode,
  type FlatGridNode,
  type PanelInstance,
  type PanelBinding,
  type PanelKind,
} from './domain';

describe('types/domain — LayoutNode union + type-narrowing helpers', () => {
  it('isSplitNode narrows on a SplitNode', () => {
    const node: SplitNode = {
      type: 'split',
      id: 's1',
      direction: 'horizontal',
      ratio: [0.5, 0.5],
      children: [],
    };
    const layout: LayoutNode = node;
    expect(isSplitNode(layout)).toBe(true);
    expect(isTabNode(layout)).toBe(false);
    expect(isPanelNode(layout)).toBe(false);
    expect(isFlatGridNode(layout)).toBe(false);
  });

  it('isTabNode narrows on a TabNode', () => {
    const node: TabNode = {
      type: 'tabs',
      id: 't1',
      activePanelId: 'p1',
      children: [],
    };
    const layout: LayoutNode = node;
    expect(isTabNode(layout)).toBe(true);
    expect(isSplitNode(layout)).toBe(false);
  });

  it('isPanelNode narrows on a PanelNode', () => {
    const node: PanelNode = { type: 'panel', id: 'pn1', panelId: 'p-strip-1' };
    const layout: LayoutNode = node;
    expect(isPanelNode(layout)).toBe(true);
    expect(isFlatGridNode(layout)).toBe(false);
  });

  it('isFlatGridNode narrows on a FlatGridNode (the slice-1 escape hatch)', () => {
    const node: FlatGridNode = {
      type: 'flat-grid',
      id: 'fg-default',
      columns: 12,
      rows: 11,
      cells: [
        { panelId: 'p1', gx: 1, gy: 1, gw: 5, gh: 3 },
        { panelId: 'p2', gx: 6, gy: 1, gw: 4, gh: 3 },
      ],
    };
    const layout: LayoutNode = node;
    expect(isFlatGridNode(layout)).toBe(true);
    expect(isSplitNode(layout)).toBe(false);
    expect(node.cells).toHaveLength(2);
  });

  it('PanelKind union covers all 13 spec panel kinds + globe + gpslos', () => {
    // Compile-time: assignment proves coverage. Runtime: assert array enumerates.
    const kinds: PanelKind[] = [
      'strip',
      'multistrip',
      'xy',
      'waterfall',
      'numeric',
      'discrete',
      'eventlog',
      'map2d',
      'trajectory3d',
      'attitude3d',
      'antenna3d',
      'video',
      'relationgraph',
      'simdisbridge',
      'globe',
      'gpslos',
    ];
    // Each kind appears once
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('strip');
    expect(kinds).toContain('globe');
    expect(kinds).toContain('gpslos');
  });

  it('PanelInstance shape matches spec §6.1', () => {
    const panel: PanelInstance = {
      id: 'p-strip-1001',
      kind: 'strip',
      title: 'Power Bus',
      layoutNodeId: 'pn-1',
      bindings: [{ type: 'channel', channelId: 1001 }],
      options: { overlayMode: 'multi-axis' },
      uiState: {},
      createdAt: '2026-04-27T00:00:00Z',
      updatedAt: '2026-04-27T00:05:00Z',
    };
    expect(panel.kind).toBe('strip');
    expect(panel.bindings[0]).toMatchObject({ type: 'channel', channelId: 1001 });
  });

  it('PanelBinding discriminated union supports channel/channelGroup/anomaly/video/mapLayer/graphNode', () => {
    const bindings: PanelBinding[] = [
      { type: 'channel', channelId: 1001 },
      { type: 'channelGroup', groupId: 'power' },
      { type: 'anomaly', anomalyId: 'anom-001' },
      { type: 'video', videoId: 'cam-front' },
      { type: 'mapLayer', layerId: 'sat' },
      { type: 'graphNode', nodeId: 'obs-1205' },
    ];
    expect(bindings).toHaveLength(6);
  });
});
