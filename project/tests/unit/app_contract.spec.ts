import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repo = path.resolve(__dirname, '..', '..', '..');
const appSource = fs.readFileSync(path.join(repo, 'project/src/app/BridgeDevApp.tsx'), 'utf8');

describe('App.tsx contract — bridge client usage', () => {
  it('uses the production bridge client', () => expect(appSource).toContain('createBridgeClient'));
  it('requests current ingest status', () => expect(appSource).toContain('currentIngestStatus'));
  it('initializes managed receiver session', () => expect(appSource).toContain('initDemoReceiverSession'));
  it('requests session-backed receiver tick event', () => expect(appSource).toContain('demoReceiverTick'));
  it('displays dataRef from bridge event', () => expect(appSource).toContain('dataRef'));
  it('displays accepted sample counters', () => expect(appSource).toContain('acceptedSamples'));
  it('refreshes live bridge status periodically', () => expect(appSource).toContain('setInterval'));
  it('clears live bridge status polling', () => expect(appSource).toContain('clearInterval'));
});

describe('App.tsx contract — channel explorer', () => {
  it('includes workstation channel explorer region', () => expect(appSource).toContain('Channel Explorer'));
  it('uses typed mock channel metadata', () => expect(appSource).toContain('CHANNEL_GROUPS'));
  it('uses channel search helper', () => expect(appSource).toContain('searchChannels'));
  it('renders channel search input', () => expect(appSource).toContain('placeholder="search channels"'));
  it('renders filtered channel results', () => expect(appSource).toContain('filteredChannels'));
  it('subscribes selected channels through bridge', () => expect(appSource).toContain('subscribePanelData'));
  it('stores selected subscription handle', () => expect(appSource).toContain('selectedSubscription'));
  it('stores selected channel metadata', () => expect(appSource).toContain('selectedChannel'));
});

describe('App.tsx contract — export panel', () => {
  it('can write CSV export job', () => expect(appSource).toContain('writeDemoCsvExport'));
  it('refreshes backend jobs after export', () => expect(appSource).toContain('bridge.listJobs'));
  it('renders export preview panel', () => expect(appSource).toContain('ExportPanel'));
  it('displays CSV export path', () => expect(appSource).toContain('csvPath'));
  it('displays export manifest quality policy', () => expect(appSource).toContain('qualityPolicy'));
  it('displays export manifest value mode', () => expect(appSource).toContain('valueMode'));
  it('displays export manifest row count', () => expect(appSource).toContain('rowCount'));
});

describe('App.tsx contract — workspace regions', () => {
  it('includes workstation workspace region', () => expect(appSource).toContain('Main Workspace'));
  it('includes workstation insight pane region', () => expect(appSource).toContain('Insight Pane'));
  it('includes bottom status console region', () => expect(appSource).toContain('Bottom Status'));
});

describe('App.tsx contract — LLM trace panel', () => {
  it('renders LLM evidence trace panel', () => expect(appSource).toContain('LLMTracePanel'));
  it('validates LLM answer citations through bridge', () => expect(appSource).toContain('validateDemoLlmAnswer'));
  it('can preview Ollama request payload', () => expect(appSource).toContain('buildDemoOllamaRequest'));
  it('labels slow LLM invocation as manual', () => expect(appSource).toContain('Manual LLM'));
  it('warns about developer laptop LLM latency', () => expect(appSource).toContain('developer laptop'));
  it('LLM trace exposes manual action callback', () => expect(appSource).toContain('onManualLlm'));
  it('renders manual LLM preview refresh button', () => expect(appSource).toContain('Refresh LLM Preview'));
  it('displays queued background job count', () => expect(appSource).toContain('Queued jobs'));
  it('queues manual LLM jobs through bridge', () => expect(appSource).toContain('enqueueDemoLlmJob'));
  it('reads backend job queue through bridge', () => expect(appSource).toContain('listJobs'));
  it('renders backend job panel', () => expect(appSource).toContain('JobPanel'));
  it('JobPanel can mark jobs running', () => expect(appSource).toContain('markJobRunning'));
  it('JobPanel can mark jobs completed', () => expect(appSource).toContain('markJobCompleted'));
  it('JobPanel can mark jobs failed', () => expect(appSource).toContain('markJobFailed'));
});

