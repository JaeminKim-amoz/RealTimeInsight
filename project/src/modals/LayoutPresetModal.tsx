/**
 * LayoutPresetModal (US-2-004a) — FULL.
 *
 * Three tabs:
 *   - Factory Presets: 6 hardcoded preset cards with hand-drawn SVG thumbnails
 *   - My Workspaces:   user-saved presets with rename + delete
 *   - Team · Shared:   3 mock shared workspaces (read-only, click loads)
 *
 * Click a card / row → workspaceStore.loadPreset(id) → onClose().
 */

import { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { useWorkspaceStore } from '../store/workspaceStore';
import {
  LAYOUT_PRESET_META,
  FACTORY_PRESET_IDS,
  SHARED_WORKSPACES,
  buildFactoryPresets,
  type LayoutPresetMeta,
} from '../store/presets/layoutPresets';

type Tab = 'factory' | 'saved' | 'shared';

interface LayoutPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function PresetThumb({ kind }: { kind: LayoutPresetMeta['thumb'] }) {
  // Hand-drawn SVG thumbnail per preset (slice-2 placeholder).
  const stroke = 'var(--amber-1, #b58a3b)';
  const dim = 'var(--line-2, #555)';
  switch (kind) {
    case 'flight':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-flight" className="rti-preset-thumb">
          <rect x="4" y="4" width="60" height="18" fill="none" stroke={dim} />
          <polyline points="4,18 15,12 30,14 45,8 60,10" stroke={stroke} fill="none" />
          <rect x="68" y="4" width="68" height="18" fill="none" stroke={dim} />
          <polyline points="68,16 85,9 100,13 120,6 136,8" stroke={stroke} fill="none" />
          <rect x="4" y="26" width="42" height="26" fill="none" stroke={dim} />
          <circle cx="25" cy="39" r="8" fill="none" stroke={stroke} />
          <rect x="50" y="26" width="42" height="26" fill="none" stroke={dim} />
          <rect x="96" y="26" width="40" height="26" fill="none" stroke={dim} />
          <rect x="4" y="56" width="80" height="28" fill="none" stroke={dim} />
          <rect x="88" y="56" width="48" height="28" fill="none" stroke={dim} />
        </svg>
      );
    case 'spectrum':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-spectrum" className="rti-preset-thumb">
          <rect x="4" y="4" width="132" height="54" fill="none" stroke={dim} />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={6 + i * 9} y={10 + (i % 4) * 10} width="6" height="44" fill={stroke} opacity="0.5" />
          ))}
          <rect x="4" y="62" width="64" height="22" fill="none" stroke={dim} />
          <rect x="72" y="62" width="64" height="22" fill="none" stroke={dim} />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-map" className="rti-preset-thumb">
          <rect x="4" y="4" width="86" height="58" fill="none" stroke={dim} />
          <path d="M 10 50 Q 30 30 50 40 T 85 25" stroke={stroke} fill="none" />
          <rect x="94" y="4" width="42" height="38" fill="none" stroke={dim} />
          <rect x="94" y="46" width="42" height="16" fill="none" stroke={dim} />
          <rect x="4" y="66" width="132" height="18" fill="none" stroke={dim} />
        </svg>
      );
    case 'triage':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-triage" className="rti-preset-thumb">
          <rect x="4" y="4" width="86" height="80" fill="none" stroke={dim} />
          <rect x="94" y="4" width="42" height="80" fill="none" stroke={stroke} />
          <circle cx="115" cy="20" r="5" fill="none" stroke={stroke} />
          <circle cx="120" cy="40" r="3" fill={stroke} />
        </svg>
      );
    case 'rehearsal':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-rehearsal" className="rti-preset-thumb">
          <rect x="4" y="4" width="132" height="10" fill="none" stroke={dim} />
          <rect x="4" y="4" width="86" height="10" fill={stroke} opacity="0.5" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={4 + i * 46} y="18" width="42" height="32" fill="none" stroke={dim} />
          ))}
          <rect x="4" y="54" width="132" height="30" fill="none" stroke={dim} />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 140 88" data-testid="thumb-check" className="rti-preset-thumb">
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={4 + (i % 6) * 22} y={4 + Math.floor(i / 6) * 28} width="20" height="24" fill="none" stroke={dim} />
          ))}
          <rect x="4" y="60" width="132" height="24" fill="none" stroke={dim} />
        </svg>
      );
    default:
      return null;
  }
}

