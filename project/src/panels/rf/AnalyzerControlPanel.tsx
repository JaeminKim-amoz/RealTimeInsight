/**
 * AnalyzerControlPanel (US-2-006d) — DOM-only Keysight front-panel remote.
 *
 * Visual fidelity 1:1 with public/app/rf.jsx AnalyzerControlPanel:
 *   - `panel-body analyzer-ctrl` container with `analyzer-ctrl-grid` form.
 *   - Center Freq / Span / Ref Level number inputs.
 *   - RBW / VBW selectors (1k/10k/100k/1M Hz) + Sweep mode (continuous/single).
 *   - SCPI command preset list at top: 4 buttons that emit canonical strings
 *     to a "log" pane below.
 *   - Markers section with M1/M2 freq + amp readouts (slice-2 mock values).
 *
 * No canvas — all interaction is DOM/state. Wires to useIntegrationStore.matlab
 * for status display only (slice-2 minimal).
 */

import { useState } from 'react';
import type { PanelInstance } from '../../types/domain';
import { useIntegrationStore } from '../../store/integrationStore';

interface AnalyzerControlPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

interface ScpiPreset {
  cmd: string;
  label: string;
}

const SCPI_PRESETS: ScpiPreset[] = [
  { cmd: '*RST', label: 'Reset' },
  { cmd: ':FREQ:CENT 1.5GHZ', label: 'Center 1.5 GHz' },
  { cmd: ':FREQ:SPAN 500MHZ', label: 'Span 500 MHz' },
  { cmd: ':DISP:WIND:TRAC:Y:RLEV -30DBM', label: 'Ref -30 dBm' },
];

const RBW_OPTIONS: { value: number; label: string }[] = [
  { value: 1000, label: '1k Hz' },
  { value: 10000, label: '10k Hz' },
  { value: 100000, label: '100k Hz' },
  { value: 1000000, label: '1M Hz' },
];

interface LogEntry {
  ts: string;
  cmd: string;
}

function nowTs(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function AnalyzerControlPanel({ panel, mode }: AnalyzerControlPanelProps) {
  void panel;
  void mode;

  const [centerFreqMhz, setCenterFreqMhz] = useState('1500');
  const [spanMhz, setSpanMhz] = useState('500');
  const [refLevelDbm, setRefLevelDbm] = useState('-30');
  const [rbwHz, setRbwHz] = useState('100000');
  const [vbwHz, setVbwHz] = useState('100000');
  const [sweepMode, setSweepMode] = useState('continuous');
  const [log, setLog] = useState<LogEntry[]>([]);

  const matlabConnected = useIntegrationStore((s) => s.matlab.connected);

  const sendScpi = (cmd: string) => {
    setLog((l) => [...l, { ts: nowTs(), cmd }]);
  };

  const markers = [
    { id: 1, hz: 1.504e9, dBm: -45.2 },
    { id: 2, hz: 1.494e9, dBm: -68.1 },
  ];

  return (
    <div className="panel-body analyzer-ctrl">
      <div className="scpi-presets">
        {SCPI_PRESETS.map((p) => (
          <button
            key={p.cmd}
            data-scpi={p.cmd}
            className="scpi-preset"
            onClick={() => sendScpi(p.cmd)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="analyzer-ctrl-grid">
        <label>
          <span>Center (MHz)</span>
          <input
            type="number"
            name="centerFreqMhz"
            value={centerFreqMhz}
            onChange={(e) => setCenterFreqMhz(e.target.value)}
          />
        </label>
        <label>
          <span>Span (MHz)</span>
          <input
            type="number"
            name="spanMhz"
            value={spanMhz}
            onChange={(e) => setSpanMhz(e.target.value)}
          />
        </label>
        <label>
          <span>Ref Level (dBm)</span>
          <input
            type="number"
            name="refLevelDbm"
            value={refLevelDbm}
            onChange={(e) => setRefLevelDbm(e.target.value)}
          />
        </label>
        <label>
          <span>RBW</span>
          <select
            name="rbwHz"
            value={rbwHz}
            onChange={(e) => setRbwHz(e.target.value)}
          >
            {RBW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>VBW</span>
          <select
            name="vbwHz"
            value={vbwHz}
            onChange={(e) => setVbwHz(e.target.value)}
          >
            {RBW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sweep</span>
          <select
            name="sweepMode"
            value={sweepMode}
            onChange={(e) => setSweepMode(e.target.value)}
          >
            <option value="continuous">continuous</option>
            <option value="single">single</option>
          </select>
        </label>
      </div>

      <div className="analyzer-ctrl-markers">
        {markers.map((m) => (
          <div key={m.id} className="marker-row">
            <span className="marker-id">M{m.id}</span>
            <span className="marker-freq">{(m.hz / 1e6).toFixed(3)} MHz</span>
            <span className="marker-amp">{m.dBm.toFixed(2)} dBm</span>
          </div>
        ))}
      </div>

      <div className="analyzer-ctrl-status">
        MATLAB bridge: {matlabConnected ? 'connected' : 'disconnected'}
      </div>

      <div className="scpi-log" aria-label="SCPI log">
        {log.map((entry, i) => (
          <div key={i} className="scpi-log-entry">
            <span className="scpi-ts">{entry.ts}</span>
            <span className="scpi-cmd">{entry.cmd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
