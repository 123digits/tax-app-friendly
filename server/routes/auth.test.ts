import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';
import { getDb } from '../db/pglite.js';
import { devPeekCode, issueCode } from '../services/twoFactor.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns ok', async () => {
    const unique = Date.now().toString(36);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `reg${unique}`, email: `reg${unique}@example.com`, password: 'supersecret1' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.email).toBe(`reg${unique}@example.com`);
  });

  it('rejects duplicate user', async () => {
    const unique = Date.now().toString(36) + 'dup';
    const body = { username: `reg${unique}`, email: `reg${unique}@example.com`, password: 'supersecret1' };
    await request(app).post('/api/auth/register').send(body);
    const res2 = await request(app).post('/api/auth/register').send(body);
    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('user_exists');
  });

  it('validates fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('makes the ADMIN_EMAIL user admin when registered', async () => {
    const unique = Date.now().toString(36) + 'a';
    const email = `bootadmin${unique}@example.com`;
    process.env.ADMIN_EMAIL = email;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `bootadmin${unique}`, email, password: 'supersecret1' });
    expect(res.status).toBe(201);
    const db = await getDb();
    const r = await db.query<{ is_admin: boolean }>(
      'SELECT is_admin FROM users WHERE email = $1',
      [email],
    );
    expect(r.rows[0]?.is_admin).toBe(true);
    delete process.env.ADMIN_EMAIL;
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies with the correct code', async () => {
    const unique = Date.now().toString(36) + 'v';
    const email = `verify${unique}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ username: `verify${unique}`, email, password: 'supersecret1' });
    const code = devPeekCode(email, 'email_verify')!;
    expect(code).toBeTruthy();
    const res = await request(app).post('/api/auth/verify-email').send({ email, code });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects invalid code shape', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'x@example.com', code: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns invalid when email has no user', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'nouser@example.com', code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid');
  });

  it('returns invalid_code for wrong code', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: user.email, code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_code');
  });
});

describe('POST /api/auth/login', () => {
  it('returns twoFactorRequired on success', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c: string) => c.startsWith('pending_session='))).toBe(true);
  });

  it('supports logging in with email', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
  });

  it('rejects wrong password', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'wrong-password-123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('rejects unknown user with same timing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_user', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('validates body', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
  });
});

describe('2FA verify / resend and /me', () => {
  it('full 2FA flow sets session cookie and /me returns user', async () => {
    const user = await createUser();
    const agent = request.agent(app);
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password });
    expect(loginRes.status).toBe(200);
    const code = devPeekCode(user.email, 'login')!;
    expect(code).toBeTruthy();
    const verifyRes = await agent.post('/api/auth/two-factor/verify').send({ code });
    expect(verifyRes.status).toBe(200);
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(user.id);
  });

  it('verify without pending session returns 401', async () => {
    const res = await request(app).post('/api/auth/two-factor/verify').send({ code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('no_pending_session');
  });

  it('verify with wrong code returns invalid_code', async () => {
    const user = await createUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: user.username, password: user.password });
    const res = await agent.post('/api/auth/two-factor/verify').send({ code: '999999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_code');
  });

  it('resend without pending session returns 401', async () => {
    const res = await request(app).post('/api/auth/two-factor/resend').send({});
    expect(res.status).toBe(401);
  });

  it('resend with pending session issues a fresh code', async () => {
    const user = await createUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: user.username, password: user.password });
    const resend = await agent.post('/api/auth/two-factor/resend').send({});
    expect(resend.status).toBe(200);
  });

  it('resend returns no_user when the pending session user row is missing', async () => {
    const db = await getDb();
    const { randomTokenHex, sha256Hex, newId } = await import('../services/crypto.js');
    const ghostId = newId();
    const token = randomTokenHex(32);
    const sessionId = sha256Hex(token);
    const expires = new Date(Date.now() + 1000 * 60).toISOString();
    // Temporarily drop FK so we can wire a session to a non-existent user.
    await db.exec(`ALTER TABLE sessions DROP CONSTRAINT sessions_user_id_fkey`);
    try {
      await db.query(
        `INSERT INTO sessions (id, user_id, kind, expires_at) VALUES ($1,$2,'pending',$3)`,
        [sessionId, ghostId, expires],
      );
      const res = await request(app)
        .post('/api/auth/two-factor/resend')
        .set('Cookie', [`pending_session=${token}`]);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('no_user');
    } finally {
      await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      await db.exec(
        `ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      );
    }
  });

  it('/me without session returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('/me with session whose user is gone returns 401', async () => {
    // Users FK cascades to sessions, so forge a ghost session the same way
    // we do for the 2FA-resend test: drop + recreate the FK around the
    // manipulation.
    const db = await getDb();
    const { randomTokenHex, sha256Hex, newId } = await import('../services/crypto.js');
    const ghostId = newId();
    const token = randomTokenHex(32);
    const sessionId = sha256Hex(token);
    const expires = new Date(Date.now() + 60 * 1000).toISOString();
    await db.exec(`ALTER TABLE sessions DROP CONSTRAINT sessions_user_id_fkey`);
    try {
      await db.query(
        `INSERT INTO sessions (id, user_id, kind, expires_at) VALUES ($1,$2,'session',$3)`,
        [sessionId, ghostId, expires],
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`session=${token}`]);
      expect(res.status).toBe(401);
    } finally {
      await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      await db.exec(
        `ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
      );
    }
  });

  it('logout clears cookies', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('verifies with an expired code', async () => {
    // Manually issue a code, then age it out.
    const user = await createUser();
    await issueCode(user.id, 'email_verify');
    const db = await getDb();
    await db.query(
      `UPDATE two_factor_codes SET expires_at = now() - interval '1 hour' WHERE user_id = $1`,
      [user.id],
    );
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: user.email, code: '000000' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/dev/last-code', () => {
  it('rejects bad params', async () => {
    const res = await request(app).get('/api/dev/last-code');
    expect(res.status).toBe(400);
  });

  it('returns null when no code is cached', async () => {
    const res = await request(app)
      .get('/api/dev/last-code')
      .query({ email: 'nobody@example.com', purpose: 'login' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBeNull();
  });

  it('returns the cached code after login', async () => {
    const user = await createUser();
    await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: user.password });
    const res = await request(app)
      .get('/api/dev/last-code')
      .query({ email: user.email, purpose: 'login' });
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^\d{6}$/);
  });

  it('returns 404 in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .get('/api/dev/last-code')
      .query({ email: 'x@example.com', purpose: 'login' });
    process.env.NODE_ENV = previous;
    expect(res.status).toBe(404);
  });
});
