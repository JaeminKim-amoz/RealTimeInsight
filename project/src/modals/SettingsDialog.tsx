/**
 * SettingsDialog (US-2-007e) — FULL.
 *
 * Application settings dialog:
 *  - Theme: wired to useUiStore (mirrors TweaksPanel theme picker)
 *  - Keymap preset: Default / Vim / Emacs — wired to useUiStore
 *  - Offline mode: online-allowed / offline-preferred / airgapped
 *    wired to integrationStore.offlineAssets.mode
 *
 * Changes take effect immediately on selection (no Apply required).
 * Close button dismisses the dialog.
 */

import { Modal } from './Modal';
import { useUiStore, type AppTheme, type KeymapPreset } from '../store/uiStore';
import { useIntegrationStore, type OfflineAssetState } from '../store/integrationStore';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES: { value: AppTheme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'high-contrast', label: 'High Contrast' },
];

const KEYMAPS: { value: KeymapPreset; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'vim', label: 'Vim' },
  { value: 'emacs', label: 'Emacs' },
];

const OFFLINE_MODES: { value: OfflineAssetState['mode']; label: string; description: string }[] = [
  {
    value: 'online-allowed',
    label: 'Online allowed',
    description: 'Fetch tiles and models from CDN when not cached locally.',
  },
  {
    value: 'offline-preferred',
    label: 'Offline preferred',
    description: 'Use local assets first; fall back to network only if unavailable.',
  },
  {
    value: 'airgapped',
    label: 'Airgapped',
    description: 'Strictly offline — block all outbound requests.',
  },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const theme = useUiStore((s) => s.theme);
  const keymapPreset = useUiStore((s) => s.keymapPreset);
  const setTheme = useUiStore((s) => s.setTheme);
  const setKeymapPreset = useUiStore((s) => s.setKeymapPreset);

  const offlineMode = useIntegrationStore((s) => s.offlineAssets.mode);
  const setOfflineAssets = useIntegrationStore((s) => s.setOfflineAssets);

  const handleOfflineMode = (mode: OfflineAssetState['mode']) => {
    setOfflineAssets({ mode });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="settings-dialog" ariaLabel="Settings">
      <div className="modal-hd">
        <span>Settings</span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-body tweak-grid">
        {/* Theme */}
        <div className="tweak-row">
          <label className="hud-label" htmlFor="sd-theme">Theme</label>
          <select
            id="sd-theme"
            className="cme-cell"
            value={theme}
            onChange={(e) => setTheme(e.target.value as AppTheme)}
            data-testid="sd-theme"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Keymap */}
        <div className="tweak-row">
          <label className="hud-label" htmlFor="sd-keymap">Keymap</label>
          <select
            id="sd-keymap"
            className="cme-cell"
            value={keymapPreset}
            onChange={(e) => setKeymapPreset(e.target.value as KeymapPreset)}
            data-testid="sd-keymap"
          >
            {KEYMAPS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        {/* Offline mode */}
        <div className="tweak-row tweak-row-col">
          <label className="hud-label">Offline mode</label>
          <div
            className="sd-offline-group"
            role="radiogroup"
            aria-label="Offline mode"
            data-testid="sd-offline-group"
          >
            {OFFLINE_MODES.map((m) => (
              <label
                key={m.value}
                className={`sd-offline-option ${offlineMode === m.value ? 'on' : ''}`}
                data-testid={`sd-offline-${m.value}`}
              >
                <input
                  type="radio"
                  name="sd-offline-mode"
                  value={m.value}
                  checked={offlineMode === m.value}
                  onChange={() => handleOfflineMode(m.value)}
                  data-testid={`sd-offline-radio-${m.value}`}
                />
                <span className="sd-offline-label">{m.label}</span>
                <span className="sd-offline-desc">{m.description}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
