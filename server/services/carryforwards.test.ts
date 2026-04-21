import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getDb } from '../db/pglite.js';
import { runMigrations } from '../db/migrate.js';
import { getConfig } from './taxYearConfig.js';
import {
  getPriorYearCarryforwards,
  listCarryforwards,
  writeCarryforwards,
} from './carryforwards.js';
import {
  applyPriorYearCarryforwards,
  buildEndOfYearCarryforwards,
  computeReturnWithCarryforwards,
} from './tax/index.js';
import type { TaxReturn, TaxYearConstants } from '../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;

const TEST_USER_ID = 'cf-test-user-1';
const TEST_RETURN_ID = 'cf-test-return-2025';

beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;

  const db = await getDb();
  // Seed a test user (FK target for carryforwards.user_id).
  await db.query(
    `INSERT INTO users (id, username, email, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER_ID, 'cf-test', 'cf-test@example.com', 'unused-for-this-test'],
  );
  // Seed the 2025 tax_returns row (FK target for
  // carryforwards.source_return_id). The compute orchestrator stamps
  // sourceReturnId = ret.id on every emitted row, which must reference
  // an existing tax_returns record.
  await db.query(
    `INSERT INTO tax_returns (id, user_id, tax_year, filing_status, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_RETURN_ID, TEST_USER_ID, 2025, 'single', 'in_progress'],
  );
});

beforeEach(async () => {
  const db = await getDb();
  await db.query('DELETE FROM carryforwards WHERE user_id = $1', [TEST_USER_ID]);
});

function emptyReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: TEST_RETURN_ID,
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

describe('carryforwards service', () => {
  it('writeCarryforwards upserts rows and getPriorYearCarryforwards reads year-1', async () => {
    await writeCarryforwards(TEST_USER_ID, 2024, [
      { kind: 'capital_loss_short', refId: null, amount: 7000 },
      { kind: 'capital_loss_long', refId: null, amount: 2500 },
    ]);
    // Prior-year lookup for 2025 returns the 2024 rows.
    const prior = await getPriorYearCarryforwards(TEST_USER_ID, 2025);
    const st = prior.find((r) => r.kind === 'capital_loss_short');
    const lt = prior.find((r) => r.kind === 'capital_loss_long');
    expect(st?.amount).toBeCloseTo(7000, 2);
    expect(lt?.amount).toBeCloseTo(2500, 2);

    // Upsert is idempotent on (user_id, tax_year, kind, ref_id).
    await writeCarryforwards(TEST_USER_ID, 2024, [
      { kind: 'capital_loss_short', refId: null, amount: 1234 },
    ]);
    const all = await listCarryforwards(TEST_USER_ID, 2024);
    const stAgain = all.find((r) => r.kind === 'capital_loss_short');
    expect(stAgain?.amount).toBeCloseTo(1234, 2);
    // LT row untouched.
    expect(all.find((r) => r.kind === 'capital_loss_long')?.amount).toBeCloseTo(2500, 2);
  });

  it('writeCarryforwards deletes stale rows when amount drops to zero', async () => {
    await writeCarryforwards(TEST_USER_ID, 2024, [
      { kind: 'capital_loss_short', refId: null, amount: 5000 },
    ]);
    await writeCarryforwards(TEST_USER_ID, 2024, [
      { kind: 'capital_loss_short', refId: null, amount: 0 },
    ]);
    const rows = await listCarryforwards(TEST_USER_ID, 2024);
    expect(rows.find((r) => r.kind === 'capital_loss_short')).toBeUndefined();
  });
});

