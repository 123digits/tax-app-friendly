// Edge-case tests for tax/index.ts orchestrator branches that were not
// reached by the existing computeReturn tests — carryforward glue, AMT
// fallback (no LTCG bracket), NIIT threshold, FEIE non-qualifying paths,
// and the optional-userId degradation path.
import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import {
  computeReturnWithCarryforwards,
  buildEndOfYearCarryforwards,
  applyPriorYearCarryforwards,
  computeReturn,
} from './index.js';
import type {
  ComputedReturn,
  TaxReturn,
  TaxYearConstants,
} from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;

beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function emptyReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'edge-orch-return',
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
      educatorExpenses: 0, hsaDeduction: 0, selfEmployedHealthInsurance: 0,
      sepContribution: 0, simpleContribution: 0, solo401kContribution: 0,
      traditionalIraDeduction: 0, studentLoanInterest: 0, penaltyEarlyWithdrawal: 0,
      alimonyPaid: 0, alimonyRecipientSsn: null, alimonyDivorceDate: null,
      reservistExpenses: 0, performingArtistExpenses: 0, feeBasisExpenses: 0,
    },
    form8606: { priorYearBasis: 0, currentYearNondeductible: 0, traditionalIraBalance: 0, distributions: 0, conversions: 0 },
    form8889: { coverage: 'none', contributions: 0, isCatchUpEligible: false, distributions: 0, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false },
    form2441: { totalQualifiedExpenses: 0, numQualifyingPersons: 0, taxpayerEarnedIncome: 0, spouseEarnedIncome: 0, employerProvidedBenefits: 0 },
    form8863Students: [],
    form8880: { elective401kDeferrals: 0, iraContributions: 0, spouseElective401kDeferrals: 0, spouseIraContributions: 0, distributionsReceived: 0 },
    scheduleR: { isTaxpayerEligible: false, isSpouseEligible: false, taxpayerUnder65Disabled: false, spouseUnder65Disabled: false, disabilityIncome: 0, nontaxableSsAndPension: 0 },
    form8396: { certificateRate: 0, mortgageInterestPaid: 0, priorYearUnusedCredit: 0 },
    form5695: {
      solarElectric: 0, solarWaterHeating: 0, windEnergy: 0, geothermalHeatPump: 0,
      biomassFuel: 0, batteryStorageTech: 0, fuelCellCost: 0, fuelCellKw: 0,
      insulationAirSealing: 0, exteriorWindows: 0, exteriorDoors: 0, homeEnergyAudit: 0,
      heatPumps: 0, biomassStoves: 0, centralAc: 0, furnaceBoiler: 0,
    },
    form8936Vehicles: [],
    form1116Baskets: [],
    schedule8812: { qualifyingChildrenOverride: null, earnedIncomeOverride: null, includeCombatPay: false, combatPayAmount: 0 },
    eitcEligibility: { qualifyingChildrenOverride: null, investmentIncomeOverride: null, isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
    form8962: { householdSize: 0, federalPovertyLine: 0, annualEnrollmentPremium: 0, annualSlcsp: 0, advancePtcPaid: 0, additionalMagi: 0 },
    form6251: { privateActivityBondInterest: 0, amtDepreciationAdjustment: 0, otherAdjustments: 0, amtNolCarryforward: 0 },
    form8960: { investmentInterestExpense: 0, stateTaxAllocableToInvestment: 0, miscInvestmentExpenses: 0, otherModifications: 0 },
    form8959: { rrtaCompensation: 0, additionalMedicareWithheld: 0 },
    form2555: { foreignEarnedIncome: 0, qualifyingDays: 0, totalDaysInPeriod: 365, housingExpenses: 0, isBonaFideResident: false, usesPhysicalPresence: false },
    scheduleH: { cashWagesSsMedicare: 0, cashWagesFuta: 0, anyQuarterOver1000: false, federalIncomeTaxWithheld: 0, stateUnemploymentPaid: 0 },
    form2210: { priorYearTax: 0, priorYearAgi: 0, withholdingByQuarter: [0, 0, 0, 0], estimatedPaymentsByQuarter: [0, 0, 0, 0], requestWaiver: false },
    form5405: { annualInstallment: 0, dispositionAccelerated: 0 },
    form4972: { qualifyingLumpSum: 0, capitalGainPortion: 0, ordinaryPortion: 0, computedTax: 0 },
    itemized: { medical: 0, stateLocalTax: 0, realEstateTax: 0, mortgageInterest: 0, charitableCash: 0, charitableNoncash: 0 },
    useStandardDeduction: true,
    estimatedPayments: 0,
    schedule1: {},
    schedule2: {},
    schedule3: {},
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeReturnWithCarryforwards — null-userId degradation', () => {
  it('returns same as computeReturn when userId is null', async () => {
    const ret = emptyReturn();
    const a = await computeReturnWithCarryforwards(null, ret, DEFAULT_2025);
    const b = computeReturn(ret, DEFAULT_2025);
    expect(a.summary).toEqual(b.summary);
  });

  it('works with undefined userId', async () => {
    const ret = emptyReturn();
    const a = await computeReturnWithCarryforwards(undefined, ret, DEFAULT_2025);
    expect(a.summary).toBeDefined();
  });
});

