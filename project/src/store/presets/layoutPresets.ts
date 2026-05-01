/**
 * Layout preset catalog (US-2-004a) — 6 factory presets + 3 mock shared workspaces.
 *
 * Each factory preset is a minimal FlatGridNode + PanelInstance map (slice-2
 * scope: enough panels for the visual gallery, not full prototype fidelity).
 * The Workstation Default preset already lives in workstationDefault.ts and is
 * re-exported here as 'flight-analysis' so the LayoutPresetModal gallery can
 * load the same 14-panel layout.
 */
import type {
  FlatGridNode,
  LayoutNode,
  PanelBinding,
  PanelInstance,
  PanelKind,
} from '../../types/domain';
import type { WorkspacePresetSummary } from '../workspaceStore';
import {
  buildWorkstationDefaultLayout,
  buildWorkstationDefaultPanels,
} from './workstationDefault';

const NOW = '2026-04-27T00:00:00.000Z';

interface PanelDef {
  id: string;
  kind: PanelKind;
  title: string;
  bindings: PanelBinding[];
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

function buildLayout(id: string, columns: number, rows: number, panels: PanelDef[]): FlatGridNode {
  return {
    type: 'flat-grid',
    id,
    columns,
    rows,
    cells: panels.map((p) => ({ panelId: p.id, gx: p.gx, gy: p.gy, gw: p.gw, gh: p.gh })),
  };
}

function buildPanels(layoutNodeId: string, panels: PanelDef[]): Record<string, PanelInstance> {
  const out: Record<string, PanelInstance> = {};
  for (const p of panels) {
    out[p.id] = {
      id: p.id,
      kind: p.kind,
      title: p.title,
      layoutNodeId,
      bindings: p.bindings,
      options: {},
      uiState: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  }
  return out;
}

// ── Factory preset 2: RF / Spectrum (4 panels) ──────────────────────────
const RF_SPECTRUM_PANELS: PanelDef[] = [
  { id: 'rf-spec', kind: 'waterfall', title: 'Spectrum', gx: 1, gy: 1, gw: 6, gh: 4,
    bindings: [{ type: 'channel', channelId: 5001 }] },
  { id: 'rf-iq', kind: 'xy', title: 'IQ', gx: 7, gy: 1, gw: 6, gh: 4, bindings: [] },
  { id: 'rf-eye', kind: 'xy', title: 'Eye Diagram', gx: 1, gy: 5, gw: 6, gh: 3, bindings: [] },
  { id: 'rf-ctrl', kind: 'numeric', title: 'Analyzer Ctrl', gx: 7, gy: 5, gw: 6, gh: 3,
    bindings: [{ type: 'channel', channelId: 5002 }, { type: 'channel', channelId: 5003 }] },
];

// ── Factory preset 3: Integrated Map + Video (3 panels) ─────────────────
const MAP_VIDEO_PANELS: PanelDef[] = [
  { id: 'mv-map', kind: 'map2d', title: 'Map 2D', gx: 1, gy: 1, gw: 7, gh: 7,
    bindings: [{ type: 'channel', channelId: 3001 }] },
  { id: 'mv-video', kind: 'video', title: 'Front EO', gx: 8, gy: 1, gw: 5, gh: 4,
    bindings: [{ type: 'channel', channelId: 7001 }] },
  { id: 'mv-events', kind: 'eventlog', title: 'Event Log', gx: 8, gy: 5, gw: 5, gh: 3,
    bindings: [] },
];

// ── Factory preset 4: Anomaly Triage (4 panels) ─────────────────────────
const ANOMALY_TRIAGE_PANELS: PanelDef[] = [
  { id: 'at-graph', kind: 'relationgraph', title: 'Relation Graph', gx: 1, gy: 1, gw: 6, gh: 5,
    bindings: [] },
  { id: 'at-events', kind: 'eventlog', title: 'Event Log', gx: 7, gy: 1, gw: 6, gh: 5,
    bindings: [] },
  { id: 'at-strip-1', kind: 'strip', title: 'Hyd Pressure A', gx: 1, gy: 6, gw: 6, gh: 3,
    bindings: [{ type: 'channel', channelId: 1205 }] },
  { id: 'at-strip-2', kind: 'strip', title: 'Bus Current', gx: 7, gy: 6, gw: 6, gh: 3,
    bindings: [{ type: 'channel', channelId: 1002 }] },
];

// ── Factory preset 5: Mission Rehearsal (5 panels, BottomConsole-only) ─
const MISSION_REHEARSAL_PANELS: PanelDef[] = [
  { id: 'mr-globe', kind: 'globe', title: 'Globe', gx: 1, gy: 1, gw: 6, gh: 4, bindings: [] },
  { id: 'mr-map2d', kind: 'map2d', title: 'Map 2D', gx: 7, gy: 1, gw: 6, gh: 4,
    bindings: [{ type: 'channel', channelId: 3001 }] },
  { id: 'mr-traj', kind: 'trajectory3d', title: '3D Trajectory', gx: 1, gy: 5, gw: 6, gh: 4,
    bindings: [
      { type: 'channel', channelId: 3001 },
      { type: 'channel', channelId: 3002 },
      { type: 'channel', channelId: 3003 },
    ] },
  { id: 'mr-att', kind: 'attitude3d', title: 'Attitude 3D', gx: 7, gy: 5, gw: 3, gh: 4,
    bindings: [{ type: 'channel', channelId: 2210 }] },
  { id: 'mr-bottom', kind: 'eventlog', title: 'Bottom Console', gx: 10, gy: 5, gw: 3, gh: 4,
    bindings: [] },
];

// ── Factory preset 6: Engineering Check (6 panels) ──────────────────────
const ENG_CHECK_PANELS: PanelDef[] = [
  { id: 'ec-strip-1', kind: 'strip', title: 'Power Bus', gx: 1, gy: 1, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 1001 }] },
  { id: 'ec-strip-2', kind: 'strip', title: 'Hydraulic', gx: 5, gy: 1, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 1205 }] },
  { id: 'ec-strip-3', kind: 'strip', title: 'Pose', gx: 9, gy: 1, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 2210 }] },
  { id: 'ec-numeric', kind: 'numeric', title: 'Numeric Tile', gx: 1, gy: 4, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 1001 }] },
  { id: 'ec-discrete', kind: 'discrete', title: 'Discrete', gx: 5, gy: 4, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 1007 }] },
  { id: 'ec-waterfall', kind: 'waterfall', title: 'Waterfall', gx: 9, gy: 4, gw: 4, gh: 3,
    bindings: [{ type: 'channel', channelId: 5001 }] },
];