describe('applyPriorYearCarryforwards', () => {
  it('preserves user-entered non-zero override', () => {
    const ret = emptyReturn({ priorYearShortTermLossCarryforward: 1500 });
    const patched = applyPriorYearCarryforwards(ret, [
      {
        id: 'x',
        userId: TEST_USER_ID,
        taxYear: 2024,
        kind: 'capital_loss_short',
        refId: null,
        amount: 9999,
        sourceReturnId: null,
        notes: null,
      },
    ]);
    expect(patched.priorYearShortTermLossCarryforward).toBe(1500);
  });

  it('fills zero/missing field from the carryforward table', () => {
    const ret = emptyReturn();
    const patched = applyPriorYearCarryforwards(ret, [
      {
        id: 'x',
        userId: TEST_USER_ID,
        taxYear: 2024,
        kind: 'capital_loss_short',
        refId: null,
        amount: 7000,
        sourceReturnId: null,
        notes: null,
      },
    ]);
    expect(patched.priorYearShortTermLossCarryforward).toBe(7000);
  });
});

describe('computeReturnWithCarryforwards: 2024 → 2025 cap-loss-short rollforward', () => {
  it('seeds 7000 ST carryforward at year 2024, 2025 return allows 3000 deduction and rolls 4000', async () => {
    // 1) Seed prior-year row.
    await writeCarryforwards(TEST_USER_ID, 2024, [
      { kind: 'capital_loss_short', refId: null, amount: 7000 },
    ]);

    // 2) Build a bare 2025 return with no ST activity this year and no
    //    user-entered priorYearShortTermLossCarryforward. Add a sliver
    //    of wages so the §1211(b) deduction has ordinary income to
    //    offset against (the deduction amount is independent of that,
    //    but makes the scenario realistic).
    const r = emptyReturn({
      w2s: [
        {
          id: 'w1',
          employer: 'Acme',
          ein: null,
          box1Wages: 50000,
          box2FedWithheld: 0,
          box3SsWages: 50000,
          box4SsWithheld: 0,
          box5MedicareWages: 50000,
          box6MedicareWithheld: 0,
          stateWages: 0,
          stateWithheld: 0,
        },
      ],
    });

    // 3) Run with the carryforward-aware orchestrator.
    const computed = await computeReturnWithCarryforwards(
      TEST_USER_ID,
      r,
      DEFAULT_2025,
    );

    // 4) §1211(b): single filer, annual cap $3,000 → allowed = −3,000.
    //    computeCapitalLossCarryforward returns a signed allowedDeduction
    //    but the orchestrator surfaces `capitalLossDeduction` with the
    //    sign convention used by Schedule D line 21 (negative).
    expect(computed.income.capitalLossDeduction).toBeCloseTo(-3000, 2);
    // §1212(b) / Pub 550 worksheet: short-term loss of 7,000, less 3,000
    // absorbed by the §1211(b) deduction = 4,000 carried to 2026.
    expect(computed.income.capitalLossCarryforwardShortTerm).toBeCloseTo(4000, 2);
    expect(computed.income.capitalLossCarryforwardLongTerm).toBeCloseTo(0, 2);
    expect(computed.income.capitalLossCarryforwardTotal).toBeCloseTo(4000, 2);

    // 5) The end-of-year carryforward was persisted to the table for
    //    (userId, 2025, 'capital_loss_short') with amount 4000.
    const written = await listCarryforwards(TEST_USER_ID, 2025);
    const stRow = written.find((row) => row.kind === 'capital_loss_short');
    expect(stRow).toBeDefined();
    expect(stRow!.amount).toBeCloseTo(4000, 2);
    expect(stRow!.sourceReturnId).toBe(TEST_RETURN_ID);
    // No LT row written since LT carryforward is 0.
    expect(written.find((row) => row.kind === 'capital_loss_long')).toBeUndefined();
  });

  it('buildEndOfYearCarryforwards emits only non-zero rows', () => {
    const rows = buildEndOfYearCarryforwards({
      income: {
        capitalLossCarryforwardShortTerm: 0,
        capitalLossCarryforwardLongTerm: 1234,
        capitalLossCarryforwardTotal: 1234,
        rentalSuspendedLoss: 500,
        k1SuspendedLoss: 0,
      },
    } as unknown as Parameters<typeof buildEndOfYearCarryforwards>[0]);
    const kinds = rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(['capital_loss_long', 'passive_loss_rental']);
  });
});
