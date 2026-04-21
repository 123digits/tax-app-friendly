import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes and verifies the correct password', async () => {
    const h = await hashPassword('secretpw12345');
    expect(h).toMatch(/^\$argon2/);
    expect(await verifyPassword(h, 'secretpw12345')).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const h = await hashPassword('secretpw12345');
    expect(await verifyPassword(h, 'wrong')).toBe(false);
  });

  it('returns false when hash is malformed', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});
