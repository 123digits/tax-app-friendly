import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

 
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_failed', details: err.issues });
    return;
  }
   
  console.error('[errorHandler]', err);
  const message = err instanceof Error ? err.message : 'internal_error';
  res.status(500).json({ error: 'internal_error', message });
}
