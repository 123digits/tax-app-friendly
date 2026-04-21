import { describe, it, expect, beforeAll } from 'vitest';
import { computeForm8396 } from './form8396.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type { Form8396, TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function f(p: Partial<Form8396>): Form8396 {
  return {
    certificateRate: 0,
    mortgageInterestPaid: 0,
    priorYearUnusedCredit: 0,
    ...p,
  };
}

describe('computeForm8396', () => {
  it('no form → zeros', () => {
    const r = computeForm8396(undefined);
    expect(r.currentYearCredit).toBe(0);
    expect(r.totalCredit).toBe(0);
  });

  it('rate exactly 20% with $10k interest → $2,000 (boundary, no cap triggered)', () => {
    // rate === 0.20 is NOT > 0.20, so the cap is not applied. Tentative
    // equals the cap amount by coincidence but the code path does not hit
    // the Math.min branch.
    const r = computeForm8396(
      f({ certificateRate: DEFAULT_2025.mortgageCredit!.highRateThreshold, mortgageInterestPaid: 10000 }),
    );
    expect(r.currentYearCredit).toBe(2000);
    expect(r.totalCredit).toBe(2000);
  });

  it('rate 25% with $10k interest → tentative $2,500 capped at $2,000', () => {
    const r = computeForm8396(
      f({ certificateRate: 0.25, mortgageInterestPaid: 10000 }),
    );
    expect(r.currentYearCredit).toBe(DEFAULT_2025.mortgageCredit!.capHighRate);
    expect(r.totalCredit).toBe(2000);
  });

  it('rate 15% with $8k interest → $1,200 (no cap since rate not > 20%)', () => {
    const r = computeForm8396(
      f({ certificateRate: 0.15, mortgageInterestPaid: 8000 }),
    );
    expect(r.currentYearCredit).toBe(1200);
    expect(r.totalCredit).toBe(1200);
  });

  it('prior-year unused $500 + rate 10% × $4k → current $400, total $900', () => {
    const r = computeForm8396(
      f({
        certificateRate: 0.10,
        mortgageInterestPaid: 4000,
        priorYearUnusedCredit: 500,
      }),
    );
    expect(r.currentYearCredit).toBe(400);
    expect(r.totalCredit).toBe(900);
  });
});
