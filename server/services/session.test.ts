import { describe, it, expect, beforeAll } from 'vitest';
import type { Request, Response } from 'express';
import { runMigrations } from '../db/migrate.js';
import { getDb } from '../db/pglite.js';
import { newId, randomTokenHex, sha256Hex } from './crypto.js';
import { hashPassword } from './password.js';
import {
  SESSION_COOKIE,
  PENDING_COOKIE,
  createSession,
  createPendingSession,
  clearSession,
  clearPendingSession,
  getUserIdFromSession,
  getUserIdFromPending,
} from './session.js';

interface FakeRes {
  cookies: Record<string, { value: string; opts: unknown }>;
  cleared: string[];
  cookie: (name: string, value: string, opts?: unknown) => FakeRes;
  clearCookie: (name: string, opts?: unknown) => FakeRes;
}

function mkRes(): FakeRes {
  const res = {
    cookies: {} as Record<string, { value: string; opts: unknown }>,
    cleared: [] as string[],
  } as FakeRes;
  res.cookie = function (name: string, value: string, opts?: unknown) {
    this.cookies[name] = { value, opts };
    return this;
  };
  res.clearCookie = function (name: string, _opts?: unknown) {
    this.cleared.push(name);
    return this;
  };
  return res;
}

async function seedUser() {
  const db = await getDb();
  const id = newId();
  await db.query(
    `INSERT INTO users (id, username, email, password_hash) VALUES ($1,$2,$3,$4)`,
    [id, `s_${id.slice(0, 8)}`, `s_${id.slice(0, 8)}@example.com`, await hashPassword('x')],
  );
  return id;
}

beforeAll(async () => {
  await runMigrations();
});

describe('session', () => {
  it('creates and reads a session', async () => {
    const uid = await seedUser();
    const res = mkRes();
    await createSession(res as unknown as Response, uid);
    const token = res.cookies[SESSION_COOKIE].value;
    const req = { cookies: { [SESSION_COOKIE]: token } } as unknown as Request;
    expect(await getUserIdFromSession(req)).toBe(uid);
  });

  it('creates and reads a pending session', async () => {
    const uid = await seedUser();
    const res = mkRes();
    await createPendingSession(res as unknown as Response, uid);
    const token = res.cookies[PENDING_COOKIE].value;
    const req = { cookies: { [PENDING_COOKIE]: token } } as unknown as Request;
    expect(await getUserIdFromPending(req)).toBe(uid);
  });

  it('returns null for missing cookie', async () => {
    const req = { cookies: {} } as unknown as Request;
    expect(await getUserIdFromSession(req)).toBeNull();
    expect(await getUserIdFromPending(req)).toBeNull();
  });

  it('returns null when session is unknown', async () => {
    const req = { cookies: { [SESSION_COOKIE]: 'notatoken' } } as unknown as Request;
    expect(await getUserIdFromSession(req)).toBeNull();
  });

  it('returns null for expired session and deletes it', async () => {
    const uid = await seedUser();
    const db = await getDb();
    const token = randomTokenHex(16);
    const id = sha256Hex(token);
    const expired = new Date(Date.now() - 1000).toISOString();
    await db.query(
      `INSERT INTO sessions (id, user_id, kind, expires_at) VALUES ($1,$2,'session',$3)`,
      [id, uid, expired],
    );
    const req = { cookies: { [SESSION_COOKIE]: token } } as unknown as Request;
    expect(await getUserIdFromSession(req)).toBeNull();
    const check = await db.query(`SELECT id FROM sessions WHERE id = $1`, [id]);
    expect(check.rows.length).toBe(0);
  });

  it('clearSession and clearPendingSession clear cookies even when no token present', async () => {
    const res = mkRes();
    const req = { cookies: {} } as unknown as Request;
    await clearSession(res as unknown as Response, req);
    await clearPendingSession(res as unknown as Response, req);
    expect(res.cleared).toContain(SESSION_COOKIE);
    expect(res.cleared).toContain(PENDING_COOKIE);
  });

  it('clearSession deletes the session row when token provided', async () => {
    const uid = await seedUser();
    const res = mkRes();
    await createSession(res as unknown as Response, uid);
    const token = res.cookies[SESSION_COOKIE].value;
    const req = { cookies: { [SESSION_COOKIE]: token } } as unknown as Request;
    const res2 = mkRes();
    await clearSession(res2 as unknown as Response, req);
    expect(res2.cleared).toContain(SESSION_COOKIE);
    expect(await getUserIdFromSession(req)).toBeNull();
  });

  it('clearPendingSession deletes a pending row when token provided', async () => {
    const uid = await seedUser();
    const res = mkRes();
    await createPendingSession(res as unknown as Response, uid);
    const token = res.cookies[PENDING_COOKIE].value;
    const req = { cookies: { [PENDING_COOKIE]: token } } as unknown as Request;
    const res2 = mkRes();
    await clearPendingSession(res2 as unknown as Response, req);
    expect(await getUserIdFromPending(req)).toBeNull();
  });

  it('sets secure cookie when NODE_ENV is production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const uid = await seedUser();
      const res = mkRes();
      await createSession(res as unknown as Response, uid);
      const opts = res.cookies[SESSION_COOKIE].opts as { secure: boolean };
      expect(opts.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
