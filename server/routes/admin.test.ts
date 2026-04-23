import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';
import { getConfig } from '../services/taxYearConfig.js';
import { getDb } from '../db/pglite.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

async function adminCookies() {
  const admin = await createUser({ isAdmin: true });
  const cookies = await loginAs(app, admin);
  return { admin, cookies };
}

describe('admin routes auth guard', () => {
  it('blocks unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/tax-years');
    expect(res.status).toBe(401);
  });

  it('blocks non-admin', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await request(app).get('/api/admin/tax-years').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/tax-years', () => {
  it('lists configured years', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app).get('/api/admin/tax-years').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((c: { taxYear: number }) => c.taxYear === 2025)).toBeTruthy();
  });
});

describe('GET /api/admin/tax-years/:year', () => {
  it('returns the configured year', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app).get('/api/admin/tax-years/2025').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.taxYear).toBe(2025);
  });

  it('returns 404 for unknown year', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app).get('/api/admin/tax-years/1899').set('Cookie', cookies);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/tax-years/:year', () => {
  it('upserts a config', async () => {
    const { cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const res = await request(app)
      .put('/api/admin/tax-years/2025')
      .set('Cookie', cookies)
      .send({ ...base, notes: 'roundtripped', taxYear: 2025 });
    expect(res.status).toBe(200);
    const reloaded = await getConfig(2025);
    expect(reloaded?.notes).toBe('roundtripped');
  });

  it('upserts a config with notes + eitcInvestmentIncomeLimit cleared', async () => {
    // Exercises the `?? null` save-side fallbacks for nullable scalar columns.
    const { cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const stripped = { ...base, taxYear: 2025 } as Partial<typeof base>;
    delete stripped.notes;
    delete stripped.eitcInvestmentIncomeLimit;
    const res = await request(app)
      .put('/api/admin/tax-years/2025')
      .set('Cookie', cookies)
      .send(stripped);
    expect(res.status).toBe(200);
  });
});

async function findUnusedYear(start = 2200): Promise<number> {
  let y = start;
  while (await getConfig(y)) y--;
  return y;
}

describe('POST /api/admin/tax-years', () => {
  it('creates a new year', async () => {
    const { cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const y = await findUnusedYear(2199);
    const res = await request(app)
      .post('/api/admin/tax-years')
      .set('Cookie', cookies)
      .send({ ...base, taxYear: y });
    expect(res.status).toBe(201);
  });

  it('rejects when year already exists', async () => {
    const { cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const res = await request(app)
      .post('/api/admin/tax-years')
      .set('Cookie', cookies)
      .send({ ...base, taxYear: 2025 });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/tax-years/clone', () => {
  it('clones to a new year', async () => {
    const { cookies } = await adminCookies();
    const y = await findUnusedYear(2198);
    const res = await request(app)
      .post('/api/admin/tax-years/clone')
      .set('Cookie', cookies)
      .send({ sourceYear: 2025, targetYear: y });
    expect(res.status).toBe(201);
    const cfg = await getConfig(y);
    expect(cfg?.taxYear).toBe(y);
  });

  it('rejects same-year clone', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app)
      .post('/api/admin/tax-years/clone')
      .set('Cookie', cookies)
      .send({ sourceYear: 2025, targetYear: 2025 });
    expect(res.status).toBe(400);
  });

  it('rejects when target already exists', async () => {
    const { cookies } = await adminCookies();
    // Clone into 2025 which already exists.
    const res = await request(app)
      .post('/api/admin/tax-years/clone')
      .set('Cookie', cookies)
      .send({ sourceYear: 2024, targetYear: 2025 });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/admin/tax-years/:year', () => {
  it('deletes a year when unused', async () => {
    const { cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const y = await findUnusedYear(2197);
    await request(app).post('/api/admin/tax-years').set('Cookie', cookies).send({ ...base, taxYear: y });
    const res = await request(app).delete(`/api/admin/tax-years/${y}`).set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('rejects deleting a year in use by an existing return', async () => {
    const { admin, cookies } = await adminCookies();
    const base = (await getConfig(2025))!;
    const y = await findUnusedYear(2196);
    await request(app).post('/api/admin/tax-years').set('Cookie', cookies).send({ ...base, taxYear: y });
    const db = await getDb();
    const { newId } = await import('../services/crypto.js');
    await db.query(
      `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1,$2,$3)`,
      [newId(), admin.id, y],
    );
    const res = await request(app).delete(`/api/admin/tax-years/${y}`).set('Cookie', cookies);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('in_use');
  });
});

describe('admin /users and /users/:id/admin', () => {
  it('lists users', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app).get('/api/admin/users').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('promotes and demotes an existing user', async () => {
    const { cookies } = await adminCookies();
    const other = await createUser();
    const res = await request(app)
      .put(`/api/admin/users/${other.id}/admin`)
      .set('Cookie', cookies)
      .send({ isAdmin: true });
    expect(res.status).toBe(200);

    const res2 = await request(app)
      .put(`/api/admin/users/${other.id}/admin`)
      .set('Cookie', cookies)
      .send({ isAdmin: false });
    expect(res2.status).toBe(200);
  });

  it('validates body for PUT /users/:id/admin', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app)
      .put('/api/admin/users/abc/admin')
      .set('Cookie', cookies)
      .send({ isAdmin: 'not-a-bool' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });

  it('validates body for POST /tax-years', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app)
      .post('/api/admin/tax-years')
      .set('Cookie', cookies)
      .send({ taxYear: 'not-a-year' });
    expect(res.status).toBe(400);
  });

  it('validates body for PUT /tax-years/:year', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app)
      .put('/api/admin/tax-years/2025')
      .set('Cookie', cookies)
      .send({ notes: 'not a full config' });
    expect(res.status).toBe(400);
  });

  it('validates body for POST /tax-years/clone', async () => {
    const { cookies } = await adminCookies();
    const res = await request(app)
      .post('/api/admin/tax-years/clone')
      .set('Cookie', cookies)
      .send({ sourceYear: 'x' });
    expect(res.status).toBe(400);
  });

  it('refuses to demote the last admin', async () => {
    // Use a unique data setup: make sure only one admin exists.
    const db = await getDb();
    await db.query(`UPDATE users SET is_admin = false`);
    const soloAdmin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, soloAdmin);

    const res = await request(app)
      .put(`/api/admin/users/${soloAdmin.id}/admin`)
      .set('Cookie', cookies)
      .send({ isAdmin: false });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('last_admin');
  });
});
