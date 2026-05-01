/**
 * GpsLosPanel (US-018d / US-3-003) — full prototype-parity GNSS sky-plot
 * with DOP grid, SNR bars, sat counts, and a PDOP forecast SVG.
 *
 * Layout: gps-panel = gps-skyplot (left) + gps-side (right) where gps-side
 * contains DOP grid + counts + SNR bars + 30-min PDOP forecast curve.
 *
 * The skyplot drives the constellation tick (1 Hz setInterval). Pure helpers
 * for sat/DOP math live in skyplot.ts.
 */

import { useEffect, useMemo, useState } from 'react';
import type { PanelInstance } from '../../types/domain';
import {
  computeDop,
  DOP_THRESHOLDS,
  mockGpsConstellation,
  polarToSvg,
  SYSTEM_COLOR,
  type MockGpsSat,
} from './skyplot';

interface GpsLosPanelProps {
  panel: PanelInstance;
  mode?: 'live' | 'replay';
}

const SVG_RADIUS = 100;

export function GpsLosPanel({ panel, mode }: GpsLosPanelProps) {
  void panel;
  void mode;
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sats = useMemo(() => mockGpsConstellation(tick), [tick]);
  const used = useMemo(() => sats.filter((s) => s.used), [sats]);
  const dop = useMemo(() => computeDop(used.length), [used.length]);
  const selectedSat = useMemo(
    () => sats.find((s) => s.prn === selected) ?? null,
    [sats, selected]
  );

  const azimuthSpokes = useMemo(() => {
    const spokes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let az = 0; az < 360; az += 30) {
      const end = polarToSvg(0, az, SVG_RADIUS);
      spokes.push({ x1: 0, y1: 0, x2: end.x, y2: end.y });
    }
    return spokes;
  }, []);

  // PDOP forecast curve (60 samples)
  const forecastPath = useMemo(() => {
    const pts: string[] = [];
    const fill = ['M 0 50'];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const x = t * 240;
      const v =
        1.5 +
        Math.sin(t * Math.PI * 1.4 + tick * 0.05) * 0.4 +
        Math.cos(t * 9) * 0.15;
      const y = 50 - (v / 4) * 50;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(2)}`);
      fill.push(`L ${x.toFixed(1)} ${y.toFixed(2)}`);
    }
    fill.push('L 240 50 Z');
    return { line: pts.join(' '), fill: fill.join(' ') };
  }, [tick]);

  return (
    <div className="panel-body gpslos gps-panel" data-testid="gps-panel">
      {/* Sky-plot */}
      <div className="gps-skyplot" data-testid="gps-skyplot">
        <svg viewBox="-110 -110 220 220" data-testid="skyplot-svg">
          <circle cx={0} cy={0} r={SVG_RADIUS} fill="#0a0d10" stroke="#3a4048" strokeWidth={0.6} />
          <circle cx={0} cy={0} r={SVG_RADIUS * (60 / 90)} fill="none" stroke="#2a2e34" strokeWidth={0.4} />
          <circle cx={0} cy={0} r={SVG_RADIUS * (30 / 90)} fill="none" stroke="#2a2e34" strokeWidth={0.4} />
          <line x1={-100} y1={0} x2={100} y2={0} stroke="#2a2e34" strokeWidth={0.4} />
          <line x1={0} y1={-100} x2={0} y2={100} stroke="#2a2e34" strokeWidth={0.4} />
          {azimuthSpokes.map((s, i) => (
            <line
              key={`spoke-${i}`}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="#2a2e34"
              strokeWidth={0.4}
            />
          ))}
          <text x={0} y={-104} fill="#878175" fontSize={6.5} textAnchor="middle" fontFamily="JetBrains Mono">N</text>
          <text x={106} y={2} fill="#878175" fontSize={6.5} textAnchor="middle" fontFamily="JetBrains Mono">E</text>
          <text x={0} y={110} fill="#878175" fontSize={6.5} textAnchor="middle" fontFamily="JetBrains Mono">S</text>
          <text x={-106} y={2} fill="#878175" fontSize={6.5} textAnchor="middle" fontFamily="JetBrains Mono">W</text>
          <text x={2} y={-67} fill="#5a564d" fontSize={5} fontFamily="JetBrains Mono">60°</text>
          <text x={2} y={-34} fill="#5a564d" fontSize={5} fontFamily="JetBrains Mono">30°</text>
          {sats.map((s) => {
            const { x, y } = polarToSvg(s.elevationDeg, s.azimuthDeg, SVG_RADIUS);
            const col = SYSTEM_COLOR[s.system];
            const isSel = s.prn === selected;
            return (
              <g
                key={s.prn}
                data-sat-prn={s.prn}
                data-testid={`skyplot-sat-${s.prn}`}
                onClick={() => setSelected(s.prn)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={s.used ? 4 : 3}
                  fill={s.used ? col : 'transparent'}
                  stroke={col}
                  strokeWidth={isSel ? 1.4 : 0.7}
                  opacity={s.used ? 1 : 0.5}
                />
                <text
                  x={x}
                  y={y + 1.5}
                  fill={s.used ? '#0a0d10' : col}
                  fontSize={3.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono"
                  fontWeight={600}
                >
                  {s.prn.slice(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Side panel: DOP grid + counts + SNR bars + forecast */}
      <div className="gps-side" data-testid="gps-side">
        <div className="dop-grid" data-testid="dop-grid">
          {DOP_THRESHOLDS.map((th) => {
            const v = dop[th.name];
            const cls = v < th.target ? 'good' : 'warn';
            return (
              <div key={th.name} className={`dop-cell ${cls}`} data-testid={`dop-cell-${th.name}`}>
                <div className="dop-name">{th.label}</div>
                <div className="dop-val mono">{v < 99 ? v.toFixed(2) : '—'}</div>
                <div className="dop-target mono">{th.display}</div>
              </div>
            );
          })}
        </div>

        <div className="gps-counts" data-testid="gps-counts">
          <div>
            <span className="gps-c-num mono" style={{ color: '#7aa874' }} data-testid="gps-used-count">
              {used.length}
            </span>
            <span>USED</span>
          </div>
          <div>
            <span className="gps-c-num mono" data-testid="gps-vis-count">{sats.length}</span>
            <span>VIS</span>
          </div>
          <div>
            <span className="gps-c-num mono" style={{ color: '#e5a24a' }} data-testid="gps-masked-count">
              {sats.length - used.length}
            </span>
            <span>MASKED</span>
          </div>
        </div>

        <div className="hud-label">SNR · C/N0 (dBHz)</div>
        <div className="snr-bars" data-testid="snr-bars">
          {sats.slice(0, 12).map((s: MockGpsSat) => (
            <div key={s.prn + s.system} className="snr-row" data-testid={`snr-row-${s.prn}`}>
              <span className="snr-id mono" style={{ color: SYSTEM_COLOR[s.system] }}>
                {s.prn}
              </span>
              <div className="snr-track">
                <div
                  className="snr-fill"
                  style={{
                    width: `${(s.signalStrength - 20) * 2.5}%`,
                    background: SYSTEM_COLOR[s.system],
                  }}
                />
              </div>
              <span className="snr-val mono">{s.signalStrength.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <div className="hud-label">PDOP · 향후 30분 예측</div>
        <div className="pdop-forecast" data-testid="gps-pdop-forecast">
          <svg viewBox="0 0 240 50" preserveAspectRatio="none" style={{ width: '100%', height: 50 }}>
            <defs>
              <linearGradient id="pdopg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#e5a24a" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#e5a24a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={forecastPath.fill} fill="url(#pdopg)" />
            <path d={forecastPath.line} fill="none" stroke="#e5a24a" strokeWidth={1.2} />
            <line
              x1={0}
              y1={50 - (2.0 / 4) * 50}
              x2={240}
              y2={50 - (2.0 / 4) * 50}
              stroke="#d8634a"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
            <text
              x={2}
              y={50 - (2.0 / 4) * 50 - 2}
              fill="#d8634a"
              fontSize={6}
              fontFamily="JetBrains Mono"
            >
              2.0 limit
            </text>
          </svg>
        </div>

        {selectedSat ? (
          <div className="gpslos-tooltip" data-testid="sat-tooltip">
            <div>
              <span className="label">PRN </span>
              {selectedSat.prn}
            </div>
            <div>
              <span className="label">EL </span>
              {selectedSat.elevationDeg.toFixed(1)}°
            </div>
            <div>
              <span className="label">AZ </span>
              {selectedSat.azimuthDeg.toFixed(1)}°
            </div>
            <div>
              <span className="label">SNR </span>
              {selectedSat.signalStrength.toFixed(1)} dB-Hz
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