export interface LayoutPresetMeta {
  id: string;
  label: string;
  tags: string[];
  panelCount: number;
  thumb: 'flight' | 'spectrum' | 'map' | 'triage' | 'rehearsal' | 'check';
  description: string;
}

export const FACTORY_PRESET_IDS: ReadonlySet<string> = new Set([
  'flight-analysis',
  'rf-spectrum',
  'map-video',
  'anomaly-triage',
  'mission-rehearsal',
  'eng-check',
]);

export const LAYOUT_PRESET_META: ReadonlyArray<LayoutPresetMeta> = [
  { id: 'flight-analysis', label: 'Flight Analysis', tags: ['flight-test', 'default'], panelCount: 14, thumb: 'flight',
    description: 'Power, hydraulics, attitude, trajectory, event log' },
  { id: 'rf-spectrum', label: 'RF / Spectrum', tags: ['rf', 'link-analysis'], panelCount: 4, thumb: 'spectrum',
    description: 'Spectrum, IQ, Eye Diagram, Analyzer Ctrl' },
  { id: 'map-video', label: 'Integrated Map + Video', tags: ['tactical', 'c2'], panelCount: 3, thumb: 'map',
    description: 'Map 2D, Front EO video, Event Log' },
  { id: 'anomaly-triage', label: 'Anomaly Triage', tags: ['post-flight', 'analysis'], panelCount: 4, thumb: 'triage',
    description: 'Relation graph, event log, paired strips' },
  { id: 'mission-rehearsal', label: 'Mission Rehearsal', tags: ['replay', 'training'], panelCount: 5, thumb: 'rehearsal',
    description: 'Globe, Map 2D, 3D Trajectory, Attitude 3D, BottomConsole' },
  { id: 'eng-check', label: 'Engineering Check', tags: ['preflight'], panelCount: 6, thumb: 'check',
    description: 'Strip × 3, Numeric, Discrete, Waterfall' },
];

