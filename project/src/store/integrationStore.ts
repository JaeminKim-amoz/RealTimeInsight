/**
 * IntegrationStore — owns external integration state: MATLAB bridge, LLM
 * provider, SimDIS bridge, map provider, export jobs, offline asset inventory.
 * Spec §8.5 + §15-§19.
 */

import { create } from 'zustand';

export interface MatlabState {
  connected: boolean;
  version?: string;
  scriptPath?: string;
  lastFigureId?: string;
}

export interface LlmState {
  provider: 'local-ollama' | 'remote' | 'disabled';
  modelId: string;
  ready: boolean;
  citationGate: 'required' | 'preferred' | 'disabled';
}

export interface SimdisState {
  mode: 'disconnected' | 'file-replay' | 'network-bridge';
  scenarioId?: string;
  selectedEntityId?: string;
  syncEnabled: boolean;
}

export interface MapState {
  basemapId: string;
  offlineMode: boolean;
  layersEnabled: string[];
}

export interface ExportJob {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAtMs: number;
  artifactPath?: string;
  error?: string;
}

export interface AssetPackSummary {
  id: string;
  label: string;
  sizeMb: number;
  available: boolean;
}

export interface OfflineAssetState {
  mode: 'online-allowed' | 'offline-preferred' | 'airgapped';
  mapTilePacks: AssetPackSummary[];
  terrainPacks: AssetPackSummary[];
  llmModels: AssetPackSummary[];
}

export interface IntegrationStoreState {
  matlab: MatlabState;
  llm: LlmState;
  simdis: SimdisState;
  map: MapState;
  exportJobs: ExportJob[];
  offlineAssets: OfflineAssetState;

  setMatlabState: (patch: Partial<MatlabState>) => void;
  setLlmState: (patch: Partial<LlmState>) => void;
  setSimdisState: (patch: Partial<SimdisState>) => void;
  setMapState: (patch: Partial<MapState>) => void;
  addExportJob: (job: ExportJob) => void;
  updateExportJob: (id: string, patch: Partial<ExportJob>) => void;
  setOfflineAssets: (patch: Partial<OfflineAssetState>) => void;
  reset: () => void;
}

const INITIAL: Pick<
  IntegrationStoreState,
  'matlab' | 'llm' | 'simdis' | 'map' | 'exportJobs' | 'offlineAssets'
> = {
  matlab: { connected: false },
  llm: {
    provider: 'local-ollama',
    modelId: 'llama-3.1-8b',
    ready: false,
    citationGate: 'required',
  },
  simdis: { mode: 'disconnected', syncEnabled: false },
  map: { basemapId: 'sat', offlineMode: true, layersEnabled: ['tracks', 'events', 'aoi'] },
  exportJobs: [],
  offlineAssets: { mode: 'offline-preferred', mapTilePacks: [], terrainPacks: [], llmModels: [] },
};

export const useIntegrationStore = create<IntegrationStoreState>((set) => ({
  ...INITIAL,

  setMatlabState: (patch) => set((s) => ({ matlab: { ...s.matlab, ...patch } })),
  setLlmState: (patch) => set((s) => ({ llm: { ...s.llm, ...patch } })),
  setSimdisState: (patch) => set((s) => ({ simdis: { ...s.simdis, ...patch } })),
  setMapState: (patch) => set((s) => ({ map: { ...s.map, ...patch } })),
  addExportJob: (job) => set((s) => ({ exportJobs: [...s.exportJobs, job] })),
  updateExportJob: (id, patch) =>
    set((s) => ({
      exportJobs: s.exportJobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),
  setOfflineAssets: (patch) => set((s) => ({ offlineAssets: { ...s.offlineAssets, ...patch } })),
  reset: () =>
    set({
      matlab: { ...INITIAL.matlab },
      llm: { ...INITIAL.llm },
      simdis: { ...INITIAL.simdis },
      map: { ...INITIAL.map },
      exportJobs: [],
      offlineAssets: { ...INITIAL.offlineAssets },
    }),
}));
