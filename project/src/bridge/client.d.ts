import type { BridgeEvent, IngestStatusPayload, PanelSchema } from './schemas';

export interface BridgeInvoke {
  (command: string, payload?: Record<string, unknown>): Promise<unknown>;
}

export interface BridgeClient {
  subscribePanelData(input: {
    panelId: string;
    channelIds: number[];
    schema: PanelSchema;
    rangeNs: [string, string] | null;
  }): Promise<{ subscriptionId: string }>;
  currentIngestStatus(): Promise<IngestStatusPayload>;
  supportedPanelSchemas(): Promise<PanelSchema[]>;
  demoPanelStreamEvent(): Promise<BridgeEvent | null>;
  demoReceiverTick(input?: { channelIds?: number[] }): Promise<BridgeEvent | null>;
  liveSessionStatus(): Promise<LiveSessionStatus>;
  startLiveSession(): Promise<LiveSessionStatus>;
  stopLiveSession(): Promise<LiveSessionStatus>;
  initDemoReceiverSession(): Promise<LiveSessionStatus>;
  exportDemoCsv(input?: { channelIds?: number[] }): Promise<{
    format: 'csv';
    rows: number;
    content: string;
    manifest: {
      channelIds: number[];
      rowCount: number;
      qualityPolicy: string;
      valueMode: string;
      range: [number, number] | null;
    };
  }>;
  writeDemoCsvExport(input?: { channelIds?: number[] }): Promise<{
    format: 'csv';
    rows: number;
    content: string;
    manifest: unknown;
    csvPath: string;
    manifestPath: string;
  }>;
  validateDemoLlmAnswer(answer: string): Promise<{
    prompt: string;
    requiredCitations: string[];
    cited: string[];
    missing: string[];
    valid: boolean;
  }>;
  demoRootCauseCandidates(): Promise<Array<{
    nodeId: string;
    label: string;
    confidence: number;
    evidenceEdges?: string[];
  }>>;
  buildDemoOllamaRequest(): Promise<{
    enabled: boolean;
    model: string;
    requestJson: string;
  }>;
  runtimeAssetInventory(): Promise<RuntimeAssetInventory>;
  startManagedReceiverLoop(input?: {
    bindIp?: string;
    bindPort?: number;
    channelIds?: number[];
    expectedBitrateMbps?: number;
  }): Promise<ManagedReceiverStatus>;
  stopManagedReceiverLoop(): Promise<ManagedReceiverStatus>;
  managedReceiverStatus(): Promise<ManagedReceiverStatus>;
  drainManagedReceiverEvents(): Promise<BridgeEvent[]>;
  demoSimdisBridgeStatus(): Promise<SimdisBridgeStatus>;
  demoVideoSyncEvent(): Promise<BridgeEvent>;
  prepareDemoMatlabHandoff(): Promise<MatlabHandoff>;
  enqueueDemoMatlabJob(): Promise<JobSummary>;
  enqueueDemoLlmJob(): Promise<JobSummary>;
  listJobs(): Promise<JobSummary[]>;
  markJobRunning(id: number): Promise<JobSummary[]>;
  markJobCompleted(id: number): Promise<JobSummary[]>;
  markJobFailed(id: number): Promise<JobSummary[]>;
}

export interface JobSummary {
  id: number;
  label: string;
  status: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface RuntimeAssetInventory {
  assets: Array<{
    name: string;
    kind: string;
    available: boolean;
  }>;
  runtimes: Array<{
    name: string;
    health: string;
    detail?: string;
  }>;
}

export interface ManagedReceiverStatus {
  running: boolean;
  bindAddr: string | null;
  acceptedFrames: number;
  rejectedFrames: number;
  acceptedSamples: number;
  timeoutCount: number;
  queuedEvents: number;
}

export interface SimdisBridgeStatus {
  name: string;
  target: string;
  publishRateHz: number;
  health: string;
  detail: string;
}

export interface MatlabHandoff {
  scriptPath: string;
  toolName: string;
  requestJson: string;
  evidenceIds: string[];
}

export interface LiveSessionStatus {
  running: boolean;
  demoSeq: number;
  receiverReady: boolean;
  acceptedFrames: number;
  rejectedFrames: number;
  acceptedSamples: number;
  timeoutCount: number;
}

export function createBridgeClient(options?: {
  invoke?: BridgeInvoke;
  listen?: (event: string, handler: (payload: { payload: unknown }) => void) => Promise<() => void>;
}): BridgeClient;
