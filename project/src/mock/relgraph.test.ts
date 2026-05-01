/**
 * Mock relation graph fixture (US-018a) — structural tests.
 */

import { describe, it, expect } from 'vitest';
import { RELGRAPH } from './relgraph';

describe('mock/relgraph RELGRAPH', () => {
  it('has root node "obs-1205"', () => {
    expect(RELGRAPH.root).toBe('obs-1205');
  });

  it('has exactly 10 nodes', () => {
    expect(RELGRAPH.nodes).toHaveLength(10);
  });

  it('has exactly 9 edges', () => {
    expect(RELGRAPH.edges).toHaveLength(9);
  });

  it('every edge source/target references an existing node id', () => {
    const ids = new Set(RELGRAPH.nodes.map((n) => n.id));
    for (const e of RELGRAPH.edges) {
      expect(ids.has(e.s)).toBe(true);
      expect(ids.has(e.t)).toBe(true);
    }
  });

  it('root node has kind "observation"', () => {
    const root = RELGRAPH.nodes.find((n) => n.id === RELGRAPH.root);
    expect(root?.kind).toBe('observation');
  });

  it('all edge weights are between 0 and 1', () => {
    for (const e of RELGRAPH.edges) {
      expect(e.w).toBeGreaterThanOrEqual(0);
      expect(e.w).toBeLessThanOrEqual(1);
    }
  });

  it('all node scores are between 0 and 1 when defined', () => {
    for (const n of RELGRAPH.nodes) {
      if (n.score != null) {
        expect(n.score).toBeGreaterThanOrEqual(0);
        expect(n.score).toBeLessThanOrEqual(1);
      }
    }
  });
});
