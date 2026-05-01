/**
 * Pure-logic tests for the eye-diagram renderer (US-2-006c).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  drawEyeDiagram,
  generateEyeTraces,
  type EyeTrace,
  type EyeViewport,
} from './eye-render';

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    globalAlpha: 1,
  };
}

describe('panels/rf/eye-render generateEyeTraces', () => {
  it('produces requested number of traces', () => {
    const traces = generateEyeTraces(50, 80, 0, () => 0.5);
    expect(traces.length).toBe(50);
  });

  it('each trace has the requested sample count', () => {
    const traces = generateEyeTraces(10, 100, 0, () => 0.5);
    for (const tr of traces) {
      expect(tr.samples.length).toBe(100);
    }
  });

  it('different rng yields different traces', () => {
    let seed = 0.1;
    const rngA = () => {
      seed = (seed + 0.13) % 1;
      return seed;
    };
    let seed2 = 0.7;
    const rngB = () => {
      seed2 = (seed2 + 0.17) % 1;
      return seed2;
    };
    const a = generateEyeTraces(5, 40, 0, rngA);
    const b = generateEyeTraces(5, 40, 0, rngB);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('samples remain bounded in reasonable amplitude range', () => {
    const traces = generateEyeTraces(20, 80, 0, () => 0.5);
    for (const tr of traces) {
      for (const s of tr.samples) {
        expect(s).toBeGreaterThan(-2);
        expect(s).toBeLessThan(2);
      }
    }
  });
});

describe('panels/rf/eye-render drawEyeDiagram', () => {
  let ctx: ReturnType<typeof makeMockCtx>;
  const viewport: EyeViewport = { width: 300, height: 200 };

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas before drawing', () => {
    drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 200);
  });

  it('overlays each trace as a polyline (1 stroke per trace + grid)', () => {
    const traces: EyeTrace[] = [
      { samples: [0, 0.5, 1, 0.5, 0] },
      { samples: [0, -0.5, -1, -0.5, 0] },
    ];
    drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, traces, viewport);
    // ≥2 stroke calls (one per trace), plus grid strokes
    expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders persistence by setting alpha to 0.2 on traces', () => {
    const traces: EyeTrace[] = [{ samples: [0, 0.5, 1] }];
    drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, traces, viewport, {
      persistenceAlpha: 0.2,
    });
    // strokeStyle is set to an rgba string with 0.2 alpha
    expect(ctx.strokeStyle).toContain('0.2');
  });

  it('draws axis labels (-1 UI, 0, +1 UI)', () => {
    drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('draws grid lines (≥9 vertical + ≥9 horizontal)', () => {
    drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, [], viewport);
    expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(18);
  });

  it('does not throw with 50 traces (acceptance criteria)', () => {
    const traces = generateEyeTraces(50, 60, 0, () => 0.5);
    expect(() =>
      drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, traces, viewport)
    ).not.toThrow();
  });

  it('handles empty traces array', () => {
    expect(() =>
      drawEyeDiagram(ctx as unknown as CanvasRenderingContext2D, [], viewport)
    ).not.toThrow();
  });
});
