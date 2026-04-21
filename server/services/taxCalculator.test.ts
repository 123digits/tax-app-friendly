import { describe, it, expect, beforeAll } from 'vitest';
import { computeReturn, applyBrackets } from './tax/index.js';
import { runMigrations } from '../db/migrate.js';
import { getConfig } from './taxYearConfig.js';
import type { TaxReturn, TaxYearConstants } from '../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function emptyReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'r1',
    taxYear: 2025,
    filingStatus: 'single',
    status: 'in_progress',
    personalInfo: {
      firstName: null, lastName: null, ssnLast4: null, dob: null,
      addressLine1: null, addressLine2: null, city: null, state: null, zip: null,
      spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
    },
    dependents: [],
    w2s: [],
    interest: [],
    dividends: [],
    selfEmployment: [],
    capitalGains: [],
    retirementIncome: [],
    socialSecurity: { grossBenefits: 0, medicarePremiums: 0, federalWithheld: 0 },
    unemployment: [],
    gambling: [],
    gamblingLosses: 0,
    otherIncome: [],
    scheduleERentals: [],
    scheduleERoyalties: [],
    k1s: [],
    farms: [],
    form4797Sales: [],
    depreciationAssets: [],
    homeOffices: [],
    schedule1Adjustments: {
      educatorExpenses: 0,
      hsaDeduction: 0,
      selfEmployedHealthInsurance: 0,
      sepContribution: 0,
      simpleContribution: 0,
      solo401kContribution: 0,
      traditionalIraDeduction: 0,
      studentLoanInterest: 0,
      penaltyEarlyWithdrawal: 0,
      alimonyPaid: 0,
      alimonyRecipientSsn: null,
      alimonyDivorceDate: null,
      reservistExpenses: 0,
      performingArtistExpenses: 0,
      feeBasisExpenses: 0,
    },
    form8606: {
      priorYearBasis: 0,
      currentYearNondeductible: 0,
      traditionalIraBalance: 0,
      distributions: 0,
      conversions: 0,
    },
    form8889: {
      coverage: 'none',
      contributions: 0,
      isCatchUpEligible: false,
      distributions: 0,
      qualifiedMedicalExpenses: 0,
      isDisabledOrOver65: false,
    },
    form2441: {
      totalQualifiedExpenses: 0,
      numQualifyingPersons: 0,
      taxpayerEarnedIncome: 0,
      spouseEarnedIncome: 0,
      employerProvidedBenefits: 0,
    },
    form8863Students: [],
    form8880: {
      elective401kDeferrals: 0,
      iraContributions: 0,
      spouseElective401kDeferrals: 0,
      spouseIraContributions: 0,
      distributionsReceived: 0,
    },
    scheduleR: {
      isTaxpayerEligible: false,
      isSpouseEligible: false,
      taxpayerUnder65Disabled: false,
      spouseUnder65Disabled: false,
      disabilityIncome: 0,
      nontaxableSsAndPension: 0,
    },
    form8396: {
      certificateRate: 0,
      mortgageInterestPaid: 0,
      priorYearUnusedCredit: 0,
    },
    form5695: {
      solarElectric: 0,
      solarWaterHeating: 0,
      windEnergy: 0,
      geothermalHeatPump: 0,
      biomassFuel: 0,
      batteryStorageTech: 0,
      fuelCellCost: 0,
      fuelCellKw: 0,
      insulationAirSealing: 0,
      exteriorWindows: 0,
      exteriorDoors: 0,
      homeEnergyAudit: 0,
      heatPumps: 0,
      biomassStoves: 0,
      centralAc: 0,
      furnaceBoiler: 0,
    },
    form8936Vehicles: [],
    form1116Baskets: [],
    schedule8812: {
      qualifyingChildrenOverride: null,
      earnedIncomeOverride: null,
      includeCombatPay: false,
      combatPayAmount: 0,
    },
    eitcEligibility: {
      qualifyingChildrenOverride: null,
      investmentIncomeOverride: null,
      isEligibleAge: true,
      includeCombatPay: false,
      combatPayAmount: 0,
    },
    form8962: {
      householdSize: 0,
      federalPovertyLine: 0,
      annualEnrollmentPremium: 0,
      annualSlcsp: 0,
      advancePtcPaid: 0,
      additionalMagi: 0,
    },
    form6251: {
      privateActivityBondInterest: 0,
      amtDepreciationAdjustment: 0,
      otherAdjustments: 0,
      amtNolCarryforward: 0,
    },
    form8960: {
      investmentInterestExpense: 0,
      stateTaxAllocableToInvestment: 0,
      miscInvestmentExpenses: 0,
      otherModifications: 0,
    },
    form8959: {
      rrtaCompensation: 0,
      additionalMedicareWithheld: 0,
    },
    form2555: {
      foreignEarnedIncome: 0,
      qualifyingDays: 0,
      totalDaysInPeriod: 365,
      housingExpenses: 0,
      isBonaFideResident: false,
      usesPhysicalPresence: false,
    },
    scheduleH: {
      cashWagesSsMedicare: 0,
      cashWagesFuta: 0,
      anyQuarterOver1000: false,
      federalIncomeTaxWithheld: 0,
      stateUnemploymentPaid: 0,
    },
    form2210: {
      priorYearTax: 0,
      priorYearAgi: 0,
      withholdingByQuarter: [0, 0, 0, 0],
      estimatedPaymentsByQuarter: [0, 0, 0, 0],
      requestWaiver: false,
    },
    form5405: {
      annualInstallment: 0,
      dispositionAccelerated: 0,
    },
    form4972: {
      qualifyingLumpSum: 0,
      capitalGainPortion: 0,
      ordinaryPortion: 0,
      computedTax: 0,
    },
    itemized: {
      medical: 0, stateLocalTax: 0, realEstateTax: 0,
      mortgageInterest: 0, charitableCash: 0, charitableNoncash: 0,
    },
    useStandardDeduction: true,
    estimatedPayments: 0,
    schedule1: {},
    schedule2: {},
    schedule3: {},
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('applyBrackets', () => {
  it('zero income yields zero tax', () => {
    expect(applyBrackets(0, DEFAULT_2025.brackets.single)).toBe(0);
  });

  it('taxes within first bracket at 10%', () => {
    expect(applyBrackets(10000, DEFAULT_2025.brackets.single)).toBeCloseTo(1000, 2);
  });
});

