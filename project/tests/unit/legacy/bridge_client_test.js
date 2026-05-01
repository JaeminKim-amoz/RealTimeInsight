const assert = require('assert');

const { createBridgeClient } = require('../../../src/bridge/client.js');

async function testUsesTauriInvokeForSubscribe() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      return { subscriptionId: 'sub-panel-1' };
    },
  });

  const handle = await client.subscribePanelData({
    panelId: 'panel-1',
    channelIds: [1001],
    schema: 'timeseries-v1',
    rangeNs: null,
  });

  assert.deepStrictEqual(handle, { subscriptionId: 'sub-panel-1' });
  assert.strictEqual(calls[0].command, 'subscribe_panel_data');
  assert.deepStrictEqual(calls[0].payload.input.channelIds, [1001]);
}

async function testParsesCurrentIngestStatus() {
  const client = createBridgeClient({
    invoke: async () => ({
      sourceConnected: true,
      packetRateHz: 1200,
      frameRateHz: 200,
      bitrateMbps: 18,
      crcFailRate: 0,
      syncLossCount: 0,
    }),
  });

  const status = await client.currentIngestStatus();
  assert.strictEqual(status.sourceConnected, true);
  assert.strictEqual(status.bitrateMbps, 18);
}

async function testParsesDemoReceiverTickEvent() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
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
    },
  });

  const event = await client.demoReceiverTick({ channelIds: [1205] });
  assert.strictEqual(event.type, 'panel_stream_data');
  assert.strictEqual(event.payload.dataRef, 'buffer://rti/live/sub-demo/2');
  assert.deepStrictEqual(calls[0], { command: 'demo_receiver_tick', payload: { input: { channelIds: [1205] } } });
}

async function testListensForBridgeEvents() {
  const listened = [];
  const client = createBridgeClient({
    invoke: async () => ({ sourceConnected: false, packetRateHz: 0, frameRateHz: 0, bitrateMbps: 0, crcFailRate: 0, syncLossCount: 0 }),
    listen: async (eventName, handler) => {
      listened.push(eventName);
      handler({
        payload: {
          type: 'panel_stream_data',
          payload: {
            subscriptionId: 'sub-demo',
            panelId: 'panel-demo',
            schema: 'timeseries-v1',
            dataRef: 'buffer://rti/live/sub-demo/9',
            rangeNs: ['0', '1'],
            seq: 9,
          },
        },
      });
      return () => {
        listened.push('unlisten');
      };
    },
  });
  const events = [];

  const unlisten = await client.onBridgeEvent((event) => events.push(event));
  unlisten();

  assert.deepStrictEqual(listened, ['rti://bridge-event', 'unlisten']);
  assert.strictEqual(events[0].type, 'panel_stream_data');
  assert.strictEqual(events[0].payload.seq, 9);
}


async function testValidatesSubscribeInputBeforeInvoke() {
  let called = false;
  const client = createBridgeClient({
    invoke: async () => {
      called = true;
    },
  });

  await assert.rejects(
    () => client.subscribePanelData({
      panelId: 'panel-1',
      channelIds: [],
      schema: 'timeseries-v1',
      rangeNs: null,
    }),
    /channelIds/
  );
  assert.strictEqual(called, false);
}

async function testLiveSessionCommands() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      return { running: command === 'start_live_session', demoSeq: 2, receiverReady: true, acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1 };
    },
  });

  assert.deepStrictEqual(await client.liveSessionStatus(), { running: false, demoSeq: 2, receiverReady: true, acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1 });
  assert.deepStrictEqual(await client.startLiveSession(), { running: true, demoSeq: 2, receiverReady: true, acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1 });
  assert.deepStrictEqual(await client.stopLiveSession(), { running: false, demoSeq: 2, receiverReady: true, acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1 });
  assert.deepStrictEqual(await client.initDemoReceiverSession(), { running: false, demoSeq: 2, receiverReady: true, acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1 });
  assert.deepStrictEqual(calls.map((call) => call.command), ['live_session_status', 'start_live_session', 'stop_live_session', 'init_demo_receiver_session']);
}

async function testExportDemoCsv() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      return {
        format: 'csv',
        rows: 1,
        content: 'timestamp,channel_id,raw,value,quality_flags\n',
        manifest: { channelIds: [1205], rowCount: 1, qualityPolicy: 'GoodCrcOnly', valueMode: 'Both', range: [1, 2] },
      };
    },
  });

  const preview = await client.exportDemoCsv({ channelIds: [1205] });
  assert.strictEqual(preview.format, 'csv');
  assert.strictEqual(preview.rows, 1);
  assert.deepStrictEqual(preview.manifest.channelIds, [1205]);
  assert.ok(preview.content.includes('quality_flags'));
  assert.deepStrictEqual(calls[0], { command: 'export_demo_csv', payload: { input: { channelIds: [1205] } } });
}

