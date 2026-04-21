import { defineConfig } from 'vitest/config';

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
  test: {
    fileParallelism: false,
  },
});