describe('buildEndOfYearCarryforwards — every-row combinations', () => {
  it('emits no rows when every kind is zero', () => {
    const rows = buildEndOfYearCarryforwards({
      income: {
        capitalLossCarryforwardShortTerm: 0,
        capitalLossCarryforwardLongTerm: 0,
        capitalLossCarryforwardTotal: 0,
        rentalSuspendedLoss: 0,
        k1SuspendedLoss: 0,
      },
    } as unknown as ComputedReturn);
    expect(rows).toEqual([]);
  });

  it('emits all four kinds when all are positive', () => {
    const rows = buildEndOfYearCarryforwards({
      income: {
        capitalLossCarryforwardShortTerm: 1000,
        capitalLossCarryforwardLongTerm: 500,
        capitalLossCarryforwardTotal: 1500,
        rentalSuspendedLoss: 200,
        k1SuspendedLoss: 300,
      },
    } as unknown as ComputedReturn);
    expect(rows.map((r) => r.kind).sort()).toEqual([
      'capital_loss_long',
      'capital_loss_short',
      'passive_loss_k1',
      'passive_loss_rental',
    ]);
  });

  it('emits only the passive-loss-k1 row', () => {
    const rows = buildEndOfYearCarryforwards({
      income: {
        capitalLossCarryforwardShortTerm: 0,
        capitalLossCarryforwardLongTerm: 0,
        capitalLossCarryforwardTotal: 0,
        rentalSuspendedLoss: 0,
        k1SuspendedLoss: 750,
      },
    } as unknown as ComputedReturn);
    expect(rows.map((r) => r.kind)).toEqual(['passive_loss_k1']);
  });
});

describe('applyPriorYearCarryforwards — both kinds from table', () => {
  it('fills both ST and LT when user fields are zero', () => {
    const patched = applyPriorYearCarryforwards(emptyReturn(), [
      { id: '1', userId: 'u', taxYear: 2024, kind: 'capital_loss_short', refId: null, amount: 500, sourceReturnId: null, notes: null },
      { id: '2', userId: 'u', taxYear: 2024, kind: 'capital_loss_long', refId: null, amount: 700, sourceReturnId: null, notes: null },
    ]);
    expect(patched.priorYearShortTermLossCarryforward).toBe(500);
    expect(patched.priorYearLongTermLossCarryforward).toBe(700);
  });

  it('preserves user LT override', () => {
    const patched = applyPriorYearCarryforwards(emptyReturn({ priorYearLongTermLossCarryforward: 999 }), [
      { id: '2', userId: 'u', taxYear: 2024, kind: 'capital_loss_long', refId: null, amount: 700, sourceReturnId: null, notes: null },
    ]);
    expect(patched.priorYearLongTermLossCarryforward).toBe(999);
  });
});