describe('computeReturn', () => {
  it('single filer with $75k wages, MFJ 1 dep sample', () => {
    const r = emptyReturn({
      filingStatus: 'mfj',
      dependents: [
        { id: 'd1', name: 'Kid', ssnLast4: null, relationship: 'child', dob: null, isQualifyingChild: true },
      ],
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 75000, box2FedWithheld: 8000,
        box3SsWages: 75000, box4SsWithheld: 0,
        box5MedicareWages: 75000, box6MedicareWithheld: 0,
        stateWages: 0, stateWithheld: 0,
      }],
      interest: [{ id: 'i1', payer: 'Bank', amount: 200, taxExempt: false }],
      dividends: [{ id: 'dv1', payer: 'Broker', ordinary: 1000, qualified: 1000 }],
    });

    const c = computeReturn(r, DEFAULT_2025);
    expect(c.income.wages).toBe(75000);
    expect(c.income.interest).toBe(200);
    expect(c.income.ordinaryDividends).toBe(1000);
    expect(c.income.totalIncome).toBeCloseTo(76200, 2);
    // 2025 MFJ standard deduction is exactly $30,000 (Rev. Proc. 2024-40).
    expect(c.deductions.used).toBeGreaterThanOrEqual(30000);
    expect(c.credits.childTaxCredit).toBe(2000);
    expect(c.summary.refund + c.summary.balanceDue).toBeGreaterThanOrEqual(0);
  });

  it('applies capital loss cap of $3000', () => {
    const r = emptyReturn({
      capitalGains: [
        { id: 'c1', description: 'x', dateAcquired: null, dateSold: null, proceeds: 1000, costBasis: 11000, term: 'long' },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    expect(c.income.capitalLossDeduction).toBe(-3000);
  });

  it('threads admin-edited penalties.earlyWithdrawalRate through the orchestrator', () => {
    // Regression guard for Wave 3: an early 1099-R distribution of $10,000
    // with box 7 = '1' and no exception should incur a 10% Form 5329 penalty
    // by default. Doubling penalties.earlyWithdrawalRate to 0.20 in a clone
    // of DEFAULT_2025 must double the penalty, proving the admin-editable
    // constant actually flows from TaxYearConstants through computeReturn
    // to computeEarlyWithdrawalPenalty.
    const r = emptyReturn({
      retirementIncome: [{
        id: 'r1',
        payer: 'Plan',
        grossDistribution: 10000,
        taxableAmount: 10000,
        federalWithheld: 0,
        stateWithheld: 0,
        distributionCode: '1',
        isIra: false,
        isRoth: false,
        exceptionCode: null,
        taxableAmountNotDetermined: false,
      }],
    });
    const doubled = {
      ...DEFAULT_2025,
      penalties: {
        ...(DEFAULT_2025.penalties ?? { earlyWithdrawalRate: 0.10, hsaAdditionalTaxRate: 0.20 }),
        earlyWithdrawalRate: 0.20,
      },
    };
    const base = computeReturn(r, DEFAULT_2025);
    const bumped = computeReturn(r, doubled);
    expect(base.otherTaxes.earlyWithdrawalPenalty).toBe(1000);
    expect(bumped.otherTaxes.earlyWithdrawalPenalty).toBe(2000);
  });

  it('refunds excess Social Security tax withheld when ≥2 W-2s exceed 6.2% × wage base (§31(b))', () => {
    // 2025 SS wage base = $176,100 → max employee SS tax = 176,100 × 0.062 = $10,918.20.
    // Two W-2s each withholding $8,000 box-4 → combined $16,000 → excess = $5,081.80.
    // This must surface as a refundable credit on Schedule 3 line 11.
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [
        {
          id: 'w1', employer: 'Acme', ein: null,
          box1Wages: 130000, box2FedWithheld: 0,
          box3SsWages: 130000, box4SsWithheld: 8000,
          box5MedicareWages: 130000, box6MedicareWithheld: 0,
          stateWages: 0, stateWithheld: 0,
        },
        {
          id: 'w2', employer: 'Beta', ein: null,
          box1Wages: 130000, box2FedWithheld: 0,
          box3SsWages: 130000, box4SsWithheld: 8000,
          box5MedicareWages: 130000, box6MedicareWithheld: 0,
          stateWages: 0, stateWithheld: 0,
        },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    const maxSs = DEFAULT_2025.ssWageBase * 0.062;
    const expectedExcess = 16000 - maxSs;
    expect(c.refundableCredits.excessSocialSecurity).toBeCloseTo(expectedExcess, 2);
  });

  it('does not compute excess SS when only one W-2 (§31(b) requires ≥2 employers)', () => {
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 300000, box2FedWithheld: 0,
        box3SsWages: 176100, box4SsWithheld: 15000, // overwithheld but single employer
        box5MedicareWages: 300000, box6MedicareWithheld: 0,
        stateWages: 0, stateWithheld: 0,
      }],
    });
    const c = computeReturn(r, DEFAULT_2025);
    expect(c.refundableCredits.excessSocialSecurity).toBe(0);
  });

  it('refundable credits (EITC) reduce the §6654 underpayment-penalty base (Form 2210 Part I line 2)', () => {
    // Per §6654(f) and Form 2210 Part I lines 2-3, "tax shown on the return"
    // for the underpayment-penalty calculation is total tax − refundable
    // credits (EITC, ACTC, refundable AOTC, net PTC, excess SS withholding).
    // This test pins that behavior end-to-end via the orchestrator.
    //
    // Setup: MFJ, Schedule C net profit $30k (generates SE tax ≈ $4.2k but
    // no regular income tax after MFJ $30k standard deduction). No wage
    // withholding and no estimated payments. priorYearTax is large so the
    // safe-harbor pivot is the 90%-of-current-year test.
    //
    // Return A: EITC override → 0 qualifying children (no EITC).
    // Return B: EITC override → 2 qualifying children (several-thousand
    // dollar EITC). Nothing else differs. The EITC must flow through
    // refundableCreditsTotal into currentYearTaxForPenalty, shrinking the
    // 90% safe harbor and therefore the underpayment penalty.
    const common: Partial<TaxReturn> = {
      filingStatus: 'mfj',
      selfEmployment: [{
        id: 'sc1',
        businessName: 'Sole Prop',
        ein: null,
        principalActivity: null,
        grossReceipts: 30000,
        returnsAllowances: 0,
        costOfGoods: 0,
        expenses: {},
      }],
      form2210: {
        priorYearTax: 50000,
        priorYearAgi: 100000,
        withholdingByQuarter: [0, 0, 0, 0],
        estimatedPaymentsByQuarter: [0, 0, 0, 0],
        requestWaiver: false,
      },
    };
    const withoutEitc = emptyReturn({
      ...common,
      eitcEligibility: {
        qualifyingChildrenOverride: 0,
        investmentIncomeOverride: 0,
        isEligibleAge: false,
        includeCombatPay: false,
        combatPayAmount: 0,
      },
    });
    const withEitc = emptyReturn({
      ...common,
      eitcEligibility: {
        qualifyingChildrenOverride: 2,
        investmentIncomeOverride: 0,
        isEligibleAge: true,
        includeCombatPay: false,
        combatPayAmount: 0,
      },
    });

    const a = computeReturn(withoutEitc, DEFAULT_2025);
    const b = computeReturn(withEitc, DEFAULT_2025);

    // Sanity: both returns have the same total-tax-before-credits composition
    // (same SE tax) so any change in penalty must come from refundable credits.
    expect(b.otherTaxes.seTax).toBeCloseTo(a.otherTaxes.seTax, 2);
    expect(a.refundableCredits.earnedIncomeCredit).toBe(0);
    expect(b.refundableCredits.earnedIncomeCredit).toBeGreaterThan(0);

    // The EITC-bearing return must have a strictly smaller 2210 penalty.
    // With $0 payments and a material underpayment, A must have a nonzero
    // penalty; B's penalty must be lower (commonly zero once EITC exceeds
    // the SE tax that constituted the penalty base).
    expect(a.otherTaxes.underpaymentPenalty).toBeGreaterThan(0);
    expect(b.otherTaxes.underpaymentPenalty).toBeLessThan(
      a.otherTaxes.underpaymentPenalty,
    );
  });

  it('respects admin-edited constants (e.g. increased standard deduction)', () => {
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 50000, box2FedWithheld: 0, box3SsWages: 50000, box4SsWithheld: 0,
        box5MedicareWages: 50000, box6MedicareWithheld: 0, stateWages: 0, stateWithheld: 0,
      }],
    });
    const withHigher = { ...DEFAULT_2025, standardDeduction: { ...DEFAULT_2025.standardDeduction, single: 25000 } };
    const a = computeReturn(r, DEFAULT_2025);
    const b = computeReturn(r, withHigher);
    expect(b.taxComputation.taxableIncome).toBe(
      a.taxComputation.taxableIncome - (25000 - DEFAULT_2025.standardDeduction.single)
    );
  });

  // ----- 1099-DIV Box 2a total capital gain distributions (Task #45) -----
  // Per Schedule D instructions, Box 2a flows to Schedule D line 13 (or, if
  // no Schedule D is required, directly to Form 1040 line 7). The amounts
  // are always long-term and qualify for LTCG preferential rates.

  it('1099-DIV Box 2a increases the long-term capital gain line', () => {
    const base = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 50000, box2FedWithheld: 0, box3SsWages: 50000, box4SsWithheld: 0,
        box5MedicareWages: 50000, box6MedicareWithheld: 0, stateWages: 0, stateWithheld: 0,
      }],
    });
    const without = computeReturn(
      { ...base, dividends: [{ id: 'd1', payer: 'Fund', ordinary: 0, qualified: 0 }] },
      DEFAULT_2025,
    );
    const withBox2a = computeReturn(
      {
        ...base,
        dividends: [
          { id: 'd1', payer: 'Fund', ordinary: 0, qualified: 0, totalCapGainDistributions: 5000 },
        ],
      },
      DEFAULT_2025,
    );
    // ComputedIncome surfaces the aggregated Box 2a line.
    expect(withBox2a.income.totalCapGainDistributions).toBe(5000);
    // LTCG line increases by exactly the Box 2a amount.
    expect(withBox2a.income.longTermGain - without.income.longTermGain).toBe(5000);
    // And AGI / totalIncome rises by the same amount (no Schedule D sales).
    expect(withBox2a.income.totalIncome - without.income.totalIncome).toBe(5000);
  });

  it('1099-DIV Box 2a alone triggers LTCG preferential-rate treatment', () => {
    // Low AGI single filer: $30k wages + $10k Box 2a cap-gain distribution.
    // For 2025 the single-filer 0% LTCG bracket goes up to $48,350 taxable
    // income, so the $10k preferential amount should be taxed at 0% — i.e.,
    // cap-gain distributions must flow through the LTCG computation rather
    // than being taxed at ordinary rates.
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 30000, box2FedWithheld: 0, box3SsWages: 30000, box4SsWithheld: 0,
        box5MedicareWages: 30000, box6MedicareWithheld: 0, stateWages: 0, stateWithheld: 0,
      }],
      dividends: [
        { id: 'd1', payer: 'Fund', ordinary: 0, qualified: 0, totalCapGainDistributions: 10000 },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    // The preferential pool's contribution to tax should be zero at this AGI.
    expect(c.taxComputation.ltcgTax).toBe(0);
    // Control: moving the same $10k into ordinary dividends (not qualified)
    // must produce strictly more regular tax than the Box-2a version.
    const ordinaryVersion = computeReturn(
      {
        ...r,
        dividends: [{ id: 'd1', payer: 'Fund', ordinary: 10000, qualified: 0 }],
      },
      DEFAULT_2025,
    );
    expect(ordinaryVersion.taxComputation.totalTax).toBeGreaterThan(
      c.taxComputation.totalTax,
    );
  });

  it('1099-DIV Box 2a does not disturb the qualified-≤-ordinary invariant', () => {
    // Adding Box 2a to a row must not change how sumDividends clamps
    // qualified to the per-row ordinary amount.
    const r = emptyReturn({
      filingStatus: 'single',
      dividends: [
        // Bad data: qualified > ordinary. Must still be clamped to ordinary.
        {
          id: 'd1', payer: 'Fund A', ordinary: 100, qualified: 500,
          totalCapGainDistributions: 250,
        },
        {
          id: 'd2', payer: 'Fund B', ordinary: 300, qualified: 300,
          totalCapGainDistributions: 0,
        },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    expect(c.income.ordinaryDividends).toBe(400);
    // Qualified clamped per row: min(500,100) + min(300,300) = 400.
    expect(c.income.qualifiedDividends).toBe(400);
    // Box 2a aggregates independently.
    expect(c.income.totalCapGainDistributions).toBe(250);
  });

  // ---------------------------------------------------------------------
  // IRC §1402(b): per-spouse Social Security wage-base ceiling on MFJ.
  // Task #44. Each spouse has their own ceiling; Medicare has no cap.
  // ---------------------------------------------------------------------

  it('MFJ with both spouses above the SS wage base → SS tax on 2× ceiling', () => {
    // Two Schedule-C sole proprietorships, one per spouse, each earning
    // enough SE income that 92.35% of it exceeds the SS wage base. Under
    // the correct per-spouse rule each spouse pays SS tax on the full
    // ceiling; the combined SS portion of SE tax is therefore ~ 2 ×
    // (ssWageBase × 12.4%). The pre-fix aggregate ceiling would cap SS at
    // ~ 1 × (ssWageBase × 12.4%) — this test asserts the correct behavior.
    const big = 400_000; // well above any plausible 2025 wage base
    const r = emptyReturn({
      filingStatus: 'mfj',
      selfEmployment: [
        {
          id: 'tp-sc', businessName: 'TP Biz', ein: null, principalActivity: null,
          grossReceipts: big, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          ownerSpouse: 'taxpayer',
        },
        {
          id: 'sp-sc', businessName: 'SP Biz', ein: null, principalActivity: null,
          grossReceipts: big, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          ownerSpouse: 'spouse',
        },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    const ssRate = DEFAULT_2025.seTax?.ssRate ?? 0.124;
    const medRate = DEFAULT_2025.seTax?.medicareRate ?? 0.029;
    const factor = DEFAULT_2025.seTax?.incomeFactor ?? 0.9235;
    const base = DEFAULT_2025.ssWageBase;

    const expectedSs = 2 * base * ssRate;
    const totalNetSe = 2 * big * factor;
    const expectedMedicare = totalNetSe * medRate;
    const expected = expectedSs + expectedMedicare;

    // Allow a few dollars of rounding slack.
    expect(c.otherTaxes.seTax).toBeGreaterThan(expected - 5);
    expect(c.otherTaxes.seTax).toBeLessThan(expected + 5);

    // Control: the single-ceiling (pre-fix) result would have been
    // strictly smaller by roughly `base × ssRate`.
    const singleCeilingEquivalent = base * ssRate + expectedMedicare;
    expect(c.otherTaxes.seTax).toBeGreaterThan(singleCeilingEquivalent + base * ssRate * 0.5);
  });

  it('Single filer unchanged by the per-spouse refactor', () => {
    // A single filer with SE income above the wage base still gets exactly
    // one ceiling. This guards against the per-owner path silently
    // double-counting or dropping earnings on non-MFJ filing statuses.
    const big = 400_000;
    const r = emptyReturn({
      filingStatus: 'single',
      selfEmployment: [
        {
          id: 'sc1', businessName: 'Sole Prop', ein: null, principalActivity: null,
          grossReceipts: big, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          // Explicitly tag 'spouse' just to prove the non-MFJ code path
          // ignores the tag and uses one ceiling.
          ownerSpouse: 'spouse',
        },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    const ssRate = DEFAULT_2025.seTax?.ssRate ?? 0.124;
    const medRate = DEFAULT_2025.seTax?.medicareRate ?? 0.029;
    const factor = DEFAULT_2025.seTax?.incomeFactor ?? 0.9235;
    const base = DEFAULT_2025.ssWageBase;
    const netSe = big * factor;
    const expected = base * ssRate + netSe * medRate;

    expect(c.otherTaxes.seTax).toBeGreaterThan(expected - 5);
    expect(c.otherTaxes.seTax).toBeLessThan(expected + 5);
  });

  it('MFJ: W-2 SS wages reduce each spouse wage base independently (Sched SE 8a)', () => {
    // Taxpayer already has W-2 box-3 SS wages up to the wage base from a
    // day job, and also runs a Schedule C on the side. Spouse has no W-2
    // and a separate Schedule C. Correct result: the taxpayer's SE income
    // pays only Medicare (their SS wage base is fully consumed), while
    // the spouse's SE income pays both SS (up to the full ceiling) and
    // Medicare. Pre-fix behavior would have incorrectly reduced the
    // spouse's base by the taxpayer's W-2 box-3 wages.
    const base = DEFAULT_2025.ssWageBase;
    const r = emptyReturn({
      filingStatus: 'mfj',
      w2s: [{
        id: 'w-tp', employer: 'BigCo', ein: null,
        box1Wages: base, box2FedWithheld: 0,
        box3SsWages: base, box4SsWithheld: 0,
        box5MedicareWages: base, box6MedicareWithheld: 0,
        stateWages: 0, stateWithheld: 0,
        ownerSpouse: 'taxpayer',
      }],
      selfEmployment: [
        {
          id: 'tp-sc', businessName: 'TP Side Biz', ein: null, principalActivity: null,
          grossReceipts: 50_000, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          ownerSpouse: 'taxpayer',
        },
        {
          id: 'sp-sc', businessName: 'SP Biz', ein: null, principalActivity: null,
          grossReceipts: 50_000, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          ownerSpouse: 'spouse',
        },
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    const ssRate = DEFAULT_2025.seTax?.ssRate ?? 0.124;
    const medRate = DEFAULT_2025.seTax?.medicareRate ?? 0.029;
    const factor = DEFAULT_2025.seTax?.incomeFactor ?? 0.9235;

    // Taxpayer net SE = 50k × 0.9235. SS portion = 0 (W-2 already at ceiling).
    // Spouse net SE = 50k × 0.9235. Spouse SS base remaining = full ceiling
    // so spouse pays SS on the full spouse net SE.
    const tpNet = 50_000 * factor;
    const spNet = 50_000 * factor;
    const expectedSs = spNet * ssRate; // taxpayer contributes 0
    const expectedMed = (tpNet + spNet) * medRate;
    const expected = expectedSs + expectedMed;

    expect(c.otherTaxes.seTax).toBeGreaterThan(expected - 5);
    expect(c.otherTaxes.seTax).toBeLessThan(expected + 5);
  });

  // ---------------------------------------------------------------------
  // Task #36 — Schedule 2 partitioned into Part I (→ 1040 line 17) and
  // Part II (→ 1040 line 23). Part I is treated as regular tax for §§26(a)
  // / 904; Part II is not.
  // ---------------------------------------------------------------------

  it('Schedule 2 Part I surfaces AMT and excess APTC repayment in its total', () => {
    // Force a modest APTC repayment by claiming advance PTC with low
    // annual premium. AMT is forced via Form 6251 otherAdjustments.
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 60000, box2FedWithheld: 0,
        box3SsWages: 60000, box4SsWithheld: 0,
        box5MedicareWages: 60000, box6MedicareWithheld: 0,
        stateWages: 0, stateWithheld: 0,
      }],
      form6251: {
        privateActivityBondInterest: 0,
        amtDepreciationAdjustment: 0,
        // Large AMT preference → force positive AMT liability.
        otherAdjustments: 200000,
        amtNolCarryforward: 0,
      },
      form8962: {
        householdSize: 1,
        federalPovertyLine: 15060,
        annualEnrollmentPremium: 1000,
        annualSlcsp: 1000,
        advancePtcPaid: 3000, // overpaid APTC → excess repayment
        additionalMagi: 0,
      },
    });
    const c = computeReturn(r, DEFAULT_2025);
    // AMT and excess APTC repayment must both appear in Part I.
    expect(c.schedule2.partI.amt).toBeGreaterThan(0);
    expect(c.schedule2.partI.excessAptcRepayment).toBeGreaterThan(0);
    expect(c.schedule2.partI.total).toBeCloseTo(
      c.schedule2.partI.amt + c.schedule2.partI.excessAptcRepayment,
      2,
    );
    // Part I does NOT include SE tax / NIIT / Add'l Medicare.
    expect(c.schedule2.partII.seTax).toBe(0);
  });

  it('Schedule 2 Part II surfaces SE tax + NIIT + Add\'l Medicare in its total', () => {
    // MFJ, large SE income + investment income → triggers NIIT and Add'l
    // Medicare. Part II total must equal the sum of its components.
    const r = emptyReturn({
      filingStatus: 'mfj',
      selfEmployment: [{
        id: 'sc1', businessName: 'Sole Prop', ein: null, principalActivity: null,
        grossReceipts: 400000, returnsAllowances: 0, costOfGoods: 0, expenses: {},
      }],
      interest: [{ id: 'i1', payer: 'Bank', amount: 50000, taxExempt: false }],
      dividends: [{ id: 'd1', payer: 'Broker', ordinary: 30000, qualified: 0 }],
    });
    const c = computeReturn(r, DEFAULT_2025);
    expect(c.schedule2.partII.seTax).toBeGreaterThan(0);
    expect(c.schedule2.partII.niit).toBeGreaterThan(0);
    expect(c.schedule2.partII.additionalMedicareTax).toBeGreaterThan(0);
    const recomputed =
      c.schedule2.partII.seTax +
      c.schedule2.partII.unreportedSsMedicare +
      c.schedule2.partII.earlyWithdrawalPenalty +
      c.schedule2.partII.additionalMedicareTax +
      c.schedule2.partII.niit +
      c.schedule2.partII.householdEmploymentTax +
      c.schedule2.partII.firstTimeHomebuyerRepayment +
      c.schedule2.partII.lumpSumAveraging +
      c.schedule2.partII.otherTaxes;
    expect(c.schedule2.partII.total).toBeCloseTo(recomputed, 2);
    // AMT and excess APTC are NOT in Part II.
    expect(c.schedule2.partI.amt).toBe(0);
    expect(c.schedule2.partI.excessAptcRepayment).toBe(0);
  });

  it('§26(a): nonrefundable credits cannot reduce Schedule 2 Part II (SE tax survives FTC)', () => {
    // MFJ, Schedule C net profit = $10k → ≈$1,413 SE tax (Part II).
    // Foreign tax paid = $15k in the general basket, tied to $200k foreign
    // general-category income → large FTC, far exceeding the filer's
    // regular tax. Without §26(a) discipline, credits could incorrectly
    // wipe out the SE tax. They must not.
    const r = emptyReturn({
      filingStatus: 'mfj',
      selfEmployment: [{
        id: 'sc1', businessName: 'Sole Prop', ein: null, principalActivity: null,
        grossReceipts: 10000, returnsAllowances: 0, costOfGoods: 0, expenses: {},
      }],
      form1116Baskets: [{
        id: 'b1',
        category: 'general',
        country: 'DE',
        foreignGrossIncome: 200000,
        definitelyRelatedDeductions: 0,
        foreignTaxPaid: 15000,
      }],
    });
    const c = computeReturn(r, DEFAULT_2025);

    // Sanity: there IS a Part II SE tax.
    expect(c.schedule2.partII.seTax).toBeGreaterThan(1000);

    // Foreign tax credit claimed: whatever §904 limits it to.
    // §26(a) ceiling — credits cannot exceed regular tax + Part I.
    const creditCeiling =
      c.taxComputation.regularTax +
      c.taxComputation.ltcgTax +
      c.schedule2.partI.total;
    expect(c.credits.total).toBeLessThanOrEqual(creditCeiling + 0.5);

    // taxAfterNonrefundableCredits floors at zero and excludes Part II.
    expect(c.taxComputation.taxAfterNonrefundableCredits).toBeGreaterThanOrEqual(0);

    // The critical invariant: even if all of regular tax + Part I were
    // wiped out by nonrefundable credits, Part II SE tax must still
    // survive in the final totalTaxAfterCredits (before refundable
    // credits are subtracted).
    // taxAfterNonrefundableCredits + Part II >= Part II seTax.
    expect(
      c.taxComputation.taxAfterNonrefundableCredits +
        c.schedule2.partII.total,
    ).toBeGreaterThanOrEqual(c.schedule2.partII.seTax - 1);
  });

  it('taxComputation.taxBeforeNonrefundableCredits = regular tax + LTCG tax + Schedule 2 Part I', () => {
    // Small wage return with a forced AMT. Confirms the new anchor field
    // exposes the §26(a) ceiling explicitly.
    const r = emptyReturn({
      filingStatus: 'single',
      w2s: [{
        id: 'w1', employer: 'Acme', ein: null,
        box1Wages: 80000, box2FedWithheld: 0,
        box3SsWages: 80000, box4SsWithheld: 0,
        box5MedicareWages: 80000, box6MedicareWithheld: 0,
        stateWages: 0, stateWithheld: 0,
      }],
      form6251: {
        privateActivityBondInterest: 0,
        amtDepreciationAdjustment: 0,
        otherAdjustments: 200000,
        amtNolCarryforward: 0,
      },
    });
    const c = computeReturn(r, DEFAULT_2025);
    const expected =
      c.taxComputation.regularTax +
      c.taxComputation.ltcgTax +
      c.schedule2.partI.total;
    expect(c.taxComputation.taxBeforeNonrefundableCredits).toBeCloseTo(expected, 2);
    expect(c.taxComputation.taxAfterNonrefundableCredits).toBeCloseTo(
      Math.max(0, expected - c.credits.total),
      2,
    );
  });
});
