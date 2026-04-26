// Targeted route-level tests to close 100%-coverage gaps that the
// existing integration suites don't reach. Each `it` exercises a
// specific defensive branch — the registration-bootstrap `?? 0`,
// the GET /admin/users route's own `} catch (err)` block, and the
// `isoDate(...)` ISO-string fast path.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';
import * as pglite from '../db/pglite.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('POST /api/auth/register — count-rows fallback', () => {
  it('treats an empty count() result as a fresh DB and grants admin', async () => {
    // Force `countRes.rows` to be empty so `rows[0]?.c` evaluates
    // undefined and the `?? 0` fallback fires (line 86 of auth.ts).
    const realDb = await pglite.getDb();
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (sql: string, params?: unknown[]) => {
              if (typeof sql === 'string' && sql.includes("count(*)::int as c FROM users")) {
                return { rows: [], affectedRows: 0, fields: [] } as never;
              }
              return (target as unknown as { query: (s: string, p?: unknown[]) => Promise<unknown> })
                .query(sql, params);
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: `cov_${Date.now().toString(36)}`,
          email: `cov_${Date.now().toString(36)}@example.com`,
          password: 'password1234',
        });
      expect(res.status).toBe(201);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET /api/admin/users — route-body catch', () => {
  it('reaches the route-body try/catch when db.query throws on the second call', async () => {
    // requireAdmin runs db.query (session+user lookup) before reaching
    // the route body. We let the first few queries through (so admin
    // auth succeeds) and only throw on the SELECT against `users` that
    // the route body issues.
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const realDb = await pglite.getDb();
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (sql: string, params?: unknown[]) => {
              if (
                typeof sql === 'string' &&
                sql.includes('SELECT id, username, email, email_verified, is_admin')
              ) {
                throw new Error('synthetic users-query failure');
              }
              return (target as unknown as { query: (s: string, p?: unknown[]) => Promise<unknown> })
                .query(sql, params);
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/admin/users').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET /api/return — isoDate handles Date-typed and string columns', () => {
  it('formats a Date-typed date column to YYYY-MM-DD via toISOString slice', async () => {
    // PGlite sometimes hands back Date objects for date/timestamp
    // columns; isoDate(...) must call toISOString().slice(0, 10) on
    // those (line 159 of taxReturn.ts) rather than String(v).slice.
    const user = await createUser();
    const cookies = await loginAs(app, user);
    await request(app).post('/api/return/create').set('Cookie', cookies).send({});
    // Save a personal_info row so loadFullReturn pulls it in via isoDate(piRow.dob).
    const putRes = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({ dob: '1980-01-01', spouseDob: '1982-02-02' });
    expect(putRes.status).toBe(200);
    const realDb = await pglite.getDb();
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              const result = await (target as unknown as {
                query: (...a: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
              }).query.apply(target, args);
              const sql = args[0];
              if (typeof sql === 'string' && sql.includes('FROM personal_info')) {
                for (const row of result.rows) {
                  // Force the date columns to be Date instances regardless
                  // of what PGlite returned (string or Date) so isoDate()
                  // hits the `v instanceof Date` branch.
                  row.dob = new Date('1980-01-01T00:00:00Z');
                  row.spouse_dob = new Date('1982-02-02T00:00:00Z');
                }
              }
              return result;
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/return').set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.body.personalInfo?.dob).toBe('1980-01-01');
      expect(res.body.personalInfo?.spouseDob).toBe('1982-02-02');
    } finally {
      spy.mockRestore();
    }
  });

  it('falls through to String(v).slice for non-Date date column values', async () => {
    // Exercise the second branch of isoDate by ensuring piRow.dob is a
    // plain string ISO date (the normal PGlite return shape).
    const user = await createUser();
    const cookies = await loginAs(app, user);
    await request(app).post('/api/return/create').set('Cookie', cookies).send({});
    const putRes = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({ dob: '1990-06-15' });
    expect(putRes.status).toBe(200);
    const realDb = await pglite.getDb();
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              const result = await (target as unknown as {
                query: (...a: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
              }).query.apply(target, args);
              const sql = args[0];
              if (typeof sql === 'string' && sql.includes('FROM personal_info')) {
                for (const row of result.rows) {
                  // Force the dob to be a string with a timezone suffix so
                  // String(v).slice(0, 10) is the correct path.
                  row.dob = '1990-06-15T00:00:00Z';
                }
              }
              return result;
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/return').set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.body.personalInfo?.dob).toBe('1990-06-15');
    } finally {
      spy.mockRestore();
    }
  });
});
