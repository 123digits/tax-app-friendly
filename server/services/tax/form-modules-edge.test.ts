// Targeted edge-case coverage for the small form modules: 4562, 8606, 8889,
// 8829, 2441.
import { describe, it, expect } from 'vitest';
import { summarizeDepreciation } from './form4562.js';
import { computeForm8606 } from './form8606.js';
import { computeForm8889, hsaContributionLimit } from './form8889.js';
import { computeHomeOfficeDeduction, totalHomeOfficeDeduction } from './form8829.js';
import { computeForm2441, pickChildCareRate } from './form2441.js';
import type {
  ChildCareConstants,
  DepreciationAsset,
  DepreciationConstants,
  Form2441,
  Form8606,
  Form8889,
  HomeOfficeExpense,
  HsaConstants,
} from '../../../shared/types.js';

describe('form4562 — missing constants', () => {
  it('throws when firstYearMacrs is missing', () => {
    expect(() => summarizeDepreciation(
      [],
      { section179Limit: 1000, section179Phaseout: 100000, bonusPct: 0 } as DepreciationConstants,
    )).toThrow(/firstYearMacrs/);
  });

  it('unknown macrsClass falls back to 10% rate', () => {
    const constants: DepreciationConstants = {
      section179Limit: 1_200_000, section179Phaseout: 3_000_000, bonusPct: 0,
      firstYearMacrs: { '5': 0.2 },
    };
    const asset: DepreciationAsset = {
      id: 'a', description: null, datePlacedInService: null, cost: 1000,
      macrsClass: '27.5', section179Election: 0, claimBonus: false,
      businessUsePercent: 1, businessId: null,
    };
    const r = summarizeDepreciation([asset], constants);
    expect(r.totalMacrs).toBeCloseTo(100, 2); // default 0.1 fallback
  });

  it('no assets returns all zeros', () => {
    const constants: DepreciationConstants = {
      section179Limit: 1, section179Phaseout: 1, bonusPct: 0,
      firstYearMacrs: { '5': 0.2 },
    };
    const r = summarizeDepreciation([], constants);
    expect(r.total).toBe(0);
  });
});

describe('form8606 — special cases', () => {
  it('all-zero inputs return all-zero output', () => {
    const r = computeForm8606(undefined);
    expect(r.totalBasisAvailable).toBe(0);
    expect(r.endingBasis).toBe(0);
  });

  it('backdoor Roth: distributions == basis, balance == 0 → fully nontaxable', () => {
    const f: Form8606 = {
      priorYearBasis: 0,
      currentYearNondeductible: 7000,
      traditionalIraBalance: 0,
      distributions: 0,
      conversions: 7000,
    };
    const r = computeForm8606(f);
    expect(r.taxableConversion).toBe(0);
    expect(r.nontaxablePortion).toBe(7000);
  });

  it('mix of basis and pre-tax balance pro-rates', () => {
    const f: Form8606 = {
      priorYearBasis: 5000,
      currentYearNondeductible: 0,
      traditionalIraBalance: 20000,
      distributions: 5000,
      conversions: 0,
    };
    const r = computeForm8606(f);
    // totalBasis=5000, denom=25000 → fraction 5000/25000=0.20
    // nontaxable of 5000 distribution = 1000 → taxable=4000
    expect(r.taxableDistribution).toBeCloseTo(4000, 2);
    expect(r.nontaxablePortion).toBeCloseTo(1000, 2);
    expect(r.endingBasis).toBeCloseTo(4000, 2);
  });
});

describe('form8889 — branches', () => {
  const HSA: HsaConstants = { selfLimit: 4150, familyLimit: 8300, catchUp: 1000 };

  it('hsaContributionLimit: returns 0 for none coverage', () => {
    expect(hsaContributionLimit('none', false, HSA)).toBe(0);
  });

  it('hsaContributionLimit: returns 0 when constants missing', () => {
    expect(hsaContributionLimit('self', false, undefined)).toBe(0);
  });

  it('self with catch-up adds catch-up', () => {
    expect(hsaContributionLimit('self', true, HSA)).toBe(5150);
  });

  it('family with catch-up adds catch-up', () => {
    expect(hsaContributionLimit('family', true, HSA)).toBe(9300);
  });

  it('excess contribution surfaces', () => {
    const f: Form8889 = {
      coverage: 'self', contributions: 10000, isCatchUpEligible: false,
      distributions: 0, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false,
    };
    const r = computeForm8889(f, HSA);
    expect(r.excessContribution).toBe(10000 - 4150);
  });

  it('non-qualified distribution over 65 has no additional tax', () => {
    const f: Form8889 = {
      coverage: 'self', contributions: 0, isCatchUpEligible: false,
      distributions: 1000, qualifiedMedicalExpenses: 0, isDisabledOrOver65: true,
    };
    const r = computeForm8889(f, HSA);
    expect(r.additionalTax).toBe(0);
  });

  it('custom HSA additional-tax rate from PenaltyConstants is honored', () => {
    const f: Form8889 = {
      coverage: 'self', contributions: 0, isCatchUpEligible: false,
      distributions: 1000, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false,
    };
    const r = computeForm8889(f, HSA, { earlyWithdrawalRate: 0.10, hsaAdditionalTaxRate: 0.25 });
    expect(r.additionalTax).toBe(250);
  });

  it('undefined input falls back to none coverage', () => {
    const r = computeForm8889(undefined, HSA);
    expect(r.contributionLimit).toBe(0);
  });
});

