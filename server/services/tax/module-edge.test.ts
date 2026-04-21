// Targeted edge-case tests for remaining uncovered branches across individual
// tax modules: form6251 LTCG-row fallback, form2555 number-coercion defaults,
// form8962 missing-constants throws, eitc non-array dependents + missing-row
// fallback, otherTaxes defaults + legacy overload zero-path, etc.
import { describe, it, expect } from 'vitest';
import { computeForm6251 } from './form6251.js';
import { computeForm2555 } from './form2555.js';
import { computeForm8962, pickApplicablePercentage } from './form8962.js';
import { computeEitc } from './eitc.js';
import { computeSeTax, computeEarlyWithdrawalPenalty } from './otherTaxes.js';
import type {
  AmtRow,
  EitcRow,
  FilingStatus,
  Form2555,
  Form6251,
  Form8962,
  PtcConstants,
  RetirementIncome,
} from '../../../shared/types.js';

describe('form6251 — preferential-income AMT fallback when ltcgRow missing', () => {
  const row: AmtRow = {
    exemption: 85700,
    phaseoutStart: 609350,
    phaseoutRate: 0.25,
    rate26: 0.26,
    rate28: 0.28,
    rate28Threshold: 232600,
    nolLimitPct: 0.9,
  };

  it('taxes preferential AMTI at ordinary AMT rates when ltcgRow is omitted', () => {
    // preferentialFromRegular = $300k, taxableIncome = $800k, regular tax = $0.
    const out = computeForm6251(
      { privateActivityBondInterest: 0, amtDepreciationAdjustment: 0, otherAdjustments: 0, amtNolCarryforward: 0 } as Form6251,
      'single',
      800000,
      0,
      0,
      0,
      row,
      300000,
      undefined, // <-- no ltcgRow → fallback branch fires
    );
    // With no ltcgRow, preferential amount is taxed at ordinary AMT rates
    // (26% up to rate28Threshold - ordinaryAmti, then 28%). The positive tmt
    // demonstrates the fallback branch ran.
    expect(out.tentativeMinimumTax).toBeGreaterThan(0);
  });

  it('returns zeros when AmtRow is missing', () => {
    const out = computeForm6251(
      undefined,
      'single',
      100000,
      10000,
      0,
      0,
      undefined,
      0,
      undefined,
    );
    expect(out.tentativeMinimumTax).toBe(0);
    expect(out.amtLiability).toBe(0);
  });

  it('clamps AMT NOL to 90% of AMTI before NOL', () => {
    const out = computeForm6251(
      { privateActivityBondInterest: 0, amtDepreciationAdjustment: 0, otherAdjustments: 0, amtNolCarryforward: 9_999_999 } as Form6251,
      'single',
      100000,
      0,
      10000,
      0,
      row,
      0,
      undefined,
    );
    // AMTI-before-NOL = 110000, 90% cap = 99000 → amti = 11000.
    expect(out.amti).toBeCloseTo(11000, 0);
  });
});

describe('form2555 — numeric-coercion fallbacks', () => {
  const FEIE = { exclusionLimit: 130000, housingBasePct: 0.16, housingCapPct: 0.30 };

  it('coerces string / NaN inputs to safe defaults', () => {
    const input = {
      foreignEarnedIncome: 'abc' as unknown as number,
      qualifyingDays: 'x' as unknown as number,
      totalDaysInPeriod: 'y' as unknown as number,
      housingExpenses: 'z' as unknown as number,
      isBonaFideResident: true,
      usesPhysicalPresence: false,
    } as unknown as Form2555;
    const out = computeForm2555(input, FEIE);
    expect(out.foreignEarnedIncome).toBe(0);
    // totalDaysInPeriod defaults to 365 when NaN
    expect(out.exclusionAllowed).toBe(0);
  });

  it('location-adjusted cap string fallback to 0 → default cap wins', () => {
    const input: Form2555 & { locationAdjustedHousingCap?: unknown } = {
      foreignEarnedIncome: 150000,
      qualifyingDays: 365,
      totalDaysInPeriod: 365,
      housingExpenses: 60000,
      isBonaFideResident: true,
      usesPhysicalPresence: false,
      locationAdjustedHousingCap: 'oops' as unknown as number,
    };
    const out = computeForm2555(input as Form2555, FEIE);
    // With a bad override coerced to 0, the 30% floor applies.
    expect(out.housingCap).toBe(39000);
  });
});

