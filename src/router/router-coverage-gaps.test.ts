// Closes the two remaining function-coverage gaps in router/index.ts:
// the lazy `() => import(...)` arrows for the /register route (which
// the main router.test.ts skips because the test user is logged in
// and `/register` redirects away) and for /admin/tax-years/:year
// (which the route-iteration loop skips because its path contains a
// colon). Both arrows must execute at least once before v8 counts
// them as covered.
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import router from './index';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('router lazy-import coverage', () => {
  it('navigates to /register when not logged in (fires the RegisterView lazy import)', async () => {
    // The other router test logs in as admin, so the public-route guard
    // bounces /register away to '/' before the lazy import runs. With no
    // auth user the navigation succeeds and the import arrow executes.
    const auth = useAuthStore();
    auth.user = null;
    await router.push('/register');
    expect(router.currentRoute.value.name).toBe('register');
  });

  it('navigates to /admin/tax-years/:year (fires the TaxYearEditView lazy import)', async () => {
    // The `:year` segment makes this route skipped by the path-filter
    // loop in router.test.ts. Pushing it directly fires the lazy
    // component arrow on the dynamic route.
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'admin', email: 'admin@example.com',
      emailVerified: true, isAdmin: true, createdAt: 'n',
    };
    await router.push('/admin/tax-years/2025');
    expect(router.currentRoute.value.name).toBe('admin-tax-year');
  });
});
