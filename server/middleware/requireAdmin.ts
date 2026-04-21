import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/pglite.js';
import { getUserIdFromSession } from '../services/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    isAdmin?: boolean;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const db = await getDb();
    const r = await db.query<{ is_admin: boolean }>(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );
    if (!r.rows[0]?.is_admin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    req.userId = userId;
    req.isAdmin = true;
    next();
  } catch (err) {
    next(err);
  }
}
