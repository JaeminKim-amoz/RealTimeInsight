const EVENT_TYPES = new Set([
  'ingest_status',
  'panel_stream_data',
  'alarm_event',
  'crc_event',
  'sync_loss_event',
  'export_progress',
  'llm_tool_progress',
  'video_sync_event',
]);

const PANEL_SCHEMAS = new Set(['timeseries-v1', 'waterfall-v1', 'discrete-v1', 'xy-v1']);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function assertStringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty string array`);
  }
  value.forEach((item, index) => assertString(item, `${name}[${index}]`));
}

function assertNumberArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty number array`);
  }
  value.forEach((item, index) => assertNumber(item, `${name}[${index}]`));
}

function parsePanelStreamData(payload) {
  assertObject(payload, 'panel_stream_data payload');
  assertString(payload.subscriptionId, 'subscriptionId');
  assertString(payload.panelId, 'panelId');
  assertString(payload.dataRef, 'dataRef');
  if (!PANEL_SCHEMAS.has(payload.schema)) throw new Error(`unsupported panel schema: ${payload.schema}`);
  if (Object.prototype.hasOwnProperty.call(payload, 'samples')) {
    throw new Error('panel_stream_data must use dataRef, not inline samples');
  }
  if (!Array.isArray(payload.rangeNs) || payload.rangeNs.length !== 2) {
    throw new Error('rangeNs must be a [start,end] tuple');
  }
  payload.rangeNs.forEach((value, index) => assertString(value, `rangeNs[${index}]`));
  assertNumber(payload.seq, 'seq');
  return {
    subscriptionId: payload.subscriptionId,
    panelId: payload.panelId,
    schema: payload.schema,
    dataRef: payload.dataRef,
    rangeNs: payload.rangeNs,
    seq: payload.seq,
  };
}

function parseIngestStatus(payload) {
  assertObject(payload, 'ingest_status payload');
  assertNumber(payload.packetRateHz, 'packetRateHz');
  assertNumber(payload.frameRateHz, 'frameRateHz');
  assertNumber(payload.bitrateMbps, 'bitrateMbps');
  assertNumber(payload.crcFailRate, 'crcFailRate');
  assertNumber(payload.syncLossCount, 'syncLossCount');
  return {
    sourceConnected: Boolean(payload.sourceConnected),
    packetRateHz: payload.packetRateHz,
    frameRateHz: payload.frameRateHz,
    bitrateMbps: payload.bitrateMbps,
    crcFailRate: payload.crcFailRate,
    syncLossCount: payload.syncLossCount,
  };
}

function parseCrcEvent(payload) {
  assertObject(payload, 'crc_event payload');
  assertNumber(payload.frameCounter, 'frameCounter');
  assertNumberArray(payload.channelIds, 'channelIds');
  assertString(payload.reason, 'reason');
  assertString(payload.timestampNs, 'timestampNs');
  return {
    frameCounter: payload.frameCounter,
    channelIds: payload.channelIds,
    reason: payload.reason,
    timestampNs: payload.timestampNs,
  };
}

function parseSyncLossEvent(payload) {
  assertObject(payload, 'sync_loss_event payload');
  assertString(payload.lostAtNs, 'lostAtNs');
  assertString(payload.reacquiredAtNs, 'reacquiredAtNs');
  assertString(payload.durationNs, 'durationNs');
  assertNumber(payload.bitOffset, 'bitOffset');
  return {
    lostAtNs: payload.lostAtNs,
    reacquiredAtNs: payload.reacquiredAtNs,
    durationNs: payload.durationNs,
    bitOffset: payload.bitOffset,
  };
}

function parseExportProgress(payload) {
  assertObject(payload, 'export_progress payload');
  assertNumber(payload.jobId, 'jobId');
  assertString(payload.status, 'status');
  assertNumber(payload.rowsWritten, 'rowsWritten');
  assertString(payload.artifactPath, 'artifactPath');
  assertString(payload.manifestPath, 'manifestPath');
  return {
    jobId: payload.jobId,
    status: payload.status,
    rowsWritten: payload.rowsWritten,
    artifactPath: payload.artifactPath,
    manifestPath: payload.manifestPath,
  };
}

function parseLlmToolProgress(payload) {
  assertObject(payload, 'llm_tool_progress payload');
  assertNumber(payload.jobId, 'jobId');
  assertString(payload.tool, 'tool');
  assertString(payload.status, 'status');
  assertStringArray(payload.evidenceIds, 'evidenceIds');
  return {
    jobId: payload.jobId,
    tool: payload.tool,
    status: payload.status,
    evidenceIds: payload.evidenceIds,
  };
}

function parseVideoSyncEvent(payload) {
  assertObject(payload, 'video_sync_event payload');
  assertString(payload.cursorNs, 'cursorNs');
  assertString(payload.segmentId, 'segmentId');
  assertString(payload.frameRef, 'frameRef');
  return {
    cursorNs: payload.cursorNs,
    segmentId: payload.segmentId,
    frameRef: payload.frameRef,
  };
}

function parseBridgeEvent(event) {
  assertObject(event, 'bridge event');
  assertString(event.type, 'event.type');
  if (!EVENT_TYPES.has(event.type)) throw new Error(`unknown bridge event type: ${event.type}`);
  if (event.type === 'panel_stream_data') {
    return { type: event.type, payload: parsePanelStreamData(event.payload) };
  }
  if (event.type === 'ingest_status') {
    return { type: event.type, payload: parseIngestStatus(event.payload) };
  }
  if (event.type === 'crc_event') {
    return { type: event.type, payload: parseCrcEvent(event.payload) };
  }
  if (event.type === 'sync_loss_event') {
    return { type: event.type, payload: parseSyncLossEvent(event.payload) };
  }
  if (event.type === 'export_progress') {
    return { type: event.type, payload: parseExportProgress(event.payload) };
  }
  if (event.type === 'llm_tool_progress') {
    return { type: event.type, payload: parseLlmToolProgress(event.payload) };
  }
  if (event.type === 'video_sync_event') {
    return { type: event.type, payload: parseVideoSyncEvent(event.payload) };
  }
  assertObject(event.payload, 'event.payload');
  return { type: event.type, payload: event.payload };
}

function parseSubscribePanelData(input) {
  assertObject(input, 'subscribePanelData input');
  assertString(input.panelId, 'panelId');
  if (!Array.isArray(input.channelIds) || input.channelIds.length === 0) {
    throw new Error('channelIds must be a non-empty array');
  }
  input.channelIds.forEach((value, index) => assertNumber(value, `channelIds[${index}]`));
  if (!PANEL_SCHEMAS.has(input.schema)) throw new Error(`unsupported panel schema: ${input.schema}`);
  if (input.rangeNs !== null && input.rangeNs !== undefined) {
    if (!Array.isArray(input.rangeNs) || input.rangeNs.length !== 2) {
      throw new Error('rangeNs must be null or a [start,end] tuple');
    }
  }
  return {
    panelId: input.panelId,
    channelIds: input.channelIds,
    schema: input.schema,
    rangeNs: input.rangeNs ?? null,
  };
}

function parseBridgeCommand(command) {
  assertObject(command, 'bridge command');
  assertString(command.kind, 'command.kind');
  if (command.kind === 'subscribePanelData') {
    return { kind: command.kind, input: parseSubscribePanelData(command.input) };
  }
  throw new Error(`unknown bridge command kind: ${command.kind}`);
}

module.exports = {
  parseBridgeEvent,
  parseBridgeCommand,
  PANEL_SCHEMAS: Array.from(PANEL_SCHEMAS),
};
