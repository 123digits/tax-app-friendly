// Covers errorHandler's 500 branch and the catch-block next(err) paths in
// requireAuth / requireAdmin.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { errorHandler } from './errorHandler.js';
import { requireAuth } from './requireAuth.js';
import { requireAdmin } from './requireAdmin.js';

describe('errorHandler', () => {
  it('returns 500 for generic Error', async () => {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(new Error('bang')));
    app.use(errorHandler);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
    expect(res.body.message).toBe('bang');
  });

  it('returns internal_error for non-Error thrown values', async () => {
    const app = express();
    app.get('/boom', (_req, _res, next) => next('not-an-error'));
    app.use(errorHandler);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
  });

  it('honors err.status for 4xx', async () => {
    const app = express();
    app.get('/forbidden', (_req, _res, next) =>
      next(Object.assign(new Error('nope'), { status: 403 })),
    );
    app.use(errorHandler);
    const res = await request(app).get('/forbidden');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('nope');
  });

  it('ignores err.status in 5xx range (falls through to 500)', async () => {
    const app = express();
    app.get('/oops', (_req, _res, next) =>
      next(Object.assign(new Error('bleh'), { status: 502 })),
    );
    app.use(errorHandler);
    const res = await request(app).get('/oops');
    expect(res.status).toBe(500);
  });
});

describe('requireAuth catch branch', () => {
  it('forwards thrown errors to error middleware', async () => {
    vi.resetModules();
    vi.doMock('../services/session.js', () => ({
      SESSION_COOKIE: 'session',
      PENDING_COOKIE: 'pending_session',
      getUserIdFromSession: async () => { throw new Error('db-dead'); },
      getUserIdFromPending: async () => null,
      createSession: async () => {},
      createPendingSession: async () => {},
      clearSession: async () => {},
      clearPendingSession: async () => {},
    }));
    const { requireAuth: ra } = await import('./requireAuth.js');
    const app = express();
    app.use(cookieParser());
    app.get('/x', ra, (_req, res) => { res.json({ ok: true }); });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    vi.doUnmock('../services/session.js');
  });
});

describe('requireAdmin catch branch', () => {
  it('forwards thrown errors to error middleware', async () => {
    vi.resetModules();
    vi.doMock('../services/session.js', () => ({
      SESSION_COOKIE: 'session',
      PENDING_COOKIE: 'pending_session',
      getUserIdFromSession: async () => { throw new Error('boom'); },
      getUserIdFromPending: async () => null,
      createSession: async () => {},
      createPendingSession: async () => {},
      clearSession: async () => {},
      clearPendingSession: async () => {},
    }));
    const { requireAdmin: rm } = await import('./requireAdmin.js');
    const app = express();
    app.use(cookieParser());
    app.get('/x', rm, (_req, res) => { res.json({ ok: true }); });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    vi.doUnmock('../services/session.js');
  });
});

describe('requireAuth / requireAdmin — happy path (not the catch)', () => {
  // Sanity: with the real session module, unauthenticated requests return 401,
  // not 500.
  it('requireAuth unauthenticated → 401', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/x', requireAuth, (_req, res) => { res.json({ ok: true }); });
    const res = await request(app).get('/x');
    expect(res.status).toBe(401);
  });

  it('requireAdmin unauthenticated → 401', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/x', requireAdmin, (_req, res) => { res.json({ ok: true }); });
    const res = await request(app).get('/x');
    expect(res.status).toBe(401);
  });
});
