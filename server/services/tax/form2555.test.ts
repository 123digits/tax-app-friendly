import { describe, it, expect } from 'vitest';
import { computeForm2555 } from './form2555.js';
import type { FeieConstants, Form2555 } from '../../../shared/types.js';

const FEIE: FeieConstants = {
  exclusionLimit: 130000,
  housingBasePct: 0.16,
  housingCapPct: 0.30,
};

function base(overrides: Partial<Form2555> = {}): Form2555 {
  return {
    foreignEarnedIncome: 0,
    qualifyingDays: 0,
    totalDaysInPeriod: 365,
    housingExpenses: 0,
    isBonaFideResident: false,
    usesPhysicalPresence: false,
    ...overrides,
  };
}

describe('computeForm2555', () => {
  it('returns zeros when no constants', () => {
    const r = computeForm2555(base(), undefined);
    expect(r.totalExclusion).toBe(0);
  });

  it('returns zeros when taxpayer does not qualify', () => {
    const r = computeForm2555(
      base({ foreignEarnedIncome: 100000, qualifyingDays: 365 }),
      FEIE,
    );
    expect(r.totalExclusion).toBe(0);
  });

  it('full-year bona fide residence: excludes up to limit', () => {
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 150000,
        qualifyingDays: 365,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.exclusionAllowed).toBeCloseTo(130000, 2);
    expect(r.totalExclusion).toBeCloseTo(130000, 2);
  });

  it('foreign income below limit → excludes actual income', () => {
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 80000,
        qualifyingDays: 365,
        usesPhysicalPresence: true,
      }),
      FEIE,
    );
    expect(r.exclusionAllowed).toBeCloseTo(80000, 2);
  });

  it('partial year: exclusion pro-rated', () => {
    // 183/365 qualifying days × $130k = $65,150 limit.
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 100000,
        qualifyingDays: 183,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.exclusionAllowed).toBeCloseTo((183 / 365) * 130000, 2);
  });

  it('housing exclusion above base is allowed', () => {
    // Housing base = 0.16 × 130000 = 20,800; cap = 0.30 × 130000 = 39,000.
    // Housing expenses 35,000 → excluded = 35,000 − 20,800 = 14,200.
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 150000,
        qualifyingDays: 365,
        housingExpenses: 35000,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.housingExclusion).toBeCloseTo(14200, 2);
    expect(r.totalExclusion).toBeCloseTo(130000 + 14200, 2);
  });

  it('housing expenses below base → no housing exclusion', () => {
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 150000,
        qualifyingDays: 365,
        housingExpenses: 15000,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.housingExclusion).toBe(0);
  });

  it('housing expenses above cap → capped', () => {
    // Cap = 39,000. Expenses 60,000 → capped to 39,000; base 20,800 →
    // housing exclusion = 39,000 − 20,800 = 18,200.
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 150000,
        qualifyingDays: 365,
        housingExpenses: 60000,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.housingExclusion).toBeCloseTo(18200, 2);
  });

  it('§911(d)(6): total exclusion capped at foreign earned income', () => {
    // FEI $50k, full qualifying year, housing expenses $50k.
    // Housing base = 0.16 × 130000 = 20,800; cap = 0.30 × 130000 = 39,000.
    // Raw housing exclusion = min(39000, 50000) − 20800 = 18,200.
    // Raw total = min(50000, 130000) + 18200 = 68,200, but §911(d)(6)
    // caps total at FEI = $50,000.
    const r = computeForm2555(
      base({
        foreignEarnedIncome: 50000,
        qualifyingDays: 365,
        housingExpenses: 50000,
        isBonaFideResident: true,
      }),
      FEIE,
    );
    expect(r.exclusionAllowed).toBeCloseTo(50000, 2);
    expect(r.housingExclusion).toBeCloseTo(18200, 2);
    expect(r.totalExclusion).toBe(50000);
  });
});
