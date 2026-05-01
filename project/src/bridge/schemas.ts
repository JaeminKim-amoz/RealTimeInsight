/**
 * Bridge schema types and parser for Tauri IPC events and commands.
 * Mirrors the contract established in the legacy bridge_schema_test.js.
 */

export type PanelSchema = 'timeseries-v1' | 'spectrum-v1' | 'pose3d-v1' | 'map-track-v1';

export interface IngestStatusPayload {
  sourceConnected: boolean;
  packetRateHz: number;
  frameRateHz: number;
  bitrateMbps: number;
  crcFailRate: number;
  syncLossCount: number;
}

export interface PanelStreamDataPayload {
  subscriptionId: string;
  panelId: string;
  schema: PanelSchema;
  dataRef: string;
  rangeNs: [string, string];
  seq: number;
}

export interface CrcEventPayload {
  frameCounter: number;
  channelIds: number[];
  reason: string;
  timestampNs: string;
}

export interface SyncLossPayload {
  lostAtNs: string;
  reacquiredAtNs: string;
  durationNs: string;
  bitOffset: number;
}

export interface ExportProgressPayload {
  jobId: number;
  status: string;
  rowsWritten: number;
  artifactPath: string;
  manifestPath: string;
}

export interface LlmToolProgressPayload {
  jobId: number;
  tool: string;
  status: string;
  evidenceIds: string[];
}

export interface VideoSyncPayload {
  cursorNs: string;
  segmentId: string;
  frameRef: string;
}

export type BridgeEvent =
  | { type: 'ingest_status'; payload: IngestStatusPayload }
  | { type: 'panel_stream_data'; payload: PanelStreamDataPayload }
  | { type: 'crc_event'; payload: CrcEventPayload }
  | { type: 'sync_loss_event'; payload: SyncLossPayload }
  | { type: 'export_progress'; payload: ExportProgressPayload }
  | { type: 'llm_tool_progress'; payload: LlmToolProgressPayload }
  | { type: 'video_sync_event'; payload: VideoSyncPayload };

export type BridgeCommand =
  | { kind: 'subscribePanelData'; input: { panelId: string; channelIds: number[]; schema: PanelSchema; rangeNs: [string, string] | null } };

// ---------- parsers ----------

function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string') throw new Error(`${field} must be a string`);
  return val;
}

function assertNumber(val: unknown, field: string): number {
  if (typeof val !== 'number') throw new Error(`${field} must be a number`);
  return val;
}

function assertBoolean(val: unknown, field: string): boolean {
  if (typeof val !== 'boolean') throw new Error(`${field} must be a boolean`);
  return val;
}

function assertNumberArray(val: unknown, field: string): number[] {
  if (!Array.isArray(val) || val.some((v) => typeof v !== 'number')) {
    throw new Error(`${field} must be a number[]`);
  }
  return val as number[];
}

function assertStringArray(val: unknown, field: string): string[] {
  if (!Array.isArray(val) || val.some((v) => typeof v !== 'string')) {
    throw new Error(`${field} must be a string[]`);
  }
  return val as string[];
}

function parseIngestStatus(p: Record<string, unknown>): IngestStatusPayload {
  return {
    sourceConnected: assertBoolean(p['sourceConnected'], 'sourceConnected'),
    packetRateHz: assertNumber(p['packetRateHz'], 'packetRateHz'),
    frameRateHz: assertNumber(p['frameRateHz'], 'frameRateHz'),
    bitrateMbps: assertNumber(p['bitrateMbps'], 'bitrateMbps'),
    crcFailRate: assertNumber(p['crcFailRate'], 'crcFailRate'),
    syncLossCount: assertNumber(p['syncLossCount'], 'syncLossCount'),
  };
}

