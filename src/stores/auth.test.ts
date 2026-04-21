import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';
import { api } from '../api/client';

function mockApi() {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  api.get = vi.fn(async (url: string) => {
    calls.push({ method: 'GET', url });
    if (url === '/api/auth/me') return { user: { id: 'u', username: 'x', email: 'x@y', emailVerified: true, isAdmin: false, createdAt: 'now' } };
    return null;
  }) as unknown as typeof api.get;
  api.post = vi.fn(async (url: string, body?: unknown) => {
    calls.push({ method: 'POST', url, body });
    if (url === '/api/auth/login') return { ok: true, twoFactorRequired: true, email: 'x@y' };
    return { ok: true };
  }) as unknown as typeof api.post;
  return calls;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('auth store', () => {
  it('fetchMe sets user on success', async () => {
    mockApi();
    const s = useAuthStore();
    await s.fetchMe();
    expect(s.user?.id).toBe('u');
  });

  it('fetchMe clears user on error', async () => {
    api.get = vi.fn(async () => { throw new Error('no'); }) as unknown as typeof api.get;
    const s = useAuthStore();
    await s.fetchMe();
    expect(s.user).toBeNull();
  });

  it('register records the pending email', async () => {
    mockApi();
    const s = useAuthStore();
    await s.register('u', 'a@b.com', 'pw123456789');
    expect(s.pendingEmail).toBe('a@b.com');
  });

  it('verifyEmail calls the endpoint', async () => {
    const calls = mockApi();
    const s = useAuthStore();
    await s.verifyEmail('a@b.com', '123456');
    expect(calls.find((c) => c.url === '/api/auth/verify-email')).toBeTruthy();
  });

  it('login sets twoFactorPending and email', async () => {
    mockApi();
    const s = useAuthStore();
    const r = await s.login('u', 'pw');
    expect(r.twoFactorRequired).toBe(true);
    expect(s.twoFactorPending).toBe(true);
    expect(s.pendingEmail).toBe('x@y');
  });

  it('login that does not require 2FA does not set pending', async () => {
    api.get = vi.fn(async () => ({ user: { id: 'u', username: 'x', email: 'x@y', emailVerified: true, isAdmin: false, createdAt: 'n' } })) as unknown as typeof api.get;
    api.post = vi.fn(async () => ({ ok: true, twoFactorRequired: false, email: 'x@y' })) as unknown as typeof api.post;
    const s = useAuthStore();
    await s.login('u', 'pw');
    expect(s.twoFactorPending).toBe(false);
  });

  it('verifyTwoFactor clears pending and fetches user', async () => {
    mockApi();
    const s = useAuthStore();
    s.twoFactorPending = true;
    s.pendingEmail = 'x@y';
    await s.verifyTwoFactor('123456');
    expect(s.twoFactorPending).toBe(false);
    expect(s.pendingEmail).toBeNull();
    expect(s.user?.id).toBe('u');
  });

  it('resendTwoFactor calls the endpoint', async () => {
    const calls = mockApi();
    const s = useAuthStore();
    await s.resendTwoFactor();
    expect(calls.find((c) => c.url === '/api/auth/two-factor/resend')).toBeTruthy();
  });

  it('logout clears user', async () => {
    mockApi();
    const s = useAuthStore();
    s.user = { id: 'u' } as never;
    await s.logout();
    expect(s.user).toBeNull();
  });
});
