/**
 * TweaksPanel (US-2-007d) — FULL.
 *
 * Developer-mode tweaks panel:
 *  - Theme picker: Dark / Light / High-Contrast segmented selector
 *  - Density toggle: Compact / Normal / Spacious
 *  - Relation-graph layout selector: Force / Hierarchy / Radial
 *  - Dev mode toggle (enables extra diagnostics in the UI)
 *
 * All state is wired to useUiStore (UI-only slice; not persisted to backend).
 */

import { Modal } from './Modal';
import {
  useUiStore,
  type AppTheme,
  type UiDensity,
  type RelationGraphLayout,
} from '../store/uiStore';

interface TweaksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES: { value: AppTheme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'high-contrast', label: 'High Contrast' },
];

const DENSITIES: { value: UiDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Spacious' },
];

const GRAPH_LAYOUTS: { value: RelationGraphLayout; label: string }[] = [
  { value: 'force', label: 'Force' },
  { value: 'hierarchy', label: 'Hierarchy' },
  { value: 'radial', label: 'Radial' },
];

export function TweaksPanel({ isOpen, onClose }: TweaksPanelProps) {
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  const relationGraphLayout = useUiStore((s) => s.relationGraphLayout);
  const devMode = useUiStore((s) => s.devMode);
  const setTheme = useUiStore((s) => s.setTheme);
  const setDensity = useUiStore((s) => s.setDensity);
  const setRelationGraphLayout = useUiStore((s) => s.setRelationGraphLayout);
  const setDevMode = useUiStore((s) => s.setDevMode);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="tweaks-panel" ariaLabel="Tweaks">
      <div className="modal-hd">
        <span>Tweaks</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-body tweak-grid">
        {/* Theme picker */}
        <div className="tweak-row">
          <label className="hud-label">Theme</label>
          <div className="tweak-seg" role="group" aria-label="Theme" data-testid="tweak-theme-group">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={theme === t.value ? 'on' : ''}
                aria-pressed={theme === t.value}
                onClick={() => setTheme(t.value)}
                data-testid={`tweak-theme-${t.value}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Density toggle */}
        <div className="tweak-row">
          <label className="hud-label">Density</label>
          <div className="tweak-seg" role="group" aria-label="Density" data-testid="tweak-density-group">
            {DENSITIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={density === d.value ? 'on' : ''}
                aria-pressed={density === d.value}
                onClick={() => setDensity(d.value)}
                data-testid={`tweak-density-${d.value}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Relation-graph layout selector */}
        <div className="tweak-row">
          <label className="hud-label" htmlFor="tweak-graph-layout">Relation graph</label>
          <select
            id="tweak-graph-layout"
            className="cme-cell"
            value={relationGraphLayout}
            onChange={(e) => setRelationGraphLayout(e.target.value as RelationGraphLayout)}
            data-testid="tweak-graph-layout"
          >
            {GRAPH_LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dev mode toggle */}
        <div className="tweak-row">
          <label className="hud-label" htmlFor="tweak-devmode">Dev mode</label>
          <label className="tweak-toggle">
            <input
              id="tweak-devmode"
              type="checkbox"
              checked={devMode}
              onChange={(e) => setDevMode(e.target.checked)}
              data-testid="tweak-devmode"
            />
            <span>{devMode ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {devMode && (
          <div className="tweak-devinfo" data-testid="tweak-devinfo" role="status">
            Dev mode active — additional diagnostics are visible in panels.
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
