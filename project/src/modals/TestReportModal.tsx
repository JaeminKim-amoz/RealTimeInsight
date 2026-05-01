/**
 * TestReportModal (US-2-007c) — FULL.
 *
 * Header: report title + date + aircraft + mission.
 * Body:
 *   - Pass/fail summary at top
 *   - Per-channel min/avg/max table (mock 12 channels)
 *   - Per-step table (from result?.steps)
 * Footer: Export to PDF button (slice-2 stub: shows
 * "PDF export not yet implemented" message).
 *
 * If `result` prop is absent, shows a mock report.
 */

import { useState } from 'react';
import { Modal } from './Modal';
import type { SequenceRunResult } from './SequenceValidator';

interface TestReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: SequenceRunResult;
  title?: string;
  aircraft?: string;
  mission?: string;
}

interface MockChannelStat {
  id: number;
  name: string;
  min: number;
  avg: number;
  max: number;
  unit: string;
}

const MOCK_CHANNELS: MockChannelStat[] = [
  { id: 1001, name: 'bus_volt_28v', min: 27.4, avg: 28.1, max: 28.6, unit: 'V' },
  { id: 1002, name: 'bus_cur_28v', min: 0.5, avg: 4.2, max: 22.1, unit: 'A' },
  { id: 1007, name: 'pdu_mode', min: 0, avg: 1, max: 2, unit: '' },
  { id: 1205, name: 'hyd_pA', min: 5, avg: 152, max: 168, unit: 'bar' },
  { id: 1206, name: 'hyd_pB', min: 5, avg: 151, max: 167, unit: 'bar' },
  { id: 2210, name: 'imu_roll', min: -0.8, avg: 0.1, max: 0.9, unit: 'deg' },
  { id: 2215, name: 'accel_z', min: -3.2, avg: 1.0, max: 4.1, unit: 'g' },
  { id: 5003, name: 'link_snr', min: 12, avg: 22, max: 28, unit: 'dB' },
  { id: 5004, name: 'link_rssi', min: -98, avg: -68, max: -52, unit: 'dBm' },
  { id: 7001, name: 'cam_front_lock', min: 0, avg: 1, max: 1, unit: '' },
  { id: 7002, name: 'cam_rear_lock', min: 0, avg: 1, max: 1, unit: '' },
  { id: 9001, name: 'gps_lat', min: 36.4, avg: 36.5, max: 36.6, unit: 'deg' },
];

const MOCK_RESULT: SequenceRunResult = {
  verdict: 'pass',
  steps: [
    { stepId: 's1', status: 'pass', detail: 'observed within band' },
    { stepId: 's2', status: 'pass', detail: 'observed within band' },
  ],
};

const today = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function TestReportModal({
  isOpen,
  onClose,
  result,
  title = 'T-247 Acceptance Report',
  aircraft = 'T-247 · s/n 00142',
  mission = 'Sortie 2026-04-20-A',
}: TestReportModalProps) {
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  const r = result ?? MOCK_RESULT;
  const passed = r.steps.filter((s) => s.status === 'pass').length;
  const failed = r.steps.filter((s) => s.status === 'fail').length;
  const verdictClass = r.verdict;

  const handleExport = () => {
    setPdfMessage('PDF export not yet implemented');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="test-report-modal" ariaLabel="Test Report">
      <div className="modal-hd">
        <span data-testid="trm-title">{title}</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="trm-meta" data-testid="trm-meta">
        <div>
          <span className="hud-label">Date</span>{' '}
          <span className="mono" data-testid="trm-date">
            {today()}
          </span>
        </div>
        <div>
          <span className="hud-label">Aircraft</span>{' '}
          <span data-testid="trm-aircraft">{aircraft}</span>
        </div>
        <div>
          <span className="hud-label">Mission</span>{' '}
          <span data-testid="trm-mission">{mission}</span>
        </div>
      </div>

      <div className="modal-body">
        <div className={`trm-summary trm-verdict-${verdictClass}`} data-testid="trm-summary">
          <span
            className={`trm-verdict trm-verdict-${verdictClass}`}
            data-testid="trm-verdict"
          >
            {r.verdict.toUpperCase()}
          </span>
          <span className="mono" data-testid="trm-counts">
            {passed} passed · {failed} failed · {r.steps.length} total
          </span>
        </div>

        <section data-testid="trm-channels-section">
          <div className="hud-label">Channel statistics</div>
          <table className="cme-sheet" data-testid="trm-channels-table">
            <thead>
              <tr>
                <th>id</th>
                <th>name</th>
                <th>min</th>
                <th>avg</th>
                <th>max</th>
                <th>unit</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CHANNELS.map((c) => (
                <tr key={c.id} data-testid={`trm-channel-row-${c.id}`}>
                  <td className="mono">{c.id}</td>
                  <td>{c.name}</td>
                  <td className="mono">{c.min.toFixed(2)}</td>
                  <td className="mono">{c.avg.toFixed(2)}</td>
                  <td className="mono">{c.max.toFixed(2)}</td>
                  <td>{c.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section data-testid="trm-steps-section">
          <div className="hud-label">Sequence steps</div>
          <table className="cme-sheet" data-testid="trm-steps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>stepId</th>
                <th>status</th>
                <th>detail</th>
              </tr>
            </thead>
            <tbody>
              {r.steps.map((s, i) => (
                <tr key={s.stepId} data-testid={`trm-step-row-${s.stepId}`}>
                  <td className="mono">{i + 1}</td>
                  <td className="mono">{s.stepId}</td>
                  <td>
                    <span className={`sv-status sv-status-${s.status}`}>{s.status}</span>
                  </td>
                  <td>{s.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {pdfMessage && (
        <div className="trm-pdf-message" role="status" data-testid="trm-pdf-message">
          {pdfMessage}
        </div>
      )}

      <div className="modal-footer">
        <div className="spacer" />
        <button
          type="button"
          className="tb-btn"
          onClick={handleExport}
          data-testid="trm-export-pdf"
        >
          Export to PDF
        </button>
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
