import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import authRoutes from './routes/auth.js';
import taxReturnRoutes from './routes/taxReturn.js';
import devRoutes from './routes/dev.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/return', taxReturnRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/dev', devRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', errorHandler);
  return app;
}
