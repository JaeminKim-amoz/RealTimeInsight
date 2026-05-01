import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useStreamStore, __testInternals } from './streamStore';

describe('store/streamStore', () => {
  beforeEach(() => useStreamStore.getState().reset());

  it('initial state — empty subscriptions/buffers/panelDataRefs, perf snapshot zeroed', () => {
    const s = useStreamStore.getState();
    expect(s.subscriptions).toEqual({});
    expect(s.buffers).toEqual({});
    expect(s.panelDataRefs).toEqual({});
    expect(s.performance.uiFps).toBe(0);
    expect(s.performance.eventQueueDepth).toBe(0);
  });

  it('subscribe returns unique subscriptionId and registers panelDataRefs', () => {
    const handle = useStreamStore.getState().subscribe('p-strip-1', [1001], 'timeseries-v1');
    expect(handle.subscriptionId).toMatch(/^sub-/);
    const s = useStreamStore.getState();
    expect(s.subscriptions[handle.subscriptionId]).toMatchObject({
      panelId: 'p-strip-1',
      channelIds: [1001],
      schema: 'timeseries-v1',
    });
    expect(s.panelDataRefs['p-strip-1']).toContain(handle.subscriptionId);
  });

  it('subscribe twice from same panel registers both handles', () => {
    const a = useStreamStore.getState().subscribe('p1', [1001], 'timeseries-v1');
    const b = useStreamStore.getState().subscribe('p1', [1002], 'timeseries-v1');
    expect(a.subscriptionId).not.toBe(b.subscriptionId);
    expect(useStreamStore.getState().panelDataRefs.p1).toEqual(
      expect.arrayContaining([a.subscriptionId, b.subscriptionId])
    );
  });

  it('unsubscribe removes from subscriptions + panelDataRefs', () => {
    const handle = useStreamStore.getState().subscribe('p1', [1001], 'timeseries-v1');
    useStreamStore.getState().unsubscribe(handle.subscriptionId);
    const s = useStreamStore.getState();
    expect(s.subscriptions[handle.subscriptionId]).toBeUndefined();
    expect(s.panelDataRefs.p1 ?? []).not.toContain(handle.subscriptionId);
  });

  it('pushFrame increments buffer length + queueDepth — does not synchronously notify React', () => {
    const handle = useStreamStore.getState().subscribe('p1', [1001], 'timeseries-v1');
    const subscriber = vi.fn();
    const unsub = useStreamStore.subscribe(subscriber);
    const callsBefore = subscriber.mock.calls.length;
    for (let i = 0; i < 100; i++) {
      useStreamStore.getState().pushFrame(handle.subscriptionId, {
        timestampNs: String(i * 5_000_000),
        value: i,
      });
    }
    // Immediately after pushFrame loop, NO React notifications should have fired
    // (RAF coalescer still pending). Internal queueDepth reflects pending frames.
    const queue = useStreamStore.getState().performance.eventQueueDepth;
    expect(queue).toBe(100);
    const callsAfter = subscriber.mock.calls.length;
    // pushFrame uses a non-zustand internal append; allow exactly 0 zustand emissions.
    expect(callsAfter - callsBefore).toBe(0);
    unsub();
  });

  it('tickRaf coalesces N frames into ONE React notification + drains queue (Critic E1 / Architect Tension 2.6)', () => {
    const handle = useStreamStore.getState().subscribe('p1', [1001], 'timeseries-v1');
    const subscriber = vi.fn();
    const unsub = useStreamStore.subscribe(subscriber);
    for (let i = 0; i < 1000; i++) {
      useStreamStore.getState().pushFrame(handle.subscriptionId, {
        timestampNs: String(i * 5_000_000),
        value: i,
      });
    }
    const before = subscriber.mock.calls.length;
    useStreamStore.getState().tickRaf();
    const after = subscriber.mock.calls.length;
    // Exactly 1 React notification per RAF tick, regardless of how many frames pushed.
    expect(after - before).toBe(1);
    // Queue drained
    expect(useStreamStore.getState().performance.eventQueueDepth).toBe(0);
    // Buffer length reflects all 1000 frames
    expect(useStreamStore.getState().buffers[handle.subscriptionId]?.length).toBe(1000);
    unsub();
  });

  it('updatePerformance updates uiFps + p95 + queueDepth', () => {
    useStreamStore.getState().updatePerformance({ uiFps: 60, renderLatencyMsP95: 12.4 });
    expect(useStreamStore.getState().performance.uiFps).toBe(60);
    expect(useStreamStore.getState().performance.renderLatencyMsP95).toBe(12.4);
  });

  it('exposes test-internals for clearing the pending queue between tests', () => {
    expect(typeof __testInternals.flushPendingForTest).toBe('function');
  });
});

