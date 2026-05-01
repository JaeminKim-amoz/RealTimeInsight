import { describe, it, expect, vi } from 'vitest';
import { createBridgeClient } from '../../src/bridge/client';

/**
 * PCM decoder contract tests.
 *
 * The legacy pcm_decoder_test.js tested a Node-side pcm.js module (app/pcm.js)
 * that does not exist in this repository — it describes Rust-side PCM frame
 * decoding logic that runs inside the Tauri backend. Per US-008 constraints,
 * we port these as TS bridge contract tests: they verify the invoke command
 * names and payload shapes that the Rust backend expects, not the Rust
 * implementation itself.
 */

describe('PCM decoder bridge contract — demo_receiver_tick invoke shape', () => {
  it('passes channelIds array in input payload', async () => {
    const invoke = vi.fn().mockResolvedValue({
      type: 'panel_stream_data',
      payload: {
        subscriptionId: 'sub-demo',
        panelId: 'panel-demo',
        schema: 'timeseries-v1',
        dataRef: 'buffer://rti/session/live/sub-demo/0',
        rangeNs: ['0', '10000000'],
        seq: 0,
      },
    });
    const client = createBridgeClient({ invoke });

    await client.demoReceiverTick({ channelIds: [1205, 8001] });

    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0][0]).toBe('demo_receiver_tick');
    const payload = invoke.mock.calls[0][1] as { input: { channelIds: number[] } };
    expect(payload.input.channelIds).toContain(1205);
    expect(payload.input.channelIds).toContain(8001);
  });

  it('returns a panel_stream_data event with dataRef and seq', async () => {
    const invoke = vi.fn().mockResolvedValue({
      type: 'panel_stream_data',
      payload: {
        subscriptionId: 'sub-demo',
        panelId: 'panel-demo',
        schema: 'timeseries-v1',
        dataRef: 'buffer://rti/session/live/sub-demo/42',
        rangeNs: ['0', '10000000'],
        seq: 42,
      },
    });
    const client = createBridgeClient({ invoke });

    const event = await client.demoReceiverTick({ channelIds: [1205] });
    const e = event as { type: string; payload: { dataRef: string; seq: number } };
    expect(e.type).toBe('panel_stream_data');
    expect(e.payload.dataRef).toMatch(/^buffer:\/\//);
    expect(typeof e.payload.seq).toBe('number');
  });
});

describe('PCM decoder bridge contract — ingest_status payload shape', () => {
  it('ingest status contains PCM-related counters', async () => {
    const invoke = vi.fn().mockResolvedValue({
      sourceConnected: true,
      packetRateHz: 4120,
      frameRateHz: 200,
      bitrateMbps: 22.5,
      crcFailRate: 0.02,
      syncLossCount: 1,
    });
    const client = createBridgeClient({ invoke });

    const status = await client.currentIngestStatus();
    // These fields mirror the Rust RtiIngestStatus struct that the PCM decoder populates
    expect(typeof status.packetRateHz).toBe('number');
    expect(typeof status.frameRateHz).toBe('number');
    expect(typeof status.crcFailRate).toBe('number');
    expect(typeof status.syncLossCount).toBe('number');
  });
});

describe('PCM decoder bridge contract — crc_event payload shape', () => {
  it('crc_event carries frameCounter, channelIds and reason', async () => {
    // The bridge schema enforces that crc events from the PCM decoder
    // include a non-empty channelIds array and a string timestampNs.
    const { parseBridgeEvent } = await import('../../src/bridge/schemas');

    const event = parseBridgeEvent({
      type: 'crc_event',
      payload: {
        frameCounter: 0x12342,
        channelIds: [8001],
        reason: 'crc-fail',
        timestampNs: '22000000',
      },
    });

    expect(event.type).toBe('crc_event');
    const p = event.payload as { frameCounter: number; channelIds: number[]; reason: string };
    expect(p.frameCounter).toBe(0x12342);
    expect(p.channelIds).toContain(8001);
    expect(p.reason).toBe('crc-fail');
  });
});

describe('PCM decoder bridge contract — sync_loss_event payload shape', () => {
  it('sync_loss_event carries string nanosecond timestamps and numeric bitOffset', async () => {
    const { parseBridgeEvent } = await import('../../src/bridge/schemas');

    const event = parseBridgeEvent({
      type: 'sync_loss_event',
      payload: {
        lostAtNs: '22000000',
        reacquiredAtNs: '26000000',
        durationNs: '4000000',
        bitOffset: 5,
      },
    });

    const p = event.payload as { lostAtNs: string; durationNs: string; bitOffset: number };
    expect(typeof p.lostAtNs).toBe('string');
    expect(typeof p.durationNs).toBe('string');
    expect(typeof p.bitOffset).toBe('number');
    expect(p.bitOffset).toBe(5);
  });
});

// The following tests from the legacy pcm_decoder_test.js assert on Rust-side
// behaviour that requires a real PCM bitstream decoder (app/pcm.js / Rust impl).
// They are skipped here because:
// - app/pcm.js does not exist in this repository (Rust-only impl)
// - createFrame / decodeBitstream / createDemoStream are Rust-native functions
// - The contract above covers the TS bridge surface for these features

it.todo('PCM: finds all trailing sync patterns (syncMatches === 3) [Rust-side; no JS impl]');
it.todo('PCM: keeps only CRC-valid frames for display (goodFrames === 2) [Rust-side]');
it.todo('PCM: retains CRC failures in diagnostics (badFrames === 1) [Rust-side]');
it.todo('PCM: recovers non-byte-aligned bit slip (bitOffset === 5) [Rust-side]');
it.todo('PCM: reconstructs 32-bit frame counter [Rust-side]');
it.todo('PCM: uses low counter bits for subcommutation [Rust-side]');
it.todo('PCM: extracts hydraulic channel sample with quality flags [Rust-side]');
it.todo('PCM: demo stream reports sync lock [Rust-side]');
it.todo('PCM: demo stream reports configured bit slip [Rust-side]');
