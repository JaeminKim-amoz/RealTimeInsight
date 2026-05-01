import { describe, it, expect, vi } from 'vitest';
import { createBridgeClient } from '../../src/bridge/client';

describe('createBridgeClient — subscribePanelData', () => {
  it('invokes subscribe_panel_data with correct command and payload', async () => {
    const invoke = vi.fn().mockResolvedValue({ subscriptionId: 'sub-panel-1' });
    const client = createBridgeClient({ invoke });

    const handle = await client.subscribePanelData({
      panelId: 'panel-1',
      channelIds: [1001],
      schema: 'timeseries-v1',
      rangeNs: null,
    });

    expect(handle).toEqual({ subscriptionId: 'sub-panel-1' });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][0]).toBe('subscribe_panel_data');
    expect((invoke.mock.calls[0][1] as { input: { channelIds: number[] } }).input.channelIds).toEqual([1001]);
  });

  it('rejects empty channelIds before invoking', async () => {
    const invoke = vi.fn();
    const client = createBridgeClient({ invoke });

    await expect(
      client.subscribePanelData({
        panelId: 'panel-1',
        channelIds: [],
        schema: 'timeseries-v1',
        rangeNs: null,
      })
    ).rejects.toThrow(/channelIds/);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('createBridgeClient — currentIngestStatus', () => {
  it('parses ingest status from invoke result', async () => {
    const invoke = vi.fn().mockResolvedValue({
      sourceConnected: true,
      packetRateHz: 1200,
      frameRateHz: 200,
      bitrateMbps: 18,
      crcFailRate: 0,
      syncLossCount: 0,
    });
    const client = createBridgeClient({ invoke });

    const status = await client.currentIngestStatus();
    expect(status.sourceConnected).toBe(true);
    expect(status.bitrateMbps).toBe(18);
  });
});

describe('createBridgeClient — demoReceiverTick', () => {
  it('invokes demo_receiver_tick with input payload and returns bridge event', async () => {
    const invoke = vi.fn().mockResolvedValue({
      type: 'panel_stream_data',
      payload: {
        subscriptionId: 'sub-demo',
        panelId: 'panel-demo',
        schema: 'timeseries-v1',
        dataRef: 'buffer://rti/live/sub-demo/2',
        rangeNs: ['0', '1'],
        seq: 2,
      },
    });
    const client = createBridgeClient({ invoke });

    const event = await client.demoReceiverTick({ channelIds: [1205] });
    expect((event as { type: string }).type).toBe('panel_stream_data');
    expect(
      ((event as { payload: { dataRef: string } }).payload).dataRef
    ).toBe('buffer://rti/live/sub-demo/2');
    expect(invoke.mock.calls[0]).toEqual([
      'demo_receiver_tick',
      { input: { channelIds: [1205] } },
    ]);
  });
});

describe('createBridgeClient — onBridgeEvent', () => {
  it('listens on rti://bridge-event and forwards parsed events', async () => {
    const listened: string[] = [];
    const listen = vi.fn().mockImplementation(async (eventName: string, handler: (e: { payload: unknown }) => void) => {
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
      return () => listened.push('unlisten');
    });
    const invoke = vi.fn().mockResolvedValue({
      sourceConnected: false, packetRateHz: 0, frameRateHz: 0, bitrateMbps: 0, crcFailRate: 0, syncLossCount: 0,
    });
    const client = createBridgeClient({ invoke, listen } as Parameters<typeof createBridgeClient>[0]);

    const events: unknown[] = [];
    const unlisten = await client.onBridgeEvent((e) => events.push(e));
    unlisten();

    expect(listened).toEqual(['rti://bridge-event', 'unlisten']);
    expect((events[0] as { type: string }).type).toBe('panel_stream_data');
    expect(((events[0] as { payload: { seq: number } }).payload).seq).toBe(9);
  });
});

describe('createBridgeClient — live session commands', () => {
  it('invokes correct command names for live session lifecycle', async () => {
    const invoke = vi.fn().mockResolvedValue({
      running: false, demoSeq: 2, receiverReady: true,
      acceptedFrames: 3, rejectedFrames: 1, acceptedSamples: 39, timeoutCount: 1,
    });
    const client = createBridgeClient({ invoke });

    await client.liveSessionStatus();
    await client.startLiveSession();
    await client.stopLiveSession();
    await client.initDemoReceiverSession();

    const commands = invoke.mock.calls.map((c) => c[0]);
    expect(commands).toEqual([
      'live_session_status',
      'start_live_session',
      'stop_live_session',
      'init_demo_receiver_session',
    ]);
  });
});

describe('createBridgeClient — exportDemoCsv', () => {
  it('invokes export_demo_csv and returns preview with manifest', async () => {
    const invoke = vi.fn().mockResolvedValue({
      format: 'csv',
      rows: 1,
      content: 'timestamp,channel_id,raw,value,quality_flags\n',
      manifest: { channelIds: [1205], rowCount: 1, qualityPolicy: 'GoodCrcOnly', valueMode: 'Both', range: [1, 2] },
    });
    const client = createBridgeClient({ invoke });

    const preview = await client.exportDemoCsv({ channelIds: [1205] });
    expect(preview.format).toBe('csv');
    expect(preview.rows).toBe(1);
    expect((preview.manifest as { channelIds: number[] }).channelIds).toEqual([1205]);
    expect(preview.content).toContain('quality_flags');
    expect(invoke.mock.calls[0]).toEqual([
      'export_demo_csv',
      { input: { channelIds: [1205] } },
    ]);
  });
});

describe('createBridgeClient — writeDemoCsvExport', () => {
  it('returns csvPath and manifestPath from write_demo_csv_export', async () => {
    const invoke = vi.fn().mockResolvedValue({
      format: 'csv',
      rows: 1,
      content: 'timestamp,channel_id,raw,value,quality_flags\n',
      manifest: {},
      csvPath: 'project/runtime/exports/demo-evidence.csv',
      manifestPath: 'project/runtime/exports/demo-evidence.manifest.json',
    });
    const client = createBridgeClient({ invoke });

    const result = await client.writeDemoCsvExport({ channelIds: [8001] });
    expect(result.csvPath).toMatch(/\.csv$/);
    expect(result.manifestPath).toMatch(/\.manifest\.json$/);
  });
});

describe('createBridgeClient — validateDemoLlmAnswer', () => {
  it('returns citation validation result', async () => {
    const invoke = vi.fn().mockResolvedValue({
      prompt: 'Evidence EVT-1 CH-1002',
      requiredCitations: ['EVT-1', 'CH-1002'],
      cited: ['EVT-1'],
      missing: ['CH-1002'],
      valid: true,
    });
    const client = createBridgeClient({ invoke });

    const result = await client.validateDemoLlmAnswer('EVT-1 and CH-1002');
    expect(result.valid).toBe(true);
    expect(result.requiredCitations).toEqual(['EVT-1', 'CH-1002']);
    expect(result.cited).toEqual(['EVT-1']);
    expect(result.missing).toEqual(['CH-1002']);
  });
});

describe('createBridgeClient — demoRootCauseCandidates', () => {
  it('returns array of root cause candidates', async () => {
    const invoke = vi.fn().mockResolvedValue([
      { nodeId: 'ch-1002', label: 'Bus current transient', confidence: 0.9 },
    ]);
    const client = createBridgeClient({ invoke });

    const candidates = await client.demoRootCauseCandidates();
    expect(candidates[0].label).toBe('Bus current transient');
  });
});

describe('createBridgeClient — buildDemoOllamaRequest', () => {
  it('returns ollama request preview with model name', async () => {
    const invoke = vi.fn().mockResolvedValue({
      enabled: false,
      model: 'gemma4:31b',
      requestJson: '{"model":"gemma4:31b"}',
    });
    const client = createBridgeClient({ invoke });

    const preview = await client.buildDemoOllamaRequest();
    expect(preview.enabled).toBe(false);
    expect(preview.model).toBe('gemma4:31b');
    expect(preview.requestJson).toContain('gemma4:31b');
  });
});

describe('createBridgeClient — runtimeAssetInventory', () => {
  it('returns assets and runtimes arrays', async () => {
    const invoke = vi.fn().mockResolvedValue({
      assets: [{ name: 'korea.gpkg', kind: 'geopackage', available: true }],
      runtimes: [{ name: 'simdis', health: 'degraded', detail: 'sidecar missing', action: 'Set SIMDIS_PATH' }],
    });
    const client = createBridgeClient({ invoke });

    const inventory = await client.runtimeAssetInventory();
    expect(inventory.assets[0].kind).toBe('geopackage');
    expect(inventory.runtimes[0].health).toBe('degraded');
  });
});

describe('createBridgeClient — managed receiver commands', () => {
  it('invokes all managed receiver commands with correct names', async () => {
    const invoke = vi.fn().mockImplementation(async (command: string) => {
      if (command === 'drain_managed_receiver_events') {
        return [{
          type: 'panel_stream_data',
          payload: {
            subscriptionId: 'sub-live', panelId: 'panel-live',
            schema: 'timeseries-v1', dataRef: 'buffer://rti/live/sub-live/1',
            rangeNs: ['0', '1'], seq: 1,
          },
        }];
      }
      if (command === 'stop_managed_receiver_loop') {
        return { running: false, bindAddr: null, acceptedFrames: 1, rejectedFrames: 0, acceptedSamples: 13, timeoutCount: 2, queuedEvents: 0 };
      }
      return { running: true, bindAddr: '127.0.0.1:50001', acceptedFrames: 1, rejectedFrames: 0, acceptedSamples: 13, timeoutCount: 2, queuedEvents: 1 };
    });
    const client = createBridgeClient({ invoke });

    const started = await client.startManagedReceiverLoop({ bindIp: '127.0.0.1', bindPort: 5001, channelIds: [8001, 1205], expectedBitrateMbps: 30 });
    expect(started.running).toBe(true);

    const status = await client.managedReceiverStatus();
    expect(status.bindAddr).toBe('127.0.0.1:50001');

    const events = await client.drainManagedReceiverEvents();
    expect((events[0] as { type: string }).type).toBe('panel_stream_data');

    const stopped = await client.stopManagedReceiverLoop();
    expect(stopped.running).toBe(false);
    expect(stopped.bindAddr).toBeNull();

    const commands = invoke.mock.calls.map((c) => c[0]);
    expect(commands).toEqual([
      'start_managed_receiver_loop',
      'managed_receiver_status',
      'drain_managed_receiver_events',
      'stop_managed_receiver_loop',
    ]);
    expect(
      (invoke.mock.calls[0][1] as { input: { channelIds: number[]; expectedBitrateMbps: number } }).input.channelIds
    ).toEqual([8001, 1205]);
    expect(
      (invoke.mock.calls[0][1] as { input: { expectedBitrateMbps: number } }).input.expectedBitrateMbps
    ).toBe(30);
  });
});

describe('createBridgeClient — demoSimdisBridgeStatus', () => {
  it('returns SIMDIS bridge status with health and publishRateHz', async () => {
    const invoke = vi.fn().mockResolvedValue({
      name: 'local-simdis',
      target: '127.0.0.1:30000',
      publishRateHz: 20,
      health: 'degraded',
      detail: 'sidecar executable missing; SDK baseline configured',
    });
    const client = createBridgeClient({ invoke });

    const status = await client.demoSimdisBridgeStatus();
    expect(status.publishRateHz).toBe(20);
    expect(status.health).toBe('degraded');
    expect(status.detail).toContain('SDK baseline');
  });
});

describe('createBridgeClient — demoVideoSyncEvent', () => {
  it('returns a video_sync_event with frameRef', async () => {
    const invoke = vi.fn().mockResolvedValue({
      type: 'video_sync_event',
      payload: {
        cursorNs: '182340000000',
        segmentId: 'seg-0001',
        frameRef: 'video://cam-front/182340000000',
      },
    });
    const client = createBridgeClient({ invoke });

    const event = await client.demoVideoSyncEvent();
    expect(event.type).toBe('video_sync_event');
    expect(event.payload.frameRef).toBe('video://cam-front/182340000000');
  });
});

describe('createBridgeClient — MATLAB handoff commands', () => {
  it('invokes prepare and enqueue with correct command names', async () => {
    const invoke = vi.fn().mockImplementation(async (command: string) => {
      if (command === 'prepare_demo_matlab_handoff') {
        return {
          scriptPath: 'project/runtime/matlab/anomaly_bundle.m',
          toolName: 'run_matlab_file',
          requestJson: '{"name":"run_matlab_file"}',
          evidenceIds: ['EVT-1', 'CH-1002'],
        };
      }
      return { id: 7, label: 'MATLAB anomaly bundle', status: 'Queued' };
    });
    const client = createBridgeClient({ invoke });

    const handoff = await client.prepareDemoMatlabHandoff();
    const job = await client.enqueueDemoMatlabJob();

    expect(handoff.scriptPath).toMatch(/\.m$/);
    expect(handoff.toolName).toBe('run_matlab_file');
    expect(handoff.evidenceIds).toEqual(['EVT-1', 'CH-1002']);
    expect(job.id).toBe(7);
    expect(invoke.mock.calls.map((c) => c[0])).toEqual([
      'prepare_demo_matlab_handoff',
      'enqueue_demo_matlab_job',
    ]);
  });
});

describe('createBridgeClient — job commands', () => {
  it('invokes enqueue, list, mark running/completed/failed commands', async () => {
    const invoke = vi.fn().mockImplementation(async (command: string) => {
      if (command === 'list_jobs') return [{ id: 1, label: 'LLM evidence preview', status: 'Queued' }];
      if (command === 'enqueue_demo_llm_job') return { id: 1, label: 'LLM evidence preview', status: 'Queued' };
      return [{ id: 1, label: 'LLM evidence preview', status: 'Running' }];
    });
    const client = createBridgeClient({ invoke });

    expect((await client.enqueueDemoLlmJob()).id).toBe(1);
    expect((await client.listJobs())[0].label).toBe('LLM evidence preview');
    expect((await client.markJobRunning(1))[0].status).toBe('Running');
    expect((await client.markJobCompleted(1))[0].status).toBe('Running');
    expect((await client.markJobFailed(1))[0].status).toBe('Running');

    const commands = invoke.mock.calls.map((c) => c[0]);
    expect(commands).toContain('mark_job_running');
    expect(commands).toContain('mark_job_completed');
    expect(commands).toContain('mark_job_failed');
  });
});
