import { describe, it, expect } from 'vitest';
import { computeHomeOfficeDeduction, totalHomeOfficeDeduction } from './form8829.js';
import type { HomeOfficeExpense } from '../../../shared/types.js';

function office(h: Partial<HomeOfficeExpense>): HomeOfficeExpense {
  return {
    id: h.id ?? 'h1',
    businessId: h.businessId ?? null,
    useSimplified: h.useSimplified ?? true,
    squareFeet: h.squareFeet ?? 0,
    totalHomeSquareFeet: h.totalHomeSquareFeet ?? 0,
    utilities: h.utilities ?? 0,
    insurance: h.insurance ?? 0,
    mortgageInterest: h.mortgageInterest ?? 0,
    realEstateTax: h.realEstateTax ?? 0,
    repairs: h.repairs ?? 0,
    depreciation: h.depreciation ?? 0,
  };
}

describe('computeHomeOfficeDeduction', () => {
  it('simplified method: 200 sqft → $1000', () => {
    expect(computeHomeOfficeDeduction(office({ useSimplified: true, squareFeet: 200 }))).toBe(1000);
  });

  it('simplified method caps at 300 sqft = $1500', () => {
    expect(computeHomeOfficeDeduction(office({ useSimplified: true, squareFeet: 500 }))).toBe(1500);
  });

  it('actual method clamps business-use pct to 100% when sqft > total home sqft', () => {
    // Data-entry error: 2000 sqft office in a 1000 sqft home. pct must
    // clamp to 1.0 (Form 8829 line 7), not 2.0, so deduction = full expenses.
    const d = computeHomeOfficeDeduction(
      office({
        useSimplified: false,
        squareFeet: 2000,
        totalHomeSquareFeet: 1000,
        utilities: 1000,
      })
    );
    expect(d).toBe(1000);
  });

  it('actual method: 10% use × $10,000 expenses = $1,000', () => {
    const d = computeHomeOfficeDeduction(
      office({
        useSimplified: false,
        squareFeet: 100,
        totalHomeSquareFeet: 1000,
        utilities: 2000,
        insurance: 1000,
        mortgageInterest: 5000,
        realEstateTax: 1000,
        repairs: 500,
        depreciation: 500,
      })
    );
    expect(d).toBeCloseTo(1000, 2);
  });
});

describe('totalHomeOfficeDeduction', () => {
  it('sums across offices', () => {
    expect(
      totalHomeOfficeDeduction([
        office({ useSimplified: true, squareFeet: 100 }),
        office({ useSimplified: true, squareFeet: 150 }),
      ])
    ).toBe(1250);  // 500 + 750
  });
});