export function LayoutPresetModal({ isOpen, onClose }: LayoutPresetModalProps) {
  const [tab, setTab] = useState<Tab>('factory');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const presets = useWorkspaceStore((s) => s.presets);
  const loadPreset = useWorkspaceStore((s) => s.loadPreset);

  // Saved workspaces: any preset whose id is NOT in the factory id set.
  const savedWorkspaces = useMemo(
    () => presets.filter((p) => !FACTORY_PRESET_IDS.has(p.id)),
    [presets]
  );

  const ensureFactoryPresetsLoaded = (id: string) => {
    // If the store has been reset (no presets matching the requested id), seed
    // it from the factory before dispatching loadPreset.
    const exists = useWorkspaceStore.getState().presets.some((p) => p.id === id);
    if (!exists) {
      const factory = buildFactoryPresets();
      useWorkspaceStore.setState((s) => ({
        presets: [...factory, ...s.presets.filter((p) => !FACTORY_PRESET_IDS.has(p.id))],
      }));
    }
  };

  const handleFactoryClick = (id: string) => {
    ensureFactoryPresetsLoaded(id);
    loadPreset(id);
    onClose();
  };

  const handleRenameStart = (id: string, currentLabel: string) => {
    setRenamingId(id);
    setRenameDraft(currentLabel);
  };

  const handleRenameCommit = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      // Rename in-place: rewrite the preset's label without snapshotting the
      // current workspace (savePreset would clone layoutTree from state).
      useWorkspaceStore.setState((s) => ({
        presets: s.presets.map((p) => (p.id === id ? { ...p, label: trimmed } : p)),
      }));
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const handleDelete = (id: string) => {
    useWorkspaceStore.setState((s) => ({
      presets: s.presets.filter((p) => p.id !== id),
    }));
  };

  const handleSharedLoad = (sharedId: string) => {
    const shared = SHARED_WORKSPACES.find((s) => s.id === sharedId);
    if (!shared) return;
    // Inject the shared preset into the store registry, then loadPreset.
    useWorkspaceStore.setState((s) => {
      const filtered = s.presets.filter((p) => p.id !== shared.id);
      return {
        presets: [
          ...filtered,
          {
            id: shared.id,
            label: shared.label,
            layoutTree: shared.layoutTree,
            panels: shared.panels,
          },
        ],
      };
    });
    loadPreset(shared.id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="layout-preset-modal" ariaLabel="Layout Presets">
      <div className="modal-hd">
        <span>Workspaces & Layouts</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>
      <div className="modal-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'factory'}
          className={tab === 'factory' ? 'on' : ''}
          onClick={() => setTab('factory')}
          data-testid="layout-tab-factory"
        >
          Factory Presets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'saved'}
          className={tab === 'saved' ? 'on' : ''}
          onClick={() => setTab('saved')}
          data-testid="layout-tab-saved"
        >
          My Workspaces
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'shared'}
          className={tab === 'shared' ? 'on' : ''}
          onClick={() => setTab('shared')}
          data-testid="layout-tab-shared"
        >
          Team · Shared
        </button>
      </div>
      <div className="modal-body" data-testid={`layout-tab-content-${tab}`}>
        {tab === 'factory' && (
          <div className="rti-preset-grid">
            {LAYOUT_PRESET_META.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rti-preset-card"
                data-testid={`layout-preset-card-${p.id}`}
                onClick={() => handleFactoryClick(p.id)}
              >
                <PresetThumb kind={p.thumb} />
                <div className="rti-preset-card-title">
                  <span>{p.label}</span>
                  <span className="mono">{p.panelCount} panels</span>
                </div>
                <div className="rti-preset-card-desc">{p.description}</div>
                <div className="rti-preset-card-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="rti-preset-tag">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === 'saved' && (
          <div className="rti-saved-list">
            {savedWorkspaces.length === 0 && (
              <div className="rti-empty">No saved workspaces yet.</div>
            )}
            {savedWorkspaces.map((p) => (
              <div key={p.id} className="rti-saved-row" data-testid={`saved-row-${p.id}`}>
                {renamingId === p.id ? (
                  <input
                    className="mf-input"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => handleRenameCommit(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCommit(p.id);
                      else if (e.key === 'Escape') {
                        setRenamingId(null);
                        setRenameDraft('');
                      }
                    }}
                    autoFocus
                    data-testid={`rename-input-${p.id}`}
                  />
                ) : (
                  <span className="rti-saved-label">{p.label}</span>
                )}
                <div className="rti-saved-actions">
                  <button
                    type="button"
                    className="tb-btn"
                    onClick={() => {
                      loadPreset(p.id);
                      onClose();
                    }}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="tb-btn"
                    onClick={() => handleRenameStart(p.id, p.label)}
                    data-testid={`rename-${p.id}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="tb-btn"
                    onClick={() => handleDelete(p.id)}
                    data-testid={`delete-${p.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'shared' && (
          <div className="rti-shared-list">
            {SHARED_WORKSPACES.map((sw) => (
              <div key={sw.id} className="rti-shared-row" data-testid={`shared-row-${sw.id}`}>
                <span className="rti-shared-team">{sw.team}</span>
                <span className="rti-shared-label">{sw.label}</span>
                <span className="rti-shared-by">by {sw.by}</span>
                <span className="rti-shared-when">{sw.when}</span>
                <button type="button" className="tb-btn" onClick={() => handleSharedLoad(sw.id)}>
                  Load
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
