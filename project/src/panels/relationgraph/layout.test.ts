/**
 * Pure layout helpers (US-018a) — deterministic geometry for relation graph.
 */

import { describe, it, expect } from 'vitest';
import {
  computeForceLayout,
  computeLayout,
  pathFromRoot,
} from './layout';
import { RELGRAPH } from '../../mock/relgraph';

describe('panels/relationgraph/layout computeForceLayout', () => {
  it('returns a position for every node', () => {
    const pos = computeForceLayout(
      RELGRAPH.nodes,
      RELGRAPH.edges,
      40,
      400,
      260,
      RELGRAPH.root
    );
    for (const n of RELGRAPH.nodes) {
      expect(pos[n.id]).toBeDefined();
      expect(Number.isFinite(pos[n.id].x)).toBe(true);
      expect(Number.isFinite(pos[n.id].y)).toBe(true);
    }
  });

  it('places the root node at canvas center', () => {
    const pos = computeForceLayout(
      RELGRAPH.nodes,
      RELGRAPH.edges,
      40,
      400,
      260,
      RELGRAPH.root
    );
    expect(pos[RELGRAPH.root].x).toBeCloseTo(200, 5);
    expect(pos[RELGRAPH.root].y).toBeCloseTo(130, 5);
  });

  it('is deterministic for the same input', () => {
    const a = computeForceLayout(RELGRAPH.nodes, RELGRAPH.edges, 40, 400, 260, RELGRAPH.root);
    const b = computeForceLayout(RELGRAPH.nodes, RELGRAPH.edges, 40, 400, 260, RELGRAPH.root);
    for (const id of Object.keys(a)) {
      expect(a[id].x).toBeCloseTo(b[id].x, 10);
      expect(a[id].y).toBeCloseTo(b[id].y, 10);
    }
  });

  it('high-weight edges yield closer-to-root positions than low-weight ones', () => {
    const pos = computeForceLayout(RELGRAPH.nodes, RELGRAPH.edges, 40, 400, 260, RELGRAPH.root);
    const root = pos[RELGRAPH.root];
    const dist = (id: string) =>
      Math.hypot(pos[id].x - root.x, pos[id].y - root.y);
    // ch-1002 has w=0.86 (high), ch-2215 has w=0.41 (low) — both connect to obs-1205
    expect(dist('ch-1002')).toBeLessThan(dist('ch-2215'));
  });
});

describe('panels/relationgraph/layout computeLayout', () => {
  it('radial mode places root at center', () => {
    const pos = computeLayout({
      nodes: RELGRAPH.nodes,
      edges: RELGRAPH.edges,
      root: RELGRAPH.root,
      width: 400,
      height: 260,
      mode: 'radial',
    });
    expect(pos[RELGRAPH.root].x).toBeCloseTo(200, 5);
    expect(pos[RELGRAPH.root].y).toBeCloseTo(130, 5);
  });

  it('radial mode positions all non-root nodes on a ring of equal radius', () => {
    const w = 400, h = 260;
    const pos = computeLayout({
      nodes: RELGRAPH.nodes,
      edges: RELGRAPH.edges,
      root: RELGRAPH.root,
      width: w,
      height: h,
      mode: 'radial',
    });
    const cx = w / 2, cy = h / 2;
    const expectedR = Math.min(w, h) * 0.36;
    for (const n of RELGRAPH.nodes) {
      if (n.id === RELGRAPH.root) continue;
      const r = Math.hypot(pos[n.id].x - cx, pos[n.id].y - cy);
      expect(r).toBeCloseTo(expectedR, 3);
    }
  });

  it('timeline mode lays nodes left-to-right with the highest score on the left', () => {
    const pos = computeLayout({
      nodes: RELGRAPH.nodes,
      edges: RELGRAPH.edges,
      root: RELGRAPH.root,
      width: 400,
      height: 260,
      mode: 'timeline',
    });
    // observation has score 0.93 — highest — should be at the leftmost x
    const minX = Math.min(...Object.values(pos).map((p) => p.x));
    expect(pos[RELGRAPH.root].x).toBeCloseTo(minX, 3);
  });

  it('force mode produces same output as computeForceLayout', () => {
    const a = computeLayout({
      nodes: RELGRAPH.nodes,
      edges: RELGRAPH.edges,
      root: RELGRAPH.root,
      width: 400,
      height: 260,
      mode: 'force',
    });
    const b = computeForceLayout(RELGRAPH.nodes, RELGRAPH.edges, 40, 400, 260, RELGRAPH.root);
    for (const id of Object.keys(a)) {
      expect(a[id].x).toBeCloseTo(b[id].x, 10);
      expect(a[id].y).toBeCloseTo(b[id].y, 10);
    }
  });
});

describe('panels/relationgraph/layout pathFromRoot', () => {
  it('returns [root] when target equals root', () => {
    expect(pathFromRoot(RELGRAPH.edges, RELGRAPH.root, RELGRAPH.root)).toEqual([RELGRAPH.root]);
  });

  it('finds direct path obs-1205 → ch-1002 (single edge)', () => {
    const p = pathFromRoot(RELGRAPH.edges, RELGRAPH.root, 'ch-1002');
    expect(p).toEqual(['obs-1205', 'ch-1002']);
  });

  it('finds two-hop path obs-1205 → ch-1002 → ch-1001', () => {
    const p = pathFromRoot(RELGRAPH.edges, RELGRAPH.root, 'ch-1001');
    expect(p[0]).toBe('obs-1205');
    expect(p[p.length - 1]).toBe('ch-1001');
    expect(p.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when target is unreachable', () => {
    const p = pathFromRoot(RELGRAPH.edges, RELGRAPH.root, 'no-such-node');
    expect(p).toEqual([]);
  });
});
