import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for field-level secrets (SSNs).
 * Key is loaded from DATA_ENCRYPTION_KEY env (64 hex chars = 32 bytes).
 * Ciphertext format: base64( iv(12) || authTag(16) || ciphertext )
 */

function getKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      'DATA_ENCRYPTION_KEY must be set to 64 hex chars (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(raw, 'hex');
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptField(packed: string | null | undefined): string | null {
  if (packed == null || packed === '') return null;
  const key = getKey();
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomTokenHex(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function newId(): string {
  return crypto.randomUUID();
}

export function last4(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}
