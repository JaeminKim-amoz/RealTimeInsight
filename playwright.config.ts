import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for RTI slice 1.
 * - Visual regression (Phase 13): PR-blocking, headless Chromium, tagged @visual.
 * - e2e_60fps (Phase 14): PR-blocking, headed Chromium, tagged @perf.
 *
 * Per Critic C1: real-browser perf gate uses median-of-3 strategy via testProject.repeatEach=3.
 * Per Critic C4: install with `npx playwright install chromium --with-deps` cached on
 * ~/.cache/ms-playwright with key including this Playwright version.
 */
export default defineConfig({
  testDir: './project/tests/e2e',
  fullyParallel: false,  // perf tests must run sequentially for stable timing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // single worker for perf measurement stability
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'perf',
      testMatch: /.*\.perf\.spec\.ts/,
      // Phase 14: headed mode for accurate frame timing (per Architect B1 + Critic C1)
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: { headless: false },
      },
      // Median-of-3 strategy per C1: run each test 3x, assert on median
      repeatEach: 3,
    },
  ],

  // Spawn dev server only when running locally; CI uses prebuilt static + tauri:dev
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
