import { describe, it, expect } from 'vitest';
import { parseBridgeEvent, parseBridgeCommand } from '../../src/bridge/schemas';

describe('parseBridgeEvent — ingest_status', () => {
  it('parses a valid ingest_status event', () => {
    const event = parseBridgeEvent({
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
    expect(event.type).toBe('ingest_status');
    expect((event.payload as { bitrateMbps: number }).bitrateMbps).toBe(22.5);
  });
});

describe('parseBridgeEvent — panel_stream_data', () => {
  it('parses a valid panel_stream_data event', () => {
    const event = parseBridgeEvent({
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
    expect((event.payload as { schema: string }).schema).toBe('timeseries-v1');
    expect((event.payload as { rangeNs: string[] }).rangeNs).toEqual(['1000', '2000']);
  });

  it('rejects inline samples in panel stream payloads', () => {
    expect(() =>
      parseBridgeEvent({
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
      })
    ).toThrow();
  });
});

describe('parseBridgeEvent — crc_event', () => {
  it('parses a valid crc_event', () => {
    const event = parseBridgeEvent({
      type: 'crc_event',
      payload: {
        frameCounter: 22,
        channelIds: [8001],
        reason: 'crc-fail',
        timestampNs: '22000000',
      },
    });
    expect((event.payload as { frameCounter: number }).frameCounter).toBe(22);
    expect((event.payload as { channelIds: number[] }).channelIds).toEqual([8001]);
  });

  it('rejects crc_event with empty channelIds', () => {
    expect(() =>
      parseBridgeEvent({
        type: 'crc_event',
        payload: {
          channelIds: [],
          reason: 'crc-fail',
          timestampNs: '22000000',
        },
      })
    ).toThrow();
  });
});

describe('parseBridgeEvent — sync_loss_event', () => {
  it('parses a valid sync_loss_event', () => {
    const event = parseBridgeEvent({
      type: 'sync_loss_event',
      payload: {
        lostAtNs: '22000000',
        reacquiredAtNs: '26000000',
        durationNs: '4000000',
        bitOffset: 7,
      },
    });
    expect((event.payload as { bitOffset: number }).bitOffset).toBe(7);
  });

  it('rejects sync_loss_event with numeric durationNs', () => {
    expect(() =>
      parseBridgeEvent({
        type: 'sync_loss_event',
        payload: {
          lostAtNs: '1',
          reacquiredAtNs: '2',
          durationNs: 1,
          bitOffset: 7,
        },
      })
    ).toThrow();
  });
});

describe('parseBridgeEvent — export_progress', () => {
  it('parses a valid export_progress event', () => {
    const event = parseBridgeEvent({
      type: 'export_progress',
      payload: {
        jobId: 3,
        status: 'completed',
        rowsWritten: 512,
        artifactPath: 'project/runtime/exports/a.csv',
        manifestPath: 'project/runtime/exports/a.manifest.json',
      },
    });
    expect((event.payload as { rowsWritten: number }).rowsWritten).toBe(512);
  });
});

describe('parseBridgeEvent — llm_tool_progress', () => {
  it('parses a valid llm_tool_progress event', () => {
    const event = parseBridgeEvent({
      type: 'llm_tool_progress',
      payload: {
        jobId: 4,
        tool: 'ollama',
        status: 'citation-gate-passed',
        evidenceIds: ['EVT-1', 'CH-1002'],
      },
    });
    expect((event.payload as { evidenceIds: string[] }).evidenceIds).toEqual(['EVT-1', 'CH-1002']);
  });
});

describe('parseBridgeEvent — video_sync_event', () => {
  it('parses a valid video_sync_event', () => {
    const event = parseBridgeEvent({
      type: 'video_sync_event',
      payload: {
        cursorNs: '182340000000',
        segmentId: 'sortie-0410-seg-1',
        frameRef: 'video://sortie-0410/000123',
      },
    });
    expect((event.payload as { segmentId: string }).segmentId).toBe('sortie-0410-seg-1');
  });
});

describe('parseBridgeEvent — unknown type', () => {
  it('rejects unknown bridge event types', () => {
    expect(() =>
      parseBridgeEvent({
        type: 'unknown_event',
        payload: {},
      })
    ).toThrow();
  });
});

describe('parseBridgeCommand', () => {
  it('parses a valid subscribePanelData command', () => {
    const command = parseBridgeCommand({
      kind: 'subscribePanelData',
      input: {
        panelId: 'panel-strip-1',
        channelIds: [1001, 1002],
        schema: 'timeseries-v1',
        rangeNs: null,
      },
    });
    expect(command.kind).toBe('subscribePanelData');
    expect(command.input.channelIds).toEqual([1001, 1002]);
  });
});
