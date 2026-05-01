/**
 * e2e_60fps.perf.spec.ts (US-024) — real-browser perf gate.
 *
 * Tag: @perf — invoked via `npm run e2e:perf` (headed Chromium, single worker).
 * Per Critic C1 the playwright config `repeatEach: 3` gives a median-of-3
 * sample. This spec records `performance.now()` deltas across 10s of live
 * data flow (or browser-dev synthesizer fires when no Tauri runtime is
 * present), then asserts:
 *   mean(frame_ms) <= 16.7 && p95(frame_ms) <= 25
 *
 * Skip via `SKIP_PERF=1`.
 */

import { test, expect } from '@playwright/test';

test.skip(process.env.SKIP_PERF === '1', 'Perf gate skipped via SKIP_PERF=1');

const WINDOW_MS = 10_000;

test('@perf e2e_60fps under live data', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.dockgrid', { timeout: 30_000 });
  // Warmup: let panel renderers settle before sampling.
  await page.waitForTimeout(500);

  // Inject a recorder into the page that captures RAF deltas for WINDOW_MS.
  const samples = await page.evaluate<number[], number>((windowMs) => {
    return new Promise<number[]>((resolve) => {
      const deltas: number[] = [];
      let last = performance.now();
      const start = last;
      const tick = (t: number) => {
        deltas.push(t - last);
        last = t;
        if (t - start >= windowMs) {
          resolve(deltas);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, WINDOW_MS);

  expect(samples.length, 'recorded ≥100 frames over the 10s window').toBeGreaterThan(100);

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Idx];

  console.log(`e2e_60fps: frames=${samples.length} mean=${mean.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);

  expect(mean, 'mean frame time should be ≤16.7ms').toBeLessThanOrEqual(16.7);
  expect(p95, 'p95 frame time should be ≤25ms').toBeLessThanOrEqual(25);
});
