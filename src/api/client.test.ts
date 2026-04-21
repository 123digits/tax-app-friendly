import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './client';

function mockFetch(response: {
  status?: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
  contentType?: string;
}) {
  const r = {
    status: response.status ?? 200,
    ok: response.ok ?? true,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? (response.contentType ?? 'application/json') : null,
    },
    json: response.json ?? (async () => ({ ok: true })),
  };
  (globalThis as { fetch: unknown }).fetch = vi.fn().mockResolvedValue(r);
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('GETs and parses JSON', async () => {
    const fetchMock = mockFetch({ json: async () => ({ hello: 'world' }) });
    const res = await api.get<{ hello: string }>('/api/x');
    expect(res.hello).toBe('world');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('POSTs JSON body', async () => {
    const fetchMock = mockFetch({});
    await api.post('/api/x', { a: 1 });
    expect(fetchMock).toHaveBeenCalled();
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('PUTs with default empty body', async () => {
    const fetchMock = mockFetch({});
    await api.put('/api/x');
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.body).toBe(JSON.stringify({}));
  });

  it('DELETEs without body', async () => {
    const fetchMock = mockFetch({});
    await api.delete('/api/x');
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.body).toBeUndefined();
  });

  it('returns null for non-JSON response', async () => {
    mockFetch({ contentType: 'text/plain' });
    const r = await api.get<null>('/api/x');
    expect(r).toBeNull();
  });

  it('throws ApiError on non-ok with message from body', async () => {
    mockFetch({ status: 400, ok: false, json: async () => ({ error: 'bad_request' }) });
    await expect(api.get('/api/x')).rejects.toThrow(/bad_request/);
  });

  it('throws ApiError on non-ok without body', async () => {
    mockFetch({ status: 500, ok: false, contentType: 'text/plain' });
    await expect(api.get('/api/x')).rejects.toThrow(/Request failed/);
  });

  it('throws ApiError with generic message when body has no error field', async () => {
    mockFetch({ status: 500, ok: false, json: async () => ({}) });
    await expect(api.get('/api/x')).rejects.toThrow(/Request failed/);
  });

  it('falls back to null when JSON parsing fails', async () => {
    mockFetch({ json: async () => { throw new Error('bad json'); } });
    const r = await api.get<unknown>('/api/x');
    expect(r).toBeNull();
  });
});
