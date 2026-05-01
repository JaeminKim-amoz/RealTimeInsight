/**
 * workstation.visual.spec.ts (US-023) — visual regression baseline.
 *
 * Tag: @visual — invoked via `npm run e2e:visual`. The first run creates the
 * baseline at `__snapshots__/workstation.png`; subsequent runs compare against
 * it with `maxDiffPixels: 1500` (≈5px text + 2px chrome + 10px canvas slack
 * per Critic C1). Skip via `SKIP_VISUAL=1`.
 *
 * BASELINE: First-time runners can generate the snapshot with:
 *   npx playwright test --grep @visual --update-snapshots
 */

import { test, expect } from '@playwright/test';

test.skip(process.env.SKIP_VISUAL === '1', 'Visual regression skipped via SKIP_VISUAL=1');

test('@visual workstation default render', async ({ page }) => {
  await page.goto('/');
  // DockGrid root carries the .dockgrid className per US-014.
  await page.waitForSelector('.dockgrid', { timeout: 30_000 });
  // Allow one frame for animations / canvas warmup before snapshotting.
  await page.waitForTimeout(500);

  await expect(page).toHaveScreenshot('workstation.png', {
    maxDiffPixels: 1500,
    fullPage: false,
  });
});
