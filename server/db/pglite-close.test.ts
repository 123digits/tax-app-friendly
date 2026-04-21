// Exercises closeDb(). Kept in its own file so the next test run re-inits
// the singleton via getDb() + beforeAll(runMigrations()) cleanly.
import { describe, it, expect } from 'vitest';
import { getDb, closeDb } from './pglite.js';
import { runMigrations } from './migrate.js';

describe('closeDb', () => {
  it('closes the active instance and allows a fresh one afterwards', async () => {
    await runMigrations();
    const first = await getDb();
    expect(first).toBeTruthy();
    await closeDb();
    // Second call → fresh singleton; won't throw.
    const second = await getDb();
    expect(second).toBeTruthy();
    // Re-run migrations on the re-opened instance so downstream test files
    // (if they run after this one) see a ready schema.
    await runMigrations();
  });

  it('closeDb is a no-op when no instance exists', async () => {
    // Sequence closeDb → closeDb without an intervening getDb.
    await closeDb();
    await expect(closeDb()).resolves.toBeUndefined();
    // Restore state so other files keep working.
    await getDb();
    await runMigrations();
  });
});
