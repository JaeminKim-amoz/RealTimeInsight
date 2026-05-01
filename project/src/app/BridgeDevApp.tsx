import { useEffect, useMemo, useRef, useState } from 'react';
import { createBridgeClient } from '../bridge/client.ts';
import { CHANNEL_GROUPS, searchChannels } from '../mock/channels.ts';
import type { ChannelSummary } from '../mock/channels.ts';

type Status = {
  sourceConnected: boolean;
  bitrateMbps: number;
  frameRateHz: number;
  crcFailRate: number;
};

type DemoEvent = {
  type: string;
  payload?: {
    dataRef?: string;
    schema?: string;
    seq?: number;
    cursorNs?: string;
    segmentId?: string;
    frameRef?: string;
  };
} | null;

type LiveSession = {
  running: boolean;
  demoSeq: number;
  receiverReady: boolean;
  acceptedFrames: number;
  rejectedFrames: number;
  acceptedSamples: number;
  timeoutCount: number;
};

type ManagedReceiver = {
  running: boolean;
  bindAddr: string | null;
  acceptedFrames: number;
  rejectedFrames: number;
  acceptedSamples: number;
  timeoutCount: number;
  queuedEvents: number;
};

type ManagedReceiverProfile = {
  bindIp: string;
  bindPort: number;
  channelIds: number[];
  expectedBitrateMbps: number;
};

type ExportPreview = {
  format: string;
  rows: number;
  content: string;
  manifest?: {
    channelIds: number[];
    rowCount: number;
    qualityPolicy: string;
    valueMode: string;
    range: [number, number] | null;
  };
  csvPath?: string;
  manifestPath?: string;
} | null;

type LlmValidation = {
  requiredCitations: string[];
  cited: string[];
  missing: string[];
  valid: boolean;
} | null;

type OllamaPreview = {
  enabled: boolean;
  model: string;
  requestJson: string;
} | null;

type JobSummary = {
  id: number;
  label: string;
  status: string;
  createdAtMs?: number;
  updatedAtMs?: number;
};

type RuntimeInventory = {
  assets: Array<{ name: string; kind: string; available: boolean }>;
  runtimes: Array<{ name: string; health: string; detail?: string; action?: string }>;
} | null;

type SimdisBridgeStatus = {
  name: string;
  target: string;
  publishRateHz: number;
  health: string;
  detail: string;
} | null;

type MatlabHandoff = {
  scriptPath: string;
  toolName: string;
  requestJson: string;
  evidenceIds: string[];
} | null;

type RootCauseCandidate = {
  nodeId?: string;
  label: string;
  confidence: number;
  evidenceEdges?: string[];
  evidenceSummary?: string;
};

