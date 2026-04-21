import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendTwoFactorEmail } from './email.js';

describe('email', () => {
  // Reset module state if needed by using fresh env each test.
  let origHost: string | undefined;

  beforeEach(() => {
    origHost = process.env.SMTP_HOST;
  });

  afterEach(() => {
    process.env.SMTP_HOST = origHost;
  });

  it('sends via jsonTransport when SMTP_HOST is unset (dev)', async () => {
    delete process.env.SMTP_HOST;
    // Should not throw
    await expect(
      sendEmail({ to: 'test@example.com', subject: 's', text: 'body' }),
    ).resolves.toBeUndefined();
  });

  it('sendTwoFactorEmail composes an email with the code', async () => {
    delete process.env.SMTP_HOST;
    await expect(sendTwoFactorEmail('foo@example.com', '654321', 'login')).resolves.toBeUndefined();
    await expect(sendTwoFactorEmail('foo@example.com', '654321', 'email_verify')).resolves.toBeUndefined();
  });
});