describe('form8962 — missing-constants throws + helper branches', () => {
  const f: Form8962 = {
    householdSize: 2,
    federalPovertyLine: 20000,
    annualEnrollmentPremium: 7000,
    annualSlcsp: 8000,
    advancePtcPaid: 0,
    additionalMagi: 0,
  };

  it('throws when contributionBands is missing', () => {
    expect(() => computeForm8962(f, 50000, 'single', {} as PtcConstants)).toThrow(/contributionBands/);
  });

  it('throws when repaymentCapSingle is missing', () => {
    const constants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
    } as PtcConstants;
    expect(() => computeForm8962(f, 50000, 'single', constants)).toThrow(/repaymentCapSingle/);
  });

  it('throws when repaymentCapFamily is missing', () => {
    const constants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }],
    } as PtcConstants;
    expect(() => computeForm8962(f, 50000, 'single', constants)).toThrow(/repaymentCapFamily/);
  });

  it('returns zeros when input is undefined', () => {
    expect(computeForm8962(undefined, 50000, 'single', {} as PtcConstants).annualPtc).toBe(0);
  });

  it('pickApplicablePercentage: at exact band edge', () => {
    const bands = [
      { fpl: 150, pct: 0 },
      { fpl: 400, pct: 0.085 },
    ];
    expect(pickApplicablePercentage(150, bands)).toBe(0);
    expect(pickApplicablePercentage(400, bands)).toBeCloseTo(0.085, 4);
  });

  it('pickApplicablePercentage: above top band stays at top pct', () => {
    const bands = [
      { fpl: 150, pct: 0 },
      { fpl: 400, pct: 0.085 },
    ];
    expect(pickApplicablePercentage(500, bands)).toBeCloseTo(0.085, 4);
  });

  it('pickApplicablePercentage: zero-width band returns lo.pct without divide-by-zero', () => {
    const bands = [
      { fpl: 150, pct: 0 },
      { fpl: 150, pct: 0.03 },
    ];
    // fpl=150 matches both — the first one's `pct` is returned on zero-width.
    expect(pickApplicablePercentage(150, bands)).toBe(0);
  });

  it('MFS filer without abuse exception → eligible band is zero', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }, { fpl: 300, cap: 950 }],
      repaymentCapFamily: [{ fpl: 200, cap: 750 }, { fpl: 300, cap: 1900 }],
    };
    const out = computeForm8962(f, 50000, 'mfs', constants);
    expect(out.annualPtc).toBe(0);
  });

  it('MFS + abuse/abandonment exception → PTC can be positive', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }, { fpl: 300, cap: 950 }],
      repaymentCapFamily: [{ fpl: 200, cap: 750 }, { fpl: 300, cap: 1900 }],
    };
    const out = computeForm8962(
      { ...f, mfsAbuseAbandonmentException: true } as Form8962 & { mfsAbuseAbandonmentException: boolean },
      50000,
      'mfs',
      constants,
    );
    expect(out.annualPtc).toBeGreaterThanOrEqual(0);
  });

  it('APTC overpayment capped at repaymentCap (family table)', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }, { fpl: 300, cap: 950 }, { fpl: 400, cap: 1575 }],
      repaymentCapFamily: [{ fpl: 200, cap: 750 }, { fpl: 300, cap: 1900 }, { fpl: 400, cap: 3150 }],
    };
    const out = computeForm8962(
      { ...f, advancePtcPaid: 20000, annualEnrollmentPremium: 0, annualSlcsp: 0 },
      50000,
      'mfj',
      constants,
    );
    // Advance PTC of $20k, zero PTC → cap applies.
    expect(out.aptcRepayment).toBeLessThanOrEqual(3150);
  });

  it('above 400% FPL: no cap → full repayment', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }, { fpl: 300, cap: 950 }, { fpl: 400, cap: 1575 }],
      repaymentCapFamily: [{ fpl: 200, cap: 750 }, { fpl: 300, cap: 1900 }, { fpl: 400, cap: 3150 }],
    };
    const out = computeForm8962(
      { ...f, householdSize: 1, federalPovertyLine: 15000, advancePtcPaid: 5000, annualEnrollmentPremium: 0, annualSlcsp: 0 },
      200000,
      'single',
      constants,
    );
    // FPL% well above 400 → cap is +Infinity → full excess repaid.
    expect(out.aptcRepayment).toBe(5000);
  });

  it('fpl <= 0 short-circuits to zeros + advancePtc passthrough', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 150, pct: 0 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [{ fpl: 200, cap: 375 }],
      repaymentCapFamily: [{ fpl: 200, cap: 750 }],
    };
    const out = computeForm8962(
      { ...f, federalPovertyLine: 0, advancePtcPaid: 500 },
      50000,
      'single',
      constants,
    );
    expect(out.advancePtc).toBe(500);
    expect(out.annualPtc).toBe(0);
  });
});

