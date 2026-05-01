/**
 * RTI Slice 1 — Core domain types (subset; full LayoutNode union added in US-002).
 *
 * Per spec §10 + Critic C9 + Plan v3 OQ-2: types are excluded from c8 coverage
 * via vitest.config.ts exclude.
 */

export type ChannelType =
  | 'analog'
  | 'discrete'
  | 'enum'
  | 'counter'
  | 'spectrum'
  | 'trajectory'
  | 'pose3d'
  | 'antenna3d'
  | 'video-ref'
  | 'derived';

export type QualityPolicy = 'keep-all' | 'good-crc-only' | 'decode-valid-only';

export interface ChannelSummary {
  channelId: number;
  name: string;
  displayName: string;
  group: string;
  subgroup?: string;
  unit?: string;
  channelType: ChannelType;
  sampleRateHz?: number;
  qualityPolicy: QualityPolicy;
  tags: string[];
  /** UI-only: prototype favorite flag */
  favorite?: boolean;
  /** UI-only: prototype alarm-armed flag */
  alarmArmed?: boolean;
}

export interface ChannelGroup {
  id: string;
  name: string;
  count: number;
  children: ChannelSummary[];
}

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface AnomalyCandidate {
  rank: number;
  title: string;
  confidence: number;
  evidenceKinds: string[];
  rationale: string;
}

export interface AnomalyDescriptor {
  anomalyId: string;
  channelId: number;
  channelDisplay: string;
  timestampNs: string;
  severity: AnomalySeverity;
  score: number;
  label: string;
  windowSec: [number, number];
  candidates: AnomalyCandidate[];
  relatedChannelIds: number[];
}

export type EventSeverity = 'info' | 'low' | 'medium' | 'high';

export interface EventDescriptor {
  timestampSec: number;
  severity: EventSeverity;
  code: string;
  channelId: number | null;
  message: string;
}

export interface TrackPoint {
  /** Synthetic projected x in pixel units (prototype data.jsx coordinate space) */
  x: number;
  /** Synthetic projected y in pixel units */
  y: number;
  /** Normalized 0..1 progress along track */
  t: number;
}

export type DragChannelPayload = {
  kind: 'channel-drag';
  channelId: number;
  displayName: string;
  channelType: ChannelType;
  unit?: string;
};

// ───────────────────────────────────────────────────────────────────────────
// Panels (spec §6)
// ───────────────────────────────────────────────────────────────────────────

export type PanelKind =
  | 'strip'
  | 'multistrip'
  | 'xy'
  | 'waterfall'
  | 'numeric'
  | 'discrete'
  | 'eventlog'
  | 'map2d'
  | 'trajectory3d'
  | 'attitude3d'
  | 'antenna3d'
  | 'video'
  | 'relationgraph'
  | 'simdisbridge'
  | 'globe'
  | 'gpslos'
  | 'table'
  | 'markdown'
  // US-2-006: RF instrumentation panels (Keysight LAN/SCPI integration view).
  | 'spectrum-rf'
  | 'iq'
  | 'eye'
  | 'analyzer-ctrl';

export type PanelBinding =
  | { type: 'channel'; channelId: number }
  | { type: 'channelGroup'; groupId: string }
  | { type: 'anomaly'; anomalyId: string }
  | { type: 'video'; videoId: string }
  | { type: 'mapLayer'; layerId: string }
  | { type: 'graphNode'; nodeId: string };

export interface PanelInstance {
  id: string;
  kind: PanelKind;
  title: string;
  layoutNodeId: string;
  bindings: PanelBinding[];
  options: Record<string, unknown>;
  uiState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Layout tree (spec §7.1) + FlatGridNode escape hatch (Critic C-fix /
// plan v3 §3 phase 2; Architect S3 / Tension 2.3 mitigation).
//
// Slice-1 uses FlatGridNode to reproduce the prototype's heterogeneous
// 14-cell 12×11 grid verbatim. Slice-2 introduces real drag-to-split, at
// which point a LayoutNode tree mutation transitions FlatGridNode →
// SplitNode/PanelNode subtree (planned in slice 2).
// ───────────────────────────────────────────────────────────────────────────

export interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratio: number[];
  children: LayoutNode[];
}

export interface TabNode {
  type: 'tabs';
  id: string;
  activePanelId: string;
  children: PanelNode[];
}

export interface PanelNode {
  type: 'panel';
  id: string;
  panelId: string;
}

export interface PanelCellPosition {
  panelId: string;
  /** 1-indexed CSS grid column start */
  gx: number;
  /** 1-indexed CSS grid row start */
  gy: number;
  /** Column span */
  gw: number;
  /** Row span */
  gh: number;
  /**
   * US-2-001: optional per-cell subtree. When present, the cell renders
   * `cellSubtree` (a SplitNode/TabNode/PanelNode tree) inside its grid area
   * instead of a single PanelNode keyed by `panelId`. This is the slice-2
   * mutation path for drag-to-split: the FlatGridNode frame is preserved,
   * but individual cells can host nested SplitNode trees. The `panelId`
   * field still identifies the cell for indexing, even when a subtree is
   * present (it equals the original panel id at split time).
   */
  cellSubtree?: LayoutNode;
}

export interface FlatGridNode {
  type: 'flat-grid';
  id: string;
  columns: number;
  rows: number;
  cells: PanelCellPosition[];
}

export type LayoutNode = SplitNode | TabNode | PanelNode | FlatGridNode;

// Type-narrowing helpers — used by DockGrid recursive renderer.
export function isSplitNode(n: LayoutNode): n is SplitNode {
  return n.type === 'split';
}
export function isTabNode(n: LayoutNode): n is TabNode {
  return n.type === 'tabs';
}
export function isPanelNode(n: LayoutNode): n is PanelNode {
  return n.type === 'panel';
}
export function isFlatGridNode(n: LayoutNode): n is FlatGridNode {
  return n.type === 'flat-grid';
}

// ───────────────────────────────────────────────────────────────────────────
// Relation graph (US-018a) — anomaly observation → channel/alarm/recommendation
// nodes connected by typed edges (spec §13.3).
// ───────────────────────────────────────────────────────────────────────────

export type GraphNodeKind =
  | 'observation'
  | 'channel'
  | 'alarm'
  | 'crc-cluster'
  | 'video-event'
  | 'recommendation';

export type GraphEdgeKind =
  | 'temporal-lead'
  | 'formula-dependency'
  | 'shared-frame'
  | 'shared-subsystem'
  | 'correlation'
  | 'video-alignment'
  | 'operator-bookmark';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  score?: number;
}

export interface GraphEdge {
  /** source node id */
  s: string;
  /** target node id */
  t: string;
  kind: GraphEdgeKind;
  /** weight 0..1 */
  w: number;
  verified: boolean;
  why: string;
}

export interface RelationGraph {
  root: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
