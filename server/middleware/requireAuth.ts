import type { Request, Response, NextFunction } from 'express';
import { getUserIdFromSession } from '../services/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