describe('eitc — non-array dependents + missing-row fallback', () => {
  const table: Record<FilingStatus, Record<string, EitcRow>> = {
    single: {
      '0': { maxCredit: 600, phaseInRate: 0.0765, phaseOutRate: 0.0765, phaseOutStart: 10000, maxAgi: 18000 },
      '1': { maxCredit: 4000, phaseInRate: 0.34, phaseOutRate: 0.1598, phaseOutStart: 22000, maxAgi: 49000 },
    },
    // No entries for mfj / hoh / qw to exercise the "missing row" fallback.
    mfj: {},
    mfs: {},
    hoh: {},
    qw: {},
  };

  it('treats non-array dependents as 0 kids', () => {
    const out = computeEitc(
      {
        qualifyingChildrenOverride: null, investmentIncomeOverride: null,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0,
      },
      undefined as never,
      'single', 5000, 5000, 0, 0, 0, 0, 0, 0, table,
    );
    expect(out.qualifyingChildren).toBe(0);
    expect(out.credit).toBeGreaterThan(0);
  });

  it('returns partial zeros when the (status, kids) row is missing', () => {
    const out = computeEitc(
      {
        qualifyingChildrenOverride: 1, investmentIncomeOverride: null,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0,
      },
      [],
      'hoh', 20000, 20000, 0, 0, 0, 0, 0, 0, table,
    );
    expect(out.credit).toBe(0);
    expect(out.qualifyingChildren).toBe(1);
    expect(out.earnedIncome).toBe(20000);
  });

  it('custom investment income limit lets borderline cases pass', () => {
    const out = computeEitc(
      {
        qualifyingChildrenOverride: null, investmentIncomeOverride: 20000,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0,
      },
      [],
      'single', 10000, 10000, 0, 0, 0, 0, 0, 0, table,
      50000, // investmentIncomeLimit override
    );
    expect(out.disqualifiedByInvestment).toBe(false);
  });

  it('override investment income above default limit disqualifies', () => {
    const out = computeEitc(
      {
        qualifyingChildrenOverride: null, investmentIncomeOverride: 50000,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0,
      },
      [],
      'single', 10000, 10000, 0, 0, 0, 0, 0, 0, table,
    );
    expect(out.disqualifiedByInvestment).toBe(true);
  });
});

