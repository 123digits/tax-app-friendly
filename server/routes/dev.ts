import { Router } from 'express';
import { z } from 'zod';
import { devPeekCode } from '../services/twoFactor.js';

const router = Router();

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).end();
    return;
  }
  next();
});

router.get('/last-code', (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    purpose: z.enum(['login', 'email_verify']),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'bad_params' });
    return;
  }
  const code = devPeekCode(parsed.data.email, parsed.data.purpose);
  res.json({ code });
});

export default router;