function parsePanelStreamData(p: Record<string, unknown>): PanelStreamDataPayload {
  if ('samples' in p) {
    throw new Error('panel_stream_data payload must not contain inline samples; use dataRef');
  }
  const rangeNs = p['rangeNs'];
  if (!Array.isArray(rangeNs) || rangeNs.length !== 2 || typeof rangeNs[0] !== 'string' || typeof rangeNs[1] !== 'string') {
    throw new Error('rangeNs must be [string, string]');
  }
  return {
    subscriptionId: assertString(p['subscriptionId'], 'subscriptionId'),
    panelId: assertString(p['panelId'], 'panelId'),
    schema: assertString(p['schema'], 'schema') as PanelSchema,
    dataRef: assertString(p['dataRef'], 'dataRef'),
    rangeNs: [rangeNs[0], rangeNs[1]],
    seq: assertNumber(p['seq'], 'seq'),
  };
}

function parseCrcEvent(p: Record<string, unknown>): CrcEventPayload {
  const channelIds = assertNumberArray(p['channelIds'], 'channelIds');
  if (channelIds.length === 0) throw new Error('channelIds must be non-empty');
  if (!('frameCounter' in p)) throw new Error('frameCounter is required');
  return {
    frameCounter: assertNumber(p['frameCounter'], 'frameCounter'),
    channelIds,
    reason: assertString(p['reason'], 'reason'),
    timestampNs: assertString(p['timestampNs'], 'timestampNs'),
  };
}

function parseSyncLoss(p: Record<string, unknown>): SyncLossPayload {
  return {
    lostAtNs: assertString(p['lostAtNs'], 'lostAtNs'),
    reacquiredAtNs: assertString(p['reacquiredAtNs'], 'reacquiredAtNs'),
    durationNs: assertString(p['durationNs'], 'durationNs'),
    bitOffset: assertNumber(p['bitOffset'], 'bitOffset'),
  };
}

function parseExportProgress(p: Record<string, unknown>): ExportProgressPayload {
  return {
    jobId: assertNumber(p['jobId'], 'jobId'),
    status: assertString(p['status'], 'status'),
    rowsWritten: assertNumber(p['rowsWritten'], 'rowsWritten'),
    artifactPath: assertString(p['artifactPath'], 'artifactPath'),
    manifestPath: assertString(p['manifestPath'], 'manifestPath'),
  };
}

function parseLlmToolProgress(p: Record<string, unknown>): LlmToolProgressPayload {
  return {
    jobId: assertNumber(p['jobId'], 'jobId'),
    tool: assertString(p['tool'], 'tool'),
    status: assertString(p['status'], 'status'),
    evidenceIds: assertStringArray(p['evidenceIds'], 'evidenceIds'),
  };
}

function parseVideoSync(p: Record<string, unknown>): VideoSyncPayload {
  return {
    cursorNs: assertString(p['cursorNs'], 'cursorNs'),
    segmentId: assertString(p['segmentId'], 'segmentId'),
    frameRef: assertString(p['frameRef'], 'frameRef'),
  };
}

export function parseBridgeEvent(raw: { type: string; payload: Record<string, unknown> }): BridgeEvent {
  const { type, payload } = raw;
  switch (type) {
    case 'ingest_status':
      return { type, payload: parseIngestStatus(payload) };
    case 'panel_stream_data':
      return { type, payload: parsePanelStreamData(payload) };
    case 'crc_event':
      return { type, payload: parseCrcEvent(payload) };
    case 'sync_loss_event':
      return { type, payload: parseSyncLoss(payload) };
    case 'export_progress':
      return { type, payload: parseExportProgress(payload) };
    case 'llm_tool_progress':
      return { type, payload: parseLlmToolProgress(payload) };
    case 'video_sync_event':
      return { type, payload: parseVideoSync(payload) };
    default:
      throw new Error(`Unknown bridge event type: ${type}`);
  }
}

export function parseBridgeCommand(raw: { kind: string; input: Record<string, unknown> }): BridgeCommand {
  const { kind, input } = raw;
  switch (kind) {
    case 'subscribePanelData':
      return {
        kind,
        input: {
          panelId: assertString(input['panelId'], 'panelId'),
          channelIds: assertNumberArray(input['channelIds'], 'channelIds'),
          schema: assertString(input['schema'], 'schema') as PanelSchema,
          rangeNs: (input['rangeNs'] as [string, string] | null) ?? null,
        },
      };
    default:
      throw new Error(`Unknown bridge command kind: ${kind}`);
  }
}
