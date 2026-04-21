import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db/pglite.js';
import { newId } from '../services/crypto.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import {
  createSession,
  createPendingSession,
  clearSession,
  clearPendingSession,
  getUserIdFromSession,
  getUserIdFromPending,
} from '../services/session.js';
import { issueCode, verifyCode } from '../services/twoFactor.js';
import { sendTwoFactorEmail } from '../services/email.js';
import type { User } from '../../shared/types.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const twoFaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const registerSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, 'invalid username'),
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const codeSchema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) });

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  is_admin: boolean;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: row.email_verified,
    isAdmin: !!row.is_admin,
    createdAt: row.created_at,
  };
}

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    const db = await getDb();

    const existing = await db.query<UserRow>(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'user_exists' });
      return;
    }

    const id = newId();
    const passwordHash = await hashPassword(password);
    // Bootstrap: first registered user (or matching ADMIN_EMAIL) becomes admin.
    const countRes = await db.query<{ c: number }>('SELECT count(*)::int as c FROM users');
    const isFirst = (countRes.rows[0]?.c ?? 0) === 0;
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const makeAdmin = isFirst || (adminEmail && email.toLowerCase() === adminEmail);
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, email_verified, is_admin)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [id, username, email.toLowerCase(), passwordHash, !!makeAdmin]
    );

    const code = await issueCode(id, 'email_verify');
    await sendTwoFactorEmail(email.toLowerCase(), code, 'email_verify');

    res.status(201).json({ ok: true, email: email.toLowerCase() });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-email', twoFaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const email = z.string().email().parse(req.body?.email).toLowerCase();
    const db = await getDb();
    const userRes = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) {
      res.status(400).json({ error: 'invalid' });
      return;
    }
    const result = await verifyCode(user.id, 'email_verify', code);
    if (!result.ok) {
      res.status(400).json({ error: 'invalid_code', reason: result.reason });
      return;
    }
    await db.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const db = await getDb();
    const userRes = await db.query<UserRow>(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username.toLowerCase()]
    );
    const user = userRes.rows[0];
    // Always run verify to avoid revealing account existence via timing.
    const ok = user
      ? await verifyPassword(user.password_hash, password)
      : await verifyPassword(
          '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          password
        );
    if (!user || !ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    await createPendingSession(res, user.id);
    const code = await issueCode(user.id, 'login');
    await sendTwoFactorEmail(user.email, code, 'login');

    res.json({ ok: true, twoFactorRequired: true, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.post('/two-factor/verify', twoFaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const userId = await getUserIdFromPending(req);
    if (!userId) {
      res.status(401).json({ error: 'no_pending_session' });
      return;
    }
    const result = await verifyCode(userId, 'login', code);
    if (!result.ok) {
      res.status(400).json({ error: 'invalid_code', reason: result.reason });
      return;
    }
    await clearPendingSession(res, req);
    await createSession(res, userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/two-factor/resend', twoFaLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getUserIdFromPending(req);
    if (!userId) {
      res.status(401).json({ error: 'no_pending_session' });
      return;
    }
    const db = await getDb();
    const userRes = await db.query<UserRow>('SELECT email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) {
      res.status(401).json({ error: 'no_user' });
      return;
    }
    const code = await issueCode(userId, 'login');
    await sendTwoFactorEmail(user.email, code, 'login');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await clearSession(res, req);
    await clearPendingSession(res, req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const db = await getDb();
    const userRes = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: toUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
