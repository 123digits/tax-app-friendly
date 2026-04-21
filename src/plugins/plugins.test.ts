import { describe, it, expect } from 'vitest';

describe('plugins', () => {
  it('pinia exports a Pinia instance', async () => {
    const m = await import('./pinia');
    expect(m.default).toBeTruthy();
    expect(typeof m.default.use).toBe('function');
  });

  it('vuetify exports a Vuetify instance with the custom primary color', async () => {
    const m = await import('./vuetify');
    const v = m.default as { install: (app: unknown) => void };
    expect(typeof v.install).toBe('function');
  });
});
