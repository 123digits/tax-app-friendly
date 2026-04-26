import path from 'node:path';
import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end Playwright smoke tests.
 *
 * Browser binaries must be installed once on the host:
 *   npx playwright install chromium
 *
 * Run tests:
 *   npm run test:e2e          (headless)
 *   npm run test:e2e:ui       (interactive)
 *
 * The webServer block boots the app against a fresh PGlite directory in
 * tmpdir so the suite is hermetic and doesn't pollute dev state.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // `tsx server/index.ts` (no `watch`) — the dev `npm run dev` script
    // runs `tsx watch`, which restarts the server on file events and
    // makes pglite re-open the same data dir. PGlite only allows a
    // single live instance per directory, so the second open crashes
    // the WASM layer and mid-flight requests die with ECONNRESET.
    // Running tsx without watch keeps the server stable for the suite.
    command: 'npx tsx server/index.ts',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: '3100',
      // Per-run fresh pglite directory so a previous failed run doesn't
      // leave a half-written WASM heap behind.
      DATA_DIR: path.join(os.tmpdir(), `tax-app-e2e-${process.pid}`),
      NODE_ENV: 'development',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
