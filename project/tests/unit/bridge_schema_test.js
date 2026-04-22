const assert = require('assert');

const bridge = require('../../src/bridge/schemas.js');

function expectThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert.ok(threw, message);
}

const ingest = bridge.parseBridgeEvent({
  type: 'ingest_status',
  payload: {
    sourceConnected: true,
    packetRateHz: 4120,
    frameRateHz: 200,
    bitrateMbps: 22.5,
    crcFailRate: 0.02,
    syncLossCount: 1,
  },
});

assert.strictEqual(ingest.type, 'ingest_status');
assert.strictEqual(ingest.payload.bitrateMbps, 22.5);

const panelData = bridge.parseBridgeEvent({
  type: 'panel_stream_data',
  payload: {
    subscriptionId: 'sub-1',
    panelId: 'panel-strip-1',
    schema: 'timeseries-v1',
    dataRef: 'buffer://rti/session/live/sub-1/42',
    rangeNs: ['1000', '2000'],
    seq: 42,
  },
});

assert.strictEqual(panelData.payload.schema, 'timeseries-v1');
assert.deepStrictEqual(panelData.payload.rangeNs, ['1000', '2000']);

const crcEvent = bridge.parseBridgeEvent({
  type: 'crc_event',
  payload: {
    frameCounter: 22,
    channelIds: [8001],
    reason: 'crc-fail',
    timestampNs: '22000000',
  },
});

assert.strictEqual(crcEvent.payload.frameCounter, 22);
assert.deepStrictEqual(crcEvent.payload.channelIds, [8001]);

const syncLossEvent = bridge.parseBridgeEvent({
  type: 'sync_loss_event',
  payload: {
    lostAtNs: '22000000',
    reacquiredAtNs: '26000000',
    durationNs: '4000000',
    bitOffset: 7,
  },
});

assert.strictEqual(syncLossEvent.payload.bitOffset, 7);

const exportProgress = bridge.parseBridgeEvent({
  type: 'export_progress',
  payload: {
    jobId: 3,
    status: 'completed',
    rowsWritten: 512,
    artifactPath: 'project/runtime/exports/a.csv',
    manifestPath: 'project/runtime/exports/a.manifest.json',
  },
});

assert.strictEqual(exportProgress.payload.rowsWritten, 512);

const llmProgress = bridge.parseBridgeEvent({
  type: 'llm_tool_progress',
  payload: {
    jobId: 4,
    tool: 'ollama',
    status: 'citation-gate-passed',
    evidenceIds: ['EVT-1', 'CH-1002'],
  },
});

assert.deepStrictEqual(llmProgress.payload.evidenceIds, ['EVT-1', 'CH-1002']);

const videoSync = bridge.parseBridgeEvent({
  type: 'video_sync_event',
  payload: {
    cursorNs: '182340000000',
    segmentId: 'sortie-0410-seg-1',
    frameRef: 'video://sortie-0410/000123',
  },
});

assert.strictEqual(videoSync.payload.segmentId, 'sortie-0410-seg-1');

expectThrows(
  () => bridge.parseBridgeEvent({
    type: 'panel_stream_data',
    payload: {
      subscriptionId: 'sub-1',
      panelId: 'panel-strip-1',
      schema: 'timeseries-v1',
      samples: [1, 2, 3],
      dataRef: 'inline-json',
      rangeNs: ['1000', '2000'],
      seq: 1,
    },
  }),
  'rejects inline samples in panel stream payloads'
);

expectThrows(
  () => bridge.parseBridgeEvent({
    type: 'crc_event',
    payload: {
      channelIds: [],
      reason: 'crc-fail',
      timestampNs: '22000000',
    },
  }),
  'rejects invalid crc events'
);

expectThrows(
  () => bridge.parseBridgeEvent({
    type: 'sync_loss_event',
    payload: {
      lostAtNs: '1',
      reacquiredAtNs: '2',
      durationNs: 1,
      bitOffset: 7,
    },
  }),
  'rejects invalid sync loss events'
);

expectThrows(
  () => bridge.parseBridgeEvent({
    type: 'unknown_event',
    payload: {},
  }),
  'rejects unknown bridge events'
);

const command = bridge.parseBridgeCommand({
  kind: 'subscribePanelData',
  input: {
    panelId: 'panel-strip-1',
    channelIds: [1001, 1002],
    schema: 'timeseries-v1',
    rangeNs: null,
  },
});

assert.strictEqual(command.kind, 'subscribePanelData');
assert.deepStrictEqual(command.input.channelIds, [1001, 1002]);

console.log('Bridge schema tests passed');
