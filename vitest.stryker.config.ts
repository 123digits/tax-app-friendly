// Separate vitest config used only by Stryker's mutation runner.
//
// The main vitest.config.ts pins the pool to a single fork because tax-
// calculator integration tests touch the PGlite singleton, which can't
// survive parallel worker startups. Stryker-targeted tests (the pure
// calculator modules under server/services/tax/) don't touch PGlite — they
// operate on plain inputs and constants objects — so we can safely let
// vitest run them in the default parallel thread pool. That's the
// difference between a 45-minute Stryker run and a 4-minute Stryker run.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    // Only the pure calculator tests run under Stryker. This matches the
    // `mutate` set in stryker.config.json and keeps the baseline dry-run
    // fast (< 10s in practice vs 2+ minutes in the full-suite config).
    include: [
      'server/services/tax/**/*.test.ts',
    ],
    // No pglite, so parallel threads are safe.
    environment: 'node',
    setupFiles: ['./test-setup/vitest.setup.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      '.stryker-tmp/**',
      // The carryforwards + orchestrator-edge suites need the DB — Stryker's
      // calculator mutants never reach those paths anyway, so excluding them
      // speeds up each mutant's test run without reducing kill rate.
      'server/services/carryforwards.test.ts',
      'server/services/tax/orchestrator-edge.test.ts',
    ],
  },
});
