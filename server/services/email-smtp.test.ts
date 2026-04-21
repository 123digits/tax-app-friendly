// Covers the SMTP_HOST-present branch of email.ts. nodemailer.createTransport
// is called with the SMTP config; we don't actually connect to a server.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('email with SMTP_HOST set', () => {
  const origHost = process.env.SMTP_HOST;
  const origPort = process.env.SMTP_PORT;
  const origSecure = process.env.SMTP_SECURE;
  const origUser = process.env.SMTP_USER;
  const origPass = process.env.SMTP_PASS;
  const origFrom = process.env.SMTP_FROM;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.SMTP_HOST = origHost ?? undefined;
    process.env.SMTP_PORT = origPort ?? undefined;
    process.env.SMTP_SECURE = origSecure ?? undefined;
    process.env.SMTP_USER = origUser ?? undefined;
    process.env.SMTP_PASS = origPass ?? undefined;
    process.env.SMTP_FROM = origFrom ?? undefined;
    if (!origHost) delete process.env.SMTP_HOST;
    if (!origPort) delete process.env.SMTP_PORT;
    if (!origSecure) delete process.env.SMTP_SECURE;
    if (!origUser) delete process.env.SMTP_USER;
    if (!origPass) delete process.env.SMTP_PASS;
    if (!origFrom) delete process.env.SMTP_FROM;
  });

  it('uses nodemailer SMTP transport when SMTP_HOST is set (with auth)', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pw';
    process.env.SMTP_FROM = 'Test <test@example.com>';
    const sendMail = vi.fn(async () => ({ messageId: 'fake' }));
    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({ sendMail })),
      },
    }));
    const mod = await import('./email.js');
    await mod.sendEmail({ to: 'a@b', subject: 's', text: 'body' });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('uses SMTP transport without auth when SMTP_USER is not set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const sendMail = vi.fn(async () => ({ messageId: 'x' }));
    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({ sendMail })),
      },
    }));
    const mod = await import('./email.js');
    await mod.sendEmail({ to: 'a@b', subject: 's', text: 'body' });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('reuses the transporter across calls (memoized)', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const createTransport = vi.fn(() => ({ sendMail: async () => ({ messageId: 'x' }) }));
    vi.doMock('nodemailer', () => ({ default: { createTransport } }));
    const mod = await import('./email.js');
    await mod.sendEmail({ to: 'a@b', subject: 's', text: 'body' });
    await mod.sendEmail({ to: 'a@b', subject: 's', text: 'body' });
    expect(createTransport).toHaveBeenCalledTimes(1);
  });
});
