/**
 * WorkstationSheet (US-019a) — top-level workstation tab.
 *
 * Loads `workstation-default` preset on first mount and renders the DockGrid
 * with each PanelFrame body slot dispatched to the appropriate panel TSX
 * based on PanelInstance.kind.
 */

import { useEffect, type CSSProperties } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSelectionStore } from '../store/selectionStore';
import { CH, colorFor } from '../mock/channels';
import {
  isFlatGridNode,
  isPanelNode,
  isSplitNode,
  isTabNode,
} from '../types/domain';
import type {
  FlatGridNode,
  LayoutNode,
  PanelInstance,
} from '../types/domain';
import { StripChartPanel } from '../panels/strip/StripChartPanel';
import { NumericPanel } from '../panels/numeric/NumericPanel';
import { DiscretePanel } from '../panels/discrete/DiscretePanel';
import { EventLogPanel } from '../panels/eventlog/EventLogPanel';
import { WaterfallPanel } from '../panels/waterfall/WaterfallPanel';
import { Map2DPanel } from '../panels/map2d/Map2DPanel';
import { VideoPanel } from '../panels/video/VideoPanel';
import { Attitude3DPanel } from '../panels/attitude3d/Attitude3DPanel';
import { Trajectory3DPanel } from '../panels/trajectory3d/Trajectory3DPanel';
import { RelationGraphPanel } from '../panels/relationgraph/RelationGraphPanel';
import { SimdisBridgePanel } from '../panels/simdisbridge/SimdisBridgePanel';
import { GlobePanel } from '../panels/globe/GlobePanel';
import { GpsLosPanel } from '../panels/gpslos/GpsLosPanel';

interface WorkstationSheetProps {
  mode?: 'live' | 'replay';
}

function renderPanelBody(panel: PanelInstance, mode: 'live' | 'replay') {
  switch (panel.kind) {
    case 'strip': return <StripChartPanel panel={panel} mode={mode} />;
    case 'numeric': return <NumericPanel panel={panel} mode={mode} />;
    case 'discrete': return <DiscretePanel panel={panel} />;
    case 'eventlog': return <EventLogPanel />;
    case 'waterfall': return <WaterfallPanel panel={panel} mode={mode} />;
    case 'map2d': return <Map2DPanel panel={panel} mode={mode} />;
    case 'video': return <VideoPanel panel={panel} mode={mode} />;
    case 'attitude3d': return <Attitude3DPanel panel={panel} mode={mode} />;
    case 'trajectory3d': return <Trajectory3DPanel panel={panel} mode={mode} />;
    case 'relationgraph': return <RelationGraphPanel panel={panel} mode={mode} />;
    case 'simdisbridge': return <SimdisBridgePanel panel={panel} mode={mode} />;
    case 'globe': return <GlobePanel panel={panel} mode={mode} />;
    case 'gpslos': return <GpsLosPanel panel={panel} mode={mode} />;
    default: return <div className="panel-body-placeholder">{panel.kind}</div>;
  }
}

interface PanelFrameProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
  selected: boolean;
  onSelect: (panelId: string) => void;
  onClose: (panelId: string) => void;
  style?: CSSProperties;
}

function PanelFrame({ panel, mode, selected, onSelect, onClose, style }: PanelFrameProps) {
  const channelBindings = panel.bindings.filter((b) => b.type === 'channel');
  const visibleBindings = channelBindings.slice(0, 4);
  const overflow = channelBindings.length - visibleBindings.length;
  const linked = panel.options?.linkedCursor === true;

  return (
    <div
      className={`panel ${selected ? 'selected' : ''}`.trim()}
      data-panel-id={panel.id}
      data-screen-label={panel.title}
      style={style}
    >
      <div
        className="panel-header"
        onClick={() => onSelect(panel.id)}
        role="button"
        tabIndex={0}
      >
        <span className="panel-kind">{panel.kind}</span>
        <span className="panel-title">{panel.title}</span>
        <div className="panel-bindings">
          {visibleBindings.map((b, i) => {
            if (b.type !== 'channel') return null;
            const ch = CH[b.channelId];
            if (!ch) return null;
            return (
              <span key={b.channelId} className="pb" title={ch.displayName}>
                <span className="swatch" style={{ background: colorFor(ch.channelId, i) }} />
                {ch.name}
              </span>
            );
          })}
          {overflow > 0 ? <span className="pb">+{overflow}</span> : null}
        </div>
        <div className="panel-actions">
          <button
            type="button"
            aria-label="Close panel"
            onClick={(e) => {
              e.stopPropagation();
              onClose(panel.id);
            }}
          >
            ×
          </button>
        </div>
      </div>
      {renderPanelBody(panel, mode)}
      <div className="panel-footer">
        <span>{panel.kind.toUpperCase()}</span>
        <span>·</span>
        <span>{channelBindings.length} ch</span>
        <span className="spacer" />
        {linked ? <span>⌖ linked</span> : null}
      </div>
    </div>
  );
}