async function testWriteDemoCsvExport() {
  const client = createBridgeClient({
    invoke: async () => ({
      format: 'csv',
      rows: 1,
      content: 'timestamp,channel_id,raw,value,quality_flags\n',
      manifest: {},
      csvPath: 'project/runtime/exports/demo-evidence.csv',
      manifestPath: 'project/runtime/exports/demo-evidence.manifest.json',
    }),
  });

  const result = await client.writeDemoCsvExport({ channelIds: [8001] });
  assert.ok(result.csvPath.endsWith('.csv'));
  assert.ok(result.manifestPath.endsWith('.manifest.json'));
}

async function testValidateDemoLlmAnswer() {
  const client = createBridgeClient({
    invoke: async () => ({
      prompt: 'Evidence EVT-1 CH-1002',
      requiredCitations: ['EVT-1', 'CH-1002'],
      cited: ['EVT-1'],
      missing: ['CH-1002'],
      valid: true,
    }),
  });

  const result = await client.validateDemoLlmAnswer('EVT-1 and CH-1002');
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.requiredCitations, ['EVT-1', 'CH-1002']);
  assert.deepStrictEqual(result.cited, ['EVT-1']);
  assert.deepStrictEqual(result.missing, ['CH-1002']);
}

async function testDemoRootCauseCandidates() {
  const client = createBridgeClient({
    invoke: async () => [
      { nodeId: 'ch-1002', label: 'Bus current transient', confidence: 0.9 },
    ],
  });

  const candidates = await client.demoRootCauseCandidates();
  assert.strictEqual(candidates[0].label, 'Bus current transient');
}

async function testBuildDemoOllamaRequest() {
  const client = createBridgeClient({
    invoke: async () => ({
      enabled: false,
      model: 'gemma4:31b',
      requestJson: '{"model":"gemma4:31b"}',
    }),
  });

  const preview = await client.buildDemoOllamaRequest();
  assert.strictEqual(preview.enabled, false);
  assert.strictEqual(preview.model, 'gemma4:31b');
  assert.ok(preview.requestJson.includes('gemma4:31b'));
}

async function testRuntimeAssetInventory() {
  const client = createBridgeClient({
    invoke: async () => ({
      assets: [{ name: 'korea.gpkg', kind: 'geopackage', available: true }],
      runtimes: [{ name: 'simdis', health: 'degraded', detail: 'sidecar missing', action: 'Set SIMDIS_PATH' }],
    }),
  });

  const inventory = await client.runtimeAssetInventory();

  assert.strictEqual(inventory.assets[0].kind, 'geopackage');
  assert.strictEqual(inventory.runtimes[0].health, 'degraded');
  assert.strictEqual(inventory.runtimes[0].action, 'Set SIMDIS_PATH');
}

async function testManagedReceiverCommands() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      if (command === 'drain_managed_receiver_events') {
        return [{
          type: 'panel_stream_data',
          payload: {
            subscriptionId: 'sub-live',
            panelId: 'panel-live',
            schema: 'timeseries-v1',
            dataRef: 'buffer://rti/live/sub-live/1',
            rangeNs: ['0', '1'],
            seq: 1,
          },
        }];
      }
      if (command === 'stop_managed_receiver_loop') {
        return {
          running: false,
          bindAddr: null,
          acceptedFrames: 1,
          rejectedFrames: 0,
          acceptedSamples: 13,
          timeoutCount: 2,
          queuedEvents: 0,
        };
      }
      return {
        running: true,
        bindAddr: '127.0.0.1:50001',
        acceptedFrames: 1,
        rejectedFrames: 0,
        acceptedSamples: 13,
        timeoutCount: 2,
        queuedEvents: 1,
      };
    },
  });

  assert.strictEqual((await client.startManagedReceiverLoop({
    bindIp: '127.0.0.1',
    bindPort: 5001,
    channelIds: [8001, 1205],
    expectedBitrateMbps: 30,
  })).running, true);
  assert.strictEqual((await client.managedReceiverStatus()).bindAddr, '127.0.0.1:50001');
  assert.strictEqual((await client.drainManagedReceiverEvents())[0].type, 'panel_stream_data');
  const stopped = await client.stopManagedReceiverLoop();
  assert.strictEqual(stopped.running, false);
  assert.strictEqual(stopped.bindAddr, null);
  assert.deepStrictEqual(calls.map((call) => call.command), [
    'start_managed_receiver_loop',
    'managed_receiver_status',
    'drain_managed_receiver_events',
    'stop_managed_receiver_loop',
  ]);
  assert.deepStrictEqual(calls[0].payload.input.channelIds, [8001, 1205]);
  assert.strictEqual(calls[0].payload.input.expectedBitrateMbps, 30);
}

