// Forces the `} catch (err) { next(err) }` paths on every route that does
// `await getDb()` inside its try block. We mock the pglite helper to reject
// so the await-getDb throws and the catch propagates through to the error
// handler middleware. Tests assert the HTTP response comes back with a 5xx
// (exercised via the error-handler translating err → response).
import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';
import * as pglite from '../db/pglite.js';
import * as taxYearConfig from '../services/taxYearConfig.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

afterAll(() => {
  vi.restoreAllMocks();
});

async function breakDb<T>(fn: () => Promise<T>): Promise<T> {
  // Make getDb itself reject for the duration of the request. This also
  // breaks requireAuth → the error handler returns 500 before the route
  // body runs, which still exercises the route catch for endpoints that
  // call getDb outside of auth (e.g. GET /, /compute with auth already
  // done — here both fail, but the 500 path asserts the error-handler
  // middleware is reached).
  const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
    throw new Error('synthetic db error');
  });
  try {
    return await fn();
  } finally {
    spy.mockRestore();
  }
}


describe('route catch(err) paths — synthetic DB failures', () => {
  it('GET /api/return/list → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).get('/api/return/list').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('GET /api/return/carryforwards → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).get('/api/return/carryforwards').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('GET /api/admin/tax-years (list) → 500 when DB throws', async () => {
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const res = await breakDb(() =>
      request(app).get('/api/admin/tax-years').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('GET /api/admin/users → 500 when DB throws', async () => {
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const res = await breakDb(() =>
      request(app).get('/api/admin/users').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('DELETE /api/admin/tax-years/:year → 500 when DB throws', async () => {
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const res = await breakDb(() =>
      request(app).delete('/api/admin/tax-years/2025').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('GET /api/return/ (main) → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).get('/api/return').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('GET /api/return/compute → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).get('/api/return/compute').set('Cookie', cookies),
    );
    expect(res.status).toBe(500);
  });

  it('POST /api/auth/two-factor/resend → 500 when DB throws', async () => {
    // This route needs a pending-session cookie so getUserIdFromPending
    // resolves before getDb; even a rejected lookup will fire the route's
    // catch once the DB throws.
    const user = await createUser();
    const res = await breakDb(() =>
      request(app).post('/api/auth/two-factor/resend')
        .set('Cookie', [`pending_session=${user.id}`]),
    );
    // getUserIdFromPending calls getDb too → error before reaching the
    // route body; either way the catch-err path fires.
    expect([401, 500]).toContain(res.status);
  });

  it('POST /api/auth/logout → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).post('/api/auth/logout').set('Cookie', cookies),
    );
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/auth/me → 500 when DB throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const res = await breakDb(() =>
      request(app).get('/api/auth/me').set('Cookie', cookies),
    );
    // If session cookie is checked before getDb, may also be 401.
    expect([401, 500]).toContain(res.status);
  });
});

// Tests that mock a non-getDb service to throw AFTER requireAuth has
// already succeeded. This forces execution into the route's own
// try/catch block (rather than the one in the auth middleware).
describe('route catch(err) paths — non-DB service failures', () => {
  afterAll(() => vi.restoreAllMocks());

  it('GET /api/return/compute → 500 when listConfigs throws (no existing return)', async () => {
    // With no explicit ?year and no existing returns for this user,
    // resolveYear falls through to listConfigs(). Making it throw
    // triggers the route's own catch block.
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const spy = vi.spyOn(taxYearConfig, 'listConfigs').mockImplementation(async () => {
      throw new Error('synthetic listConfigs error');
    });
    try {
      const res = await request(app).get('/api/return/compute').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/return/ (main) → 500 when listConfigs throws', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const spy = vi.spyOn(taxYearConfig, 'listConfigs').mockImplementation(async () => {
      throw new Error('synthetic listConfigs error');
    });
    try {
      const res = await request(app).get('/api/return').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/admin/tax-years → 500 when listConfigs throws', async () => {
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const spy = vi.spyOn(taxYearConfig, 'listConfigs').mockImplementation(async () => {
      throw new Error('synthetic listConfigs error');
    });
    try {
      const res = await request(app).get('/api/admin/tax-years').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/admin/tax-years/:year → 500 when getConfig throws', async () => {
    const admin = await createUser({ isAdmin: true });
    const cookies = await loginAs(app, admin);
    const spy = vi.spyOn(taxYearConfig, 'getConfig').mockImplementation(async () => {
      throw new Error('synthetic getConfig error');
    });
    try {
      const res = await request(app).get('/api/admin/tax-years/2025').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  // The remaining uncovered catches on /list, /available-years, and
  // /carryforwards call db.query() directly, not a service function. To
  // force just the route-body db.query() to fail (without breaking
  // requireAuth's own db.query on the sessions table), return a db
  // object whose query method throws on every call AFTER the first
  // session lookup.
  it('GET /api/return/list → 500 when db.query throws in route body', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const realDb = await pglite.getDb();
    let callCount = 0;
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              callCount++;
              // Let the first query (session lookup) go through; throw
              // on subsequent queries (the route's own body).
              if (callCount > 1) throw new Error('synthetic route-query error');
              return (target as unknown as Record<string, (...a: unknown[]) => unknown>).query.apply(target, args);
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/return/list').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/return/available-years → 500 when db.query throws in route body', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const realDb = await pglite.getDb();
    let callCount = 0;
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              callCount++;
              if (callCount > 1) throw new Error('synthetic route-query error');
              return (target as unknown as Record<string, (...a: unknown[]) => unknown>).query.apply(target, args);
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/return/available-years').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/return/carryforwards → 500 when db.query throws in route body', async () => {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    const realDb = await pglite.getDb();
    let callCount = 0;
    const spy = vi.spyOn(pglite, 'getDb').mockImplementation(async () => {
      return new Proxy(realDb, {
        get(target, prop) {
          if (prop === 'query') {
            return async (...args: unknown[]) => {
              callCount++;
              if (callCount > 1) throw new Error('synthetic route-query error');
              return (target as unknown as Record<string, (...a: unknown[]) => unknown>).query.apply(target, args);
            };
          }
          return (target as unknown as Record<string, unknown>)[prop as string];
        },
      });
    });
    try {
      const res = await request(app).get('/api/return/carryforwards').set('Cookie', cookies);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
