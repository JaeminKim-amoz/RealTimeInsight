/**
 * Pure-logic tests for the strip chart renderer (US-016a).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers so the
 * React wrapper stays thin and the heavy logic is unit-tested without RTL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeRange,
  resolveSeriesColor,
  findAnomalyIndex,
  drawStripPlot,
  type StripSeries,
  type StripViewport,
} from './render';

describe('panels/strip/render computeRange', () => {
  it('computes min/max with 12% padding for finite values', () => {
    const r = computeRange([10, 20, 30]);
    // raw min=10, max=30, pad = 20*0.12 = 2.4 → min=7.6, max=32.4
    expect(r.min).toBeCloseTo(7.6, 5);
    expect(r.max).toBeCloseTo(32.4, 5);
  });

  it('falls back to ±1 padding when all values are equal', () => {
    const r = computeRange([5, 5, 5]);
    expect(r.min).toBe(4);
    expect(r.max).toBe(6);
  });

  it('returns a safe default for empty arrays', () => {
    const r = computeRange([]);
    expect(r.min).toBeLessThan(r.max);
    expect(Number.isFinite(r.min)).toBe(true);
    expect(Number.isFinite(r.max)).toBe(true);
  });
});

describe('panels/strip/render resolveSeriesColor', () => {
  it('returns the literal color when not a CSS variable token', () => {
    expect(resolveSeriesColor('#ff0000')).toBe('#ff0000');
  });

  it('extracts and resolves --sN tokens into computed style values', () => {
    const fakeStyle = { getPropertyValue: vi.fn().mockReturnValue('  #abcdef  ') };
    const root = { style: fakeStyle } as unknown as HTMLElement;
    const out = resolveSeriesColor('var(--s4)', root, fakeStyle as unknown as CSSStyleDeclaration);
    expect(fakeStyle.getPropertyValue).toHaveBeenCalledWith('--s4');
    expect(out).toBe('#abcdef');
  });

  it('falls back to amber default if computed value is empty', () => {
    const fakeStyle = { getPropertyValue: vi.fn().mockReturnValue('') };
    const out = resolveSeriesColor('var(--s7)', undefined, fakeStyle as unknown as CSSStyleDeclaration);
    expect(out).toBe('#e5a24a');
  });
});

describe('panels/strip/render findAnomalyIndex', () => {
  it('returns the first index whose timestamp ≥ spike time', () => {
    const ts = [180, 181, 182, 182.5, 183];
    expect(findAnomalyIndex(ts, 182.34)).toBe(3);
  });

  it('returns -1 when no timestamp reaches the spike time', () => {
    expect(findAnomalyIndex([180, 181], 182.34)).toBe(-1);
  });

  it('returns -1 for empty arrays', () => {
    expect(findAnomalyIndex([], 100)).toBe(-1);
  });
});

describe('panels/strip/render drawStripPlot', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  function makeMockCtx() {
    return {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      scale: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    };
  }

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  const viewport: StripViewport = { width: 400, height: 200, sampleCount: 10 };

  it('clears the canvas before drawing', () => {
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 200);
  });

  it('draws background grid lines (9 vertical + 3 horizontal)', () => {
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    // 9 inner verticals + 3 inner horizontals = 12 stroke calls for the grid
    expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(12);
  });

  it('strokes one polyline per series', () => {
    const series: StripSeries[] = [
      { channelId: 1001, color: '#aaaaaa', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { channelId: 1002, color: '#bbbbbb', values: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
    ];
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, series, viewport);
    // each series begins one path; verify enough lineTo calls per series
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(series.length * 9);
  });

  it('draws a cursor line when cursorX ∈ [0,1]', () => {
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, [], viewport, {
      cursorX: 0.5,
    });
    // Cursor draw uses moveTo(x,0) and lineTo(x,H)
    const cursorMoveTo = ctx.moveTo.mock.calls.some(
      ([x, y]) => x === 200 && y === 0
    );
    expect(cursorMoveTo).toBe(true);
  });

  it('draws an anomaly marker when channel 1205 is present and showAnomaly is true', () => {
    const series: StripSeries[] = [
      {
        channelId: 1205,
        color: '#d8634a',
        values: Array.from({ length: 10 }, (_, i) => 207 + i),
      },
    ];
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, series, viewport, {
      showAnomaly: true,
    });
    // arc() is the anomaly dot
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('omits anomaly marker when showAnomaly is false even if 1205 binding exists', () => {
    const series: StripSeries[] = [
      {
        channelId: 1205,
        color: '#d8634a',
        values: Array.from({ length: 10 }, (_, i) => 207 + i),
      },
    ];
    drawStripPlot(ctx as unknown as CanvasRenderingContext2D, series, viewport, {
      showAnomaly: false,
    });
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('skips empty value arrays without throwing', () => {
    const series: StripSeries[] = [
      { channelId: 1001, color: '#fff', values: [] },
    ];
    expect(() =>
      drawStripPlot(ctx as unknown as CanvasRenderingContext2D, series, viewport)
    ).not.toThrow();
  });
});
