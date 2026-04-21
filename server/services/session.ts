import type { Response, Request } from 'express';
import { getDb } from '../db/pglite.js';
import { randomTokenHex, sha256Hex } from './crypto.js';

export const SESSION_COOKIE = 'session';
export const PENDING_COOKIE = 'pending_session';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const PENDING_TTL_MS = 1000 * 60 * 10; // 10 min (covers 2FA flow)

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  };
}

async function storeSession(userId: string, kind: 'session' | 'pending', ttlMs: number): Promise<string> {
  const db = await getDb();
  const token = randomTokenHex(32);
  const id = sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.query(
    'INSERT INTO sessions (id, user_id, kind, expires_at) VALUES ($1, $2, $3, $4)',
    [id, userId, kind, expiresAt]
  );
  return token;
}

export async function createSession(res: Response, userId: string): Promise<void> {
  const token = await storeSession(userId, 'session', SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
}

export async function createPendingSession(res: Response, userId: string): Promise<void> {
  const token = await storeSession(userId, 'pending', PENDING_TTL_MS);
  res.cookie(PENDING_COOKIE, token, cookieOptions(PENDING_TTL_MS));
}

export async function clearSession(res: Response, req: Request): Promise<void> {
  const db = await getDb();
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await db.query('DELETE FROM sessions WHERE id = $1', [sha256Hex(token)]);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function clearPendingSession(res: Response, req: Request): Promise<void> {
  const db = await getDb();
  const token = req.cookies?.[PENDING_COOKIE];
  if (token) {
    await db.query("DELETE FROM sessions WHERE id = $1 AND kind = 'pending'", [sha256Hex(token)]);
  }
  res.clearCookie(PENDING_COOKIE, { path: '/' });
}

interface SessionRow {
  id: string;
  user_id: string;
  kind: string;
  expires_at: string;
}

async function lookupSession(
  token: string | undefined,
  kind: 'session' | 'pending'
): Promise<SessionRow | null> {
  if (!token) return null;
  const db = await getDb();
  const id = sha256Hex(token);
  const res = await db.query<SessionRow>(
    'SELECT id, user_id, kind, expires_at FROM sessions WHERE id = $1 AND kind = $2',
    [id, kind]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.query('DELETE FROM sessions WHERE id = $1', [id]);
    return null;
  }
  return row;
}

export async function getUserIdFromSession(req: Request): Promise<string | null> {
  const row = await lookupSession(req.cookies?.[SESSION_COOKIE], 'session');
  return row?.user_id ?? null;
}

export async function getUserIdFromPending(req: Request): Promise<string | null> {
  const row = await lookupSession(req.cookies?.[PENDING_COOKIE], 'pending');
  return row?.user_id ?? null;
}