describe('otherTaxes — defaults, per-owner MFJ override, and exception codes', () => {
  it('legacy overload with zero SE earnings returns zeros', () => {
    expect(computeSeTax(0, 0, 168600)).toEqual({ seTax: 0, seTaxDeduction: 0 });
  });

  it('uses default rates when SeTaxConstants is undefined', () => {
    const out = computeSeTax(10000, 0, 168600);
    // 92.35% × 10000 = 9235. SS 12.4% = 1145.14; Medicare 2.9% = 267.81
    // → total 1412.95, deduction 706.48.
    expect(out.seTax).toBeCloseTo(1412.95, 1);
    expect(out.seTaxDeduction).toBeCloseTo(706.48, 1);
  });

  it('per-owner overload on MFJ gives each spouse their own SS wage-base', () => {
    // Single-filer (non-MFJ) collapses both entries into one ceiling.
    const nonMfj = computeSeTax(
      [
        { owner: 'taxpayer', seEarnings: 100000, w2SsWages: 100000 },
        { owner: 'spouse',   seEarnings: 100000, w2SsWages: 100000 },
      ],
      'single',
      168600,
    );
    const mfj = computeSeTax(
      [
        { owner: 'taxpayer', seEarnings: 100000, w2SsWages: 100000 },
        { owner: 'spouse',   seEarnings: 100000, w2SsWages: 100000 },
      ],
      'mfj',
      168600,
    );
    // On MFJ each spouse has their own SS ceiling, so more of the SE earnings
    // is subject to the 12.4% SS portion.
    expect(mfj.seTax).toBeGreaterThan(nonMfj.seTax);
  });

  it('per-owner overload: owner field missing defaults to taxpayer', () => {
    const out = computeSeTax(
      [
        { owner: undefined as unknown as 'taxpayer', seEarnings: 10000, w2SsWages: 0 },
        { owner: undefined as unknown as 'taxpayer', seEarnings: 10000, w2SsWages: 0 },
      ],
      'mfj',
      168600,
    );
    expect(out.seTax).toBeGreaterThan(0);
  });

  it('negative SE earnings in per-owner path are dropped', () => {
    const out = computeSeTax(
      [{ owner: 'taxpayer', seEarnings: -5000, w2SsWages: 0 }],
      'mfj',
      168600,
    );
    expect(out.seTax).toBe(0);
  });

  it('early-withdrawal penalty: distribution code 1 without exception triggers', () => {
    const items: RetirementIncome[] = [
      {
        id: 'r', payer: 'X', grossDistribution: 10000, taxableAmount: 10000,
        federalWithheld: 0, stateWithheld: 0,
        distributionCode: '1', isIra: true, isRoth: false,
        exceptionCode: null, taxableAmountNotDetermined: false,
      },
    ];
    expect(computeEarlyWithdrawalPenalty(items)).toBe(1000);
  });

  it('early-withdrawal penalty: exception code suppresses penalty', () => {
    const items: RetirementIncome[] = [
      {
        id: 'r', payer: 'X', grossDistribution: 10000, taxableAmount: 10000,
        federalWithheld: 0, stateWithheld: 0,
        distributionCode: '1', isIra: true, isRoth: false,
        exceptionCode: '03', taxableAmountNotDetermined: false,
      },
    ];
    expect(computeEarlyWithdrawalPenalty(items)).toBe(0);
  });

  it('early-withdrawal penalty: non-"1" distribution code is exempt', () => {
    const items: RetirementIncome[] = [
      {
        id: 'r', payer: 'X', grossDistribution: 10000, taxableAmount: 10000,
        federalWithheld: 0, stateWithheld: 0,
        distributionCode: '7', isIra: true, isRoth: false,
        exceptionCode: null, taxableAmountNotDetermined: false,
      },
    ];
    expect(computeEarlyWithdrawalPenalty(items)).toBe(0);
  });

  it('early-withdrawal penalty: honors a custom rate from PenaltyConstants', () => {
    const items: RetirementIncome[] = [
      {
        id: 'r', payer: 'X', grossDistribution: 10000, taxableAmount: 10000,
        federalWithheld: 0, stateWithheld: 0,
        distributionCode: '1', isIra: true, isRoth: false,
        exceptionCode: null, taxableAmountNotDetermined: false,
      },
    ];
    expect(computeEarlyWithdrawalPenalty(items, { earlyWithdrawalRate: 0.25, hsaAdditionalTaxRate: 0.20 })).toBe(2500);
  });
});
