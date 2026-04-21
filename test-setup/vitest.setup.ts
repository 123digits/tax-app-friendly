// Shared test environment setup.
import crypto from 'node:crypto';

// Deterministic dev encryption key so encryptField/decryptField work in tests.
if (!process.env.DATA_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY.length !== 64) {
  process.env.DATA_ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update('test-fixture-key')
    .digest('hex');
}
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Suppress console noise during tests unless DEBUG_TESTS=1.
if (!process.env.DEBUG_TESTS) {
  const noop = () => undefined;
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.warn = noop;
  // eslint-disable-next-line no-console
  console.error = noop;
}

// jsdom's URL lacks createObjectURL in some Vuetify code paths.
if (typeof globalThis.URL !== 'undefined' && !('createObjectURL' in globalThis.URL)) {
  (globalThis.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
}

// ResizeObserver/IntersectionObserver stubs Vuetify occasionally reaches for.
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
for (const name of ['ResizeObserver', 'IntersectionObserver', 'MutationObserver'] as const) {
  if (!(name in globalThis)) {
    (globalThis as unknown as Record<string, unknown>)[name] = StubObserver;
  }
}

// Provide a default `fetch` stub that returns an empty-but-valid JSON response.
// Individual tests can still override it.
if (typeof globalThis.fetch === 'undefined' || (globalThis.fetch as { _stub?: boolean })?._stub) {
  const stub = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
  });
  (stub as unknown as { _stub: boolean })._stub = true;
  (globalThis as unknown as { fetch: typeof stub }).fetch = stub;
}

if (typeof globalThis.matchMedia === 'undefined' && typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
}
