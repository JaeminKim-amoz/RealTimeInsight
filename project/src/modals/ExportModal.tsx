/**
 * ExportModal (US-020a) — FULL.
 *
 * 5 tabs (CSV / Parquet / Arrow / MATLAB / Snapshot). Active tab managed via
 * internal state. CSV tab content includes target selector, time-range picker,
 * quality policy radio, value-mode toggle, file-name input, and a "Generate
 * Export" button that pushes a job onto useIntegrationStore.
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { useIntegrationStore } from '../store/integrationStore';

type ExportTab = 'csv' | 'parquet' | 'arrow' | 'matlab' | 'snapshot';
type ExportTarget = 'channels' | 'panel' | 'selection';
type RangeMode = 'viewport' | 'custom';
type QualityPolicy = 'keep-all' | 'good-crc-only' | 'decode-valid-only' | 'split-by-quality';
type ValueMode = 'raw' | 'eng' | 'both';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: ReadonlyArray<{ key: ExportTab; label: string }> = [
  { key: 'csv', label: 'CSV' },
  { key: 'parquet', label: 'Parquet' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'matlab', label: 'MATLAB' },
  { key: 'snapshot', label: 'Snapshot' },
];

const QUALITY_POLICIES: ReadonlyArray<{ key: QualityPolicy; label: string }> = [
  { key: 'keep-all', label: 'Keep all rows' },
  { key: 'good-crc-only', label: 'Only good CRC' },
  { key: 'decode-valid-only', label: 'Only decode-valid' },
  { key: 'split-by-quality', label: 'Split by quality' },
];

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [tab, setTab] = useState<ExportTab>('csv');
  const [target, setTarget] = useState<ExportTarget>('channels');
  const [rangeMode, setRangeMode] = useState<RangeMode>('viewport');
  const [quality, setQuality] = useState<QualityPolicy>('good-crc-only');
  const [valueMode, setValueMode] = useState<ValueMode>('both');
  const [fileName, setFileName] = useState('export-001');

  const addExportJob = useIntegrationStore((s) => s.addExportJob);

  const handleGenerate = () => {
    addExportJob({
      id: `job-${Date.now()}`,
      label: `${tab.toUpperCase()} export — ${fileName}`,
      status: 'queued',
      createdAtMs: Date.now(),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="export-modal" ariaLabel="Export">
      <div className="modal-hd">
        <span>Export</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>
      <div className="modal-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'on' : ''}
            onClick={() => setTab(t.key)}
            data-testid={`export-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="modal-content modal-body" data-testid={`export-tab-content-${tab}`}>
        {tab === 'csv' ? (
          <div className="mf-grid">
            <div className="mf-row">
              <label>Target</label>
              <div className="tweak-seg">
                {(['channels', 'panel', 'selection'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={target === t ? 'on' : ''}
                    onClick={() => setTarget(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Range</label>
              <div className="tweak-seg">
                {(['viewport', 'custom'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={rangeMode === r ? 'on' : ''}
                    onClick={() => setRangeMode(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Quality</label>
              <div className="quality-radio">
                {QUALITY_POLICIES.map((q) => (
                  <label key={q.key} className="mf-radio">
                    <input
                      type="radio"
                      name="quality-policy"
                      value={q.key}
                      checked={quality === q.key}
                      onChange={() => setQuality(q.key)}
                      data-testid={`quality-${q.key}`}
                    />
                    <span>{q.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Values</label>
              <div className="tweak-seg">
                {(['raw', 'eng', 'both'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={valueMode === v ? 'on' : ''}
                    onClick={() => setValueMode(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>File</label>
              <input
                className="mf-input"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                data-testid="export-filename"
              />
            </div>
            <div className="mf-row">
              <label>Preview</label>
              <span className="mono" data-testid="export-row-count">
                ~60,000 rows
              </span>
            </div>
          </div>
        ) : null}
        {tab === 'parquet' ? <p>Parquet export — columnar, compressed.</p> : null}
        {tab === 'arrow' ? <p>Arrow IPC — zero-copy.</p> : null}
        {tab === 'matlab' ? <p>MATLAB .mat handoff.</p> : null}
        {tab === 'snapshot' ? <p>Snapshot — frozen workspace state.</p> : null}
      </div>
      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="tb-btn primary"
          onClick={handleGenerate}
          data-testid="generate-export"
        >
          Generate Export
        </button>
      </div>
    </Modal>
  );
}
