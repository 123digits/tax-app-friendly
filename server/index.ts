import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import ViteExpress from 'vite-express';

import { getDb } from './db/pglite.js';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import taxReturnRoutes from './routes/taxReturn.js';
import devRoutes from './routes/dev.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

// ---- .env fallback (dotenv usually handles this, but we may not have it) ----
// Try a minimal manual parser if `dotenv/config` fails to load.
function ensureEnvLoaded(): void {
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
try {
  ensureEnvLoaded();
} catch {
  /* ignore */
}

// Sensible defaults so developer startup isn't blocked by a missing .env.
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

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite dev server + Vuetify require relaxed CSP
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/return', taxReturnRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dev', devRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', errorHandler);

const port = Number(process.env.PORT || 3000);

async function main() {
  await getDb();
  await runMigrations();
  console.log('[startup] pglite initialized; schema migrated; tax-year defaults seeded');

  const server = app.listen(port, () => {
    console.log(`[startup] listening on http://localhost:${port}`);
  });

  // In prod, serve the built client from dist/client. In dev, ViteExpress bridges to Vite.
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

main().catch((err) => {
  console.error('[startup] failed:', err);
  process.exit(1);
});
