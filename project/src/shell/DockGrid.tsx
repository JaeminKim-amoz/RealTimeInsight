/**
 * DockGrid + PanelFrame (US-014, US-2-002) — workspace panel grid.
 *
 * Slice-1 scope renders a FlatGridNode using CSS Grid with the same gx/gy/gw/gh
 * placement that the prototype used. Split/Tab/Panel nodes have placeholder
 * renderers (full split/tabs lands in slice 2 per plan v3). Panel bodies are
 * placeholder slots (`<div className="panel-body-placeholder">{kind}</div>`)
 * — actual panel renderers ship in US-016..US-018.
 *
 * US-2-002: PanelFrame supports a 5-zone drop overlay (center/top/bottom/
 * left/right). The overlay only renders while a `application/x-channel`
 * drag is in progress over the frame. Drop on `center` calls
 * addBindingToPanel; drop on an edge zone calls splitPanel with the
 * appropriate direction (top/bottom = vertical, left/right = horizontal).
 * The PanelFrame component takes an optional `onDrop(zone, payload)` callback
 * — when omitted it wires directly to the workspaceStore.
 */

import { useState, type CSSProperties, type DragEvent } from 'react';
import { useSelectionStore } from '../store/selectionStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { CH, colorFor } from '../mock/channels';
import {
  isFlatGridNode,
  isPanelNode,
  isSplitNode,
  isTabNode,
} from '../types/domain';
import type {
  DragChannelPayload,
  FlatGridNode,
  LayoutNode,
  PanelInstance,
} from '../types/domain';

const DRAG_FORMAT = 'application/x-channel';
type DropZone = 'center' | 'top' | 'bottom' | 'left' | 'right';
const ZONES: DropZone[] = ['center', 'top', 'bottom', 'left', 'right'];

function dragHasChannelPayload(e: DragEvent<HTMLElement>): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  // jsdom returns a plain array; browsers return DOMStringList.
  if (Array.isArray(types)) return types.includes(DRAG_FORMAT);
  return Array.from(types as ArrayLike<string>).includes(DRAG_FORMAT);
}

