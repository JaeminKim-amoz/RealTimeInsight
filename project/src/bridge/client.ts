import type { BridgeEvent, IngestStatusPayload, PanelSchema } from './schemas';

declare global {
  // eslint-disable-next-line no-var
  var __TAURI__: undefined | {
    core?: {
      invoke?: (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
    };
    event?: {
      listen?: (
        event: string,
        handler: (payload: { payload: unknown }) => void,
      ) => Promise<() => void>;
    };
  };
}

type Invoke = (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
type Listen = (
  event: string,
  handler: (payload: { payload: unknown }) => void,
) => Promise<() => void>;

type ExportManifestPreview = {
  channelIds: number[];
  rowCount: number;
  qualityPolicy: string;
  valueMode: string;
  range: [number, number] | null;
};

type ManagedReceiverStatus = {
  running: boolean;
  bindAddr: string | null;
  acceptedFrames: number;
  rejectedFrames: number;
  acceptedSamples: number;
  timeoutCount: number;
  queuedEvents: number;
};

type SimdisBridgeStatus = {
  name: string;
  target: string;
  publishRateHz: number;
  health: string;
  detail: string;
};

type VideoSyncEvent = {
  type: 'video_sync_event';
  payload: {
    cursorNs: string;
    segmentId: string;
    frameRef: string;
  };
};

type MatlabHandoff = {
  scriptPath: string;
  toolName: string;
  requestJson: string;
  evidenceIds: string[];
};

function assertSubscriptionHandle(value: unknown): { subscriptionId: string } {
  if (!value || typeof value !== 'object' || typeof (value as { subscriptionId?: unknown }).subscriptionId !== 'string') {
    throw new Error('subscription handle must include subscriptionId');
  }
  return { subscriptionId: (value as { subscriptionId: string }).subscriptionId };
}

function assertIngestStatus(value: unknown): IngestStatusPayload {
  const payload = value as IngestStatusPayload;
  if (!payload || typeof payload.bitrateMbps !== 'number') {
    throw new Error('invalid ingest status payload');
  }
  return payload;
}

function assertLiveSessionStatus(value: unknown): {
  running: boolean;
  demoSeq: number;
  receiverReady: boolean;
    acceptedFrames: number;
    rejectedFrames: number;
    acceptedSamples: number;
    timeoutCount: number;
} {
  if (!value || typeof value !== 'object' || typeof (value as { running?: unknown }).running !== 'boolean') {
    throw new Error('live session status must include running');
  }
  const raw = value as { running: boolean; demoSeq?: unknown };
  const extended = raw as typeof raw & {
    receiverReady?: unknown;
    acceptedFrames?: unknown;
    rejectedFrames?: unknown;
    acceptedSamples?: unknown;
    timeoutCount?: unknown;
  };
  return {
    running: raw.running,
    demoSeq: typeof raw.demoSeq === 'number' ? raw.demoSeq : 0,
    receiverReady: Boolean(extended.receiverReady),
    acceptedFrames: typeof extended.acceptedFrames === 'number' ? extended.acceptedFrames : 0,
    rejectedFrames: typeof extended.rejectedFrames === 'number' ? extended.rejectedFrames : 0,
    acceptedSamples: typeof extended.acceptedSamples === 'number' ? extended.acceptedSamples : 0,
    timeoutCount: typeof extended.timeoutCount === 'number' ? extended.timeoutCount : 0,
  };
}

function assertManagedReceiverStatus(value: unknown): ManagedReceiverStatus {
  if (!value || typeof value !== 'object' || typeof (value as { running?: unknown }).running !== 'boolean') {
    throw new Error('managed receiver status must include running');
  }
  const raw = value as {
    running: boolean;
    bindAddr?: unknown;
    acceptedFrames?: unknown;
    rejectedFrames?: unknown;
    acceptedSamples?: unknown;
    timeoutCount?: unknown;
    queuedEvents?: unknown;
  };
  return {
    running: raw.running,
    bindAddr: typeof raw.bindAddr === 'string' ? raw.bindAddr : null,
    acceptedFrames: typeof raw.acceptedFrames === 'number' ? raw.acceptedFrames : 0,
    rejectedFrames: typeof raw.rejectedFrames === 'number' ? raw.rejectedFrames : 0,
    acceptedSamples: typeof raw.acceptedSamples === 'number' ? raw.acceptedSamples : 0,
    timeoutCount: typeof raw.timeoutCount === 'number' ? raw.timeoutCount : 0,
    queuedEvents: typeof raw.queuedEvents === 'number' ? raw.queuedEvents : 0,
  };
}

function assertSimdisBridgeStatus(value: unknown): SimdisBridgeStatus {
  if (!value || typeof value !== 'object' || typeof (value as { publishRateHz?: unknown }).publishRateHz !== 'number') {
    throw new Error('demo_simdis_bridge_status must return bridge status');
  }
  const raw = value as {
    name?: unknown;
    target?: unknown;
    publishRateHz: number;
    health?: unknown;
    detail?: unknown;
  };
  return {
    name: typeof raw.name === 'string' ? raw.name : 'simdis',
    target: typeof raw.target === 'string' ? raw.target : '',
    publishRateHz: raw.publishRateHz,
    health: typeof raw.health === 'string' ? raw.health : 'degraded',
    detail: typeof raw.detail === 'string' ? raw.detail : '',
  };
}

function assertVideoSyncEvent(value: unknown): VideoSyncEvent {
  const event = value as {
    type?: unknown;
    payload?: {
      cursorNs?: unknown;
      segmentId?: unknown;
      frameRef?: unknown;
    };
  };
  if (
    event.type !== 'video_sync_event' ||
    typeof event.payload?.cursorNs !== 'string' ||
    typeof event.payload?.segmentId !== 'string' ||
    typeof event.payload?.frameRef !== 'string'
  ) {
    throw new Error('demo_video_sync_event must return a video_sync_event');
  }
  return {
    type: 'video_sync_event',
    payload: {
      cursorNs: event.payload.cursorNs,
      segmentId: event.payload.segmentId,
      frameRef: event.payload.frameRef,
    },
  };
}

function assertMatlabHandoff(value: unknown): MatlabHandoff {
  const raw = value as {
    scriptPath?: unknown;
    toolName?: unknown;
    requestJson?: unknown;
    evidenceIds?: unknown;
  };
  if (
    typeof raw.scriptPath !== 'string' ||
    typeof raw.toolName !== 'string' ||
    typeof raw.requestJson !== 'string' ||
    !Array.isArray(raw.evidenceIds)
  ) {
    throw new Error('prepare_demo_matlab_handoff must return handoff details');
  }
  return {
    scriptPath: raw.scriptPath,
    toolName: raw.toolName,
    requestJson: raw.requestJson,
    evidenceIds: raw.evidenceIds as string[],
  };
}

export function createBridgeClient(options: { invoke?: Invoke } = {}) {
  const invoke = options.invoke || globalThis.__TAURI__?.core?.invoke;
  const listen = (options as { listen?: Listen }).listen || globalThis.__TAURI__?.event?.listen;
  if (!invoke) throw new Error('Tauri invoke is unavailable');

  return {
    async onBridgeEvent(handler: (event: BridgeEvent) => void) {
      if (!listen) return () => {};
      return listen('rti://bridge-event', (event) => {
        handler(event.payload as BridgeEvent);
      });
    },

    async subscribePanelData(input: {
      panelId: string;
      channelIds: number[];
      schema: PanelSchema;
      rangeNs: [string, string] | null;
    }) {
      if (!input.channelIds.length) throw new Error('channelIds must be a non-empty array');
      return assertSubscriptionHandle(await invoke('subscribe_panel_data', { input }));
    },

    async currentIngestStatus() {
      return assertIngestStatus(await invoke('current_ingest_status', {}));
    },

    async supportedPanelSchemas() {
      const schemas = await invoke('supported_panel_schemas', {});
      if (!Array.isArray(schemas)) throw new Error('supported_panel_schemas must return an array');
      return schemas as PanelSchema[];
    },

    async demoPanelStreamEvent() {
      return (await invoke('demo_panel_stream_event', {})) as BridgeEvent | null;
    },

    async demoReceiverTick(input: { channelIds?: number[] } = {}) {
      return (await invoke('demo_receiver_tick', { input })) as BridgeEvent | null;
    },

    async liveSessionStatus() {
      return assertLiveSessionStatus(await invoke('live_session_status', {}));
    },

    async startLiveSession() {
      return assertLiveSessionStatus(await invoke('start_live_session', {}));
    },

    async stopLiveSession() {
      return assertLiveSessionStatus(await invoke('stop_live_session', {}));
    },

    async initDemoReceiverSession() {
      return assertLiveSessionStatus(await invoke('init_demo_receiver_session', {}));
    },

    async exportDemoCsv(input: { channelIds?: number[] } = {}) {
      const value = await invoke('export_demo_csv', { input });
      const preview = value as { format?: unknown; rows?: unknown; content?: unknown; manifest?: unknown };
      if (preview.format !== 'csv' || typeof preview.rows !== 'number' || typeof preview.content !== 'string' || !preview.manifest) {
        throw new Error('export_demo_csv must return a CSV export preview');
      }
      return { format: 'csv' as const, rows: preview.rows, content: preview.content, manifest: preview.manifest as ExportManifestPreview };
    },

    async writeDemoCsvExport(input: { channelIds?: number[] } = {}) {
      const value = await invoke('write_demo_csv_export', { input });
      const preview = value as { format?: unknown; rows?: unknown; content?: unknown; manifest?: unknown; csvPath?: unknown; manifestPath?: unknown };
      if (preview.format !== 'csv' || typeof preview.csvPath !== 'string' || typeof preview.manifestPath !== 'string') {
        throw new Error('write_demo_csv_export must return output paths');
      }
      return {
        format: 'csv' as const,
        rows: typeof preview.rows === 'number' ? preview.rows : 0,
        content: typeof preview.content === 'string' ? preview.content : '',
        manifest: preview.manifest as ExportManifestPreview,
        csvPath: preview.csvPath,
        manifestPath: preview.manifestPath,
      };
    },

    async validateDemoLlmAnswer(answer: string) {
      const value = await invoke('validate_demo_llm_answer', { input: { answer } });
      const result = value as { prompt?: unknown; requiredCitations?: unknown; cited?: unknown; missing?: unknown; valid?: unknown };
      if (typeof result.prompt !== 'string' || !Array.isArray(result.requiredCitations) || !Array.isArray(result.cited) || !Array.isArray(result.missing) || typeof result.valid !== 'boolean') {
        throw new Error('validate_demo_llm_answer must return citation validation');
      }
      return {
        prompt: result.prompt,
        requiredCitations: result.requiredCitations as string[],
        cited: result.cited as string[],
        missing: result.missing as string[],
        valid: result.valid,
      };
    },

    async demoRootCauseCandidates() {
      const value = await invoke('demo_root_cause_candidates', {});
      if (!Array.isArray(value)) throw new Error('demo_root_cause_candidates must return an array');
      return value as Array<{ nodeId: string; label: string; confidence: number; evidenceEdges?: string[] }>;
    },

    async buildDemoOllamaRequest() {
      const value = await invoke('build_demo_ollama_request', {});
      const preview = value as { enabled?: unknown; model?: unknown; requestJson?: unknown };
      if (typeof preview.enabled !== 'boolean' || typeof preview.model !== 'string' || typeof preview.requestJson !== 'string') {
        throw new Error('build_demo_ollama_request must return a request preview');
      }
      return { enabled: preview.enabled, model: preview.model, requestJson: preview.requestJson };
    },

    async runtimeAssetInventory() {
      const value = await invoke('runtime_asset_inventory', {});
      const inventory = value as { assets?: unknown; runtimes?: unknown };
      if (!Array.isArray(inventory.assets) || !Array.isArray(inventory.runtimes)) {
        throw new Error('runtime_asset_inventory must return assets and runtimes');
      }
      return inventory as {
        assets: Array<{ name: string; kind: string; available: boolean }>;
        runtimes: Array<{ name: string; health: string; detail?: string }>;
      };
    },

    async startManagedReceiverLoop(input: {
      bindIp?: string;
      bindPort?: number;
      channelIds?: number[];
      expectedBitrateMbps?: number;
    } = {}) {
      return assertManagedReceiverStatus(await invoke('start_managed_receiver_loop', { input }));
    },

    async stopManagedReceiverLoop() {
      return assertManagedReceiverStatus(await invoke('stop_managed_receiver_loop', {}));
    },

    async managedReceiverStatus() {
      return assertManagedReceiverStatus(await invoke('managed_receiver_status', {}));
    },

    async drainManagedReceiverEvents() {
      const value = await invoke('drain_managed_receiver_events', {});
      if (!Array.isArray(value)) throw new Error('drain_managed_receiver_events must return events');
      return value as BridgeEvent[];
    },

    async demoSimdisBridgeStatus() {
      return assertSimdisBridgeStatus(await invoke('demo_simdis_bridge_status', {}));
    },

    async demoVideoSyncEvent() {
      return assertVideoSyncEvent(await invoke('demo_video_sync_event', {}));
    },

    async prepareDemoMatlabHandoff() {
      return assertMatlabHandoff(await invoke('prepare_demo_matlab_handoff', {}));
    },

    async enqueueDemoMatlabJob() {
      const value = await invoke('enqueue_demo_matlab_job', {});
      const job = value as { id?: unknown; label?: unknown; status?: unknown };
      if (typeof job.id !== 'number' || typeof job.label !== 'string') {
        throw new Error('enqueue_demo_matlab_job must return a job');
      }
      return job as { id: number; label: string; status: string };
    },

    async enqueueDemoLlmJob() {
      const value = await invoke('enqueue_demo_llm_job', {});
      const job = value as { id?: unknown; label?: unknown; status?: unknown };
      if (typeof job.id !== 'number' || typeof job.label !== 'string') {
        throw new Error('enqueue_demo_llm_job must return a job');
      }
      return job as { id: number; label: string; status: string };
    },

    async listJobs() {
      const value = await invoke('list_jobs', {});
      if (!Array.isArray(value)) throw new Error('list_jobs must return an array');
      return value as Array<{ id: number; label: string; status: string }>;
    },

    async markJobRunning(id: number) {
      const value = await invoke('mark_job_running', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_running must return jobs');
      return value as Array<{ id: number; label: string; status: string }>;
    },

    async markJobCompleted(id: number) {
      const value = await invoke('mark_job_completed', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_completed must return jobs');
      return value as Array<{ id: number; label: string; status: string }>;
    },

    async markJobFailed(id: number) {
      const value = await invoke('mark_job_failed', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_failed must return jobs');
      return value as Array<{ id: number; label: string; status: string }>;
    },
  };
}
