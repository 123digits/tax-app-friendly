import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import ViteExpress from 'vite-express';

import { getDb } from './db/pglite.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';

// ---- .env fallback (dotenv usually handles this, but we may not have it) ----
// Try a minimal manual parser if `dotenv/config` fails to load.
export function ensureEnvLoaded(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)?\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2] ?? '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

export async function ensureDefaults(): Promise<void> {
  try {
    ensureEnvLoaded();
  } catch {
    /* ignore */
  }
  if (!process.env.DATA_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY.length !== 64) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[warn] DATA_ENCRYPTION_KEY is missing or wrong length. Using an ephemeral dev key; ' +
          'SSN values will NOT decrypt across restarts. Set DATA_ENCRYPTION_KEY in .env for persistence.'
      );
      const crypto = await import('node:crypto');
      process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    } else {
      throw new Error('DATA_ENCRYPTION_KEY must be set in production (64 hex chars).');
    }
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
  }
}

export async function main(): Promise<void> {
  await ensureDefaults();
  const app = createApp();
  const port = Number(process.env.PORT || 3000);

  await getDb();
  await runMigrations();
  console.log('[startup] pglite initialized; schema migrated; tax-year defaults seeded');

  const server = app.listen(port, () => {
    console.log(`[startup] listening on http://localhost:${port}`);
  });

  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.resolve(process.cwd(), 'dist', 'client');
    app.use(express.static(clientDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
    void server;
  } else {
    ViteExpress.bind(app, server);
  }
}

// Only run main when this file is the entrypoint (not imported by tests).
const isEntrypoint = (() => {
  try {
    const arg = process.argv[1];
    if (!arg) return false;
    const url = new URL(`file://${path.resolve(arg)}`).href;
    return import.meta.url === url;
  } catch {
    return false;
  }
})();

if (isEntrypoint) {
  main().catch((err) => {
    console.error('[startup] failed:', err);
    process.exit(1);
  });
}
