import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

let instance: PGlite | null = null;

/**
 * Returns the directory pglite will use.
 *
 * Priority:
 *   1. DATA_DIR env var (absolute path preferred).
 *   2. `./data` under the project root, if that path doesn't contain
 *      characters that break pglite's bundled WASM fs (e.g. apostrophes,
 *      quotes). Some paths — notably Dropbox folders with personal names —
 *      trip a silent crash inside pglite's Emscripten runtime on Windows.
 *   3. Fallback: a stable path under the OS temp dir, so the app still works
 *      even if the project lives in such a path. We warn in this case.
 */
export function getDataDir(): string {
  if (process.env.DATA_DIR) {
    const dir = path.resolve(process.env.DATA_DIR);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  const projectData = path.resolve(process.cwd(), 'data');
  const bad = /['"`]/.test(projectData);
  if (!bad) {
    fs.mkdirSync(projectData, { recursive: true });
    return projectData;
  }

  const hash = crypto.createHash('sha1').update(projectData).digest('hex').slice(0, 12);
  const fallback = path.join(os.tmpdir(), `tax-app-${hash}`);
  fs.mkdirSync(fallback, { recursive: true });
   
  console.warn(
    `[warn] Project path contains special chars; pglite data moved to ${fallback}. ` +
      `Set DATA_DIR env to override.`
  );
  return fallback;
}

export async function getDb(): Promise<PGlite> {
  if (!instance) {
    const dir = getDataDir();
    instance = new PGlite(dir);
    await instance.waitReady;
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