const fallbackInvoke = async (command: string) => {
  if (command === 'current_ingest_status') {
    return {
      sourceConnected: false,
      packetRateHz: 0,
      frameRateHz: 0,
      bitrateMbps: 0,
      crcFailRate: 0,
      syncLossCount: 0,
    };
  }
  if (command === 'demo_panel_stream_event') {
    return {
      type: 'panel_stream_data',
      payload: {
        subscriptionId: 'sub-demo',
        panelId: 'panel-demo',
        schema: 'timeseries-v1',
        dataRef: 'buffer://rti/demo/sub-demo/1',
        rangeNs: ['0', '1'],
        seq: 1,
      },
    };
  }
  if (command === 'demo_receiver_tick') {
    return {
      type: 'panel_stream_data',
      payload: {
        subscriptionId: 'sub-demo',
        panelId: 'panel-demo',
        schema: 'timeseries-v1',
        dataRef: 'buffer://rti/live/sub-demo/2',
        rangeNs: ['0', '1'],
        seq: 2,
      },
    };
  }
  if (command === 'supported_panel_schemas') return ['timeseries-v1'];
  if (command === 'subscribe_panel_data') return { subscriptionId: 'sub-selected' };
  if (command === 'live_session_status') return { running: false, demoSeq: 1, receiverReady: true, acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0 };
  if (command === 'start_live_session') return { running: true, demoSeq: 1, receiverReady: true, acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0 };
  if (command === 'stop_live_session') return { running: false, demoSeq: 1, receiverReady: true, acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0 };
  if (command === 'init_demo_receiver_session') return { running: false, demoSeq: 1, receiverReady: true, acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0 };
  if (command === 'start_managed_receiver_loop') return { running: true, bindAddr: '127.0.0.1:50001', acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0, queuedEvents: 0 };
  if (command === 'stop_managed_receiver_loop') return { running: false, bindAddr: null, acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 0, queuedEvents: 0 };
  if (command === 'managed_receiver_status') return { running: true, bindAddr: '127.0.0.1:50001', acceptedFrames: 0, rejectedFrames: 0, acceptedSamples: 0, timeoutCount: 1, queuedEvents: 0 };
  if (command === 'drain_managed_receiver_events') return [];
  if (command === 'export_demo_csv') return {
    format: 'csv',
    rows: 1,
    content: 'timestamp,channel_id,raw,value,quality_flags\n',
    manifest: { channelIds: [8001], rowCount: 1, qualityPolicy: 'GoodCrcOnly', valueMode: 'Both', range: [0, 1] },
    csvPath: 'project/runtime/exports/demo-evidence.csv',
    manifestPath: 'project/runtime/exports/demo-evidence.manifest.json',
  };
  if (command === 'validate_demo_llm_answer') return {
    prompt: 'Evidence EVT-1 CH-1002',
    requiredCitations: ['EVT-1', 'CH-1002'],
    cited: ['EVT-1', 'CH-1002'],
    missing: [],
    valid: true,
  };
  if (command === 'demo_root_cause_candidates') return [
    { nodeId: 'ch-1002', label: 'Bus current transient', confidence: 0.9, evidenceEdges: ['TemporalLead'], evidenceSummary: 'temporal lead, verified' },
  ];
  if (command === 'build_demo_ollama_request') return {
    enabled: false,
    model: 'gemma4:31b',
    requestJson: '{"model":"gemma4:31b"}',
  };
  if (command === 'runtime_asset_inventory') return {
    assets: [
      { name: 'korea.gpkg', kind: 'geopackage', available: true },
      { name: 'terrain.tif', kind: 'geotiff', available: true },
      { name: 'range.cdb', kind: 'cdb', available: true },
    ],
    runtimes: [
      { name: 'matlab-mcp-core-server', health: 'ready' },
      { name: 'ollama-gemma4-31b', health: 'ready' },
      { name: 'simdis-sidecar', health: 'degraded', detail: 'full executable/profile not configured', action: 'Set SIMDIS_PATH/SIMDIS_PROFILE' },
      { name: 'gstreamer', health: 'missing', detail: 'video runtime not configured', action: 'Install GStreamer runtime/plugins' },
    ],
  };
  if (command === 'demo_simdis_bridge_status') return {
    name: 'local-simdis',
    target: '127.0.0.1:30000',
    publishRateHz: 20,
    health: 'degraded',
    detail: 'sidecar executable missing; SDK baseline configured',
  };
  if (command === 'demo_video_sync_event') return {
    type: 'video_sync_event',
    payload: {
      cursorNs: '182340000000',
      segmentId: 'seg-0001',
      frameRef: 'video://cam-front/182340000000',
    },
  };
  if (command === 'prepare_demo_matlab_handoff') return {
    scriptPath: 'project/runtime/matlab/anomaly_bundle.m',
    toolName: 'run_matlab_file',
    requestJson: '{"name":"run_matlab_file"}',
    evidenceIds: ['EVT-1', 'CH-1002'],
  };
  if (command === 'enqueue_demo_matlab_job') return {
    id: 3,
    label: 'MATLAB anomaly bundle',
    status: 'Queued',
  };
  throw new Error(`unsupported fallback command: ${command}`);
};

