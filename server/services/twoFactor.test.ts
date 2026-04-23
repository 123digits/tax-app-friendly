import { describe, it, expect, beforeAll, vi } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { getDb } from '../db/pglite.js';
import { newId } from './crypto.js';
import { issueCode, verifyCode, generateCode, devPeekCode } from './twoFactor.js';
import { hashPassword } from './password.js';

async function seedUser(): Promise<{ id: string; email: string }> {
  const db = await getDb();
  const id = newId();
  const email = `tf_${id.slice(0, 8)}@example.com`;
  await db.query(
    `INSERT INTO users (id, username, email, password_hash) VALUES ($1,$2,$3,$4)`,
    [id, `tf_${id.slice(0, 8)}`, email, await hashPassword('x')],
  );
  return { id, email };
}

beforeAll(async () => {
  await runMigrations();
});

describe('twoFactor', () => {
  it('generateCode returns a 6-digit zero-padded string', () => {
    for (let i = 0; i < 100; i++) {
      const c = generateCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('verifyCode returns ok for the latest issued code and consumes it', async () => {
    const u = await seedUser();
    const code = await issueCode(u.id, 'login');
    expect(await verifyCode(u.id, 'login', code)).toEqual({ ok: true });
    // Already consumed.
    expect((await verifyCode(u.id, 'login', code)).ok).toBe(false);
    expect((await verifyCode(u.id, 'login', code)).reason).toBe('consumed');
  });

  it('returns not_found when no code exists', async () => {
    const u = await seedUser();
    const r = await verifyCode(u.id, 'login', '000000');
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns wrong for a bad code and bumps attempts, locks after max', async () => {
    const u = await seedUser();
    await issueCode(u.id, 'login');
    for (let i = 0; i < 5; i++) {
      const r = await verifyCode(u.id, 'login', '999999');
      expect(r.ok).toBe(false);
    }
    const r = await verifyCode(u.id, 'login', '999999');
    expect(r.reason).toBe('locked');
  });

  it('returns expired after TTL', async () => {
    const u = await seedUser();
    await issueCode(u.id, 'login');
    const db = await getDb();
    await db.query(
      `UPDATE two_factor_codes SET expires_at = now() - interval '1 hour' WHERE user_id = $1`,
      [u.id],
    );
    const r = await verifyCode(u.id, 'login', '000000');
    expect(r.reason).toBe('expired');
  });

  it('devPeekCode returns the cached code in dev and null in prod', async () => {
    const u = await seedUser();
    await issueCode(u.id, 'login');
    const peek = devPeekCode(u.email, 'login');
    expect(peek).toMatch(/^\d{6}$/);
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(devPeekCode(u.email, 'login')).toBeNull();
    process.env.NODE_ENV = prev;
  });

  it('devPeekCode returns null when no code has been issued for the email', () => {
    expect(devPeekCode('never-issued@example.com', 'login')).toBeNull();
  });

  it('devPeekCode returns null once the cached entry has expired', async () => {
    const u = await seedUser();
    await issueCode(u.id, 'login');
    // Confirm it's present.
    expect(devPeekCode(u.email, 'login')).toMatch(/^\d{6}$/);
    // Fast-forward Date.now past the 5-minute TTL.
    const realNow = Date.now;
    const future = realNow() + 1000 * 60 * 10;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(future);
    try {
      expect(devPeekCode(u.email, 'login')).toBeNull();
      // Subsequent peek confirms the entry was deleted (not just detected
      // stale), so the map no-entry branch fires too.
      expect(devPeekCode(u.email, 'login')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
