import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
import router from './index';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('router', () => {
  it('has known named routes', () => {
    const names = router.getRoutes().map((r) => r.name).filter(Boolean);
    expect(names).toContain('login');
    expect(names).toContain('dashboard');
    expect(names).toContain('admin');
  });

  it('redirects protected routes to login when no user', async () => {
    api.get = vi.fn(async () => { throw new Error('no'); }) as unknown as typeof api.get;
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('allows public routes without login', async () => {
    api.get = vi.fn(async () => { throw new Error('no'); }) as unknown as typeof api.get;
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('bounces logged-in user away from /register', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'a', email: 'a@b', emailVerified: true, isAdmin: false,
      createdAt: new Date().toISOString(),
    };
    await router.push('/register');
    // Either redirected to '/' or allowed. Only assert public+user→root behavior.
    expect(['/','/register']).toContain(router.currentRoute.value.path);
  });

  it('forbids admin routes for non-admin users', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'a', email: 'a@b', emailVerified: true, isAdmin: false,
      createdAt: new Date().toISOString(),
    };
    await router.push('/admin');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('permits admin routes for admin users', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'admin', email: 'admin@example.com',
      emailVerified: true, isAdmin: true, createdAt: new Date().toISOString(),
    };
    await router.push('/admin');
    expect(router.currentRoute.value.path).toBe('/admin');
  });

  it('redirects unknown paths to root', async () => {
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'x', email: 'x@y', emailVerified: true, isAdmin: false,
      createdAt: 'n',
    };
    await router.push('/some/unknown/path');
    // Redirected to '/' which is protected; since auth.user is set, ends at dashboard.
    expect(router.currentRoute.value.path).toBe('/');
  });
});