async function testSimdisBridgeStatus() {
  const client = createBridgeClient({
    invoke: async () => ({
      name: 'local-simdis',
      target: '127.0.0.1:30000',
      publishRateHz: 20,
      health: 'degraded',
      detail: 'sidecar executable missing; SDK baseline configured',
    }),
  });

  const status = await client.demoSimdisBridgeStatus();

  assert.strictEqual(status.publishRateHz, 20);
  assert.strictEqual(status.health, 'degraded');
  assert.ok(status.detail.includes('SDK baseline'));
}

async function testDemoVideoSyncEvent() {
  const client = createBridgeClient({
    invoke: async () => ({
      type: 'video_sync_event',
      payload: {
        cursorNs: '182340000000',
        segmentId: 'seg-0001',
        frameRef: 'video://cam-front/182340000000',
      },
    }),
  });

  const event = await client.demoVideoSyncEvent();

  assert.strictEqual(event.type, 'video_sync_event');
  assert.strictEqual(event.payload.frameRef, 'video://cam-front/182340000000');
}

async function testMatlabHandoffCommands() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command) => {
      calls.push(command);
      if (command === 'prepare_demo_matlab_handoff') {
        return {
          scriptPath: 'project/runtime/matlab/anomaly_bundle.m',
          toolName: 'run_matlab_file',
          requestJson: '{"name":"run_matlab_file"}',
          evidenceIds: ['EVT-1', 'CH-1002'],
        };
      }
      return { id: 7, label: 'MATLAB anomaly bundle', status: 'Queued' };
    },
  });

  const handoff = await client.prepareDemoMatlabHandoff();
  const job = await client.enqueueDemoMatlabJob();

  assert.ok(handoff.scriptPath.endsWith('.m'));
  assert.strictEqual(handoff.toolName, 'run_matlab_file');
  assert.deepStrictEqual(handoff.evidenceIds, ['EVT-1', 'CH-1002']);
  assert.strictEqual(job.id, 7);
  assert.deepStrictEqual(calls, ['prepare_demo_matlab_handoff', 'enqueue_demo_matlab_job']);
}

async function testJobCommands() {
  const calls = [];
  const client = createBridgeClient({
    invoke: async (command) => {
      calls.push(command);
      if (command === 'list_jobs') return [{ id: 1, label: 'LLM evidence preview', status: 'Queued' }];
      if (command === 'enqueue_demo_llm_job') return { id: 1, label: 'LLM evidence preview', status: 'Queued' };
      return [{ id: 1, label: 'LLM evidence preview', status: 'Running' }];
    },
  });

  assert.strictEqual((await client.enqueueDemoLlmJob()).id, 1);
  assert.strictEqual((await client.listJobs())[0].label, 'LLM evidence preview');
  assert.strictEqual((await client.markJobRunning(1))[0].status, 'Running');
  assert.strictEqual((await client.markJobCompleted(1))[0].status, 'Running');
  assert.strictEqual((await client.markJobFailed(1))[0].status, 'Running');
  assert.ok(calls.includes('mark_job_running'));
  assert.ok(calls.includes('mark_job_completed'));
  assert.ok(calls.includes('mark_job_failed'));
}

(async () => {
  await testUsesTauriInvokeForSubscribe();
  await testParsesCurrentIngestStatus();
  await testParsesDemoReceiverTickEvent();
  await testListensForBridgeEvents();
  await testValidatesSubscribeInputBeforeInvoke();
  await testLiveSessionCommands();
  await testExportDemoCsv();
  await testWriteDemoCsvExport();
  await testValidateDemoLlmAnswer();
  await testDemoRootCauseCandidates();
  await testBuildDemoOllamaRequest();
  await testRuntimeAssetInventory();
  await testManagedReceiverCommands();
  await testSimdisBridgeStatus();
  await testDemoVideoSyncEvent();
  await testMatlabHandoffCommands();
  await testJobCommands();
  console.log('Bridge client tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
