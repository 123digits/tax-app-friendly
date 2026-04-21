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
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['shared/**', 'node'],
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
    },
  },
});
