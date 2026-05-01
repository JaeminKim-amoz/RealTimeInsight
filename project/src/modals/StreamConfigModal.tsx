/**
 * StreamConfigModal (US-2-007a) — FULL.
 *
 * 4-tab modal: Sync Pattern / Frame Layout / Streams / Encryption.
 * - Sync Pattern: hex pattern input + sync_width_bits selector + frame_words input
 * - Frame Layout: word_bits selector, CRC word index, sync placement, subcom mask bits
 * - Streams: editable table of (streamId, ip, port, bitrate_mbps) with add/remove + total
 * - Encryption: AES-256 key input (text/hex toggle), enable/disable toggle
 * Apply button validates and on success closes + emits a status message.
 */

import { useMemo, useState } from 'react';
import { Modal } from './Modal';

interface StreamConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (config: StreamConfig) => void;
}

type Tab = 'sync' | 'frame' | 'streams' | 'encryption';

export interface StreamRow {
  streamId: string;
  ip: string;
  port: number;
  bitrateMbps: number;
}

export interface StreamConfig {
  syncPatternHex: string;
  syncWidthBits: 16 | 24 | 32;
  frameWords: number;
  wordBits: 8 | 10 | 16 | 32;
  crcWordIndex: number;
  syncPlacement: 'start' | 'end';
  subcomMaskBits: number;
  streams: StreamRow[];
  aesEnabled: boolean;
  aesKey: string;
  aesKeyMode: 'text' | 'hex';
}

const DEFAULT_CONFIG: StreamConfig = {
  syncPatternHex: 'FE6B2840',
  syncWidthBits: 32,
  frameWords: 256,
  wordBits: 16,
  crcWordIndex: 255,
  syncPlacement: 'start',
  subcomMaskBits: 4,
  streams: [
    { streamId: 's-primary', ip: '239.192.1.10', port: 5001, bitrateMbps: 42.8 },
    { streamId: 's-video', ip: '10.10.20.14', port: 5101, bitrateMbps: 18.4 },
  ],
  aesEnabled: true,
  aesKey: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  aesKeyMode: 'hex',
};

function isValidHex(value: string): boolean {
  return /^[0-9a-fA-F]+$/.test(value);
}

function isValidIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}

