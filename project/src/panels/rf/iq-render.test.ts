/**
 * Pure-logic tests for the IQ constellation renderer (US-2-006b).
 *
 * Architect S2 / Tension 2.1: extract canvas drawing into pure helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  drawConstellation,
  qamConstellation,
  pskConstellation,
  addNoise,
  generateConstellationSamples,
  type IQPoint,
  type ConstellationOptions,
} from './iq-render';

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
    arc: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
  };
}

describe('panels/rf/iq-render qamConstellation', () => {
  it('produces 16 points for 16-QAM', () => {
    const pts = qamConstellation(16);
    expect(pts.length).toBe(16);
  });

  it('produces 64 points for 64-QAM', () => {
    const pts = qamConstellation(64);
    expect(pts.length).toBe(64);
  });

  it('points are normalized roughly within unit square', () => {
    const pts = qamConstellation(16);
    for (const [i, q] of pts) {
      expect(Math.abs(i)).toBeLessThanOrEqual(1.001);
      expect(Math.abs(q)).toBeLessThanOrEqual(1.001);
    }
  });

  it('throws on non-square M', () => {
    expect(() => qamConstellation(15)).toThrow();
  });
});

describe('panels/rf/iq-render pskConstellation', () => {
  it('produces M points for M-PSK', () => {
    const qpsk = pskConstellation(4);
    const psk8 = pskConstellation(8);
    expect(qpsk.length).toBe(4);
    expect(psk8.length).toBe(8);
  });

  it('points lie on the unit circle', () => {
    const psk8 = pskConstellation(8);
    for (const [i, q] of psk8) {
      const r = Math.sqrt(i * i + q * q);
      expect(r).toBeCloseTo(1, 5);
    }
  });

  it('points are angularly equispaced', () => {
    const qpsk = pskConstellation(4);
    expect(qpsk[0][0]).toBeCloseTo(1, 5);
    expect(qpsk[0][1]).toBeCloseTo(0, 5);
    expect(qpsk[1][0]).toBeCloseTo(0, 5);
    expect(qpsk[1][1]).toBeCloseTo(1, 5);
  });
});

describe('panels/rf/iq-render addNoise', () => {
  it('returns same number of points', () => {
    const ideal: IQPoint[] = [
      [1, 1],
      [-1, -1],
    ];
    const noisy = addNoise(ideal, 0.05, () => 0.5);
    expect(noisy.length).toBe(2);
  });

  it('zero sigma leaves points unchanged', () => {
    const ideal: IQPoint[] = [
      [0.5, -0.5],
      [-0.3, 0.7],
    ];
    const noisy = addNoise(ideal, 0, () => 0.5);
    expect(noisy[0][0]).toBeCloseTo(0.5, 10);
    expect(noisy[0][1]).toBeCloseTo(-0.5, 10);
  });

  it('non-zero sigma perturbs points', () => {
    const ideal: IQPoint[] = [[1, 1]];
    const noisy = addNoise(ideal, 0.5, () => 0.99);
    expect(noisy[0][0]).not.toBe(1);
  });
});

describe('panels/rf/iq-render generateConstellationSamples', () => {
  it('generates trail of given length for 16-QAM', () => {
    const pts = generateConstellationSamples('16-QAM', 200, 0.05, () => 0.5);
    expect(pts.length).toBe(200);
  });

  it('supports QPSK preset', () => {
    const pts = generateConstellationSamples('QPSK', 100, 0.05, () => 0.5);
    expect(pts.length).toBe(100);
  });

  it('supports 8-PSK preset', () => {
    const pts = generateConstellationSamples('8-PSK', 50, 0.05, () => 0.5);
    expect(pts.length).toBe(50);
  });

  it('throws on unknown modulation', () => {
    expect(() =>
      generateConstellationSamples('FAKE-MOD' as 'QPSK', 10, 0.05, () => 0.5)
    ).toThrow();
  });
});

describe('panels/rf/iq-render drawConstellation', () => {
  let ctx: ReturnType<typeof makeMockCtx>;
  const options: ConstellationOptions = {
    width: 300,
    height: 300,
    idealPoints: [
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ],
  };

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas', () => {
    drawConstellation(ctx as unknown as CanvasRenderingContext2D, [], options);
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('renders one fillRect per sample', () => {
    const samples: IQPoint[] = [
      [0.9, 0.9],
      [-0.9, -0.9],
      [0.9, -0.9],
    ];
    drawConstellation(ctx as unknown as CanvasRenderingContext2D, samples, options);
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('renders ideal points as arcs', () => {
    drawConstellation(ctx as unknown as CanvasRenderingContext2D, [], options);
    expect(ctx.arc.mock.calls.length).toBe(options.idealPoints.length);
  });

  it('does not throw on empty inputs', () => {
    expect(() =>
      drawConstellation(ctx as unknown as CanvasRenderingContext2D, [], {
        width: 100,
        height: 100,
        idealPoints: [],
      })
    ).not.toThrow();
  });

  it('renders I/Q axis labels', () => {
    drawConstellation(ctx as unknown as CanvasRenderingContext2D, [], options);
    expect(ctx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