function readChannelPayload(e: DragEvent<HTMLElement>): DragChannelPayload | null {
  const raw = e.dataTransfer?.getData(DRAG_FORMAT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragChannelPayload;
    if (parsed && parsed.kind === 'channel-drag' && typeof parsed.channelId === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

interface PanelFrameProps {
  panel: PanelInstance;
  selected: boolean;
  onSelect: (panelId: string) => void;
  onClose: (panelId: string) => void;
  /**
   * US-2-002: optional drop handler injected for testing. When omitted,
   * the frame wires drops directly to the workspaceStore.
   */
  onDrop?: (zone: DropZone, payload: DragChannelPayload) => void;
  style?: CSSProperties;
}

export function PanelFrame({
  panel,
  selected,
  onSelect,
  onClose,
  onDrop,
  style,
}: PanelFrameProps) {
  const channelBindings = panel.bindings.filter((b) => b.type === 'channel');
  const visibleBindings = channelBindings.slice(0, 4);
  const overflow = channelBindings.length - visibleBindings.length;
  const linked = panel.options?.linkedCursor === true;

  const [overlayActive, setOverlayActive] = useState(false);
  const [hoverZone, setHoverZone] = useState<DropZone | null>(null);

  const addBindingToPanel = useWorkspaceStore((s) => s.addBindingToPanel);
  const splitPanel = useWorkspaceStore((s) => s.splitPanel);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasChannelPayload(e)) return;
    e.preventDefault();
    if (!overlayActive) setOverlayActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // jsdom's relatedTarget is null — for the simple PanelFrame test we just
    // hide the overlay on any dragLeave on the frame itself.
    if (e.currentTarget === e.target) {
      setOverlayActive(false);
      setHoverZone(null);
    }
  };

  const handleZoneDrop = (zone: DropZone, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = readChannelPayload(e);
    setOverlayActive(false);
    setHoverZone(null);
    if (!payload) return;
    if (onDrop) {
      onDrop(zone, payload);
      return;
    }
    // Default wiring → workspaceStore actions (US-2-002).
    if (zone === 'center') {
      addBindingToPanel(panel.id, { type: 'channel', channelId: payload.channelId });
      return;
    }
    const direction: 'horizontal' | 'vertical' =
      zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical';
    const newPanelId = `p-strip-${payload.channelId}`;
    const newPanel: PanelInstance = {
      id: newPanelId,
      kind: 'strip',
      title: payload.displayName,
      layoutNodeId: panel.layoutNodeId,
      bindings: [{ type: 'channel', channelId: payload.channelId }],
      options: {},
      uiState: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    splitPanel(panel.id, direction, newPanel);
  };

  return (
    <div
      className={`panel ${selected ? 'selected' : ''}`.trim()}
      data-panel-id={panel.id}
      data-screen-label={panel.title}
      style={style}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
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
                <span
                  className="swatch"
                  style={{ background: colorFor(ch.channelId, i) }}
                />
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
      <div className="panel-body">
        <div className="panel-body-placeholder">{panel.kind}</div>
      </div>
      <div className="panel-footer">
        <span>{panel.kind.toUpperCase()}</span>
        <span>·</span>
        <span>{channelBindings.length} ch</span>
        <span className="spacer" />
        {linked ? <span>⌖ linked</span> : null}
      </div>
      {overlayActive ? (
        <div className="drop-overlay active">
          {ZONES.map((z) => (
            <div
              key={z}
              className={`drop-zone z-${z} ${hoverZone === z ? 'hover' : ''}`.trim()}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverZone(z);
              }}
              onDragLeave={() => setHoverZone((h) => (h === z ? null : h))}
              onDrop={(e) => handleZoneDrop(z, e)}
            >
              {z === 'center' ? 'overlay' : `split ${z}`}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface FlatGridProps {
  node: FlatGridNode;
  panels: Record<string, PanelInstance>;
}

function FlatGrid({ node, panels }: FlatGridProps) {
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
        const cellStyle: CSSProperties = {
          gridColumn: `${cell.gx} / span ${cell.gw}`,
          gridRow: `${cell.gy} / span ${cell.gh}`,
        };
        // US-2-001 path B: when a cell has a subtree, render the subtree
        // inside the cell's grid area instead of a single PanelFrame.
        if (cell.cellSubtree) {
          return (
            <div
              key={cell.panelId}
              className="dockgrid-cell-subtree"
              data-cell-id={cell.panelId}
              style={cellStyle}
            >
              <RecursiveLayout node={cell.cellSubtree} panels={panels} />
            </div>
          );
        }
        const panel = panels[cell.panelId];
        if (!panel) return null;
        return (
          <PanelFrame
            key={panel.id}
            panel={panel}
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

/**
 * Recursive renderer for SplitNode / TabNode / PanelNode trees. Slice-1 emits
 * a minimal placeholder with the same `dockgrid` styling so callers can test
 * against the same root class. Full split/tab interactions land in slice 2.
 */
function RecursiveLayout({
  node,
  panels,
}: {
  node: LayoutNode;
  panels: Record<string, PanelInstance>;
}) {
  const selectedPanelId = useSelectionStore((s) => s.selectedPanelId);
  const selectPanel = useSelectionStore((s) => s.selectPanel);
  const removePanel = useWorkspaceStore((s) => s.removePanel);

  if (isFlatGridNode(node)) {
    return <FlatGrid node={node} panels={panels} />;
  }
  if (isPanelNode(node)) {
    const panel = panels[node.panelId];
    if (!panel) return <div className="dockgrid dockgrid-empty" />;
    return (
      <div className="dockgrid">
        <PanelFrame
          panel={panel}
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
          <RecursiveLayout key={child.id} node={child} panels={panels} />
        ))}
      </div>
    );
  }
  if (isTabNode(node)) {
    return (
      <div className="dockgrid">
        {node.children.map((child) => (
          <RecursiveLayout key={child.id} node={child} panels={panels} />
        ))}
      </div>
    );
  }
  return <div className="dockgrid dockgrid-empty" />;
}

export function DockGrid() {
  const layoutTree = useWorkspaceStore((s) => s.layoutTree);
  const panels = useWorkspaceStore((s) => s.panels);

  if (!layoutTree) {
    return <div className="dockgrid dockgrid-empty" data-screen-label="Empty" />;
  }
  return <RecursiveLayout node={layoutTree} panels={panels} />;
}