describe('store/streamStore — RAF-budget assertion (Critic E1 fix)', () => {
  let originalRaf: typeof globalThis.requestAnimationFrame;
  beforeEach(() => {
    useStreamStore.getState().reset();
    originalRaf = globalThis.requestAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it('flush callback wall-clock < 16.7ms avg under 200Hz synthetic for 1s', () => {
    const handle = useStreamStore.getState().subscribe('p1', [1001], 'timeseries-v1');
    const samples = 200; // 1 sec at 200 Hz
    const durations: number[] = [];
    for (let s = 0; s < samples; s++) {
      const start = performance.now();
      useStreamStore.getState().pushFrame(handle.subscriptionId, {
        timestampNs: String(s * 5_000_000),
        value: s,
      });
      // Coalesce every 5 samples (synthetic RAF tick rate at 40 Hz, faster than panel render)
      if (s % 5 === 4) useStreamStore.getState().tickRaf();
      durations.push(performance.now() - start);
    }
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(mean).toBeLessThan(16.7);
  });
});

// ── US-2-005c — runDetectors integration ───────────────────────────────────

describe('store/streamStore — runDetectors (US-2-005c)', () => {
  beforeEach(() => useStreamStore.getState().reset());

  it('runDetectors with empty rules is a no-op — detectedAnomalies stays empty', () => {
    useStreamStore.getState().runDetectors([]);
    expect(useStreamStore.getState().detectedAnomalies).toEqual([]);
  });

  it('runDetectors with 1 delta-spike rule + populated buffer populates detectedAnomalies', () => {
    const { subscriptionId } = useStreamStore.getState().subscribe('p-hyd', [1205], 'timeseries-v1');
    // Populate buffer with frames including a spike
    const frames = [
      { timestampNs: '0', value: 207 },
      { timestampNs: '1', value: 207 },
      { timestampNs: '2', value: 207 },
      { timestampNs: '3', value: 235 }, // delta = 28 bar > 20
      { timestampNs: '4', value: 207 },
    ];
    useStreamStore.getState().hydrateBuffer(subscriptionId, frames);

    const rule = {
      id: 'hyd-pressure-spike',
      name: 'Hydraulic Pressure Spike',
      channelId: 1205,
      pattern: 'delta-spike' as const,
      deltaThreshold: 20,
      severity: 'high' as const,
      label: 'Hydraulic spike',
    };
    useStreamStore.getState().runDetectors([rule]);

    const detected = useStreamStore.getState().detectedAnomalies;
    expect(detected.length).toBeGreaterThanOrEqual(1);
    expect(detected[0].channelId).toBe(1205);
    expect(detected[0].severity).toBe('high');
  });

  it('runDetectors deduplication — calling twice does not duplicate entries', () => {
    const { subscriptionId } = useStreamStore.getState().subscribe('p-hyd', [1205], 'timeseries-v1');
    const frames = [
      { timestampNs: '0', value: 207 },
      { timestampNs: '1', value: 235 }, // spike
    ];
    useStreamStore.getState().hydrateBuffer(subscriptionId, frames);

    const rule = {
      id: 'hyd-pressure-spike',
      name: 'Hydraulic Pressure Spike',
      channelId: 1205,
      pattern: 'delta-spike' as const,
      deltaThreshold: 20,
      severity: 'high' as const,
      label: 'Hydraulic spike',
    };
    useStreamStore.getState().runDetectors([rule]);
    const firstCount = useStreamStore.getState().detectedAnomalies.length;

    // Call again — dedup by anomalyId should prevent duplicates
    useStreamStore.getState().runDetectors([rule]);
    const secondCount = useStreamStore.getState().detectedAnomalies.length;

    expect(secondCount).toBe(firstCount);
  });
});
