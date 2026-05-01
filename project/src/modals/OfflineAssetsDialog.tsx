/**
 * OfflineAssetsDialog (US-020c) — FULL.
 *
 * Reads useIntegrationStore.offlineAssets. Three sections — Map Tile Packs,
 * Terrain Packs, LLM Models. Each row: name + size + available indicator +
 * import button (no-op stub). Mode badge at top reflects store state.
 */

import { Modal } from './Modal';
import { useIntegrationStore, type AssetPackSummary } from '../store/integrationStore';

interface OfflineAssetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function AssetSection({ title, packs }: { title: string; packs: AssetPackSummary[] }) {
  return (
    <section className="asset-section" data-testid={`asset-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="hud-label">{title}</div>
      {packs.length === 0 ? (
        <div className="asset-empty mono">no packs installed</div>
      ) : (
        packs.map((p) => (
          <div key={p.id} className="asset-row">
            <span className="asset-name">{p.label}</span>
            <span className="asset-size mono">{p.sizeMb.toFixed(1)} MB</span>
            <span className={`asset-avail ${p.available ? 'ok' : 'warn'}`}>
              {p.available ? 'available' : 'missing'}
            </span>
            <button type="button" className="tb-btn">Import</button>
          </div>
        ))
      )}
    </section>
  );
}

export function OfflineAssetsDialog({ isOpen, onClose }: OfflineAssetsDialogProps) {
  const offlineAssets = useIntegrationStore((s) => s.offlineAssets);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="offline-assets" ariaLabel="Offline Assets">
      <div className="modal-hd">
        <span>Offline Assets</span>
        <span className={`mode-badge mode-${offlineAssets.mode}`} data-testid="offline-mode-badge">
          {offlineAssets.mode}
        </span>
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>
      <div className="modal-content modal-body">
        <AssetSection title="Map Tile Packs" packs={offlineAssets.mapTilePacks} />
        <AssetSection title="Terrain Packs" packs={offlineAssets.terrainPacks} />
        <AssetSection title="LLM Models" packs={offlineAssets.llmModels} />
      </div>
    </Modal>
  );
}