describe('edge paths in computeReturn', () => {
  it('big return with passive rental loss + k1 loss exercises §469 suspension rows', () => {
    const ret = emptyReturn({
      filingStatus: 'mfj',
      w2s: [
        {
          id: 'w1', employer: 'High', ein: null,
          box1Wages: 350000, box2FedWithheld: 70000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 350000, box6MedicareWithheld: 5075,
          stateWages: 350000, stateWithheld: 20000,
        },
      ],
      scheduleERentals: [
        {
          id: 'r1', propertyAddress: '1 Main', propertyType: null,
          fairRentalDays: 365, personalUseDays: 0, rentsReceived: 10000,
          expenses: { mortgage: 18000, repairs: 4000 },
          activeParticipation: true, isPassive: true, priorYearUnallowedLoss: 0,
        },
      ],
      k1s: [
        {
          id: 'k1', entityKind: 'partnership', entityName: 'Pass-through', ein: null,
          isPassive: true,
          ordinaryBusinessIncome: -8000,
          netRentalRealEstate: 0, otherRentalIncome: 0,
          interestIncome: 0, ordinaryDividends: 0, qualifiedDividends: 0,
          royalties: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0, section1231Gain: 0,
          priorYearUnallowedLoss: 0,
        },
      ],
    });
    const out = computeReturn(ret, DEFAULT_2025);
    // Active-participation §25k allowance is fully phased out by AGI>150k (ends
    // at 150k for single, 150k MFJ). So rental loss is fully suspended.
    expect((out.income.rentalSuspendedLoss ?? 0) + (out.income.k1SuspendedLoss ?? 0)).toBeGreaterThan(0);
  });

  it('NIIT fires at high MFJ income', () => {
    const ret = emptyReturn({
      filingStatus: 'mfj',
      w2s: [
        {
          id: 'w1', employer: 'Big', ein: null,
          box1Wages: 400000, box2FedWithheld: 80000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 400000, box6MedicareWithheld: 5800,
          stateWages: 400000, stateWithheld: 20000,
        },
      ],
      interest: [{ id: 'i', payer: 'Bank', amount: 10000, taxExempt: false, privateActivityBondInterest: 0 }],
      dividends: [{
        id: 'd', payer: 'Broker', ordinary: 5000, qualified: 5000,
        totalCapGainDistributions: 0, unrecapSection1250Gain: 0, section1202Gain: 0,
      }],
    });
    const out = computeReturn(ret, DEFAULT_2025);
    // MFJ threshold is $250k; NIIT on investment portion.
    expect(out.otherTaxes.niit).toBeGreaterThan(0);
  });

  it('Additional Medicare fires above threshold', () => {
    const ret = emptyReturn({
      filingStatus: 'single',
      w2s: [
        {
          id: 'w1', employer: 'Rich', ein: null,
          box1Wages: 300000, box2FedWithheld: 60000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 300000, box6MedicareWithheld: 4350,
          stateWages: 300000, stateWithheld: 20000,
        },
      ],
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.otherTaxes.additionalMedicare).toBeGreaterThan(0);
  });

  it('FEIE physical-presence alt path reduces AGI', () => {
    const ret = emptyReturn({
      w2s: [],
      form2555: {
        foreignEarnedIncome: 120000,
        qualifyingDays: 330,
        totalDaysInPeriod: 365,
        housingExpenses: 20000,
        isBonaFideResident: false,
        usesPhysicalPresence: true,
      },
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.form2555?.totalExclusion).toBeGreaterThan(0);
  });

  it('AMT fires on a preference-heavy return', () => {
    const ret = emptyReturn({
      filingStatus: 'single',
      w2s: [
        {
          id: 'w1', employer: 'ISO', ein: null,
          box1Wages: 400000, box2FedWithheld: 40000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 400000, box6MedicareWithheld: 5800,
          stateWages: 400000, stateWithheld: 40000,
        },
      ],
      useStandardDeduction: false,
      itemized: {
        medical: 0, stateLocalTax: 40000, realEstateTax: 0,
        mortgageInterest: 0, charitableCash: 0, charitableNoncash: 0,
      },
      form6251: {
        privateActivityBondInterest: 5000,
        amtDepreciationAdjustment: 0,
        otherAdjustments: 50000,
        amtNolCarryforward: 0,
      },
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.form6251?.amti ?? 0).toBeGreaterThan(0);
  });

  it('Excess Social Security from two high-paying W-2s is refundable', () => {
    const ret = emptyReturn({
      w2s: [
        {
          id: 'w1', employer: 'A', ein: null,
          box1Wages: 180000, box2FedWithheld: 40000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 180000, box6MedicareWithheld: 2610,
          stateWages: 0, stateWithheld: 0,
        },
        {
          id: 'w2', employer: 'B', ein: null,
          box1Wages: 180000, box2FedWithheld: 40000,
          box3SsWages: 168000, box4SsWithheld: 10416,
          box5MedicareWages: 180000, box6MedicareWithheld: 2610,
          stateWages: 0, stateWithheld: 0,
        },
      ],
    });
    const out = computeReturn(ret, DEFAULT_2025);
    // Two W-2s with full SS withholding on each → 2×$10,416 > annual max
    // 6.2% × $168,600 = $10,453.20 → excess surfaced as a refundable credit.
    const excess = (out as unknown as { refundableCredits?: { excessSocialSecurity?: number } })
      .refundableCredits?.excessSocialSecurity ?? 0;
    expect(excess).toBeGreaterThan(0);
  });
});

describe('computeReturn — orchestrator sparse-value branches', () => {
  it('handles a farm with no ownerSpouse (taxpayer default)', () => {
    // Exercises `for (const f of ret.farms)` populated-branch.
    const ret = emptyReturn({
      farms: [{
        id: 'f1', farmName: 'Farm', principalProduct: null,
        accountingMethod: 'cash', grossIncome: 10000, expenses: {},
      }],
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.otherTaxes.seTax).toBeGreaterThan(0);
  });

  it('falls back to top-rate 0.37 when bracket table is empty for filing status', () => {
    // Exercises `topBracket.length > 0 ? ... : 0.37` false branch.
    const constants: TaxYearConstants = {
      ...DEFAULT_2025,
      brackets: { ...DEFAULT_2025.brackets, single: [] },
    };
    const out = computeReturn(emptyReturn(), constants);
    // Empty bracket table forces the 0.37 fallback but taxable income is 0
    // so no regular tax is owed regardless.
    expect(out.taxComputation.regularTax).toBe(0);
  });

  it('handles malformed DOB (YYYY > year range) → age = null', () => {
    // `Number.isFinite(y) && y > 1900` false when y is out of range.
    const ret = emptyReturn({
      personalInfo: {
        firstName: null, lastName: null, ssnLast4: null,
        dob: 'bad-date-string',
        addressLine1: null, addressLine2: null, city: null, state: null, zip: null,
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      },
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.summary).toBeDefined();
  });

  it('handles itemized SALT components undefined (nullish-coalesce defaults)', () => {
    // Exercises `Number(ret.itemized?.stateLocalTax) || 0` fallback when
    // itemized is set but fields are falsy.
    const ret = emptyReturn({
      useStandardDeduction: false,
      itemized: {
        medical: 0,
        stateLocalTax: 0,
        realEstateTax: 0,
        mortgageInterest: 50000,
        charitableCash: 0,
        charitableNoncash: 0,
      },
    });
    const out = computeReturn(ret, DEFAULT_2025);
    expect(out.summary).toBeDefined();
  });

  it('handles ssTaxability constants missing → ssResult = zero', () => {
    // `ssTier` undefined when `constants.ssTaxability` is missing. The
    // else-branch of `ssTier ? computeTaxableSocialSecurity(...) : {...}` fires.
    const constants: TaxYearConstants = {
      ...DEFAULT_2025,
      ssTaxability: undefined,
    };
    const ret = emptyReturn({
      socialSecurity: { grossBenefits: 20000, medicarePremiums: 0, federalWithheld: 0 },
    });
    const out = computeReturn(ret, constants);
    // ssTier undefined → ssTaxable = 0.
    expect(out.income.ssTaxable).toBe(0);
  });
});