interface FlatGridProps {
  node: FlatGridNode;
  panels: Record<string, PanelInstance>;
  mode: 'live' | 'replay';
}

function FlatGrid({ node, panels, mode }: FlatGridProps) {
  const selectedPanelId = useSelectionStore((s) => s.selectedPanelId);
  const selectPanel = useSelectionStore((s) => s.selectPanel);
  const removePanel = useWorkspaceStore((s) => s.removePanel);

  const style: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${node.columns}, 1fr)`,
    gridTemplateRows: `repeat(${node.rows}, 1fr)`,
    gap: '6px',
  };

  return (
    <div className="dockgrid" data-screen-label="Main Workspace" style={style}>
      {node.cells.map((cell) => {
        const panel = panels[cell.panelId];
        if (!panel) return null;
        const cellStyle: CSSProperties = {
          gridColumn: `${cell.gx} / span ${cell.gw}`,
          gridRow: `${cell.gy} / span ${cell.gh}`,
        };
        return (
          <PanelFrame
            key={panel.id}
            panel={panel}
            mode={mode}
            selected={selectedPanelId === panel.id}
            onSelect={selectPanel}
            onClose={removePanel}
            style={cellStyle}
          />
        );
      })}
    </div>
  );
}

function RecursiveLayout({
  node,
  panels,
  mode,
}: {
  node: LayoutNode;
  panels: Record<string, PanelInstance>;
  mode: 'live' | 'replay';
}) {
  const selectedPanelId = useSelectionStore((s) => s.selectedPanelId);
  const selectPanel = useSelectionStore((s) => s.selectPanel);
  const removePanel = useWorkspaceStore((s) => s.removePanel);

  if (isFlatGridNode(node)) return <FlatGrid node={node} panels={panels} mode={mode} />;
  if (isPanelNode(node)) {
    const panel = panels[node.panelId];
    if (!panel) return <div className="dockgrid dockgrid-empty" />;
    return (
      <div className="dockgrid">
        <PanelFrame
          panel={panel}
          mode={mode}
          selected={selectedPanelId === panel.id}
          onSelect={selectPanel}
          onClose={removePanel}
        />
      </div>
    );
  }
  if (isSplitNode(node)) {
    const dir = node.direction === 'horizontal' ? 'row' : 'column';
    return (
      <div className="dockgrid" style={{ display: 'flex', flexDirection: dir }}>
        {node.children.map((child) => (
          <RecursiveLayout key={child.id} node={child} panels={panels} mode={mode} />
        ))}
      </div>
    );
  }
  if (isTabNode(node)) {
    return (
      <div className="dockgrid">
        {node.children.map((child) => (
          <RecursiveLayout key={child.id} node={child} panels={panels} mode={mode} />
        ))}
      </div>
    );
  }
  return <div className="dockgrid dockgrid-empty" />;
}

export function WorkstationSheet({ mode = 'live' }: WorkstationSheetProps) {
  const layoutTree = useWorkspaceStore((s) => s.layoutTree);
  const panels = useWorkspaceStore((s) => s.panels);
  const loadPreset = useWorkspaceStore((s) => s.loadPreset);

  useEffect(() => {
    if (!layoutTree) loadPreset('workstation-default');
  }, [layoutTree, loadPreset]);

  return (
    <div className="sheet workstation-sheet" data-screen-label="Workstation">
      {layoutTree ? (
        <RecursiveLayout node={layoutTree} panels={panels} mode={mode} />
      ) : (
        <div className="dockgrid dockgrid-empty" />
      )}
    </div>
  );
}
