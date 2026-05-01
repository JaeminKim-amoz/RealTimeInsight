/**
 * Pure-logic tests for the waterfall renderer (US-017a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  amberColormap,
  synthSpectrumFrame,
  drawWaterfall,
  type WaterfallFrame,
  type WaterfallViewport,
} from './render';

describe('panels/waterfall/render amberColormap', () => {
  it('returns a dark color near k=0', () => {
    const c = amberColormap(0);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(10);
  });

  it('returns an amber-ish color near k=0.5', () => {
    const c = amberColormap(0.5);
    expect(c.r).toBeGreaterThanOrEqual(220);
    expect(c.g).toBeGreaterThan(150);
  });

  it('returns a near-white color near k=1', () => {
    const c = amberColormap(1);
    expect(c.r).toBeGreaterThan(220);
    expect(c.g).toBeGreaterThan(220);
    expect(c.b).toBeGreaterThan(200);
  });

  it('clamps k > 1 to maximum', () => {
    const c1 = amberColormap(1);
    const c2 = amberColormap(2);
    expect(c2).toEqual(c1);
  });

  it('clamps k < 0 to minimum', () => {
    const c0 = amberColormap(0);
    const cm = amberColormap(-0.5);
    expect(cm).toEqual(c0);
  });
});

describe('panels/waterfall/render synthSpectrumFrame', () => {
  it('produces a vector with the requested column count', () => {
    const v = synthSpectrumFrame(0, 120);
    expect(v.length).toBe(120);
  });

  it('values are bounded in a reasonable [0..2] range', () => {
    const v = synthSpectrumFrame(5, 80);
    for (const x of v) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(3);
    }
  });

  it('shows peak near freq fraction = 0.55 (strongest peak)', () => {
    const v = synthSpectrumFrame(0, 200);
    const idxPeak = Math.round(0.55 * 200);
    const peakVal = v[idxPeak];
    // Compare to a far-away point
    expect(peakVal).toBeGreaterThan(v[0]);
    expect(peakVal).toBeGreaterThan(v[v.length - 1]);
  });
});

describe('panels/waterfall/render drawWaterfall', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  function makeMockCtx() {
    return {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      font: '',
    };
  }

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  const viewport: WaterfallViewport = { width: 240, height: 160, rows: 8, cols: 12 };

  it('clears the canvas before drawing', () => {
    drawWaterfall(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 240, 160);
  });

  it('draws one rect per cell (rows * cols)', () => {
    const frames: WaterfallFrame[] = Array.from({ length: 8 }, () => ({
      values: synthSpectrumFrame(0, 12),
    }));
    drawWaterfall(ctx as unknown as CanvasRenderingContext2D, frames, viewport);
    expect(ctx.fillRect.mock.calls.length).toBe(8 * 12);
  });

  it('draws the frequency band labels at the bottom', () => {
    drawWaterfall(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('does not throw when given fewer frames than rows', () => {
    const frames: WaterfallFrame[] = [{ values: synthSpectrumFrame(0, 12) }];
    expect(() =>
      drawWaterfall(ctx as unknown as CanvasRenderingContext2D, frames, viewport)
    ).not.toThrow();
  });

  it('does not throw when frame columns mismatch viewport.cols', () => {
    const frames: WaterfallFrame[] = [{ values: synthSpectrumFrame(0, 4) }];
    expect(() =>
      drawWaterfall(ctx as unknown as CanvasRenderingContext2D, frames, viewport)
    ).not.toThrow();
  });
});
