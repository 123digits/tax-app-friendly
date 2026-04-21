import { describe, it, expect, beforeAll } from 'vitest';
import { computeForm8880 } from './form8880.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type { Form8880, TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function f(p: Partial<Form8880>): Form8880 {
  return {
    elective401kDeferrals: 0,
    iraContributions: 0,
    spouseElective401kDeferrals: 0,
    spouseIraContributions: 0,
    distributionsReceived: 0,
    ...p,
  };
}

describe('computeForm8880', () => {
  it('no tiers → zeros', () => {
    const r = computeForm8880(
      f({ iraContributions: 2000 }),
      20000,
      'single',
      undefined,
    );
    expect(r.credit).toBe(0);
    expect(r.applicableRate).toBe(0);
    expect(r.eligibleContributions).toBe(0);
  });

  it('single filer, low AGI, $2k IRA → 50% × $2,000 = $1,000', () => {
    const r = computeForm8880(
      f({ iraContributions: 2000 }),
      20000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.eligibleContributions).toBe(2000);
    expect(r.applicableRate).toBe(0.50);
    expect(r.credit).toBe(1000);
  });

  it('AGI above all tiers → zero rate (no credit)', () => {
    const r = computeForm8880(
      f({ iraContributions: 2000 }),
      500000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.applicableRate).toBe(0);
    expect(r.credit).toBe(0);
  });

  it('distribution offset reduces eligible contributions', () => {
    const r = computeForm8880(
      f({ iraContributions: 2000, distributionsReceived: 500 }),
      20000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.eligibleContributions).toBe(1500);
    expect(r.credit).toBe(750); // 1500 * 0.50
  });

  it('contributions above per-person cap are capped at $2,000', () => {
    const r = computeForm8880(
      f({ iraContributions: 5000, elective401kDeferrals: 5000 }),
      20000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.eligibleContributions).toBe(2000);
    expect(r.credit).toBe(1000);
  });

  it('MFJ: both spouses contribute $2k each → eligible = $4,000', () => {
    const r = computeForm8880(
      f({
        iraContributions: 2000,
        spouseIraContributions: 2000,
      }),
      40000,
      'mfj',
      DEFAULT_2025.saversCredit?.mfj,
    );
    expect(r.eligibleContributions).toBe(4000);
    expect(r.applicableRate).toBe(0.50);
    expect(r.credit).toBe(2000);
  });

  it('MFJ: spouse base capped independently at $2,000', () => {
    const r = computeForm8880(
      f({
        iraContributions: 2000,
        spouseElective401kDeferrals: 3000,
        spouseIraContributions: 3000,
      }),
      40000,
      'mfj',
      DEFAULT_2025.saversCredit?.mfj,
    );
    expect(r.eligibleContributions).toBe(4000);
    expect(r.credit).toBe(2000);
  });

  it('non-MFJ ignores spouse fields', () => {
    const r = computeForm8880(
      f({
        iraContributions: 2000,
        spouseIraContributions: 2000,
      }),
      20000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.eligibleContributions).toBe(2000);
    expect(r.credit).toBe(1000);
  });

  it('middle tier rate applies when AGI falls in second band', () => {
    const tiers = DEFAULT_2025.saversCredit?.single;
    const midAgi = (tiers?.agiTiers[0] ?? 0) + 1; // above tier0, within tier1
    const r = computeForm8880(
      f({ iraContributions: 2000 }),
      midAgi,
      'single',
      tiers,
    );
    expect(r.applicableRate).toBe(0.20);
    expect(r.credit).toBe(400);
  });

  it('zero contributions → zero credit even at best rate', () => {
    const r = computeForm8880(
      f({}),
      10000,
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.eligibleContributions).toBe(0);
    expect(r.credit).toBe(0);
  });
});
