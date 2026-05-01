/**
 * RelationGraph pure layout helpers (US-018a).
 *
 * Three layout modes are supported (matches public/app/panels2.jsx):
 *   - 'force'    — observation centered, others distributed by edge-weight
 *   - 'radial'   — observation centered, non-root nodes arrayed on a ring
 *   - 'timeline' — sorted by score, placed on a horizontal timeline
 *
 * For slice 1, "force" uses a deterministic stable position table (driven by a
 * fixed hash of node id + index) — full d3-force lands slice 2.
 *
 * Pure: no DOM, no React, no random — output is deterministic given inputs.
 */

import type { GraphEdge, GraphNode } from '../../types/domain';

export type LayoutMode = 'force' | 'radial' | 'timeline';

export interface NodePosition {
  x: number;
  y: number;
}

export type PositionMap = Record<string, NodePosition>;

export interface LayoutInput {
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
  root: string;
  width: number;
  height: number;
  mode: LayoutMode;
  /** Iteration count for force layout (slice-1 noop, reserved for slice-2). */
  iters?: number;
}

/** Find the edge linking the root to a non-root node (in either direction). */
function findRootEdge(
  edges: ReadonlyArray<GraphEdge>,
  root: string,
  nodeId: string
): GraphEdge | undefined {
  return edges.find(
    (e) => (e.s === root && e.t === nodeId) || (e.t === root && e.s === nodeId)
  );
}

/** Radial: root at center, others on a ring at radius = 0.36 * min(w, h). */
function radialLayout(
  nodes: ReadonlyArray<GraphNode>,
  root: string,
  width: number,
  height: number
): PositionMap {
  const cx = width / 2;
  const cy = height / 2;
  const pos: PositionMap = {};
  pos[root] = { x: cx, y: cy };
  const nonRoot = nodes.filter((n) => n.id !== root);
  const r = Math.min(width, height) * 0.36;
  nonRoot.forEach((n, i) => {
    const a = (i / Math.max(1, nonRoot.length)) * Math.PI * 2 - Math.PI / 2;
    pos[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  return pos;
}

/** Timeline: sort by score desc, place along horizontal axis with vertical zig. */
function timelineLayout(
  nodes: ReadonlyArray<GraphNode>,
  width: number,
  height: number
): PositionMap {
  const cy = height / 2;
  const sorted = [...nodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const denom = Math.max(1, sorted.length - 1);
  const pos: PositionMap = {};
  sorted.forEach((n, i) => {
    pos[n.id] = {
      x: 60 + (i / denom) * Math.max(0, width - 120),
      y: cy + (i % 2 === 0 ? -30 : 30) + Math.sin(i * 1.3) * 20,
    };
  });
  return pos;
}

/** Force-ish: root at center, others by edge-weight distance. Deterministic. */
function forceLayout(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  root: string,
  width: number,
  height: number
): PositionMap {
  const cx = width / 2;
  const cy = height / 2;
  const pos: PositionMap = {};
  pos[root] = { x: cx, y: cy };
  const nonRoot = nodes.filter((n) => n.id !== root);
  const span = Math.min(width, height) * 0.35;
  nonRoot.forEach((n, i) => {
    const a = i * 2.4 + 0.5;
    const edge = findRootEdge(edges, root, n.id);
    const w = edge ? edge.w : 0.3;
    const r = 60 + (1.0 - w) * span;
    pos[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  return pos;
}

/**
 * Compute node positions for the relation graph.
 * Pure (no DOM, no random) — deterministic for stable test snapshots.
 */
export function computeForceLayout(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  iters: number,
  width: number,
  height: number,
  root: string = nodes[0]?.id ?? ''
): PositionMap {
  void iters;
  return forceLayout(nodes, edges, root, width, height);
}

/** Dispatch by layout mode. */
export function computeLayout(input: LayoutInput): PositionMap {
  const { nodes, edges, root, width, height, mode } = input;
  if (mode === 'radial') return radialLayout(nodes, root, width, height);
  if (mode === 'timeline') return timelineLayout(nodes, width, height);
  return forceLayout(nodes, edges, root, width, height);
}

/**
 * BFS shortest path from root → target, walking edges as undirected.
 * Returns ordered array of node ids (inclusive). Empty if target unreachable.
 */
export function pathFromRoot(
  edges: ReadonlyArray<GraphEdge>,
  root: string,
  target: string
): string[] {
  if (root === target) return [root];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.s)) adj.set(e.s, []);
    if (!adj.has(e.t)) adj.set(e.t, []);
    adj.get(e.s)!.push(e.t);
    adj.get(e.t)!.push(e.s);
  }
  const prev = new Map<string, string | null>();
  prev.set(root, null);
  const queue: string[] = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const next of adj.get(cur) ?? []) {
      if (!prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(target)) return [];
  const path: string[] = [];
  let n: string | null = target;
  while (n != null) {
    path.unshift(n);
    n = prev.get(n) ?? null;
  }
  return path;
}