export function BridgeDevApp() {
  const bridge = useMemo(() => createBridgeClient({
    invoke: globalThis.__TAURI__?.core?.invoke || fallbackInvoke,
  }), []);
  const [status, setStatus] = useState<Status | null>(null);
  const [demoEvent, setDemoEvent] = useState<DemoEvent>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [managedReceiver, setManagedReceiver] = useState<ManagedReceiver | null>(null);
  const [managedProfile, setManagedProfile] = useState<ManagedReceiverProfile>({
    bindIp: '127.0.0.1',
    bindPort: 0,
    channelIds: [8001, 1205],
    expectedBitrateMbps: 30,
  });
  const [channelQuery, setChannelQuery] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelSummary | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportPreview>(null);
  const [llmValidation, setLlmValidation] = useState<LlmValidation>(null);
  const [ollamaPreview, setOllamaPreview] = useState<OllamaPreview>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [runtimeInventory, setRuntimeInventory] = useState<RuntimeInventory>(null);
  const [simdisBridgeStatus, setSimdisBridgeStatus] = useState<SimdisBridgeStatus>(null);
  const [videoSyncEvent, setVideoSyncEvent] = useState<DemoEvent>(null);
  const [matlabHandoff, setMatlabHandoff] = useState<MatlabHandoff>(null);
  const [rootCauseCandidates, setRootCauseCandidates] = useState<RootCauseCandidate[]>([]);
  const [selectedRootCause, setSelectedRootCause] = useState<RootCauseCandidate | null>(null);
  const managedAutoStarted = useRef(false);
  const managedManualOff = useRef(false);
  const filteredChannels = useMemo(() => searchChannels(channelQuery).slice(0, 12), [channelQuery]);
  const startManagedReceiver = () => {
    managedManualOff.current = false;
    managedAutoStarted.current = true;
    bridge.startManagedReceiverLoop(managedProfile).then(setManagedReceiver);
  };
  const stopManagedReceiver = () => {
    managedManualOff.current = true;
    managedAutoStarted.current = false;
    bridge.stopManagedReceiverLoop().then(setManagedReceiver);
  };
  const refreshLlmPreview = () => {
    bridge.enqueueDemoLlmJob().then(() => bridge.listJobs()).then(setJobs);
    const selected = selectedRootCause?.nodeId || 'CH-1002';
    bridge
      .validateDemoLlmAnswer(`EVT-1 and ${selected} indicate coupled evidence.`)
      .then(setLlmValidation);
    bridge.buildDemoOllamaRequest().then(setOllamaPreview);
  };
  const prepareMatlabHandoff = () => {
    bridge.prepareDemoMatlabHandoff()
      .then(setMatlabHandoff)
      .then(() => bridge.enqueueDemoMatlabJob())
      .then(() => bridge.listJobs())
      .then(setJobs);
  };
  const subscribeChannel = (channel: ChannelSummary) => {
    bridge.subscribePanelData({
      panelId: 'panel-live',
      channelIds: [channel.id],
      schema: 'timeseries-v1',
      rangeNs: null,
    }).then((handle) => setSelectedSubscription(handle.subscriptionId));
    setSelectedChannel(channel);
  };
  const subscribeRootCauseChannel = (candidate: RootCauseCandidate) => {
    const id = Number(String(candidate.nodeId || '').replace('ch-', ''));
    const channel = searchChannels(String(id)).find((item) => item.id === id);
    if (channel) subscribeChannel(channel);
  };

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      Promise.all([
        bridge.currentIngestStatus(),
        bridge.demoReceiverTick({ channelIds: selectedChannel ? [selectedChannel.id] : undefined }),
        bridge.liveSessionStatus(),
        bridge.managedReceiverStatus(),
        bridge.drainManagedReceiverEvents(),
      ]).then(([nextStatus, nextEvent, nextLiveSession, nextManagedReceiver, managedEvents]) => {
        if (!active) return;
        setStatus(nextStatus);
        setDemoEvent((managedEvents[0] as DemoEvent | undefined) || (nextEvent as DemoEvent));
        setLiveSession(nextLiveSession);
        setManagedReceiver(nextManagedReceiver);
      }).catch(() => {
        if (!active) return;
        setStatus(null);
        setDemoEvent(null);
      });
    };
    bridge.initDemoReceiverSession().then((nextLiveSession) => {
      if (active) setLiveSession(nextLiveSession);
    });
    if (!managedAutoStarted.current && !managedManualOff.current) {
      managedAutoStarted.current = true;
      bridge.startManagedReceiverLoop(managedProfile).then((nextManagedReceiver) => {
        if (active) setManagedReceiver(nextManagedReceiver);
      });
    }
    refresh();
    bridge.onBridgeEvent((event) => {
      if (!active) return;
      setDemoEvent(event as DemoEvent);
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    bridge.demoRootCauseCandidates().then(setRootCauseCandidates);
    bridge.runtimeAssetInventory().then(setRuntimeInventory);
    bridge.demoSimdisBridgeStatus().then(setSimdisBridgeStatus);
    bridge.demoVideoSyncEvent().then((event) => setVideoSyncEvent(event as DemoEvent));
    const timer = setInterval(refresh, 1000);
    return () => {
      active = false;
      if (unlisten) unlisten();
      clearInterval(timer);
    };
  }, [bridge, selectedChannel]);

  useEffect(() => {
    const selected = selectedRootCause?.nodeId || 'CH-1002';
    refreshLlmPreview();
  }, [bridge, selectedRootCause]);

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0f1113',
      color: '#e8e4dd',
      fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
      display: 'grid',
      gridTemplateRows: '44px 1fr 28px'
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 12px',
        borderBottom: '1px solid #2d333b',
        background: '#14171a'
      }}>
        <strong style={{ letterSpacing: 1 }}>RealTimeInsight</strong>
        <span style={{ color: '#f0b44a' }}>LIVE</span>
        <span>Bridge: {status ? 'online' : 'fallback'}</span>
        <span>Receiver: {liveSession?.receiverReady ? 'ready' : 'not ready'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
          {status ? `${status.bitrateMbps.toFixed(2)} Mbps` : '0.00 Mbps'}
        </span>
      </header>

      <section style={{
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '300px 1fr 380px'
      }}>
        <aside style={{ borderRight: '1px solid #2d333b', background: '#16191c', padding: 12 }}>
          <h2 style={smallHeading}>Channel Explorer</h2>
          <input
            value={channelQuery}
            onChange={(event) => setChannelQuery(event.target.value)}
            placeholder="search channels"
            style={{
              width: '100%',
              marginBottom: 10,
              background: '#0f1113',
              color: '#e8e4dd',
              border: '1px solid #2d333b',
              padding: '6px 8px',
              font: 'inherit'
            }}
          />
          {CHANNEL_GROUPS.map((group) => (
            <div key={group.id} style={{ padding: '6px 0', borderBottom: '1px solid #22272d' }}>
              <div>{group.name}</div>
              <div style={{ color: '#5a564d', fontSize: 10 }}>{group.children.length} channels</div>
            </div>
          ))}
          <h3 style={{ ...smallHeading, marginTop: 14 }}>Search Results</h3>
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => {
                subscribeChannel(channel);
              }}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                padding: '5px 0',
                border: 'none',
                borderBottom: '1px solid #22272d',
                background: 'transparent',
                color: '#e8e4dd',
                textAlign: 'left',
                font: 'inherit',
                cursor: 'pointer'
              }}
            >
              <span>{channel.display}</span>
              <span style={{ color: '#878175', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{channel.unit || channel.type}</span>
            </button>
          ))}
        </aside>

        <section style={{ minWidth: 0, background: '#0f1113', padding: 12 }}>
          <h2 style={smallHeading}>Main Workspace</h2>
          <div style={{
            height: 'calc(100% - 26px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(2, minmax(160px, 1fr))',
            gap: 8
          }}>
            <TelemetryPanel liveSession={liveSession} status={status} />
            <ManagedReceiverPanel
              managedReceiver={managedReceiver}
              profile={managedProfile}
              onProfileChange={setManagedProfile}
              onStart={startManagedReceiver}
              onStop={stopManagedReceiver}
            />
            <DataRefPanel demoEvent={demoEvent} selectedSubscription={selectedSubscription} selectedChannel={selectedChannel} />
            <Panel title="Prototype Reference">
              <p>The visual prototype remains preserved in <code>project/app</code>.</p>
            </Panel>
            <Panel title="Root Cause Queue">
              <Metric label="Observation" value="synthetic replay fixture" />
              <Metric label="Graph state" value="awaiting evidence expansion" />
            </Panel>
            <ExportPanel
              exportPreview={exportPreview}
              onExport={() => bridge.writeDemoCsvExport({
                channelIds: selectedChannel ? [selectedChannel.id] : undefined,
              }).then((preview) => {
                setExportPreview(preview);
                return bridge.listJobs();
              }).then(setJobs)}
            />
            <JobPanel
              jobs={jobs}
              onRunning={(id) => bridge.markJobRunning(id).then(setJobs)}
              onCompleted={(id) => bridge.markJobCompleted(id).then(setJobs)}
              onFailed={(id) => bridge.markJobFailed(id).then(setJobs)}
            />
            <RuntimeInventoryPanel inventory={runtimeInventory} />
            <SimdisBridgePanel status={simdisBridgeStatus} />
            <MapVideoSyncPanel videoSyncEvent={videoSyncEvent} />
            <MatlabHandoffPanel handoff={matlabHandoff} onPrepare={prepareMatlabHandoff} />
          </div>
        </section>

        <aside style={{ borderLeft: '1px solid #2d333b', background: '#16191c', padding: 12 }}>
          <h2 style={smallHeading}>Insight Pane</h2>
          <p>Root-cause graph, evidence cards, and LLM trace will attach here.</p>
          <p style={{ color: '#878175' }}>Current evidence root: synthetic replay fixture.</p>
          <RootCauseCandidates
            candidates={rootCauseCandidates}
            selectedRootCause={selectedRootCause}
            onSelect={(candidate) => {
              setSelectedRootCause(candidate);
              subscribeRootCauseChannel(candidate);
            }}
          />
          <LLMTracePanel
            validation={llmValidation}
            selectedRootCause={selectedRootCause}
            ollamaPreview={ollamaPreview}
            onManualLlm={refreshLlmPreview}
            jobs={jobs}
          />
        </aside>
      </section>

      <footer style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 10px',
        borderTop: '1px solid #2d333b',
        background: '#14171a',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11
      }}>
        <span>Bottom Status</span>
        <span>frames {liveSession?.acceptedFrames ?? 0}</span>
        <span>timeouts {liveSession?.timeoutCount ?? 0}</span>
        <span>crc {status ? `${(status.crcFailRate * 100).toFixed(2)}%` : '0.00%'}</span>
      </footer>
    </main>
  );
}