export function StreamConfigModal({ isOpen, onClose, onApply }: StreamConfigModalProps) {
  const [tab, setTab] = useState<Tab>('sync');
  const [cfg, setCfg] = useState<StreamConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const totalBitrate = useMemo(
    () => cfg.streams.reduce((sum, s) => sum + (Number.isFinite(s.bitrateMbps) ? s.bitrateMbps : 0), 0),
    [cfg.streams]
  );

  const updateCfg = <K extends keyof StreamConfig>(key: K, val: StreamConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: val }));
    setError(null);
  };

  const updateStreamRow = (idx: number, patch: Partial<StreamRow>) => {
    setCfg((c) => ({
      ...c,
      streams: c.streams.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
    setError(null);
  };

  const addStreamRow = () => {
    const next: StreamRow = {
      streamId: `s-${cfg.streams.length + 1}`,
      ip: '239.192.1.99',
      port: 5999,
      bitrateMbps: 10,
    };
    setCfg((c) => ({ ...c, streams: [...c.streams, next] }));
  };

  const removeStreamRow = (idx: number) => {
    setCfg((c) => ({ ...c, streams: c.streams.filter((_, i) => i !== idx) }));
  };

  const handleApply = () => {
    if (!isValidHex(cfg.syncPatternHex)) {
      setError('Sync pattern must be valid hex.');
      return;
    }
    if (cfg.frameWords <= 0) {
      setError('Frame words must be positive.');
      return;
    }
    if (cfg.crcWordIndex < 0 || cfg.crcWordIndex >= cfg.frameWords) {
      setError('CRC word index out of range.');
      return;
    }
    if (cfg.streams.length === 0) {
      setError('At least one stream is required.');
      return;
    }
    for (const s of cfg.streams) {
      if (!isValidIp(s.ip)) {
        setError(`Invalid IP for ${s.streamId}.`);
        return;
      }
      if (s.port <= 0 || s.port > 65535) {
        setError(`Invalid port for ${s.streamId}.`);
        return;
      }
    }
    if (cfg.aesEnabled) {
      if (cfg.aesKeyMode === 'hex' && (!isValidHex(cfg.aesKey) || cfg.aesKey.length !== 64)) {
        setError('AES-256 key must be 64 hex chars (256 bits).');
        return;
      }
      if (cfg.aesKeyMode === 'text' && cfg.aesKey.length < 32) {
        setError('AES-256 text key must be at least 32 characters.');
        return;
      }
    }
    onApply?.(cfg);
    setToast('Configuration applied successfully.');
    setTimeout(() => {
      setToast(null);
      onClose();
    }, 50);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="stream-config-modal" ariaLabel="Stream Config">
      <div className="modal-hd">
        <span>Stream Config</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sync'}
          className={tab === 'sync' ? 'on' : ''}
          onClick={() => setTab('sync')}
          data-testid="scm-tab-sync"
        >
          Sync Pattern
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'frame'}
          className={tab === 'frame' ? 'on' : ''}
          onClick={() => setTab('frame')}
          data-testid="scm-tab-frame"
        >
          Frame Layout
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'streams'}
          className={tab === 'streams' ? 'on' : ''}
          onClick={() => setTab('streams')}
          data-testid="scm-tab-streams"
        >
          Streams
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'encryption'}
          className={tab === 'encryption' ? 'on' : ''}
          onClick={() => setTab('encryption')}
          data-testid="scm-tab-encryption"
        >
          Encryption
        </button>
      </div>

      <div className="modal-body" data-testid={`scm-tab-content-${tab}`}>
        {tab === 'sync' && (
          <div className="sc-grid">
            <div className="sc-field">
              <label htmlFor="scm-sync-pattern">Sync pattern (hex)</label>
              <input
                id="scm-sync-pattern"
                className="cme-cell mono"
                value={cfg.syncPatternHex}
                onChange={(e) => updateCfg('syncPatternHex', e.target.value.toUpperCase())}
                data-testid="scm-sync-pattern"
              />
            </div>
            <div className="sc-field">
              <label htmlFor="scm-sync-width">Sync width (bits)</label>
              <select
                id="scm-sync-width"
                className="cme-cell mono"
                value={cfg.syncWidthBits}
                onChange={(e) => updateCfg('syncWidthBits', Number(e.target.value) as 16 | 24 | 32)}
                data-testid="scm-sync-width"
              >
                <option value={16}>16</option>
                <option value={24}>24</option>
                <option value={32}>32</option>
              </select>
            </div>
            <div className="sc-field">
              <label htmlFor="scm-frame-words">Frame words</label>
              <input
                id="scm-frame-words"
                type="number"
                className="cme-cell mono"
                value={cfg.frameWords}
                onChange={(e) => updateCfg('frameWords', Number(e.target.value))}
                data-testid="scm-frame-words"
              />
            </div>
          </div>
        )}

        {tab === 'frame' && (
          <div className="sc-grid">
            <div className="sc-field">
              <label htmlFor="scm-word-bits">Word bits</label>
              <select
                id="scm-word-bits"
                className="cme-cell mono"
                value={cfg.wordBits}
                onChange={(e) => updateCfg('wordBits', Number(e.target.value) as 8 | 10 | 16 | 32)}
                data-testid="scm-word-bits"
              >
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
              </select>
            </div>
            <div className="sc-field">
              <label htmlFor="scm-crc-index">CRC word index</label>
              <input
                id="scm-crc-index"
                type="number"
                className="cme-cell mono"
                value={cfg.crcWordIndex}
                onChange={(e) => updateCfg('crcWordIndex', Number(e.target.value))}
                data-testid="scm-crc-index"
              />
            </div>
            <div className="sc-field">
              <label htmlFor="scm-sync-placement">Sync placement</label>
              <select
                id="scm-sync-placement"
                className="cme-cell"
                value={cfg.syncPlacement}
                onChange={(e) => updateCfg('syncPlacement', e.target.value as 'start' | 'end')}
                data-testid="scm-sync-placement"
              >
                <option value="start">start</option>
                <option value="end">end</option>
              </select>
            </div>
            <div className="sc-field">
              <label htmlFor="scm-subcom-mask">Subcom mask bits</label>
              <input
                id="scm-subcom-mask"
                type="number"
                className="cme-cell mono"
                value={cfg.subcomMaskBits}
                onChange={(e) => updateCfg('subcomMaskBits', Number(e.target.value))}
                data-testid="scm-subcom-mask"
              />
            </div>
          </div>
        )}

        {tab === 'streams' && (
          <div data-testid="scm-streams-table">
            <div className="cme-toolbar">
              <button
                type="button"
                className="tb-btn"
                onClick={addStreamRow}
                data-testid="scm-add-stream"
              >
                + Add Stream
              </button>
            </div>
            <table className="cme-sheet">
              <thead>
                <tr>
                  <th>streamId</th>
                  <th>ip</th>
                  <th>port</th>
                  <th>bitrate (Mbps)</th>
                  <th>actions</th>
                </tr>
              </thead>
              <tbody>
                {cfg.streams.map((s, i) => (
                  <tr key={i} data-testid={`scm-stream-row-${i}`}>
                    <td>
                      <input
                        className="cme-cell mono"
                        value={s.streamId}
                        onChange={(e) => updateStreamRow(i, { streamId: e.target.value })}
                        data-testid={`scm-stream-id-${i}`}
                      />
                    </td>
                    <td>
                      <input
                        className="cme-cell mono"
                        value={s.ip}
                        onChange={(e) => updateStreamRow(i, { ip: e.target.value })}
                        data-testid={`scm-stream-ip-${i}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="cme-cell mono"
                        value={s.port}
                        onChange={(e) => updateStreamRow(i, { port: Number(e.target.value) })}
                        data-testid={`scm-stream-port-${i}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        className="cme-cell mono"
                        value={s.bitrateMbps}
                        onChange={(e) => updateStreamRow(i, { bitrateMbps: Number(e.target.value) })}
                        data-testid={`scm-stream-bitrate-${i}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="tb-btn"
                        onClick={() => removeStreamRow(i)}
                        data-testid={`scm-stream-remove-${i}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="scm-total" data-testid="scm-total-bitrate">
              Total bitrate: <span className="mono">{totalBitrate.toFixed(2)} Mbps</span>
            </div>
          </div>
        )}

        {tab === 'encryption' && (
          <div className="sc-grid">
            <div className="sc-field">
              <label>
                <input
                  type="checkbox"
                  checked={cfg.aesEnabled}
                  onChange={(e) => updateCfg('aesEnabled', e.target.checked)}
                  data-testid="scm-aes-enabled"
                />
                AES-256 enabled
              </label>
            </div>
            <div className="sc-field">
              <label htmlFor="scm-aes-keymode">Key format</label>
              <div className="tweak-seg" role="group">
                <button
                  type="button"
                  className={cfg.aesKeyMode === 'text' ? 'on' : ''}
                  onClick={() => updateCfg('aesKeyMode', 'text')}
                  data-testid="scm-aes-mode-text"
                  disabled={!cfg.aesEnabled}
                >
                  Text
                </button>
                <button
                  type="button"
                  className={cfg.aesKeyMode === 'hex' ? 'on' : ''}
                  onClick={() => updateCfg('aesKeyMode', 'hex')}
                  data-testid="scm-aes-mode-hex"
                  disabled={!cfg.aesEnabled}
                >
                  Hex
                </button>
              </div>
            </div>
            <div className="sc-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="scm-aes-key">AES-256 key</label>
              <input
                id="scm-aes-key"
                className="cme-cell mono"
                type="text"
                value={cfg.aesKey}
                disabled={!cfg.aesEnabled}
                onChange={(e) => updateCfg('aesKey', e.target.value)}
                data-testid="scm-aes-key"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="scm-error" role="alert" data-testid="scm-error">
          {error}
        </div>
      )}
      {toast && (
        <div className="scm-toast" role="status" data-testid="scm-toast">
          {toast}
        </div>
      )}

      <div className="modal-footer">
        <div className="spacer" />
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="tb-btn primary"
          onClick={handleApply}
          data-testid="scm-apply"
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
