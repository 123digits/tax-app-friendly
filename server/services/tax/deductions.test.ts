import { describe, it, expect, beforeAll } from 'vitest';
import { sumItemized } from './deductions.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type {
  ItemizedDeductions,
  TaxYearConstants,
} from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function item(p: Partial<ItemizedDeductions> = {}): ItemizedDeductions {
  return {
    medical: 0,
    stateLocalTax: 0,
    realEstateTax: 0,
    mortgageInterest: 0,
    charitableCash: 0,
    charitableNoncash: 0,
    ...p,
  };
}

describe('sumItemized', () => {
  it('empty itemized → 0', () => {
    const r = sumItemized(item(), 100000, 10000, 0.075);
    expect(r).toBe(0);
  });

  // --- §213(a) medical 7.5% AGI floor ---
  it('medical: below 7.5% AGI floor → $0', () => {
    // AGI $100k → floor $7,500. Medical $5,000 < floor.
    const r = sumItemized(item({ medical: 5000 }), 100000, 10000, 0.075);
    expect(r).toBe(0);
  });

  it('medical: above 7.5% AGI floor → excess only', () => {
    // AGI $100k → floor $7,500. Medical $10,000 → $2,500 deductible.
    const r = sumItemized(item({ medical: 10000 }), 100000, 10000, 0.075);
    expect(r).toBe(2500);
  });

  it('medical: uses configured threshold from DB constants', () => {
    // Defensive: ensure the constant flowing through the pipeline is
    // treated as a rate (e.g., 0.075), not a percent (7.5). With AGI $40k
    // and medical $5,000, floor = $3,000, allowed = $2,000.
    const r = sumItemized(
      item({ medical: 5000 }),
      40000,
      DEFAULT_2025.saltCap,
      DEFAULT_2025.medicalAgiThreshold,
    );
    expect(DEFAULT_2025.medicalAgiThreshold).toBeCloseTo(0.075, 5);
    expect(r).toBe(2000);
  });

  // --- §164(b)(6) SALT cap ---
  it('SALT: under cap → full amount', () => {
    const r = sumItemized(
      item({ stateLocalTax: 3000, realEstateTax: 4000 }),
      100000,
      10000,
      0.075,
    );
    expect(r).toBe(7000);
  });

  it('SALT: over cap → capped at $10,000 (single)', () => {
    const r = sumItemized(
      item({ stateLocalTax: 8000, realEstateTax: 9000 }),
      100000,
      10000,
      0.075,
      'single',
    );
    expect(r).toBe(10000);
  });

  it('SALT: MFS cap is $5,000 per §164(b)(6)(B)', () => {
    // Without the MFS carve-out this would return $10,000.
    const r = sumItemized(
      item({ stateLocalTax: 8000, realEstateTax: 9000 }),
      100000,
      10000,
      0.075,
      'mfs',
    );
    expect(r).toBe(5000);
  });

  it('SALT: MFJ keeps full $10,000 cap', () => {
    const r = sumItemized(
      item({ stateLocalTax: 8000, realEstateTax: 9000 }),
      200000,
      10000,
      0.075,
      'mfj',
    );
    expect(r).toBe(10000);
  });

  // --- §170(b)(1) charitable AGI caps ---
  it('charitable cash: under 60% AGI limit → full amount', () => {
    // AGI $100k, cash $50k ≤ 60% × $100k = $60k.
    const r = sumItemized(item({ charitableCash: 50000 }), 100000, 10000, 0.075);
    expect(r).toBe(50000);
  });

  it('charitable cash: over 60% AGI limit → capped (§170(b)(1)(G))', () => {
    // AGI $100k, cash $80k > $60k limit → capped at $60k.
    const r = sumItemized(item({ charitableCash: 80000 }), 100000, 10000, 0.075);
    expect(r).toBe(60000);
  });

  it('charitable noncash: over 30% AGI limit → capped (§170(b)(1)(C))', () => {
    // AGI $100k, noncash $50k > 30% × $100k = $30k → capped at $30k.
    const r = sumItemized(item({ charitableNoncash: 50000 }), 100000, 10000, 0.075);
    expect(r).toBe(30000);
  });

  it('charitable: cash and noncash capped independently', () => {
    // AGI $100k: cash $80k → $60k; noncash $40k → $30k. Total $90k.
    const r = sumItemized(
      item({ charitableCash: 80000, charitableNoncash: 40000 }),
      100000,
      10000,
      0.075,
    );
    expect(r).toBe(90000);
  });

  it('charitable: zero AGI → zero charitable allowed', () => {
    // With AGI $0, both 60% and 30% limits are $0.
    const r = sumItemized(
      item({ charitableCash: 5000, charitableNoncash: 5000 }),
      0,
      10000,
      0.075,
    );
    expect(r).toBe(0);
  });

  // --- mortgage interest passthrough (acquisition-debt cap not yet modeled) ---
  it('mortgage interest: passes through unmodified', () => {
    const r = sumItemized(item({ mortgageInterest: 12000 }), 100000, 10000, 0.075);
    expect(r).toBe(12000);
  });

  // --- combined smoke test ---
  it('combined: all line items with caps applied', () => {
    // AGI $100k.
    // Medical $15k − $7,500 floor = $7,500.
    // SALT $20k capped at $10k.
    // Mortgage $8k.
    // Cash $80k capped at $60k; noncash $40k capped at $30k → charity $90k.
    // Total = $7,500 + $10,000 + $8,000 + $90,000 = $115,500.
    const r = sumItemized(
      item({
        medical: 15000,
        stateLocalTax: 12000,
        realEstateTax: 8000,
        mortgageInterest: 8000,
        charitableCash: 80000,
        charitableNoncash: 40000,
      }),
      100000,
      10000,
      0.075,
      'single',
    );
    expect(r).toBe(115500);
  });

  it('filingStatus defaults to single when omitted (backward compatible)', () => {
    // Same inputs as the MFS test above, but no filing status → full $10k cap.
    const r = sumItemized(
      item({ stateLocalTax: 8000, realEstateTax: 9000 }),
      100000,
      10000,
      0.075,
    );
    expect(r).toBe(10000);
  });
});
