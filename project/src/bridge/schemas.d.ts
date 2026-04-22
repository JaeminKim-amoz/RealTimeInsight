export type PanelSchema = 'timeseries-v1' | 'waterfall-v1' | 'discrete-v1' | 'xy-v1';

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

export interface SyncLossEventPayload {
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
  | { type: 'sync_loss_event'; payload: SyncLossEventPayload }
  | { type: 'export_progress'; payload: ExportProgressPayload }
  | { type: 'llm_tool_progress'; payload: LlmToolProgressPayload }
  | { type: 'video_sync_event'; payload: VideoSyncPayload }
  | { type: string; payload: Record<string, unknown> };

export interface SubscribePanelDataCommand {
  kind: 'subscribePanelData';
  input: {
    panelId: string;
    channelIds: number[];
    schema: PanelSchema;
    rangeNs: [string, string] | null;
  };
}

export function parseBridgeEvent(event: unknown): BridgeEvent;
export function parseBridgeCommand(command: unknown): SubscribePanelDataCommand;
