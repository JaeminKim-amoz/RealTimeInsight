/**
 * EwSheet (US-019c) — Electronic Warfare theater.
 *
 * Layout: left sidebar with "1247 UAV · Live" header + threat list, plus
 * right pane showing Map2D + Waterfall stacked.
 */

import { useMemo } from 'react';
import { Map2DPanel } from '../panels/map2d/Map2DPanel';
import { WaterfallPanel } from '../panels/waterfall/WaterfallPanel';
import { buildEwSwarmMock, EW_SQUAD_LIST } from '../mock/ewSwarm';
import type { PanelInstance } from '../types/domain';

interface EwSheetProps {
  mode?: 'live' | 'replay';
}

const MAP_PANEL: PanelInstance = {
  id: 'ew-map',
  kind: 'map2d',
  title: 'EW Theater',
  layoutNodeId: 'ew-sheet',
  bindings: [],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

const WATERFALL_PANEL: PanelInstance = {
  id: 'ew-waterfall',
  kind: 'waterfall',
  title: 'RF Spectrum',
  layoutNodeId: 'ew-sheet',
  bindings: [{ type: 'channel', channelId: 5001 }],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

const THREAT_LIST: ReadonlyArray<{ id: string; label: string; freq: string }> = [
  { id: 'SA-21', label: 'SA-21 Growler', freq: 'S-band' },
  { id: 'HQ-9', label: 'HQ-9', freq: 'L/S-band' },
  { id: 'S-400', label: 'S-400', freq: 'X-band' },
];

export function EwSheet({ mode = 'live' }: EwSheetProps) {
  const swarm = useMemo(() => buildEwSwarmMock(), []);

  return (
    <div className="sheet ew-sheet" data-screen-label="Electronic Warfare">
      <aside className="ew-sheet-sidebar">
        <div className="hud-label" data-testid="ew-header">
          1247 UAV · Live
        </div>
        <div className="ew-sheet-counts mono">
          <span>Active</span>
          <span data-testid="ew-active-count">{swarm.length}</span>
        </div>
        <div className="ew-sheet-squads">
          {EW_SQUAD_LIST.map((sq) => (
            <div key={sq.id} className="ew-squad-row">
              <span className="ew-squad-id mono">{sq.id}</span>
              <span className="ew-squad-mission">{sq.mission}</span>
            </div>
          ))}
        </div>
        <div className="hud-label">THREATS</div>
        <div className="ew-sheet-threats">
          {THREAT_LIST.map((t) => (
            <div key={t.id} className="ew-threat-row">
              <span className="threat-name">{t.label}</span>
              <span className="threat-freq mono">{t.freq}</span>
            </div>
          ))}
        </div>
      </aside>
      <div className="ew-sheet-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div className="ew-sheet-map" style={{ flex: '1 1 60%', minHeight: 0 }}>
          <Map2DPanel panel={MAP_PANEL} mode={mode} />
        </div>
        <div className="ew-sheet-waterfall" style={{ flex: '1 1 40%', minHeight: 0 }}>
          <WaterfallPanel panel={WATERFALL_PANEL} mode={mode} />
        </div>
      </div>
    </div>
  );
}