describe('form8829 — simplified vs actual method', () => {
  const base: HomeOfficeExpense = {
    id: 'h', businessId: null, useSimplified: false,
    squareFeet: 300, totalHomeSquareFeet: 3000,
    utilities: 2000, insurance: 800, mortgageInterest: 10000,
    realEstateTax: 1500, repairs: 500, depreciation: 2000,
  };

  it('simplified method caps at 300 sqft × $5', () => {
    const out = computeHomeOfficeDeduction({ ...base, useSimplified: true, squareFeet: 500 });
    expect(out).toBe(1500);
  });

  it('actual method allocates by sqft fraction', () => {
    const out = computeHomeOfficeDeduction(base);
    // pct = 300/3000 = 0.1; expenses = 2000+800+10000+1500+500+2000 = 16800
    expect(out).toBeCloseTo(1680, 2);
  });

  it('actual method caps business-use ratio at 100%', () => {
    const out = computeHomeOfficeDeduction({ ...base, squareFeet: 6000, totalHomeSquareFeet: 3000 });
    // Capped at 1.0 → full expenses
    expect(out).toBe(16800);
  });

  it('actual method with total 0 defaults total to 1 and caps pct at 1', () => {
    const out = computeHomeOfficeDeduction({ ...base, squareFeet: 100, totalHomeSquareFeet: 0 });
    expect(out).toBe(16800);
  });

  it('totalHomeOfficeDeduction sums across entries', () => {
    expect(totalHomeOfficeDeduction([base, { ...base, id: 'h2' }])).toBeCloseTo(3360, 2);
  });

  it('simplified with no constants uses default $5 / 300 sqft', () => {
    const out = computeHomeOfficeDeduction({ ...base, useSimplified: true, squareFeet: 100 });
    expect(out).toBe(500);
  });
});

describe('form2441 — special branches', () => {
  const C: ChildCareConstants = {
    maxExpenseOne: 3000,
    maxExpenseTwo: 6000,
    rates: [
      { agi: 15000, rate: 0.35 },
      { agi: 43000, rate: 0.20 },
    ],
  };

  it('pickChildCareRate: no constants returns 0', () => {
    expect(pickChildCareRate(10000, undefined)).toBe(0);
  });

  it('pickChildCareRate: empty rates returns 0', () => {
    expect(pickChildCareRate(10000, { maxExpenseOne: 3000, maxExpenseTwo: 6000, rates: [] })).toBe(0);
  });

  it('pickChildCareRate: AGI exceeds all tiers → last tier rate', () => {
    expect(pickChildCareRate(1_000_000, C)).toBeCloseTo(0.20, 4);
  });

  it('returns zeros when constants missing', () => {
    const out = computeForm2441(undefined, 50000, 'single', undefined);
    expect(out.credit).toBe(0);
  });

  it('returns zeros when no qualifying persons', () => {
    const f: Form2441 = {
      totalQualifiedExpenses: 5000, numQualifyingPersons: 0,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 0,
    };
    expect(computeForm2441(f, 50000, 'single', C).credit).toBe(0);
  });

  it('MFS with no exception is ineligible', () => {
    const f: Form2441 = {
      totalQualifiedExpenses: 3000, numQualifyingPersons: 1,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 0,
    };
    expect(computeForm2441(f, 50000, 'mfs', C).credit).toBe(0);
  });

  it('MFS with exception is treated as single-style (taxpayer earned-income limit only)', () => {
    const f: Form2441 & { mfsAbandonmentException?: boolean } = {
      totalQualifiedExpenses: 3000, numQualifyingPersons: 1,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 0,
      mfsAbandonmentException: true,
    };
    expect(computeForm2441(f as Form2441, 50000, 'mfs', C).credit).toBeGreaterThan(0);
  });

  it('employer-provided benefits reduce the cap', () => {
    const f: Form2441 = {
      totalQualifiedExpenses: 5000, numQualifyingPersons: 1,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 2000,
    };
    const out = computeForm2441(f, 50000, 'single', C);
    // cap $3000 - benefits $2000 = $1000 → allowed expenses $1000
    expect(out.allowedExpenses).toBe(1000);
  });

  it('MFJ uses lesser earned income of taxpayer/spouse', () => {
    const f: Form2441 = {
      totalQualifiedExpenses: 5000, numQualifyingPersons: 2,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 1000, employerProvidedBenefits: 0,
    };
    const out = computeForm2441(f, 50000, 'mfj', C);
    expect(out.allowedExpenses).toBe(1000); // limited by spouse earned income
  });

  it('§21(d)(2) imputed earned income for disabled spouse', () => {
    const f: Form2441 & { spouseIsStudentOrDisabled?: boolean } = {
      totalQualifiedExpenses: 6000, numQualifyingPersons: 2,
      taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 0,
      spouseIsStudentOrDisabled: true,
    };
    const out = computeForm2441(f as Form2441, 50000, 'mfj', C);
    // Imputed 500/mo × 12 = $6000 earned for spouse, so cap isn't earned-income limited.
    expect(out.allowedExpenses).toBe(6000);
  });

  it('§21(d)(2) imputed for one QP uses $250/mo (= $3000/yr)', () => {
    const f: Form2441 & { taxpayerIsStudentOrDisabled?: boolean } = {
      totalQualifiedExpenses: 3000, numQualifyingPersons: 1,
      taxpayerEarnedIncome: 0, spouseEarnedIncome: 50000, employerProvidedBenefits: 0,
      taxpayerIsStudentOrDisabled: true,
    };
    const out = computeForm2441(f as Form2441, 50000, 'mfj', C);
    expect(out.allowedExpenses).toBe(3000);
  });
});
