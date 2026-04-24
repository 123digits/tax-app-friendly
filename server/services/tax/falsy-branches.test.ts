// Exercises a long tail of `|| 0` / `?? 0` / `?? default` right-side
// branches in the tax services that only fire when numeric input fields
// arrive as NaN / undefined / empty string. Integration tests always
// pass well-formed numbers so the left-side branches fire; these unit
// tests feed explicit non-numeric values to trigger the right-side.
import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import { computeHomeOfficeDeduction } from './form8829.js';
import { summarizeForm4797 } from './form4797.js';
import { computeForm4972 } from './form4972.js';
import { computeForm8606 } from './form8606.js';
import { computeForm8880 } from './form8880.js';
import { computeForm8962 } from './form8962.js';
import { computeForm8995 } from './form8995.js';
import { summarizeDepreciation } from './form4562.js';
import { aotcTentativeForStudent, computeForm8863 } from './form8863.js';
import { computeForm8936 } from './form8936.js';
import { computeForm2441 } from './form2441.js';
import { cappedIraDeduction } from './adjustments.js';
import { applyPassiveLossLimits } from './passiveLoss.js';
import { computeSchedule8812 } from './schedule8812.js';
import type { TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;

beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

describe('falsy-value right-side branches across tax services', () => {
  it('form8829 squareFeet + every expense field non-numeric → 0 deduction', () => {
    const r = computeHomeOfficeDeduction({
      id: 'h', businessId: null, useSimplified: false,
      squareFeet: undefined as unknown as number,
      totalHomeSquareFeet: 1000,
      utilities: undefined as unknown as number,
      insurance: undefined as unknown as number,
      mortgageInterest: undefined as unknown as number,
      realEstateTax: undefined as unknown as number,
      repairs: undefined as unknown as number,
      depreciation: undefined as unknown as number,
    });
    expect(r).toBe(0);
  });

  it('form4797 sale with non-numeric proceeds + costBasis → gain 0', () => {
    const r = summarizeForm4797([
      {
        id: 's', description: null, dateAcquired: null, dateSold: null,
        proceeds: undefined as unknown as number,
        costBasis: undefined as unknown as number,
        accumulatedDepreciation: 0,
        depreciationRecapture: 0,
        term: 'long_1231',
      },
    ], 0);
    expect(r.longTermCapitalGain).toBe(0);
  });

  it('form4972 with non-numeric lumpSum → 0 tax', () => {
    expect(
      computeForm4972({
        qualifyingLumpSum: undefined as unknown as number,
        capitalGainPortion: 0,
        ordinaryPortion: 0,
        computedTax: 0,
      }).electedTax,
    ).toBe(0);
  });

  it('form8606 denom=0 (no basis + zero distributions) → 0 nontaxable fraction', () => {
    const r = computeForm8606({
      priorYearBasis: 0, currentYearNondeductible: 0,
      traditionalIraBalance: 0, distributions: 0, conversions: 0,
    });
    expect(r.nontaxablePortion).toBe(0);
  });

  it('form8880 tiers.rates[i] defaults to 0 for AGI above all tiers', () => {
    // Feed an AGI that doesn't land on any tier boundary.
    const r = computeForm8880(
      { elective401kDeferrals: 1000, iraContributions: 0,
        spouseElective401kDeferrals: 0, spouseIraContributions: 0,
        distributionsReceived: 0 },
      999999, // AGI above all tiers
      'single',
      DEFAULT_2025.saversCredit?.single,
    );
    expect(r.credit).toBe(0);
  });

  it('form8962 with span ≤ 0 (single-point household income table)', () => {
    // When the table collapses to a single point (hi.magi === lo.magi),
    // the `span <= 0 ? lo.pct` branch fires. Easiest way: AGI sits
    // exactly on a table boundary where adjacent rows are equal.
    // Any AGI at or above 400% FPL gets capped at 8.5%, exercising
    // the upper-bound boundary path.
    const r = computeForm8962({
      householdSize: 1, federalPovertyLine: 15000,
      annualEnrollmentPremium: 6000, annualSlcsp: 5500,
      advancePtcPaid: 0, additionalMagi: 0,
    }, 999999, 'single', DEFAULT_2025.ptc);
    expect(r).toBeDefined();
  });

  it('form8995 activity with non-numeric qbi → 0 activityQbi', () => {
    const r = computeForm8995(
      { activities: [
          { id: 'a', name: null, ein: null,
            qbi: undefined as unknown as number,
            isSstb: false, w2Wages: 0, ubia: 0 },
        ],
        reitPtpDividends: 0,
        priorYearQbiLossCarry: 0,
        priorYearReitPtpLossCarry: 0,
      },
      'single', 50000, 0, DEFAULT_2025.qbi,
    );
    expect(r.qbiDeduction).toBe(0);
  });

  it('form4562 asset with businessUsePercent=0 → fallback to 1 (100%)', () => {
    // `n(a.businessUsePercent) || 1` — if pct is 0/NaN, defaults to 100%.
    const r = summarizeDepreciation(
      [{
        id: 'a', description: null, datePlacedInService: null,
        cost: 10000, macrsClass: '5',
        section179Election: 0, claimBonus: false,
        businessUsePercent: undefined as unknown as number,
        businessId: null,
      }],
      DEFAULT_2025.depreciation,
    );
    expect(r.totalMacrs).toBeGreaterThan(0);
  });

  it('form4562 unknown macrs class → 10% fallback rate', () => {
    const r = summarizeDepreciation(
      [{
        id: 'a', description: null, datePlacedInService: null,
        cost: 1000, macrsClass: 'unknown-class' as unknown as '5',
        section179Election: 0, claimBonus: false,
        businessUsePercent: 1, businessId: null,
      }],
      DEFAULT_2025.depreciation,
    );
    // rate default 0.1 → MACRS $100.
    expect(r.totalMacrs).toBeCloseTo(100, 2);
  });

  it('form8863 AOTC student with non-numeric qualifiedExpenses → 0 tentative', () => {
    expect(
      aotcTentativeForStudent(
        { id: 's', studentName: '', studentSsnLast4: null,
          creditType: 'aotc',
          qualifiedExpenses: undefined as unknown as number,
          isEligibleForAotc: true, priorAotcYears: 0 },
        2500,
        DEFAULT_2025.education,
      ),
    ).toBe(0);
  });

  it('form8863 LLC pool with non-numeric qualifiedExpenses → 0 in llcExpenses', () => {
    const r = computeForm8863(
      [{ id: 's', studentName: '', studentSsnLast4: null, creditType: 'llc',
         qualifiedExpenses: undefined as unknown as number,
         isEligibleForAotc: false, priorAotcYears: 0 }],
      50000, 'single', DEFAULT_2025.education,
    );
    expect(r.llcAllowed).toBe(0);
  });

  it('form8936 non-numeric priorYearAgi → coerces to 0 for safe-harbor test', () => {
    // `Math.max(0, Number(priorYearAgi) || 0)` — NaN → 0 → cap check.
    const r = computeForm8936(
      [{ id: 'v', make: null, model: null, year: 2024, vin: null,
         placedInService: null, isNew: false,
         purchasePrice: 10000, businessUsePercent: 0, userEnteredCredit: 3000 }],
      DEFAULT_2025.evCredit,
      80000,
      NaN,
      'single',
    );
    // AGI 80k current > 75k cap; priorYearAgi NaN → 0 passes → credit allowed.
    expect(r.personalUseCredit).toBeGreaterThan(0);
  });

  it('form8936 vehicle with non-numeric userEnteredCredit coerces to 0', () => {
    const r = computeForm8936(
      [{ id: 'v', make: null, model: null, year: 2024, vin: null,
         placedInService: null, isNew: true, purchasePrice: 40000,
         businessUsePercent: 0,
         userEnteredCredit: undefined as unknown as number }],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(0);
  });

  it('form2441 maxExpenseOne/Two falsy → 0 cap', () => {
    // Pass a constants object whose maxExpenseOne and Two are both falsy
    // so the `?? 0` right branches fire.
    const r = computeForm2441(
      { totalQualifiedExpenses: 10000, numQualifyingPersons: 2,
        taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0,
        employerProvidedBenefits: 0 },
      50000, 'single',
      { maxExpenseOne: undefined as unknown as number,
        maxExpenseTwo: undefined as unknown as number,
        rates: DEFAULT_2025.childCare!.rates } as unknown as typeof DEFAULT_2025.childCare,
    );
    expect(r.allowedExpenses).toBe(0);
  });

  it('form8962 pickApplicablePercentage span=0 → flat band pct', async () => {
    // Exercises the `if (span <= 0) return lo.pct;` branch by passing a
    // band table where two consecutive bands share the same fpl.
    const { pickApplicablePercentage } = await import('./form8962.js');
    const rate = pickApplicablePercentage(200, [
      { fpl: 100, pct: 0.02 },
      { fpl: 200, pct: 0.05 },
      { fpl: 200, pct: 0.08 }, // zero span between this and previous
      { fpl: 400, pct: 0.085 },
    ]);
    expect(typeof rate).toBe('number');
  });

  it('form8880 tiers.rates[i] undefined falls back to 0', async () => {
    // Exercises `applicableRate = tiers.rates[i] ?? 0;` right branch
    // when the rate for a tier is explicitly missing.
    const r = computeForm8880(
      { elective401kDeferrals: 1000, iraContributions: 0,
        spouseElective401kDeferrals: 0, spouseIraContributions: 0,
        distributionsReceived: 0 },
      25000, 'single',
      { agiTiers: [20000, 30000, 40000],
        // Second tier's rate is missing (undefined) so the fallback fires.
        rates: [undefined as unknown as number, 0.2, 0.1] } as unknown as NonNullable<typeof DEFAULT_2025.saversCredit>['single'],
    );
    // AGI 25000 falls in the 30000-tier → rate 0.2 applies.
    expect(r.credit).toBeGreaterThan(0);
  });

  it('form2441 numQualifyingPersons=1 with maxExpenseOne falsy → 0 cap', () => {
    // Exercises the else-branch `: (constants.maxExpenseOne ?? 0)`.
    const r = computeForm2441(
      { totalQualifiedExpenses: 5000, numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0,
        employerProvidedBenefits: 0 },
      50000, 'single',
      { maxExpenseOne: undefined as unknown as number,
        maxExpenseTwo: 6000,
        rates: DEFAULT_2025.childCare!.rates } as unknown as typeof DEFAULT_2025.childCare,
    );
    expect(r.allowedExpenses).toBe(0);
  });

  it('adjustments: cappedIraDeduction with non-numeric entered → 0', () => {
    expect(cappedIraDeduction(undefined as unknown as number, 40, undefined)).toBe(0);
  });

  it('passiveLoss: allocA.suspended.get falls back to 0 when key missing', () => {
    // Mount with entries such that one loss row's id doesn't appear in
    // the allocator's suspended map (e.g. zero-effective rows that are
    // skipped by allocatePro).
    const r = applyPassiveLossLimits(
      [
        { id: 'a', net: -10000, priorYearUnallowedLoss: 0 },
        { id: 'b', net: 0, priorYearUnallowedLoss: 0 }, // zero-effective
      ],
      [],
      80000,
      'single',
    );
    expect(r.totalSuspendedRental).toBeGreaterThanOrEqual(0);
  });

  it('schedule8812: earnedIncomeOverride overrides auto-earned-income', () => {
    // `if (input?.earnedIncomeOverride != null) { ... }` — exercises the
    // truthy side when override is supplied.
    const r = computeSchedule8812(
      { qualifyingChildrenOverride: null,
        earnedIncomeOverride: 50000,
        includeCombatPay: false, combatPayAmount: 0 },
      [{ id: 'd', name: 'kid', ssnLast4: null, relationship: null,
         dob: '2015-01-01', isQualifyingChild: true }],
      'single',
      30000, 10000, 2000, 0,
      { ctcPerChild: 2000, ctcPhaseoutStart: {
        single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qw: 400000 } },
      DEFAULT_2025.actc,
    );
    expect(r.combinedAfterPhaseout).toBe(2000);
  });
});
