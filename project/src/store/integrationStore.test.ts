import { describe, it, expect, beforeEach } from 'vitest';
import { useIntegrationStore } from './integrationStore';

describe('store/integrationStore', () => {
  beforeEach(() => useIntegrationStore.getState().reset());

  it('initial state — disconnected/idle for all integrations', () => {
    const s = useIntegrationStore.getState();
    expect(s.matlab.connected).toBe(false);
    expect(s.llm.provider).toBe('local-ollama');
    expect(s.simdis.mode).toBe('disconnected');
    expect(s.exportJobs).toEqual([]);
    expect(s.offlineAssets.mode).toBe('offline-preferred');
  });

  it('exportJob lifecycle queued → running → completed', () => {
    useIntegrationStore.getState().addExportJob({
      id: 'job-1',
      label: 'CSV — anom-001 window',
      status: 'queued',
      createdAtMs: 1,
    });
    useIntegrationStore.getState().updateExportJob('job-1', { status: 'running' });
    expect(useIntegrationStore.getState().exportJobs[0].status).toBe('running');
    useIntegrationStore.getState().updateExportJob('job-1', { status: 'completed' });
    expect(useIntegrationStore.getState().exportJobs[0].status).toBe('completed');
  });

  it('setMatlabState patches existing fields', () => {
    useIntegrationStore.getState().setMatlabState({ connected: true, version: 'R2026a' });
    const s = useIntegrationStore.getState().matlab;
    expect(s.connected).toBe(true);
    expect(s.version).toBe('R2026a');
  });

  it('setSimdisState updates mode', () => {
    useIntegrationStore.getState().setSimdisState({ mode: 'network-bridge', selectedEntityId: 'tk-247' });
    expect(useIntegrationStore.getState().simdis.mode).toBe('network-bridge');
    expect(useIntegrationStore.getState().simdis.selectedEntityId).toBe('tk-247');
  });

  it('setOfflineAssets updates mode + asset arrays', () => {
    useIntegrationStore.getState().setOfflineAssets({
      mode: 'airgapped',
      mapTilePacks: [{ id: 'korea-sat', label: 'Korea Sat', sizeMb: 420, available: true }],
    });
    const a = useIntegrationStore.getState().offlineAssets;
    expect(a.mode).toBe('airgapped');
    expect(a.mapTilePacks).toHaveLength(1);
  });
});
