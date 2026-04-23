import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

/**
 * Vitest configuration.
 *
 * fileParallelism is disabled because the server tests boot the same
 * on-disk PGlite data directory via `runMigrations()` in their
 * `beforeAll` hooks. PGlite allows only a single live instance per
 * data directory, so letting vitest open several worker threads against
 * the same directory crashes the Emscripten/WASM layer with an
 * `unreachable` or `Aborted()` error. Serializing test files keeps
 * PGlite happy and preserves per-suite isolation.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    fileParallelism: false,
    // Run every test file in the same worker thread so all of them share one
    // PGlite singleton. Without `singleThread: true`, vitest's default is to
    // spawn a new worker per file, each of which calls `runMigrations()` and
    // opens its own PGlite handle on the same on-disk data dir — the WASM
    // layer then crashes with `Aborted()`. This also keeps Stryker stable
    // since it wraps vitest in its own child-process harness that can't
    // tolerate the thread/fork churn.
    poolOptions: { threads: { singleThread: true } },
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['shared/**', 'node'],
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**',
      '.stryker-tmp/**',
    ],
    setupFiles: ['./test-setup/vitest.setup.ts'],
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'server/**/*.ts',
        'shared/**/*.ts',
        'src/**/*.ts',
        'src/**/*.vue',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'server/index.ts',
        'server/services/taxCalculator.ts',
        'server/test-utils/**',
        'server/types/**',
        'shared/types.ts',
        'src/shims-vue.d.ts',
        'src/main.ts',
        'test-setup/**',
        'dist/**',
        'coverage/**',
        'node_modules/**',
      ],
      // CI regression guards. These match the current floor at the time the
      // thresholds were introduced; future PRs that drop below will fail
      // `npm test -- --coverage`. Function % stays lax because v8 counts
      // generated Vue render closures and lazy route imports as functions.
      thresholds: {
        statements: 99,
        branches: 97,
        lines: 99,
        functions: 55,
      },
    },
  },
});
