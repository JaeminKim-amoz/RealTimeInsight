/**
 * SpaceSheet (US-3-004) — orbital theater view.
 *
 * Layout: GlobePanel (60%) + GpsLosPanel (40%) + bottom telemetry strip.
 * Uses a flex column with proper minHeight:0 + height:100% chain so the
 * R3F Canvas inside GlobePanel actually has pixel dimensions.
 */

import { GlobePanel } from '../panels/globe/GlobePanel';
import { GpsLosPanel } from '../panels/gpslos/GpsLosPanel';
import { SATELLITES, THREAT_SITES, FRIENDLY_EW } from '../panels/globe/globe-data';
import type { PanelInstance } from '../types/domain';

interface SpaceSheetProps {
  mode?: 'live' | 'replay';
}

const GLOBE_PANEL: PanelInstance = {
  id: 'space-globe',
  kind: 'globe',
  title: 'Orbital View',
  layoutNodeId: 'space-sheet',
  bindings: [],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

const GPSLOS_PANEL: PanelInstance = {
  id: 'space-gpslos',
  kind: 'gpslos',
  title: 'GPS LOS',
  layoutNodeId: 'space-sheet',
  bindings: [],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

export function SpaceSheet({ mode = 'live' }: SpaceSheetProps) {
  return (
    <div
      className="sheet space-sheet"
      data-screen-label="Space"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}
    >
      <div
        className="space-sheet-grid"
        style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}
        data-testid="space-sheet-grid"
      >
        <div
          className="space-sheet-globe"
          style={{ flex: '1 1 60%', minWidth: 0, minHeight: 0, height: '100%', position: 'relative' }}
          data-testid="space-sheet-globe"
        >
          <GlobePanel panel={GLOBE_PANEL} mode={mode} />
        </div>
        <div
          className="space-sheet-gpslos"
          style={{ flex: '0 0 40%', minWidth: 0, minHeight: 0, height: '100%', overflow: 'auto' }}
          data-testid="space-sheet-gpslos"
        >
          <GpsLosPanel panel={GPSLOS_PANEL} mode={mode} />
        </div>
      </div>
      <div className="space-sheet-strip" data-testid="space-telemetry-strip">
        <span className="hud-label">SATELLITES</span>
        <span className="mono" data-testid="sat-count">{SATELLITES.length}</span>
        <span className="hud-label">THREAT ZONES</span>
        <span className="mono" data-testid="threat-count">{THREAT_SITES.length}</span>
        <span className="hud-label">FRIENDLY EW</span>
        <span className="mono" data-testid="friendly-count">{FRIENDLY_EW.length}</span>
      </div>
    </div>
  );
}
