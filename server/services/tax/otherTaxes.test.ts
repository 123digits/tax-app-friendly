import { describe, it, expect, beforeAll } from 'vitest';
import { computeEarlyWithdrawalPenalty, computeSeTax } from './otherTaxes.js';
import { computeReturn } from './index.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type { TaxReturn, RetirementIncome, TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function ret(r: Partial<RetirementIncome>): RetirementIncome {
  return {
    id: r.id ?? 'r1',
    payer: r.payer ?? 'Vanguard',
    grossDistribution: r.grossDistribution ?? 0,
    taxableAmount: r.taxableAmount ?? 0,
    federalWithheld: r.federalWithheld ?? 0,
    stateWithheld: r.stateWithheld ?? 0,
    distributionCode: r.distributionCode ?? null,
    isIra: r.isIra ?? false,
    isRoth: r.isRoth ?? false,
    exceptionCode: r.exceptionCode ?? null,
    taxableAmountNotDetermined: r.taxableAmountNotDetermined ?? false,
  };
}

describe('computeEarlyWithdrawalPenalty', () => {
  it('code 7 (normal) triggers no penalty', () => {
    expect(
      computeEarlyWithdrawalPenalty([
        ret({ taxableAmount: 20000, distributionCode: '7' }),
      ])
    ).toBe(0);
  });

  it('code 1 with no exception triggers 10% additional tax', () => {
    expect(
      computeEarlyWithdrawalPenalty([
        ret({ taxableAmount: 20000, distributionCode: '1' }),
      ])
    ).toBeCloseTo(2000, 2);
  });

  it('code 1 with valid exception (02 = disability) triggers no penalty', () => {
    expect(
      computeEarlyWithdrawalPenalty([
        ret({ taxableAmount: 20000, distributionCode: '1', exceptionCode: '02' }),
      ])
    ).toBe(0);
  });
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

describe('computeReturn with retirement income', () => {
  it('flows 1099-R taxable into total income and withholding into payments', () => {
    const r = emptyReturn({
      retirementIncome: [
        ret({
          id: 'r1',
          grossDistribution: 30000,
          taxableAmount: 25000,
          federalWithheld: 2500,
          distributionCode: '7',
        }),
      ],
    });
    const c = computeReturn(r, DEFAULT_2025);
    expect(c.income.retirementGross).toBe(30000);
    expect(c.income.retirementTaxable).toBe(25000);
    expect(c.income.totalIncome).toBeCloseTo(25000, 2);
    expect(c.payments.withholding).toBe(2500);
    expect(c.otherTaxes.earlyWithdrawalPenalty).toBe(0);
  });
});

// IRC §1402(b): per-spouse SS wage-base ceiling on MFJ. Unit tests for the
// new per-owner overload of computeSeTax.
describe('computeSeTax (per-spouse SS wage base, IRC §1402(b))', () => {
  const ssWageBase = 176_100; // approximate 2025 figure; test is rate-derived
  const seConstants = { ssRate: 0.124, medicareRate: 0.029, incomeFactor: 0.9235 };

  it('MFJ with both spouses above the wage base → SS on 2× ceiling', () => {
    const big = 400_000;
    const { seTax } = computeSeTax(
      [
        { owner: 'taxpayer', seEarnings: big, w2SsWages: 0 },
        { owner: 'spouse',   seEarnings: big, w2SsWages: 0 },
      ],
      'mfj',
      ssWageBase,
      seConstants,
    );
    const expectedSs = 2 * ssWageBase * seConstants.ssRate;
    const expectedMed = 2 * big * seConstants.incomeFactor * seConstants.medicareRate;
    expect(seTax).toBeGreaterThan(expectedSs + expectedMed - 5);
    expect(seTax).toBeLessThan(expectedSs + expectedMed + 5);
  });

  it('Non-MFJ ignores owner tags and applies exactly one ceiling', () => {
    const big = 400_000;
    const { seTax } = computeSeTax(
      [
        { owner: 'taxpayer', seEarnings: big / 2, w2SsWages: 0 },
        { owner: 'spouse',   seEarnings: big / 2, w2SsWages: 0 },
      ],
      'single',
      ssWageBase,
      seConstants,
    );
    // Everyone collapses to 'taxpayer' on non-MFJ, so one ceiling applies.
    const netSe = big * seConstants.incomeFactor;
    const expected =
      ssWageBase * seConstants.ssRate + netSe * seConstants.medicareRate;
    expect(seTax).toBeGreaterThan(expected - 5);
    expect(seTax).toBeLessThan(expected + 5);
  });

  it('legacy aggregate signature still works and matches old behavior', () => {
    const { seTax } = computeSeTax(50_000, 0, ssWageBase, seConstants);
    const netSe = 50_000 * seConstants.incomeFactor;
    const expected = netSe * seConstants.ssRate + netSe * seConstants.medicareRate;
    expect(seTax).toBeCloseTo(expected, 0);
  });

  it('per-spouse W-2 SS wages reduce only that spouse\'s remaining ceiling', () => {
    // Taxpayer's W-2 consumes the ceiling entirely; spouse has a fresh one.
    const { seTax } = computeSeTax(
      [
        { owner: 'taxpayer', seEarnings: 50_000, w2SsWages: ssWageBase },
        { owner: 'spouse',   seEarnings: 50_000, w2SsWages: 0 },
      ],
      'mfj',
      ssWageBase,
      seConstants,
    );
    const tpNet = 50_000 * seConstants.incomeFactor;
    const spNet = 50_000 * seConstants.incomeFactor;
    // Taxpayer pays 0 SS (base fully consumed), spouse pays full SS on spNet.
    const expectedSs = spNet * seConstants.ssRate;
    const expectedMed = (tpNet + spNet) * seConstants.medicareRate;
    expect(seTax).toBeGreaterThan(expectedSs + expectedMed - 5);
    expect(seTax).toBeLessThan(expectedSs + expectedMed + 5);
  });
});
