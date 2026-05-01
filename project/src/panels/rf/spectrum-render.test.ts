/**
 * Pure-logic tests for the spectrum renderer (US-2-006a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  drawSpectrum,
  synthSpectrumTrace,
  type SpectrumFrame,
  type SpectrumViewport,
  type SpectrumOptions,
} from './spectrum-render';

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
  };
}

describe('panels/rf/spectrum-render synthSpectrumTrace', () => {
  it('produces a vector with the requested point count', () => {
    const trace = synthSpectrumTrace(1.5e9, 500e6, 0, 256);
    expect(trace.length).toBe(256);
  });

  it('default point count is 801 (Keysight standard)', () => {
    const trace = synthSpectrumTrace(1.5e9, 500e6, 0);
    expect(trace.length).toBe(801);
  });

  it('values are in dBm range (negative noise floor with peaks)', () => {
    const trace = synthSpectrumTrace(1.5e9, 500e6, 0, 200);
    for (const v of trace) {
      expect(v).toBeGreaterThan(-150);
      expect(v).toBeLessThan(20);
    }
  });

  it('shows peak near center frequency', () => {
    const trace = synthSpectrumTrace(1.5e9, 500e6, 0, 200);
    const centerIdx = Math.round(trace.length / 2);
    const edgeIdx = 5;
    expect(trace[centerIdx]).toBeGreaterThan(trace[edgeIdx]);
  });

  it('time parameter alters drift content', () => {
    const a = synthSpectrumTrace(1.5e9, 500e6, 0, 100);
    const b = synthSpectrumTrace(1.5e9, 500e6, 5, 100);
    let diffSum = 0;
    for (let i = 0; i < a.length; i++) diffSum += Math.abs(a[i] - b[i]);
    expect(diffSum).toBeGreaterThan(0);
  });
});

describe('panels/rf/spectrum-render drawSpectrum', () => {
  let ctx: ReturnType<typeof makeMockCtx>;
  const viewport: SpectrumViewport = { width: 400, height: 200 };
  const options: SpectrumOptions = {
    centerHz: 1.5e9,
    spanHz: 500e6,
    refLevelDbm: -30,
    scaleDbDiv: 10,
  };

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas before drawing', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, options);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 200);
  });

  it('draws Keysight 10x10 grid (≥18 grid line strokes)', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, options);
    // 9 vertical + 9 horizontal grid lines + center axis + trace
    expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(18);
  });

  it('renders dBm axis labels and MHz frequency labels', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, options);
    // 11 dBm labels + 11 freq labels = 22 fillText calls minimum
    expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(20);
  });

  it('renders a trace polyline (≥1 stroke call)', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, options);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(0);
  });

  it('draws peak markers when supplied (M1/M2)', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    const opts: SpectrumOptions = {
      ...options,
      markers: [
        { id: 1, hz: 1.5e9 + 4e6, dBm: -45 },
        { id: 2, hz: 1.5e9 - 6e6, dBm: -60 },
      ],
    };
    drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, opts);
    // marker diamonds → fill calls beyond background
    expect(ctx.fill.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not throw when frame is empty', () => {
    const frame: SpectrumFrame = { values: [] };
    expect(() =>
      drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, options)
    ).not.toThrow();
  });

  it('skips out-of-band markers gracefully', () => {
    const frame: SpectrumFrame = { values: synthSpectrumTrace(1.5e9, 500e6, 0, 100) };
    const opts: SpectrumOptions = {
      ...options,
      markers: [{ id: 1, hz: 9e9, dBm: -45 }], // way outside span
    };
    expect(() =>
      drawSpectrum(ctx as unknown as CanvasRenderingContext2D, frame, viewport, opts)
    ).not.toThrow();
  });
});
