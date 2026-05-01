/**
 * Workstation default preset — reproduces public/app/app.jsx INITIAL_PANELS
 * verbatim using a FlatGridNode (slice-1 frozen geometry). Plan v3 §3 phase 2,
 * Critic C3, Architect S3.
 *
 * The 14 cells map exactly to the prototype's `gridColumn: gx / span gw;
 * gridRow: gy / span gh` placements on a 12×11 grid.
 */

import type { FlatGridNode, PanelBinding, PanelInstance, PanelKind } from '../../types/domain';

interface WorkstationDefaultPanelDef {
  id: string;
  kind: PanelKind;
  title: string;
  bindings: PanelBinding[];
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  linked?: boolean;
}

const PANELS: WorkstationDefaultPanelDef[] = [
  { id: 'p1', kind: 'strip', title: 'Power Bus', gx: 1, gy: 1, gw: 5, gh: 3, linked: true,
    bindings: [{ type: 'channel', channelId: 1001 }, { type: 'channel', channelId: 1002 }] },
  { id: 'p2', kind: 'strip', title: 'Hydraulic A / B', gx: 6, gy: 1, gw: 4, gh: 3, linked: true,
    bindings: [{ type: 'channel', channelId: 1205 }, { type: 'channel', channelId: 1206 }] },
  { id: 'p3', kind: 'numeric', title: 'Flight State', gx: 10, gy: 1, gw: 3, gh: 3,
    bindings: [
      { type: 'channel', channelId: 1001 },
      { type: 'channel', channelId: 1002 },
      { type: 'channel', channelId: 2217 },
      { type: 'channel', channelId: 2218 },
      { type: 'channel', channelId: 1205 },
      { type: 'channel', channelId: 1207 },
    ] },
  { id: 'p4', kind: 'strip', title: 'Pose · Roll/Pitch/Yaw', gx: 1, gy: 4, gw: 4, gh: 3, linked: true,
    bindings: [
      { type: 'channel', channelId: 2210 },
      { type: 'channel', channelId: 2211 },
      { type: 'channel', channelId: 2212 },
    ] },
  { id: 'p5', kind: 'waterfall', title: 'RF Spectrum L-band', gx: 5, gy: 4, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 5001 }] },
  { id: 'p6', kind: 'attitude3d', title: 'ADI · Attitude', gx: 9, gy: 4, gw: 4, gh: 3,
    bindings: [
      { type: 'channel', channelId: 2210 },
      { type: 'channel', channelId: 2211 },
      { type: 'channel', channelId: 2212 },
    ] },
  { id: 'p7', kind: 'map2d', title: 'Map · Sortie Track', gx: 1, gy: 7, gw: 3, gh: 3,
    bindings: [{ type: 'channel', channelId: 3001 }] },
  { id: 'p8', kind: 'video', title: 'Video · Front EO', gx: 4, gy: 7, gw: 2, gh: 3,
    bindings: [{ type: 'channel', channelId: 7001 }] },
  { id: 'p8b', kind: 'trajectory3d', title: '3D Trajectory', gx: 6, gy: 7, gw: 3, gh: 3,
    bindings: [
      { type: 'channel', channelId: 3001 },
      { type: 'channel', channelId: 3002 },
      { type: 'channel', channelId: 3003 },
    ] },
  { id: 'p9', kind: 'relationgraph', title: 'Evidence Graph', gx: 9, gy: 7, gw: 2, gh: 3,
    bindings: [] },
  { id: 'p10', kind: 'simdisbridge', title: 'SimDIS Bridge', gx: 11, gy: 7, gw: 2, gh: 3,
    bindings: [] },
  { id: 'p11', kind: 'discrete', title: 'Discrete States', gx: 1, gy: 10, gw: 4, gh: 2,
    bindings: [
      { type: 'channel', channelId: 1007 },
      { type: 'channel', channelId: 1210 },
      { type: 'channel', channelId: 5004 },
      { type: 'channel', channelId: 5005 },
    ] },
  { id: 'p12', kind: 'eventlog', title: 'Event Log · Alarms', gx: 5, gy: 10, gw: 5, gh: 2,
    bindings: [] },
  { id: 'p13', kind: 'strip', title: 'Link RSSI · SNR', gx: 10, gy: 10, gw: 3, gh: 2,
    bindings: [{ type: 'channel', channelId: 5002 }, { type: 'channel', channelId: 5003 }] },
];

const NOW = '2026-04-27T00:00:00.000Z';

/**
 * Build the workstation-default FlatGridNode.
 * Returns a fresh tree on every call so callers can mutate freely.
 */
export function buildWorkstationDefaultLayout(): FlatGridNode {
  return {
    type: 'flat-grid',
    id: 'workstation-default-grid',
    columns: 12,
    rows: 11,
    cells: PANELS.map((p) => ({
      panelId: p.id,
      gx: p.gx,
      gy: p.gy,
      gw: p.gw,
      gh: p.gh,
    })),
  };
}

/**
 * Build the workstation-default panel registry (Record<panelId, PanelInstance>).
 */
export function buildWorkstationDefaultPanels(): Record<string, PanelInstance> {
  const out: Record<string, PanelInstance> = {};
  for (const p of PANELS) {
    out[p.id] = {
      id: p.id,
      kind: p.kind,
      title: p.title,
      layoutNodeId: 'workstation-default-grid',
      bindings: p.bindings,
      options: p.linked ? { linkedCursor: true } : {},
      uiState: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }
  return out;
}

export const WORKSTATION_DEFAULT_PANEL_COUNT = PANELS.length;