export function buildFactoryPresets(): WorkspacePresetSummary[] {
  return [
    {
      id: 'flight-analysis',
      label: 'Flight Analysis',
      layoutTree: buildWorkstationDefaultLayout() as LayoutNode,
      panels: buildWorkstationDefaultPanels(),
    },
    {
      id: 'rf-spectrum',
      label: 'RF / Spectrum',
      layoutTree: buildLayout('rf-spectrum-grid', 12, 8, RF_SPECTRUM_PANELS),
      panels: buildPanels('rf-spectrum-grid', RF_SPECTRUM_PANELS),
    },
    {
      id: 'map-video',
      label: 'Integrated Map + Video',
      layoutTree: buildLayout('map-video-grid', 12, 8, MAP_VIDEO_PANELS),
      panels: buildPanels('map-video-grid', MAP_VIDEO_PANELS),
    },
    {
      id: 'anomaly-triage',
      label: 'Anomaly Triage',
      layoutTree: buildLayout('anomaly-triage-grid', 12, 9, ANOMALY_TRIAGE_PANELS),
      panels: buildPanels('anomaly-triage-grid', ANOMALY_TRIAGE_PANELS),
    },
    {
      id: 'mission-rehearsal',
      label: 'Mission Rehearsal',
      layoutTree: buildLayout('mission-rehearsal-grid', 12, 9, MISSION_REHEARSAL_PANELS),
      panels: buildPanels('mission-rehearsal-grid', MISSION_REHEARSAL_PANELS),
    },
    {
      id: 'eng-check',
      label: 'Engineering Check',
      layoutTree: buildLayout('eng-check-grid', 12, 7, ENG_CHECK_PANELS),
      panels: buildPanels('eng-check-grid', ENG_CHECK_PANELS),
    },
  ];
}

// ── Mock shared (Team) workspaces — read-only catalog ───────────────────
export interface SharedWorkspaceMeta {
  id: string;
  label: string;
  team: string;
  by: string;
  when: string;
  layoutTree: LayoutNode;
  panels: Record<string, PanelInstance>;
}

export const SHARED_WORKSPACES: ReadonlyArray<SharedWorkspaceMeta> = [
  {
    id: 'shared-debrief-0420',
    label: 'sortie-0420 post-debrief',
    team: 'team-flight-test',
    by: 'jw-park',
    when: '2h ago',
    layoutTree: buildLayout('shared-debrief-0420-grid', 12, 8, RF_SPECTRUM_PANELS),
    panels: buildPanels('shared-debrief-0420-grid', RF_SPECTRUM_PANELS),
  },
  {
    id: 'shared-link-budget',
    label: 'link-budget-0918',
    team: 'eng-rf',
    by: 'mj-choi',
    when: '3d ago',
    layoutTree: buildLayout('shared-link-budget-grid', 12, 8, RF_SPECTRUM_PANELS),
    panels: buildPanels('shared-link-budget-grid', RF_SPECTRUM_PANELS),
  },
  {
    id: 'shared-crc-cluster',
    label: 'CRC cluster analysis',
    team: 'eng-rf',
    by: 'dh-lee',
    when: '1w ago',
    layoutTree: buildLayout('shared-crc-cluster-grid', 12, 9, ANOMALY_TRIAGE_PANELS),
    panels: buildPanels('shared-crc-cluster-grid', ANOMALY_TRIAGE_PANELS),
  },
];
