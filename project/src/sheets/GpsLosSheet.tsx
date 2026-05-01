/**
 * GpsLosSheet (US-019d) — Full-screen GPS LOS view.
 *
 * Layout: full-bleed GpsLosPanel + right-side stats card showing PDOP forecast,
 * 12-satellite list (from US-018d), RTCM status mock, almanac age.
 */

import { useMemo } from 'react';
import { GpsLosPanel } from '../panels/gpslos/GpsLosPanel';
import { mockGpsConstellation, SLICE1_PDOP } from '../panels/gpslos/skyplot';
import type { PanelInstance } from '../types/domain';

interface GpsLosSheetProps {
  mode?: 'live' | 'replay';
}

const GPSLOS_PANEL: PanelInstance = {
  id: 'gpslos-sheet-main',
  kind: 'gpslos',
  title: 'GPS LOS Detail',
  layoutNodeId: 'gpslos-sheet',
  bindings: [],
  options: {},
  uiState: {},
  createdAt: '',
  updatedAt: '',
};

function buildPdopForecast(): number[] {
  // Deterministic mock — 30 minute forecast at 1-minute resolution.
  return Array.from({ length: 30 }, (_, i) => 1.4 + Math.sin(i * 0.21) * 0.3 + Math.cos(i * 0.7) * 0.12);
}

export function GpsLosSheet({ mode = 'live' }: GpsLosSheetProps) {
  const sats = useMemo(() => mockGpsConstellation(0), []);
  const pdopForecast = useMemo(buildPdopForecast, []);

  const rtcmStatus = 'NTRIP active · 0.9s age · 12 corrections/s';
  const almanacAgeHours = 4.2;

  return (
    <div className="sheet gpslos-sheet" data-screen-label="GPS LOS">
      <div className="gpslos-sheet-main" style={{ flex: 1, minWidth: 0 }}>
        <GpsLosPanel panel={GPSLOS_PANEL} mode={mode} />
      </div>
      <aside className="gpslos-sheet-stats">
        <div className="gpslos-pdop-current">
          <span className="hud-label">PDOP</span>
          <span className="mono" data-testid="pdop-current">{SLICE1_PDOP.toFixed(2)}</span>
        </div>
        <div className="gpslos-pdop-forecast" data-testid="pdop-forecast">
          <div className="hud-label">PDOP · 30 min forecast</div>
          <div className="forecast-bars">
            {pdopForecast.map((v, i) => (
              <span
                key={i}
                className="forecast-bar"
                style={{ height: `${Math.min(100, v * 25)}%` }}
                data-pdop={v.toFixed(2)}
              />
            ))}
          </div>
        </div>
        <div className="gpslos-sat-list" data-testid="sat-list">
          <div className="hud-label">SATELLITES · {sats.length}</div>
          {sats.map((s) => (
            <div key={s.prn} className="sat-row">
              <span className="sat-prn mono">{s.prn}</span>
              <span className="sat-system">{s.system}</span>
              <span className="sat-snr mono">{s.signalStrength.toFixed(1)} dB-Hz</span>
            </div>
          ))}
        </div>
        <div className="gpslos-rtcm" data-testid="rtcm-status">
          <span className="hud-label">RTCM</span>
          <span className="mono">{rtcmStatus}</span>
        </div>
        <div className="gpslos-almanac" data-testid="almanac-age">
          <span className="hud-label">ALMANAC AGE</span>
          <span className="mono">{almanacAgeHours.toFixed(1)} h</span>
        </div>
      </aside>
    </div>
  );
}