const smallHeading = {
  margin: '0 0 10px',
  color: '#878175',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
};

const fieldStyle = {
  display: 'grid',
  gridTemplateColumns: '80px 1fr',
  gap: 8,
  alignItems: 'center',
  marginBottom: 6,
  color: '#878175',
} as const;

const inputStyle = {
  width: '100%',
  minWidth: 0,
  background: '#0f1113',
  color: '#e8e4dd',
  border: '1px solid #2d333b',
  padding: '4px 6px',
  font: 'inherit',
} as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article style={{ border: '1px solid #2d333b', background: '#16191c', padding: 10, minWidth: 0 }}>
      <h3 style={{ ...smallHeading, color: '#f0b44a' }}>{title}</h3>
      {children}
    </article>
  );
}

function TelemetryPanel({ liveSession, status }: { liveSession: LiveSession | null; status: Status | null }) {
  return (
    <Panel title="PCM Receiver Health">
      <Metric label="Live session" value={liveSession?.running ? 'running' : 'stopped'} />
      <Metric label="Live seq" value={String(liveSession?.demoSeq ?? 0)} />
      <Metric label="Accepted frames" value={String(liveSession?.acceptedFrames ?? 0)} />
      <Metric label="Rejected frames" value={String(liveSession?.rejectedFrames ?? 0)} />
      <Metric label="Accepted samples" value={String(liveSession?.acceptedSamples ?? 0)} />
      <Metric label="Source connected" value={status?.sourceConnected ? 'yes' : 'no'} />
      <Metric label="Frame rate" value={status ? `${status.frameRateHz.toFixed(1)} Hz` : '0.0 Hz'} />
      <Metric label="CRC fail" value={status ? `${(status.crcFailRate * 100).toFixed(2)}%` : '0.00%'} />
    </Panel>
  );
}

