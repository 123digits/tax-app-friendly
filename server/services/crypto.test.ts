import { describe, it, expect } from 'vitest';
import {
  encryptField,
  decryptField,
  sha256Hex,
  randomTokenHex,
  newId,
  last4,
} from './crypto.js';

describe('crypto', () => {
  it('encrypts and decrypts a round-trip', () => {
    const enc = encryptField('hello');
    expect(enc).toBeTruthy();
    expect(decryptField(enc)).toBe('hello');
  });

  it('returns null for empty input', () => {
    expect(encryptField('')).toBeNull();
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeNull();
    expect(decryptField('')).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptField(undefined)).toBeNull();
  });

  it('sha256Hex deterministic', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });

  it('randomTokenHex has correct length', () => {
    expect(randomTokenHex(16)).toHaveLength(32);
    expect(randomTokenHex()).toHaveLength(64);
  });

  it('newId returns a uuid', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('last4 returns last 4 digits', () => {
    expect(last4('123-45-6789')).toBe('6789');
    expect(last4('1234')).toBe('1234');
    expect(last4('abc')).toBeNull();
    expect(last4(null)).toBeNull();
    expect(last4(undefined)).toBeNull();
    expect(last4('')).toBeNull();
  });

  it('throws when DATA_ENCRYPTION_KEY is invalid', () => {
    const orig = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'tooshort';
    expect(() => encryptField('hi')).toThrow(/DATA_ENCRYPTION_KEY/);
    process.env.DATA_ENCRYPTION_KEY = orig;
  });
});
