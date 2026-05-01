/**
 * MatlabModal (US-020b) — FULL.
 *
 * Bridge status from useIntegrationStore.matlab. 6 plot presets — overlay,
 * split, XY, spectrogram, evidence-bundle, compare-runs. Generated script
 * preview block updates with the selected preset. "Plot in MATLAB" button
 * is disabled when bridge is not connected.
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { useIntegrationStore } from '../store/integrationStore';

type MatlabPreset = 'overlay' | 'split' | 'xy' | 'spectrogram' | 'evidence-bundle' | 'compare-runs';

interface MatlabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS: ReadonlyArray<{ key: MatlabPreset; label: string; desc: string }> = [
  { key: 'overlay', label: 'Overlay', desc: 'Single figure, multiple series, shared x-axis.' },
  { key: 'split', label: 'Split', desc: 'Subplots stacked, one series per axis.' },
  { key: 'xy', label: 'XY scatter', desc: 'Two-channel relationship, time-colored.' },
  { key: 'spectrogram', label: 'Spectrogram', desc: 'STFT of selected analog channel.' },
  { key: 'evidence-bundle', label: 'Evidence bundle', desc: 'All evidence channels + alarm markers.' },
  { key: 'compare-runs', label: 'Compare runs', desc: 'Aligned channels across multiple runs.' },
];

function generateScript(preset: MatlabPreset): string {
  return `% RealTimeInsight → MATLAB handoff (preset: ${preset})
run  = load_rti_run('/data/runs/sortie-0420.rti');
data = rti_window(run, ch, tr);
figure('Name','RTI ${preset}');
% ${preset}-specific plotting calls follow…`;
}

export function MatlabModal({ isOpen, onClose }: MatlabModalProps) {
  const matlab = useIntegrationStore((s) => s.matlab);
  const [preset, setPreset] = useState<MatlabPreset>('overlay');

  const script = generateScript(preset);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="matlab-modal" ariaLabel="MATLAB Handoff">
      <div className="modal-hd">
        <span>MATLAB Handoff</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>
      <div className="modal-content modal-body">
        <div className="mf-row">
          <label>Bridge</label>
          <span className="status-chip" data-testid="matlab-bridge-status">
            <span className={`led ${matlab.connected ? 'ok' : 'off'}`} />
            {matlab.connected ? `MATLAB ${matlab.version ?? ''} ready` : 'MATLAB bridge offline'}
          </span>
        </div>
        <div className="mf-row">
          <label>Preset</label>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={preset === p.key ? 'on' : ''}
                onClick={() => setPreset(p.key)}
                data-testid={`matlab-preset-${p.key}`}
              >
                <div>{p.label}</div>
                <div className="preset-desc">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mf-row">
          <label>Script</label>
          <pre className="mf-preview mono" data-testid="matlab-script">
            {script}
          </pre>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="tb-btn primary"
          disabled={!matlab.connected}
          data-testid="plot-in-matlab"
        >
          Plot in MATLAB
        </button>
      </div>
    </Modal>
  );
}
