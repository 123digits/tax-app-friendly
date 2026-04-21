import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';


export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_failed', details: err.issues });
    return;
  }
  const status =
    typeof err === 'object' && err !== null && typeof (err as { status?: unknown }).status === 'number'
      ? ((err as { status: number }).status)
      : 500;
  const message = err instanceof Error ? err.message : 'internal_error';

  console.error('[errorHandler]', err);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: message });
    return;
  }
  res.status(500).json({ error: 'internal_error', message });
}
