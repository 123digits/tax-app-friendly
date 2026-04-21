import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAdminStore } from './admin';
import { api } from '../api/client';

function mockApi() {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  api.get = vi.fn(async (url: string) => {
    calls.push({ method: 'GET', url });
    if (url === '/api/admin/tax-years') return [{ taxYear: 2025 }];
    if (url === '/api/admin/tax-years/2025') return { taxYear: 2025 };
    return null;
  }) as unknown as typeof api.get;
  api.post = vi.fn(async (url: string, body?: unknown) => {
    calls.push({ method: 'POST', url, body });
    return { ok: true };
  }) as unknown as typeof api.post;
  api.put = vi.fn(async (url: string, body?: unknown) => {
    calls.push({ method: 'PUT', url, body });
    return { ok: true };
  }) as unknown as typeof api.put;
  api.delete = vi.fn(async (url: string) => {
    calls.push({ method: 'DELETE', url });
    return { ok: true };
  }) as unknown as typeof api.delete;
  return calls;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('admin store', () => {
  it('load populates configs', async () => {
    mockApi();
    const s = useAdminStore();
    await s.load();
    expect(s.configs).toEqual([{ taxYear: 2025 }]);
  });

  it('get fetches a year', async () => {
    mockApi();
    const s = useAdminStore();
    const cfg = await s.get(2025);
    expect(cfg.taxYear).toBe(2025);
  });

  it('create posts then reloads', async () => {
    const calls = mockApi();
    const s = useAdminStore();
    await s.create({ taxYear: 2099 } as never);
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
    expect(calls.some((c) => c.method === 'GET')).toBe(true);
  });

  it('save puts then reloads', async () => {
    const calls = mockApi();
    const s = useAdminStore();
    await s.save({ taxYear: 2025 } as never);
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('2025'))).toBe(true);
  });

  it('clone posts then reloads', async () => {
    const calls = mockApi();
    const s = useAdminStore();
    await s.clone(2025, 2099);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/clone'))).toBe(true);
  });

  it('remove deletes then reloads', async () => {
    const calls = mockApi();
    const s = useAdminStore();
    await s.remove(2025);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });
});
