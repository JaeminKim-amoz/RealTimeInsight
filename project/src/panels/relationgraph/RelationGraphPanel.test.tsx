/**
 * RelationGraphPanel (US-018a) — RTL tests.
 *
 * SVG-based panel — no R3F mock needed. Tests verify nodes + edges render,
 * click on a node updates useSelectionStore, and layout mode is reflected
 * in the DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RelationGraphPanel } from './RelationGraphPanel';
import { useSelectionStore } from '../../store/selectionStore';
import { RELGRAPH } from '../../mock/relgraph';
import type { PanelInstance } from '../../types/domain';

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    id: 'p-relgraph',
    kind: 'relationgraph',
    title: 'Relation Graph Test',
    layoutNodeId: 'ln-rg',
    bindings: [],
    options: {},
    uiState: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('panels/relationgraph/RelationGraphPanel (US-018a)', () => {
  beforeEach(() => {
    useSelectionStore.getState().reset();
  });

  it('renders a panel-body relation-graph root container', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    expect(container.querySelector('.panel-body.relation-graph')).not.toBeNull();
  });

  it('renders all 10 nodes from RELGRAPH', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const nodes = container.querySelectorAll('[data-node-id]');
    expect(nodes.length).toBe(RELGRAPH.nodes.length);
  });

  it('renders all 9 edges from RELGRAPH', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const edges = container.querySelectorAll('[data-edge-id]');
    expect(edges.length).toBe(RELGRAPH.edges.length);
  });

  it('clicking a node updates useSelectionStore.selectedGraphNodeId', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const obs = container.querySelector(
      '[data-node-id="obs-1205"]'
    ) as SVGGElement;
    fireEvent.click(obs);
    expect(useSelectionStore.getState().selectedGraphNodeId).toBe('obs-1205');
  });

  it('renders the score % label for nodes that have a score', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    expect(container.textContent).toContain('93%');
  });

  it('default layout mode is force', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const svg = container.querySelector('.relgraph-svg') as SVGElement;
    expect(svg.getAttribute('data-layout-mode')).toBe('force');
  });

  it('layout mode toggle re-runs layout (radial → data attribute updated)', () => {
    const { container } = render(
      <RelationGraphPanel
        panel={makePanel({ options: { layoutMode: 'radial' } })}
      />
    );
    const svg = container.querySelector('.relgraph-svg') as SVGElement;
    expect(svg.getAttribute('data-layout-mode')).toBe('radial');
  });

  it('timeline layout sorts nodes by score', () => {
    const { container } = render(
      <RelationGraphPanel
        panel={makePanel({ options: { layoutMode: 'timeline' } })}
      />
    );
    const svg = container.querySelector('.relgraph-svg') as SVGElement;
    expect(svg.getAttribute('data-layout-mode')).toBe('timeline');
  });

  it('selecting a non-root node marks the path nodes with data-on-path', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const target = container.querySelector(
      '[data-node-id="ch-1001"]'
    ) as SVGGElement;
    fireEvent.click(target);
    // ch-1001 is reachable via obs-1205 → ch-1002 → ch-1001
    expect(
      container.querySelector('[data-node-id="obs-1205"][data-on-path="true"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-node-id="ch-1002"][data-on-path="true"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-node-id="ch-1001"][data-on-path="true"]')
    ).not.toBeNull();
  });

  it('clicked node receives data-selected="true"', () => {
    const { container } = render(<RelationGraphPanel panel={makePanel()} />);
    const target = container.querySelector(
      '[data-node-id="ch-1007"]'
    ) as SVGGElement;
    fireEvent.click(target);
    expect(
      container.querySelector('[data-node-id="ch-1007"][data-selected="true"]')
    ).not.toBeNull();
  });
});
