import crypto from 'node:crypto';
import { getDb } from '../db/pglite.js';
import { sha256Hex, newId } from './crypto.js';

export type TwoFactorPurpose = 'login' | 'email_verify';

const TTL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_ATTEMPTS = 5;

/** Dev-only in-memory cache of plaintext codes; keyed by `${email}|${purpose}`. */
const devCodeCache: Map<string, { code: string; expiresAt: number }> = new Map();

export function generateCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Creates a new 2FA code for the user + purpose. Any outstanding unconsumed
 * codes for the same (user, purpose) are invalidated so only the latest is usable.
 */
export async function issueCode(userId: string, purpose: TwoFactorPurpose): Promise<string> {
  const db = await getDb();
  const code = generateCode();
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  await db.query(
    'UPDATE two_factor_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL',
    [userId, purpose]
  );
  await db.query(
    `INSERT INTO two_factor_codes (id, user_id, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [newId(), userId, codeHash, purpose, expiresAt]
  );

  if (process.env.NODE_ENV !== 'production') {
    const userRes = await db.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userRes.rows[0]?.email;
    if (email) {
      devCodeCache.set(`${email}|${purpose}`, { code, expiresAt: Date.now() + TTL_MS });
    }
  }

  return code;
}

export interface VerifyResult {
  ok: boolean;
  reason?: 'not_found' | 'expired' | 'consumed' | 'wrong' | 'locked';
}

interface CodeRow {
  id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
}

export async function verifyCode(
  userId: string,
  purpose: TwoFactorPurpose,
  code: string
): Promise<VerifyResult> {
  const db = await getDb();
  const res = await db.query<CodeRow>(
    `SELECT id, code_hash, attempts, expires_at, consumed_at
       FROM two_factor_codes
       WHERE user_id = $1 AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
    [userId, purpose]
  );
  const row = res.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.consumed_at) return { ok: false, reason: 'consumed' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const matches = sha256Hex(code) === row.code_hash;
  if (!matches) {
    await db.query('UPDATE two_factor_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return { ok: false, reason: 'wrong' };
  }
  await db.query('UPDATE two_factor_codes SET consumed_at = now() WHERE id = $1', [row.id]);
  return { ok: true };
}

/** Dev-only helper: reveals the latest issued code for an email + purpose. */
export function devPeekCode(email: string, purpose: TwoFactorPurpose): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  const entry = devCodeCache.get(`${email}|${purpose}`);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    devCodeCache.delete(`${email}|${purpose}`);
    return null;
  }
  return entry.code;
}
