import type { Express } from 'express';
import request from 'supertest';
import { getDb } from '../db/pglite.js';
import { runMigrations } from '../db/migrate.js';
import { createApp } from '../app.js';
import { newId } from '../services/crypto.js';
import { hashPassword } from '../services/password.js';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

let bootstrapped = false;

export async function bootstrap(): Promise<Express> {
  if (!bootstrapped) {
    await runMigrations();
    bootstrapped = true;
  }
  return createApp();
}

export async function createUser(opts: { isAdmin?: boolean; emailVerified?: boolean } = {}): Promise<TestUser> {
  await bootstrap();
  const db = await getDb();
  const id = newId();
  const username = `user_${id.slice(0, 8)}`;
  const email = `${username}@example.com`;
  // Fixture credential for throwaway test users; never a real secret and
  // never leaves the in-memory test DB.
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords
  const password = 'testpw12345';
  const hash = await hashPassword(password);
  await db.query(
    `INSERT INTO users (id, username, email, password_hash, email_verified, is_admin)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, username, email, hash, opts.emailVerified ?? true, opts.isAdmin ?? false],
  );
  return { id, username, email, password, isAdmin: !!opts.isAdmin };
}

// `app` is accepted for API parity with other helpers (callers pass their
// booted app so fixtures can later switch to going through supertest instead
// of direct DB seeding); the current implementation short-circuits via the
// DB.
export async function loginAs(_app: Express, user: TestUser): Promise<string[]> {
  const { randomTokenHex, sha256Hex } = await import('../services/crypto.js');
  const token = randomTokenHex(32);
  const sessionId = sha256Hex(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const db = await getDb();
  await db.query(
    `INSERT INTO sessions (id, user_id, kind, expires_at) VALUES ($1,$2,'session',$3)`,
    [sessionId, user.id, expires],
  );
  return [`session=${token}; Path=/; HttpOnly`];
}

export async function authedAgent(app: Express, user: TestUser) {
  const cookies = await loginAs(app, user);
  const agent = request(app);
  return { agent, cookies };
}
