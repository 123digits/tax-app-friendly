import { describe, it, expect } from 'vitest';
import { computeForm8889, hsaContributionLimit } from './form8889.js';
import type { Form8889, HsaConstants } from '../../../shared/types.js';

const HSA: HsaConstants = {
  selfLimit: 4400,
  familyLimit: 8750,
  catchUp: 1000,
};

function f(p: Partial<Form8889>): Form8889 {
  return {
    coverage: 'none',
    contributions: 0,
    isCatchUpEligible: false,
    distributions: 0,
    qualifiedMedicalExpenses: 0,
    isDisabledOrOver65: false,
    ...p,
  };
}

describe('hsaContributionLimit', () => {
  it('self-only, no catch-up → selfLimit', () => {
    expect(hsaContributionLimit('self', false, HSA)).toBe(4400);
  });

  it('family + catch-up → familyLimit + 1000', () => {
    expect(hsaContributionLimit('family', true, HSA)).toBe(9750);
  });

  it('no coverage → 0', () => {
    expect(hsaContributionLimit('none', true, HSA)).toBe(0);
  });
});

describe('computeForm8889', () => {
  it('zero activity returns zeros', () => {
    const r = computeForm8889(f({}), HSA);
    expect(r.allowedDeduction).toBe(0);
    expect(r.additionalTax).toBe(0);
  });

  it('contribution within self-limit: fully deductible', () => {
    const r = computeForm8889(
      f({ coverage: 'self', contributions: 4000 }),
      HSA,
    );
    expect(r.allowedDeduction).toBe(4000);
    expect(r.excessContribution).toBe(0);
  });

  it('contribution above family limit → excess flagged', () => {
    const r = computeForm8889(
      f({ coverage: 'family', contributions: 10000 }),
      HSA,
    );
    expect(r.allowedDeduction).toBe(8750);
    expect(r.excessContribution).toBe(1250);
  });

  it('non-qualified distribution: 20% additional tax applies when under 65', () => {
    const r = computeForm8889(
      f({ coverage: 'self', distributions: 2000, qualifiedMedicalExpenses: 1500 }),
      HSA,
    );
    expect(r.taxableDistribution).toBe(500);
    expect(r.additionalTax).toBe(100);  // 500 * 0.20
  });

  it('disabled/over-65 exempt from additional tax', () => {
    const r = computeForm8889(
      f({ coverage: 'self', distributions: 2000, qualifiedMedicalExpenses: 0, isDisabledOrOver65: true }),
      HSA,
    );
    expect(r.taxableDistribution).toBe(2000);
    expect(r.additionalTax).toBe(0);
  });
});