function ManagedReceiverPanel({
  managedReceiver,
  profile,
  onProfileChange,
  onStart,
  onStop,
}: {
  managedReceiver: ManagedReceiver | null;
  profile: ManagedReceiverProfile;
  onProfileChange: (profile: ManagedReceiverProfile) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <Panel title="Managed UDP Loop">
      <label style={fieldStyle}>
        <span>Bind IP</span>
        <input
          value={profile.bindIp}
          onChange={(event) => onProfileChange({ ...profile, bindIp: event.target.value })}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        <span>Port</span>
        <input
          type="number"
          min={0}
          max={65535}
          value={profile.bindPort}
          onChange={(event) => onProfileChange({ ...profile, bindPort: Number(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        <span>Mbps</span>
        <input
          type="number"
          min={1}
          max={30}
          value={profile.expectedBitrateMbps}
          onChange={(event) => onProfileChange({ ...profile, expectedBitrateMbps: Number(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        <span>Channels</span>
        <input
          value={profile.channelIds.join(',')}
          onChange={(event) => onProfileChange({
            ...profile,
            channelIds: event.target.value
              .split(',')
              .map((value) => Number(value.trim()))
              .filter(Number.isFinite),
          })}
          style={inputStyle}
        />
      </label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={onStart}>Start</button>
        <button onClick={onStop}>Stop</button>
      </div>
      <Metric label="Loop" value={managedReceiver?.running ? 'running' : 'stopped'} />
      <Metric label="Bind addr" value={managedReceiver?.bindAddr || 'not bound'} />
      <Metric label="Accepted frames" value={String(managedReceiver?.acceptedFrames ?? 0)} />
      <Metric label="Rejected frames" value={String(managedReceiver?.rejectedFrames ?? 0)} />
      <Metric label="Accepted samples" value={String(managedReceiver?.acceptedSamples ?? 0)} />
      <Metric label="Timeouts" value={String(managedReceiver?.timeoutCount ?? 0)} />
      <Metric label="Queued events" value={String(managedReceiver?.queuedEvents ?? 0)} />
    </Panel>
  );
}

function DataRefPanel({
  demoEvent,
  selectedSubscription,
  selectedChannel
}: {
  demoEvent: DemoEvent;
  selectedSubscription: string | null;
  selectedChannel: ChannelSummary | null;
}) {
  return (
    <Panel title="Panel DataRef">
      <Metric label="Selected sub" value={selectedSubscription || 'none'} />
      <Metric label="Selected channel" value={selectedChannel ? `${selectedChannel.display} (#${selectedChannel.id})` : 'none'} />
      <Metric label="Event" value={demoEvent?.type || 'none'} />
      <Metric label="Schema" value={demoEvent?.payload?.schema || 'none'} />
      <Metric label="Seq" value={String(demoEvent?.payload?.seq ?? 0)} />
      <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', wordBreak: 'break-all', color: '#f0b44a' }}>
        {demoEvent?.payload?.dataRef || 'none'}
      </div>
    </Panel>
  );
}

function LLMTracePanel({
  validation,
  selectedRootCause,
  ollamaPreview,
  onManualLlm,
  jobs,
}: {
  validation: LlmValidation;
  selectedRootCause: RootCauseCandidate | null;
  ollamaPreview: OllamaPreview;
  onManualLlm: () => void;
  jobs: JobSummary[];
}) {
  return (
    <section style={{ marginTop: 16, borderTop: '1px solid #2d333b', paddingTop: 12 }}>
      <h3 style={{ ...smallHeading, color: '#f0b44a' }}>LLM Trace</h3>
      <Metric label="Provider" value="Ollama / gemma4:31b" />
      <Metric label="Ollama request" value={ollamaPreview?.enabled ? 'enabled' : 'preview only'} />
      <Metric label="Manual LLM" value="required" />
      <button onClick={onManualLlm} style={{ background: '#f0b44a', border: 'none', padding: '6px 10px', marginBottom: 8 }}>
        Refresh LLM Preview
      </button>
      <p style={{ color: '#878175' }}>Gemma4 evidence calls are manual on the developer laptop profile and may take minutes.</p>
      <Metric label="Selected candidate" value={selectedRootCause?.label || 'Bus current transient'} />
      <Metric label="Evidence" value={validation?.requiredCitations.join(', ') || 'EVT-1, CH-1002'} />
      <Metric label="Cited" value={validation?.cited.join(', ') || 'none'} />
      <Metric label="Missing" value={validation?.missing.join(', ') || 'none'} />
      <Metric label="Citation gate" value={validation?.valid ? 'passed' : 'required'} />
      <Metric label="Queued jobs" value={String(jobs.length)} />
      <p style={{ color: '#878175' }}>Answers must cite all evidence IDs before they can be accepted.</p>
    </section>
  );
}

function RootCauseCandidates({
  candidates,
  selectedRootCause,
  onSelect,
}: {
  candidates: RootCauseCandidate[];
  selectedRootCause: RootCauseCandidate | null;
  onSelect: (candidate: RootCauseCandidate) => void;
}) {
  return (
    <section style={{ marginTop: 16, borderTop: '1px solid #2d333b', paddingTop: 12 }}>
      <h3 style={{ ...smallHeading, color: '#f0b44a' }}>Root Cause Candidates</h3>
      {candidates.map((candidate) => (
        <button
          key={candidate.nodeId}
          onClick={() => onSelect(candidate)}
          style={{
            width: '100%',
            marginBottom: 8,
            border: '1px solid #2d333b',
            background: selectedRootCause === candidate ? '#242932' : 'transparent',
            color: '#e8e4dd',
            padding: 8,
            textAlign: 'left',
            cursor: 'pointer'
          }}
        >
          <div>{candidate.label}</div>
          <div style={{ color: '#878175', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {Math.round(candidate.confidence * 100)}%
          </div>
          <div style={{ color: '#5a564d', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10 }}>
            {edgeLabels(candidate).join(', ') || 'no edge detail'}
          </div>
          <div style={{ color: '#878175', fontSize: 11 }}>{candidate.evidenceSummary || 'No evidence summary'}</div>
        </button>
      ))}
      <Metric
        label="Selected"
        value={selectedRootCause ? `${selectedRootCause.label} (${Math.round(selectedRootCause.confidence * 100)}%)` : 'none'}
      />
    </section>
  );
}

function edgeLabels(candidate: RootCauseCandidate) {
  return (candidate.evidenceEdges || []).map((edge) => {
    const normalized = edge.replace(/_/g, '').toLowerCase();
    if (normalized === 'temporallead') return 'temporal lead';
    if (normalized === 'formuladependency') return 'formula dependency';
    if (normalized === 'sameframe') return 'same frame';
    if (normalized === 'samesubsystem') return 'same subsystem';
    if (normalized === 'userconfirmed') return 'user confirmed';
    return edge;
  });
}

function ExportPanel({ exportPreview, onExport }: { exportPreview: ExportPreview; onExport: () => void }) {
  return (
    <Panel title="Export Preview">
      <button onClick={onExport} style={{ background: '#f0b44a', border: 'none', padding: '6px 10px', marginBottom: 8 }}>
        CSV
      </button>
      <Metric label="Format" value={exportPreview?.format || 'none'} />
      <Metric label="Rows" value={String(exportPreview?.rows ?? 0)} />
      <Metric label="Manifest rows" value={String(exportPreview?.manifest?.rowCount ?? 0)} />
      <Metric label="Quality" value={exportPreview?.manifest?.qualityPolicy || 'none'} />
      <Metric label="Value mode" value={exportPreview?.manifest?.valueMode || 'none'} />
      <Metric label="Channels" value={exportPreview?.manifest?.channelIds?.join(',') || 'none'} />
      <Metric label="CSV path" value={exportPreview?.csvPath || 'none'} />
      <Metric label="Manifest path" value={exportPreview?.manifestPath || 'none'} />
      <pre style={{ maxHeight: 90, overflow: 'auto', fontSize: 10, color: '#878175' }}>
        {exportPreview?.content || 'No export preview generated.'}
      </pre>
    </Panel>
  );
}

function JobPanel({
  jobs,
  onRunning,
  onCompleted,
  onFailed,
}: {
  jobs: JobSummary[];
  onRunning: (id: number) => void;
  onCompleted: (id: number) => void;
  onFailed: (id: number) => void;
}) {
  return (
    <Panel title="Background Jobs">
      {jobs.length === 0 ? (
        <p style={{ color: '#878175' }}>No queued jobs.</p>
      ) : jobs.map((job) => (
        <div key={job.id} style={{ marginBottom: 8 }}>
          <Metric label={`#${job.id}`} value={`${job.label} / ${job.status}`} />
          <Metric label="Updated" value={job.updatedAtMs ? new Date(job.updatedAtMs).toISOString() : 'n/a'} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onRunning(job.id)}>Run</button>
            <button onClick={() => onCompleted(job.id)}>Done</button>
            <button onClick={() => onFailed(job.id)}>Fail</button>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function RuntimeInventoryPanel({ inventory }: { inventory: RuntimeInventory }) {
  return (
    <Panel title="Offline Runtime Inventory">
      <Metric label="Assets" value={String(inventory?.assets.length ?? 0)} />
      {(inventory?.assets || []).map((asset) => (
        <Metric
          key={`${asset.kind}:${asset.name}`}
          label={asset.kind}
          value={`${asset.name} / ${asset.available ? 'available' : 'missing'}`}
        />
      ))}
      {(inventory?.runtimes || []).map((runtime) => (
        <div key={runtime.name}>
          <Metric
            label={runtime.name}
            value={`${runtime.health}${runtime.detail ? ` / ${runtime.detail}` : ''}`}
          />
          {runtime.action ? <Metric label="next" value={runtime.action} /> : null}
        </div>
      ))}
    </Panel>
  );
}

function SimdisBridgePanel({ status }: { status: SimdisBridgeStatus }) {
  return (
    <Panel title="SimDIS Bridge">
      <Metric label="Profile" value={status?.name || 'not configured'} />
      <Metric label="Target" value={status?.target || 'none'} />
      <Metric label="Publish" value={status ? `${status.publishRateHz} Hz` : '0 Hz'} />
      <Metric label="Health" value={status?.health || 'unknown'} />
      <Metric label="Detail" value={status?.detail || 'n/a'} />
    </Panel>
  );
}

function MapVideoSyncPanel({ videoSyncEvent }: { videoSyncEvent: DemoEvent }) {
  return (
    <Panel title="Map / Video Sync">
      <Metric label="Linked cursor" value="enabled" />
      <Metric label="Cursor ns" value={videoSyncEvent?.payload?.cursorNs || 'none'} />
      <Metric label="Video segment" value={videoSyncEvent?.payload?.segmentId || 'none'} />
      <Metric label="Frame ref" value={videoSyncEvent?.payload?.frameRef || 'none'} />
      <Metric label="Map entity" value="track:T-247" />
    </Panel>
  );
}

function MatlabHandoffPanel({ handoff, onPrepare }: { handoff: MatlabHandoff; onPrepare: () => void }) {
  return (
    <Panel title="MATLAB Handoff">
      <button onClick={onPrepare} style={{ background: '#f0b44a', border: 'none', padding: '6px 10px', marginBottom: 8 }}>
        Prepare
      </button>
      <Metric label="Tool" value={handoff?.toolName || 'none'} />
      <Metric label="Script" value={handoff?.scriptPath || 'none'} />
      <Metric label="Evidence" value={handoff?.evidenceIds.join(', ') || 'none'} />
      <Metric label="Request" value={handoff?.requestJson || 'none'} />
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 6 }}>
      <span style={{ color: '#878175' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{value}</span>
    </div>
  );
}
