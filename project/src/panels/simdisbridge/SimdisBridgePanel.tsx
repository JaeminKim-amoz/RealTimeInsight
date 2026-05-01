/**
 * SimdisBridgePanel (US-018b) — surfaces SimDIS integration state.
 *
 * Visual fidelity 1:1 with public/app/panels2.jsx SimdisBridgePanel: status
 * grid (state, mode, scenario, selected entity, sync), connect/disconnect
 * + push-cursor buttons. Reads `useIntegrationStore.simdis` directly.
 *
 * No pure helpers — DOM-only panel.
 */

import { useIntegrationStore, type SimdisState } from '../../store/integrationStore';
import type { PanelInstance } from '../../types/domain';

interface SimdisBridgePanelProps {
  panel: PanelInstance;
  mode?: 'live' | 'replay';
}

const MODE_LABEL: Record<SimdisState['mode'], string> = {
  disconnected: 'DISCONNECTED',
  'file-replay': 'FILE-REPLAY',
  'network-bridge': 'NETWORK-BRIDGE',
};

function isConnected(s: SimdisState): boolean {
  return s.mode !== 'disconnected';
}

export function SimdisBridgePanel({ panel, mode }: SimdisBridgePanelProps) {
  void panel;
  void mode;
  const simdis = useIntegrationStore((s) => s.simdis);
  const setSimdisState = useIntegrationStore((s) => s.setSimdisState);
  const connected = isConnected(simdis);

  const onToggleConnect = () => {
    if (connected) {
      setSimdisState({ mode: 'disconnected' });
    } else {
      setSimdisState({ mode: 'file-replay' });
    }
  };

  // Slice-1: push-cursor is a deliberate no-op handler. Real pushing of the
  // global cursor lands slice-2 once the SimDIS bridge IPC is wired.
  const onPushCursor = () => {
    void 0;
  };

  return (
    <div className="panel-body simdis">
      <div className="simdis-status">
        <div className="sitem">
          <div className="slabel">Bridge State</div>
          <div className="sval" data-testid="bridge-state">
            <span
              className={`led ${connected ? 'ok' : 'alarm'}`}
              style={{
                marginRight: 6,
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
              }}
            />
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
        <div className="sitem">
          <div className="slabel">Mode</div>
          <div className="sval" data-testid="bridge-mode">
            {MODE_LABEL[simdis.mode]}
          </div>
        </div>
        <div className="sitem">
          <div className="slabel">Scenario</div>
          <div className="sval" data-testid="bridge-scenario">
            {simdis.scenarioId ?? '—'}
          </div>
        </div>
        <div className="sitem">
          <div className="slabel">Selected Entity</div>
          <div className="sval" data-testid="bridge-entity">
            {simdis.selectedEntityId ?? '—'}
          </div>
        </div>
        <div className="sitem">
          <div className="slabel">Time Sync</div>
          <div className="sval" data-testid="bridge-sync">
            {simdis.syncEnabled ? 'enabled' : 'disabled'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button
          type="button"
          className="tb-btn"
          style={{ flex: 1 }}
          data-testid="connect-toggle"
          onClick={onToggleConnect}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <button
          type="button"
          className="tb-btn"
          style={{ flex: 1 }}
          data-testid="push-cursor"
          onClick={onPushCursor}
        >
          Push Cursor to SimDIS
        </button>
      </div>
    </div>
  );
}