describe('App.tsx contract — root cause candidates', () => {
  it('passes selected root cause into LLM validation', () => expect(appSource).toContain('selectedRootCause?.nodeId'));
  it('requests root cause candidates through bridge', () => expect(appSource).toContain('demoRootCauseCandidates'));
  it('renders root cause candidates', () => expect(appSource).toContain('RootCauseCandidates'));
  it('displays root cause evidence edge details', () => expect(appSource).toContain('evidenceEdges'));
  it('maps evidence edge details to operator labels', () => expect(appSource).toContain('edgeLabels'));
  it('displays root cause evidence summary', () => expect(appSource).toContain('evidenceSummary'));
  it('stores selected root cause candidate', () => expect(appSource).toContain('selectedRootCause'));
  it('RootCauseCandidates supports selection callback', () => expect(appSource).toContain('onSelect'));
  it('can subscribe related channel from root cause candidate', () => expect(appSource).toContain('subscribeRootCauseChannel'));
  it('displays missing LLM citations', () => expect(appSource).toContain('missing'));
});

describe('App.tsx contract — managed UDP receiver', () => {
  it('renders managed UDP receiver loop status', () => expect(appSource).toContain('ManagedReceiverPanel'));
  it('starts managed UDP receiver loop through bridge', () => expect(appSource).toContain('startManagedReceiverLoop'));
  it('stops managed UDP receiver loop through bridge', () => expect(appSource).toContain('stopManagedReceiverLoop'));
  it('stores operator-managed UDP profile', () => expect(appSource).toContain('managedProfile'));
  it('exposes managed receiver bind IP', () => expect(appSource).toContain('bindIp'));
  it('exposes managed receiver bind port', () => expect(appSource).toContain('bindPort'));
  it('exposes managed receiver bitrate', () => expect(appSource).toContain('expectedBitrateMbps'));
  it('reads managed UDP receiver status through bridge', () => expect(appSource).toContain('managedReceiverStatus'));
  it('drains managed UDP receiver events through bridge', () => expect(appSource).toContain('drainManagedReceiverEvents'));
  it('labels managed receiver runtime panel', () => expect(appSource).toContain('Managed UDP Loop'));
  it('displays runtime next actions', () => expect(appSource).toContain('runtime.action'));
});

describe('App.tsx contract — SimDIS bridge', () => {
  it('reads SimDIS bridge status through bridge', () => expect(appSource).toContain('demoSimdisBridgeStatus'));
  it('renders SimDIS bridge panel', () => expect(appSource).toContain('SimdisBridgePanel'));
  it('labels SimDIS bridge panel', () => expect(appSource).toContain('SimDIS Bridge'));
});

describe('App.tsx contract — map/video sync', () => {
  it('reads video sync event through bridge', () => expect(appSource).toContain('demoVideoSyncEvent'));
  it('renders map/video sync panel', () => expect(appSource).toContain('MapVideoSyncPanel'));
  it('labels map/video sync panel', () => expect(appSource).toContain('Map / Video Sync'));
});

describe('App.tsx contract — MATLAB handoff', () => {
  it('prepares MATLAB handoff through bridge', () => expect(appSource).toContain('prepareDemoMatlabHandoff'));
  it('queues MATLAB handoff jobs through bridge', () => expect(appSource).toContain('enqueueDemoMatlabJob'));
  it('renders MATLAB handoff panel', () => expect(appSource).toContain('MatlabHandoffPanel'));
  it('labels MATLAB handoff panel', () => expect(appSource).toContain('MATLAB Handoff'));
});

describe('App.tsx contract — product signals', () => {
  it('uses a dataRef panel component', () => expect(appSource).toContain('DataRefPanel'));
  it('preserves product signal', () => expect(appSource).toContain('RealTimeInsight'));
  it('uses a production telemetry panel component', () => expect(appSource).toContain('TelemetryPanel'));
  it('labels demo evidence as synthetic replay fixture', () => expect(appSource).toContain('synthetic replay fixture'));
});
