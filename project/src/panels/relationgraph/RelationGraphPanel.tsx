/**
 * RelationGraphPanel (US-018a) — SVG force-directed graph for anomaly relations.
 *
 * Visual fidelity 1:1 with public/app/panels2.jsx RelationGraphPanel: SVG
 * (NOT 3D) renders nodes + edges from RELGRAPH; click nodes to anchor a
 * graph-node selection in `useSelectionStore`. Path from root to selected
 * node is highlighted (spec §13.3).
 *
 * Layout math is extracted to `layout.ts` for ≥85% pure coverage.
 */

import { useMemo } from 'react';
import { RELGRAPH } from '../../mock/relgraph';
import { useSelectionStore } from '../../store/selectionStore';
import type { GraphEdge, GraphNode, PanelInstance } from '../../types/domain';
import { computeLayout, pathFromRoot, type LayoutMode } from './layout';

interface RelationGraphPanelProps {
  panel: PanelInstance;
  mode?: 'live' | 'replay';
}

const NODE_COLOR: Record<GraphNode['kind'], string> = {
  observation: 'var(--amber-0)',
  channel: 'var(--s2)',
  alarm: 'var(--alarm)',
  'crc-cluster': 'var(--warn)',
  'video-event': 'var(--s5)',
  recommendation: 'var(--pinned)',
};

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 260;

function getLayoutMode(panel: PanelInstance): LayoutMode {
  const m = panel.options.layoutMode;
  if (m === 'force' || m === 'radial' || m === 'timeline') return m;
  return 'force';
}

function edgeStrokeProps(
  e: GraphEdge,
  highlighted: boolean
): { strokeDasharray: string | undefined; strokeOpacity: number; strokeWidth: number } {
  return {
    strokeDasharray: e.verified ? undefined : '3,2',
    strokeOpacity: highlighted ? 1 : Math.max(0.25, e.w),
    strokeWidth: 0.8 + e.w * 1.8 + (highlighted ? 1.2 : 0),
  };
}

export function RelationGraphPanel({ panel, mode }: RelationGraphPanelProps) {
  void mode;
  const layoutMode = getLayoutMode(panel);
  const selectedGraphNodeId = useSelectionStore((s) => s.selectedGraphNodeId);
  const selectGraphNode = useSelectionStore((s) => s.selectGraphNode);

  const positions = useMemo(
    () =>
      computeLayout({
        nodes: RELGRAPH.nodes,
        edges: RELGRAPH.edges,
        root: RELGRAPH.root,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        mode: layoutMode,
      }),
    [layoutMode]
  );

  const highlightedPath = useMemo<Set<string>>(() => {
    if (!selectedGraphNodeId) return new Set();
    return new Set(pathFromRoot(RELGRAPH.edges, RELGRAPH.root, selectedGraphNodeId));
  }, [selectedGraphNodeId]);

  const isEdgeHighlighted = (e: GraphEdge): boolean =>
    highlightedPath.has(e.s) && highlightedPath.has(e.t);

  return (
    <div className="panel-body relation-graph">
      <svg
        className="relgraph-svg"
        viewBox={`0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`}
        preserveAspectRatio="none"
        data-layout-mode={layoutMode}
      >
        {RELGRAPH.edges.map((e, i) => {
          const a = positions[e.s];
          const b = positions[e.t];
          if (!a || !b) return null;
          const hi = isEdgeHighlighted(e);
          return (
            <g key={`edge-${i}`} data-edge-id={`${e.s}-${e.t}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={hi ? 'var(--amber-0)' : 'var(--amber-1)'}
                {...edgeStrokeProps(e, hi)}
              />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 2}
                fontSize="8"
                fill="var(--fg-2)"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
              >
                {e.why}
              </text>
            </g>
          );
        })}
        {RELGRAPH.nodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const isRoot = n.id === RELGRAPH.root;
          const isSelected = n.id === selectedGraphNodeId;
          const isOnPath = highlightedPath.has(n.id);
          const r = isRoot ? 10 : 7;
          const stroke = NODE_COLOR[n.kind];
          return (
            <g
              key={n.id}
              data-node-id={n.id}
              data-selected={isSelected ? 'true' : undefined}
              data-on-path={isOnPath ? 'true' : undefined}
              onClick={() => selectGraphNode(n.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 4}
                fill={stroke}
                opacity={isRoot ? 0.25 : isOnPath ? 0.3 : 0.15}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill="var(--bg-1)"
                stroke={stroke}
                strokeWidth={isRoot || isSelected ? 2 : 1.5}
              />
              <text
                x={p.x}
                y={p.y + r + 11}
                fontSize="10"
                fill="var(--fg-0)"
                textAnchor="middle"
                fontFamily="IBM Plex Sans"
              >
                {n.label}
              </text>
              {n.score != null ? (
                <text
                  x={p.x}
                  y={p.y + r + 22}
                  fontSize="8.5"
                  fill="var(--amber-0)"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                >
                  {(n.score * 100).toFixed(0)}%
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="relgraph-legend">
        <div className="ln">
          <span className="edge-s" style={{ background: 'var(--amber-1)' }} /> verified
        </div>
        <div className="ln">
          <span
            className="edge-s"
            style={{ borderTop: '1px dashed var(--amber-1)', height: 0 }}
          />{' '}
          inferred
        </div>
      </div>
    </div>
  );
}
