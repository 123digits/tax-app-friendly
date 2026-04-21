import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listConfigs,
  getConfig,
  upsertConfig,
  deleteConfig,
  cloneConfig,
} from '../services/taxYearConfig.js';
import { getDb } from '../db/pglite.js';
import type { TaxYearConstants } from '../../shared/types.js';

const router = Router();
router.use(requireAdmin);

const filingStatuses = ['single', 'mfj', 'mfs', 'hoh', 'qw'] as const;

const bracketSchema = z.object({
  upTo: z.number().nullable(),
  rate: z.number().nonnegative().max(1),
});

const bracketsByStatusSchema = z.object(
  Object.fromEntries(filingStatuses.map((s) => [s, z.array(bracketSchema).min(1)])) as Record<
    (typeof filingStatuses)[number],
    typeof bracketSchema extends infer _ ? z.ZodArray<typeof bracketSchema> : never
  >
);

const perStatusNumber = z.object(
  Object.fromEntries(filingStatuses.map((s) => [s, z.number().nonnegative()])) as Record<
    (typeof filingStatuses)[number],
    z.ZodNumber
  >
);

const ltcgPerStatus = z.object(
  Object.fromEntries(
    filingStatuses.map((s) => [
      s,
      z.object({
        zeroUpTo: z.number().nonnegative(),
        fifteenUpTo: z.number().nonnegative(),
      }),
    ])
  ) as any
);

// Phase 0 groups: validated loosely so the admin JSON-textarea UX round-trips
// any shape. Later phases (retirement: Phase 1/6, education: Phase 7, AMT/NIIT:
// Phase 9, EITC: Phase 8, etc.) tighten the inner validators as they start
// consuming each group. A group may be omitted entirely ("use default").
const groupSchema = z.record(z.string(), z.any()).nullable().optional();

const configSchema = z.object({
  taxYear: z.number().int().min(1900).max(3000),
  brackets: bracketsByStatusSchema,
  standardDeduction: perStatusNumber,
  ctcPerChild: z.number().nonnegative(),
  ctcPhaseoutStart: perStatusNumber,
  ssWageBase: z.number().nonnegative(),
  ltcgBrackets: ltcgPerStatus,
  saltCap: z.number().nonnegative(),
  medicalAgiThreshold: z.number().nonnegative().max(1),
  capitalLossLimit: z.number().nonnegative(),
  notes: z.string().nullable().optional(),

  retirement: groupSchema,
  hsa: groupSchema,
  education: groupSchema,
  ssTaxability: groupSchema,
  additionalMedicare: groupSchema,
  niit: groupSchema,
  amt: groupSchema,
  saversCredit: groupSchema,
  depreciation: groupSchema,
  eitc: groupSchema,
  feie: groupSchema,
  childCare: groupSchema,

  // Wave 1 groups: same loose validation as Phase 0 groups. A later wave that
  // consumes each group from the calculator tightens its shape.
  seTax: groupSchema,
  penalties: groupSchema,
  scheduleRCredit: groupSchema,
  residentialEnergy: groupSchema,
  mortgageCredit: groupSchema,
  evCredit: groupSchema,
  homeOffice: groupSchema,
  passiveLoss: groupSchema,
  underpaymentPenalty: groupSchema,
  householdEmployment: groupSchema,
  actc: groupSchema,
  ptc: groupSchema,
  eitcInvestmentIncomeLimit: z.number().nonnegative().nullable().optional(),
});

router.get('/tax-years', async (_req, res, next) => {
  try {
    const list = await listConfigs();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/tax-years/:year', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const cfg = await getConfig(year);
    if (!cfg) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(cfg);
  } catch (err) {
    next(err);
  }
});

router.put('/tax-years/:year', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const body = configSchema.parse({ ...req.body, taxYear: year }) as TaxYearConstants;
    await upsertConfig(body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/tax-years', async (req, res, next) => {
  try {
    const body = configSchema.parse(req.body) as TaxYearConstants;
    const existing = await getConfig(body.taxYear);
    if (existing) {
      res.status(409).json({ error: 'already_exists' });
      return;
    }
    await upsertConfig(body);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const cloneSchema = z.object({
  sourceYear: z.number().int().min(1900).max(3000),
  targetYear: z.number().int().min(1900).max(3000),
});

router.post('/tax-years/clone', async (req, res, next) => {
  try {
    const { sourceYear, targetYear } = cloneSchema.parse(req.body);
    if (sourceYear === targetYear) {
      res.status(400).json({ error: 'same_year' });
      return;
    }
    const existing = await getConfig(targetYear);
    if (existing) {
      res.status(409).json({ error: 'already_exists' });
      return;
    }
    const cfg = await cloneConfig(sourceYear, targetYear);
    res.status(201).json(cfg);
  } catch (err) {
    next(err);
  }
});

router.delete('/tax-years/:year', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    // Prevent deletion if any return already uses this year.
    const db = await getDb();
    const r = await db.query<{ c: number }>(
      'SELECT count(*)::int as c FROM tax_returns WHERE tax_year = $1',
      [year]
    );
    if ((r.rows[0]?.c ?? 0) > 0) {
      res.status(409).json({ error: 'in_use', count: r.rows[0].c });
      return;
    }
    await deleteConfig(year);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Admin user management: list users, toggle admin flag.
router.get('/users', async (_req, res, next) => {
  try {
    const db = await getDb();
    const r = await db.query<{
      id: string; username: string; email: string;
      email_verified: boolean; is_admin: boolean; created_at: string;
    }>('SELECT id, username, email, email_verified, is_admin, created_at FROM users ORDER BY created_at');
    res.json(r.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      emailVerified: row.email_verified,
      isAdmin: row.is_admin,
      createdAt: row.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/admin', async (req, res, next) => {
  try {
    const { isAdmin } = z.object({ isAdmin: z.boolean() }).parse(req.body);
    const db = await getDb();
    // Don't let an admin demote themselves if they're the only admin.
    if (!isAdmin) {
      const countRes = await db.query<{ c: number }>(
        'SELECT count(*)::int as c FROM users WHERE is_admin = true'
      );
      const target = await db.query<{ is_admin: boolean }>(
        'SELECT is_admin FROM users WHERE id = $1', [req.params.id]
      );
      if (target.rows[0]?.is_admin && (countRes.rows[0]?.c ?? 0) <= 1) {
        res.status(409).json({ error: 'last_admin' });
        return;
      }
    }
    await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
