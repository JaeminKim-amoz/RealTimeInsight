const { parseBridgeCommand, parseBridgeEvent } = require('./schemas.js');

function normalizeInvoke(invoke) {
  if (invoke) return invoke;
  if (globalThis.__TAURI__?.core?.invoke) return globalThis.__TAURI__.core.invoke;
  throw new Error('Tauri invoke is unavailable');
}

function parseSubscriptionHandle(value) {
  if (!value || typeof value !== 'object' || typeof value.subscriptionId !== 'string') {
    throw new Error('subscription handle must include subscriptionId');
  }
  return { subscriptionId: value.subscriptionId };
}

function createBridgeClient(options = {}) {
  const invoke = normalizeInvoke(options.invoke);
  const listen = options.listen || globalThis.__TAURI__?.event?.listen;
  return {
    async onBridgeEvent(handler) {
      if (!listen) return () => {};
      const unlisten = await listen('rti://bridge-event', (event) => {
        handler(parseBridgeEvent(event.payload));
      });
      return typeof unlisten === 'function' ? unlisten : () => {};
    },

    async subscribePanelData(input) {
      const command = parseBridgeCommand({ kind: 'subscribePanelData', input });
      const result = await invoke('subscribe_panel_data', { input: command.input });
      return parseSubscriptionHandle(result);
    },

    async currentIngestStatus() {
      const payload = await invoke('current_ingest_status', {});
      return parseBridgeEvent({ type: 'ingest_status', payload }).payload;
    },

    async supportedPanelSchemas() {
      const schemas = await invoke('supported_panel_schemas', {});
      if (!Array.isArray(schemas)) throw new Error('supported_panel_schemas must return an array');
      return schemas;
    },

    async demoPanelStreamEvent() {
      const event = await invoke('demo_panel_stream_event', {});
      if (event == null) return null;
      return parseBridgeEvent(event);
    },

    async demoReceiverTick(input = {}) {
      const event = await invoke('demo_receiver_tick', { input });
      if (event == null) return null;
      return parseBridgeEvent(event);
    },

    async liveSessionStatus() {
      return parseLiveSessionStatus(await invoke('live_session_status', {}));
    },

    async startLiveSession() {
      return parseLiveSessionStatus(await invoke('start_live_session', {}));
    },

    async stopLiveSession() {
      return parseLiveSessionStatus(await invoke('stop_live_session', {}));
    },

    async initDemoReceiverSession() {
      return parseLiveSessionStatus(await invoke('init_demo_receiver_session', {}));
    },

    async exportDemoCsv(input = {}) {
      const value = await invoke('export_demo_csv', { input });
      if (!value || typeof value !== 'object' || value.format !== 'csv' || typeof value.content !== 'string' || !value.manifest) {
        throw new Error('export_demo_csv must return a CSV export preview');
      }
      return value;
    },

    async writeDemoCsvExport(input = {}) {
      const value = await invoke('write_demo_csv_export', { input });
      if (!value || typeof value !== 'object' || value.format !== 'csv' || !value.csvPath || !value.manifestPath) {
        throw new Error('write_demo_csv_export must return output paths');
      }
      return value;
    },

    async validateDemoLlmAnswer(answer) {
      const value = await invoke('validate_demo_llm_answer', { input: { answer } });
      if (!value || typeof value !== 'object' || !Array.isArray(value.requiredCitations) || !Array.isArray(value.cited) || !Array.isArray(value.missing) || typeof value.valid !== 'boolean') {
        throw new Error('validate_demo_llm_answer must return citation validation');
      }
      return value;
    },

    async demoRootCauseCandidates() {
      const value = await invoke('demo_root_cause_candidates', {});
      if (!Array.isArray(value)) throw new Error('demo_root_cause_candidates must return an array');
      return value;
    },

    async buildDemoOllamaRequest() {
      const value = await invoke('build_demo_ollama_request', {});
      if (!value || typeof value !== 'object' || typeof value.requestJson !== 'string') {
        throw new Error('build_demo_ollama_request must return a request preview');
      }
      return value;
    },

    async runtimeAssetInventory() {
      const value = await invoke('runtime_asset_inventory', {});
      if (!value || typeof value !== 'object' || !Array.isArray(value.assets) || !Array.isArray(value.runtimes)) {
        throw new Error('runtime_asset_inventory must return assets and runtimes');
      }
      return value;
    },

    async startManagedReceiverLoop(input = {}) {
      return parseManagedReceiverStatus(await invoke('start_managed_receiver_loop', { input }));
    },

    async stopManagedReceiverLoop() {
      return parseManagedReceiverStatus(await invoke('stop_managed_receiver_loop', {}));
    },

    async managedReceiverStatus() {
      return parseManagedReceiverStatus(await invoke('managed_receiver_status', {}));
    },

    async drainManagedReceiverEvents() {
      const value = await invoke('drain_managed_receiver_events', {});
      if (!Array.isArray(value)) throw new Error('drain_managed_receiver_events must return events');
      return value.map(parseBridgeEvent);
    },

    async demoSimdisBridgeStatus() {
      return parseSimdisBridgeStatus(await invoke('demo_simdis_bridge_status', {}));
    },

    async demoVideoSyncEvent() {
      return parseBridgeEvent(await invoke('demo_video_sync_event', {}));
    },

    async prepareDemoMatlabHandoff() {
      return parseMatlabHandoff(await invoke('prepare_demo_matlab_handoff', {}));
    },

    async enqueueDemoMatlabJob() {
      const value = await invoke('enqueue_demo_matlab_job', {});
      if (!value || typeof value !== 'object' || typeof value.id !== 'number') {
        throw new Error('enqueue_demo_matlab_job must return a job');
      }
      return value;
    },

    async enqueueDemoLlmJob() {
      const value = await invoke('enqueue_demo_llm_job', {});
      if (!value || typeof value !== 'object' || typeof value.id !== 'number') {
        throw new Error('enqueue_demo_llm_job must return a job');
      }
      return value;
    },

    async listJobs() {
      const value = await invoke('list_jobs', {});
      if (!Array.isArray(value)) throw new Error('list_jobs must return an array');
      return value;
    },

    async markJobRunning(id) {
      const value = await invoke('mark_job_running', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_running must return jobs');
      return value;
    },

    async markJobCompleted(id) {
      const value = await invoke('mark_job_completed', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_completed must return jobs');
      return value;
    },

    async markJobFailed(id) {
      const value = await invoke('mark_job_failed', { id });
      if (!Array.isArray(value)) throw new Error('mark_job_failed must return jobs');
      return value;
    },
  };
}

function parseMatlabHandoff(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.scriptPath !== 'string' ||
    typeof value.toolName !== 'string' ||
    typeof value.requestJson !== 'string' ||
    !Array.isArray(value.evidenceIds)
  ) {
    throw new Error('prepare_demo_matlab_handoff must return handoff details');
  }
  return value;
}

function parseSimdisBridgeStatus(value) {
  if (!value || typeof value !== 'object' || typeof value.publishRateHz !== 'number') {
    throw new Error('demo_simdis_bridge_status must return bridge status');
  }
  return {
    name: typeof value.name === 'string' ? value.name : 'simdis',
    target: typeof value.target === 'string' ? value.target : '',
    publishRateHz: value.publishRateHz,
    health: typeof value.health === 'string' ? value.health : 'degraded',
    detail: typeof value.detail === 'string' ? value.detail : '',
  };
}

function parseManagedReceiverStatus(value) {
  if (!value || typeof value !== 'object' || typeof value.running !== 'boolean') {
    throw new Error('managed receiver status must include running');
  }
  return {
    running: value.running,
    bindAddr: typeof value.bindAddr === 'string' ? value.bindAddr : null,
    acceptedFrames: typeof value.acceptedFrames === 'number' ? value.acceptedFrames : 0,
    rejectedFrames: typeof value.rejectedFrames === 'number' ? value.rejectedFrames : 0,
    acceptedSamples: typeof value.acceptedSamples === 'number' ? value.acceptedSamples : 0,
    timeoutCount: typeof value.timeoutCount === 'number' ? value.timeoutCount : 0,
    queuedEvents: typeof value.queuedEvents === 'number' ? value.queuedEvents : 0,
  };
}

function parseLiveSessionStatus(value) {
  if (!value || typeof value !== 'object' || typeof value.running !== 'boolean') {
    throw new Error('live session status must include running');
  }
  return {
    running: value.running,
    demoSeq: typeof value.demoSeq === 'number' ? value.demoSeq : 0,
    receiverReady: Boolean(value.receiverReady),
    acceptedFrames: typeof value.acceptedFrames === 'number' ? value.acceptedFrames : 0,
    rejectedFrames: typeof value.rejectedFrames === 'number' ? value.rejectedFrames : 0,
    acceptedSamples: typeof value.acceptedSamples === 'number' ? value.acceptedSamples : 0,
    timeoutCount: typeof value.timeoutCount === 'number' ? value.timeoutCount : 0,
  };
}

module.exports = { createBridgeClient };
