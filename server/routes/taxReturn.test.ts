import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

async function authedUser() {
  const user = await createUser();
  const cookies = await loginAs(app, user);
  return { user, cookies };
}

describe('taxReturn routes auth guard', () => {
  it('blocks unauthenticated access', async () => {
    const res = await request(app).get('/api/return');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/return/list and /available-years', () => {
  it('returns an empty list for a fresh user', async () => {
    const { cookies } = await authedUser();
    const res = await request(app).get('/api/return/list').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 2025 as an available year', async () => {
    const { cookies } = await authedUser();
    const res = await request(app).get('/api/return/available-years').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toContain(2025);
  });
});

describe('GET /api/return (auto-create) + compute', () => {
  it('creates a default return with blank personal info and computes zeros', async () => {
    const { cookies } = await authedUser();
    const getRes = await request(app).get('/api/return').query({ year: 2025 }).set('Cookie', cookies);
    expect(getRes.status).toBe(200);
    expect(getRes.body.taxYear).toBe(2025);
    expect(getRes.body.personalInfo.firstName).toBeNull();
    expect(Array.isArray(getRes.body.w2s)).toBe(true);
    const comp = await request(app).get('/api/return/compute').query({ year: 2025 }).set('Cookie', cookies);
    expect(comp.status).toBe(200);
    expect(comp.body.summary).toBeTruthy();
  });

  it('honours explicit ?year query', async () => {
    const { cookies } = await authedUser();
    const res = await request(app).get('/api/return').query({ year: 2025 }).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.taxYear).toBe(2025);
  });

  it('returns 400 for unconfigured year', async () => {
    const { cookies } = await authedUser();
    // 2050 will not have a configuration unless a test created one. If one does
    // exist from a parallel test run, pick a different number.
    const { getConfig } = await import('../services/taxYearConfig.js');
    let candidate = 2050;
    while (await getConfig(candidate)) candidate--;
    const res = await request(app).get('/api/return').query({ year: candidate }).set('Cookie', cookies);
    expect(res.status).toBe(400);
  });

  it('/compute returns 503 for unconfigured year', async () => {
    const { user, cookies } = await authedUser();
    const { getConfig } = await import('../services/taxYearConfig.js');
    let candidate = 2045;
    while (await getConfig(candidate)) candidate--;
    // Seed a return row for this year so resolveYear returns it.
    const { getDb } = await import('../db/pglite.js');
    const { newId } = await import('../services/crypto.js');
    const db = await getDb();
    await db.query(
      `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1,$2,$3)`,
      [newId(), user.id, candidate],
    );
    const res = await request(app).get('/api/return/compute').set('Cookie', cookies);
    expect(res.status).toBe(503);
  });

  it('falls back to most-recent return year when no ?year passed', async () => {
    const { cookies, user } = await authedUser();
    // Seed a 2024 return directly.
    const { getDb } = await import('../db/pglite.js');
    const { newId } = await import('../services/crypto.js');
    // Need 2024 config first: clone from 2025.
    const { cloneConfig, getConfig } = await import('../services/taxYearConfig.js');
    if (!(await getConfig(2024))) await cloneConfig(2025, 2024);
    const db = await getDb();
    const rid = newId();
    await db.query(
      `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1,$2,$3)`,
      [rid, user.id, 2024],
    );
    const res = await request(app).get('/api/return').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.taxYear).toBe(2024);
  });
});

describe('PUT /api/return/meta', () => {
  it('updates filing status, deduction choice, and estimated payments', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/meta')
      .set('Cookie', cookies)
      .send({
        filingStatus: 'mfj',
        useStandardDeduction: false,
        estimatedPayments: 1234.56,
        gamblingLosses: 100,
        priorYearShortTermLossCarryforward: 200,
        priorYearLongTermLossCarryforward: 300,
      });
    expect(res.status).toBe(200);
    const get = await request(app).get('/api/return').set('Cookie', cookies);
    expect(get.body.filingStatus).toBe('mfj');
    expect(get.body.useStandardDeduction).toBe(false);
    expect(get.body.estimatedPayments).toBe(1234.56);
  });

  it('validates bad filing status', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/meta')
      .set('Cookie', cookies)
      .send({ filingStatus: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('accepts empty body (no-op)', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/meta')
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/return/personal-info', () => {
  it('saves personal info and encrypts SSNs', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        ssn: '123-45-6789',
        dob: '1980-01-02',
        addressLine1: '1 Main St',
        addressLine2: 'Apt 2',
        city: 'Townsville',
        state: 'CA',
        zip: '94000',
        spouseFirstName: 'John',
        spouseLastName: 'Doe',
        spouseSsn: '987-65-4321',
        spouseDob: '1982-03-04',
      });
    expect(res.status).toBe(200);
    const get = await request(app).get('/api/return').set('Cookie', cookies);
    expect(get.body.personalInfo.firstName).toBe('Jane');
    expect(get.body.personalInfo.ssnLast4).toBe('6789');
    expect(get.body.personalInfo.spouseSsnLast4).toBe('4321');
  });

  it('preserves existing SSN when not supplied', async () => {
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({ firstName: 'A', ssn: '111-22-3333' });
    const resUpdate = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({ firstName: 'B' });
    expect(resUpdate.status).toBe(200);
    const get = await request(app).get('/api/return').set('Cookie', cookies);
    expect(get.body.personalInfo.firstName).toBe('B');
    expect(get.body.personalInfo.ssnLast4).toBe('3333');
  });

  it('returns 400 when firstName is not a string', async () => {
    // Exercises the PUT /personal-info catch(err) branch via a zod-parse
    // failure.
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({ firstName: 12345 });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/return/dependents', () => {
  it('replaces the dependents list', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/dependents')
      .set('Cookie', cookies)
      .send([
        { name: 'Kid One', ssn: '111-22-3333', relationship: 'son', dob: '2015-01-01', isQualifyingChild: true },
        { name: 'Kid Two' },
      ]);
    expect(res.status).toBe(200);
    const get = await request(app).get('/api/return').set('Cookie', cookies);
    expect(get.body.dependents).toHaveLength(2);
    expect(get.body.dependents[0].name).toMatch(/Kid/);
  });

  it('validates dependents', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/dependents')
      .set('Cookie', cookies)
      .send([{ name: '' }]);
    expect(res.status).toBe(400);
  });
});

describe('list-replace income endpoints', () => {
  async function mk() {
    return authedUser();
  }

  it('PUT /w2 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/w2')
      .set('Cookie', cookies)
      .send([
        {
          employer: 'Acme',
          ein: '12-3456789',
          box1Wages: 50000,
          box2FedWithheld: 4000,
          box3SsWages: 50000,
          box4SsWithheld: 3100,
          box5MedicareWages: 50000,
          box6MedicareWithheld: 725,
          stateWages: 50000,
          stateWithheld: 2000,
        },
      ]);
    expect(res.status).toBe(200);
    const get = await request(app).get('/api/return').set('Cookie', cookies);
    expect(get.body.w2s[0].employer).toBe('Acme');
    expect(get.body.w2s[0].box1Wages).toBe(50000);
  });

  it('PUT /interest roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/interest')
      .set('Cookie', cookies)
      .send([{ payer: 'Bank', amount: 123.45, taxExempt: false, privateActivityBondInterest: 0 }]);
    expect(res.status).toBe(200);
  });

  it('PUT /dividends roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/dividends')
      .set('Cookie', cookies)
      .send([
        {
          payer: 'Brokerage',
          ordinary: 100,
          qualified: 80,
          totalCapGainDistributions: 5,
          unrecapSection1250Gain: 0,
          section1202Gain: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /self-employment roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/self-employment')
      .set('Cookie', cookies)
      .send([
        {
          businessName: 'Freelance',
          ein: null,
          principalActivity: 'consulting',
          grossReceipts: 20000,
          returnsAllowances: 0,
          costOfGoods: 0,
          expenses: { supplies: 200, utilities: 150 },
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /capital-gains roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/capital-gains')
      .set('Cookie', cookies)
      .send([
        {
          description: 'AAPL',
          dateAcquired: '2020-01-01',
          dateSold: '2024-06-01',
          proceeds: 1500,
          costBasis: 1000,
          term: 'long',
          washSaleLossDisallowed: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /retirement-income roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/retirement-income')
      .set('Cookie', cookies)
      .send([
        {
          payer: 'Fidelity',
          grossDistribution: 5000,
          taxableAmount: 5000,
          federalWithheld: 1000,
          stateWithheld: 0,
          distributionCode: '7',
          isIra: true,
          isRoth: false,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /social-security roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/social-security')
      .set('Cookie', cookies)
      .send({ grossBenefits: 20000, medicarePremiums: 1200, federalWithheld: 0 });
    expect(res.status).toBe(200);
  });

  it('PUT /unemployment roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/unemployment')
      .set('Cookie', cookies)
      .send([{ payer: 'State', amount: 4000, federalWithheld: 0 }]);
    expect(res.status).toBe(200);
  });

  it('PUT /gambling roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/gambling')
      .set('Cookie', cookies)
      .send([{ payer: 'Casino', winnings: 500, federalWithheld: 0 }]);
    expect(res.status).toBe(200);
  });

  it('PUT /other-income roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/other-income')
      .set('Cookie', cookies)
      .send([{ source: 'jury_duty', description: 'jury', amount: 100 }]);
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-e-rental roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-e-rental')
      .set('Cookie', cookies)
      .send([
        {
          propertyAddress: '1 Rental',
          propertyType: 'single_family',
          fairRentalDays: 365,
          personalUseDays: 0,
          rentsReceived: 18000,
          expenses: { repairs: 500 },
          activeParticipation: true,
          isPassive: true,
          priorYearUnallowedLoss: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-e-royalty roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-e-royalty')
      .set('Cookie', cookies)
      .send([{ source: 'Book', grossRoyalties: 1500, expenses: 100 }]);
    expect(res.status).toBe(200);
  });

  it('PUT /k1-income roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/k1-income')
      .set('Cookie', cookies)
      .send([
        {
          entityKind: 'partnership',
          entityName: 'LP',
          ein: null,
          isPassive: false,
          ordinaryBusinessIncome: 1000,
          netRentalRealEstate: 0,
          otherRentalIncome: 0,
          interestIncome: 50,
          ordinaryDividends: 20,
          qualifiedDividends: 10,
          royalties: 0,
          shortTermCapitalGain: 0,
          longTermCapitalGain: 0,
          section1231Gain: 0,
          priorYearUnallowedLoss: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-f-farm roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-f-farm')
      .set('Cookie', cookies)
      .send([
        {
          farmName: 'Farm',
          principalProduct: 'corn',
          accountingMethod: 'cash',
          grossIncome: 20000,
          expenses: { seed: 500 },
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /form-4797 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-4797')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Equipment',
          dateAcquired: '2018-01-01',
          dateSold: '2024-01-01',
          proceeds: 4000,
          costBasis: 10000,
          accumulatedDepreciation: 8000,
          depreciationRecapture: 2000,
          term: 'long_1231',
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /depreciation-assets roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/depreciation-assets')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Computer',
          datePlacedInService: '2024-06-01',
          cost: 2500,
          macrsClass: '5',
          section179Election: 0,
          claimBonus: false,
          businessUsePercent: 1,
          businessId: null,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /home-offices roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/home-offices')
      .set('Cookie', cookies)
      .send([
        {
          businessId: null,
          useSimplified: true,
          squareFeet: 200,
          totalHomeSquareFeet: 2000,
          utilities: 1000,
          insurance: 500,
          mortgageInterest: 0,
          realEstateTax: 0,
          repairs: 100,
          depreciation: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /itemized roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/itemized')
      .set('Cookie', cookies)
      .send({
        medical: 1000,
        stateLocalTax: 5000,
        realEstateTax: 3000,
        mortgageInterest: 8000,
        charitableCash: 2000,
        charitableNoncash: 500,
      });
    expect(res.status).toBe(200);
  });
});

describe('single-row form endpoints', () => {
  async function mk() {
    return authedUser();
  }

  it('PUT /schedule-1-adjustments roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-1-adjustments')
      .set('Cookie', cookies)
      .send({
        educatorExpenses: 300,
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
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8606 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8606')
      .set('Cookie', cookies)
      .send({
        priorYearBasis: 1000,
        currentYearNondeductible: 0,
        traditionalIraBalance: 5000,
        distributions: 0,
        conversions: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8889 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8889')
      .set('Cookie', cookies)
      .send({
        coverage: 'self',
        contributions: 2000,
        isCatchUpEligible: false,
        distributions: 0,
        qualifiedMedicalExpenses: 0,
        isDisabledOrOver65: false,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-2441 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-2441')
      .set('Cookie', cookies)
      .send({
        totalQualifiedExpenses: 3000,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
        spouseEarnedIncome: 0,
        employerProvidedBenefits: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8863-students roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8863-students')
      .set('Cookie', cookies)
      .send([
        {
          studentName: 'S',
          studentSsnLast4: '1234',
          creditType: 'aotc',
          qualifiedExpenses: 4000,
          isEligibleForAotc: true,
          priorAotcYears: 0,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /form-8880 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8880')
      .set('Cookie', cookies)
      .send({
        elective401kDeferrals: 1000,
        iraContributions: 500,
        spouseElective401kDeferrals: 0,
        spouseIraContributions: 0,
        distributionsReceived: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-r roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-r')
      .set('Cookie', cookies)
      .send({
        isTaxpayerEligible: true,
        isSpouseEligible: false,
        taxpayerUnder65Disabled: false,
        spouseUnder65Disabled: false,
        disabilityIncome: 0,
        nontaxableSsAndPension: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8396 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8396')
      .set('Cookie', cookies)
      .send({ certificateRate: 0.2, mortgageInterestPaid: 5000, priorYearUnusedCredit: 0 });
    expect(res.status).toBe(200);
  });

  it('PUT /form-5695 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-5695')
      .set('Cookie', cookies)
      .send({
        solarElectric: 10000,
        solarWaterHeating: 0,
        windEnergy: 0,
        geothermalHeatPump: 0,
        biomassFuel: 0,
        batteryStorageTech: 0,
        fuelCellCost: 0,
        fuelCellKw: 0,
        insulationAirSealing: 500,
        exteriorWindows: 300,
        exteriorDoors: 200,
        homeEnergyAudit: 150,
        heatPumps: 1000,
        biomassStoves: 0,
        centralAc: 0,
        furnaceBoiler: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8936-vehicles roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8936-vehicles')
      .set('Cookie', cookies)
      .send([
        {
          make: 'Tesla',
          model: 'Y',
          year: 2024,
          vin: 'A1B2C3D4E5F6G7H8',
          placedInService: '2024-03-01',
          isNew: true,
          purchasePrice: 45000,
          businessUsePercent: 0,
          userEnteredCredit: 7500,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /form-1116-baskets roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-1116-baskets')
      .set('Cookie', cookies)
      .send([
        {
          category: 'passive',
          country: 'DE',
          foreignGrossIncome: 2000,
          definitelyRelatedDeductions: 0,
          foreignTaxPaid: 300,
        },
      ]);
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-8812 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-8812')
      .set('Cookie', cookies)
      .send({
        qualifyingChildrenOverride: null,
        earnedIncomeOverride: null,
        includeCombatPay: false,
        combatPayAmount: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /eitc-eligibility roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/eitc-eligibility')
      .set('Cookie', cookies)
      .send({
        qualifyingChildrenOverride: null,
        investmentIncomeOverride: null,
        isEligibleAge: true,
        includeCombatPay: false,
        combatPayAmount: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8962 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8962')
      .set('Cookie', cookies)
      .send({
        householdSize: 2,
        federalPovertyLine: 20000,
        annualEnrollmentPremium: 7000,
        annualSlcsp: 8000,
        advancePtcPaid: 500,
        additionalMagi: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-6251 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-6251')
      .set('Cookie', cookies)
      .send({
        privateActivityBondInterest: 0,
        amtDepreciationAdjustment: 0,
        otherAdjustments: 0,
        amtNolCarryforward: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8960 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8960')
      .set('Cookie', cookies)
      .send({
        investmentInterestExpense: 0,
        stateTaxAllocableToInvestment: 0,
        miscInvestmentExpenses: 0,
        otherModifications: 0,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8959 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8959')
      .set('Cookie', cookies)
      .send({ rrtaCompensation: 0, additionalMedicareWithheld: 0 });
    expect(res.status).toBe(200);
  });

  it('PUT /form-2555 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-2555')
      .set('Cookie', cookies)
      .send({
        foreignEarnedIncome: 50000,
        qualifyingDays: 330,
        totalDaysInPeriod: 365,
        housingExpenses: 12000,
        isBonaFideResident: true,
        usesPhysicalPresence: false,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /schedule-h roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/schedule-h')
      .set('Cookie', cookies)
      .send({
        cashWagesSsMedicare: 10000,
        cashWagesFuta: 10000,
        anyQuarterOver1000: true,
        federalIncomeTaxWithheld: 0,
        stateUnemploymentPaid: 400,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-2210 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-2210')
      .set('Cookie', cookies)
      .send({
        priorYearTax: 1000,
        priorYearAgi: 50000,
        withholdingByQuarter: [250, 250, 250, 250],
        estimatedPaymentsByQuarter: [0, 0, 0, 0],
        requestWaiver: false,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-5405 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-5405')
      .set('Cookie', cookies)
      .send({ annualInstallment: 500, dispositionAccelerated: 0 });
    expect(res.status).toBe(200);
  });

  it('PUT /form-4972 roundtrips', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-4972')
      .set('Cookie', cookies)
      .send({
        qualifyingLumpSum: 50000,
        capitalGainPortion: 10000,
        ordinaryPortion: 40000,
        computedTax: 6000,
      });
    expect(res.status).toBe(200);
  });

  it('PUT /form-8995 roundtrips with activities', async () => {
    const { cookies } = await mk();
    const res = await request(app)
      .put('/api/return/form-8995')
      .set('Cookie', cookies)
      .send({
        activities: [
          { name: 'Consulting', ein: null, qbi: 20000, isSstb: false, w2Wages: 5000, ubia: 0 },
        ],
        reitPtpDividends: 100,
        priorYearQbiLossCarry: 0,
        priorYearReitPtpLossCarry: 0,
      });
    expect(res.status).toBe(200);
  });

  it('GET /carryforwards returns rows', async () => {
    const { cookies } = await authedUser();
    const res = await request(app).get('/api/return/carryforwards').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rows');
  });
});

describe('full pipeline compute with a big populated return', () => {
  it('computes a non-trivial return end-to-end without error', async () => {
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/meta')
      .set('Cookie', cookies)
      .send({ filingStatus: 'mfj', useStandardDeduction: true, estimatedPayments: 500 });
    await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({
        firstName: 'Big',
        lastName: 'Return',
        ssn: '123-45-6789',
        dob: '1975-01-01',
        addressLine1: '1 Example Ln',
        city: 'City',
        state: 'CA',
        zip: '90210',
      });
    await request(app)
      .put('/api/return/dependents')
      .set('Cookie', cookies)
      .send([
        { name: 'Child', dob: '2015-01-01', relationship: 'son', isQualifyingChild: true },
      ]);
    await request(app)
      .put('/api/return/w2')
      .set('Cookie', cookies)
      .send([
        {
          employer: 'BigCo',
          box1Wages: 100000,
          box2FedWithheld: 15000,
          box3SsWages: 100000,
          box4SsWithheld: 6200,
          box5MedicareWages: 100000,
          box6MedicareWithheld: 1450,
          stateWages: 100000,
          stateWithheld: 4000,
        },
      ]);
    await request(app)
      .put('/api/return/interest')
      .set('Cookie', cookies)
      .send([{ payer: 'Bank', amount: 100 }]);
    await request(app)
      .put('/api/return/dividends')
      .set('Cookie', cookies)
      .send([{ payer: 'VFIAX', ordinary: 500, qualified: 400 }]);
    await request(app)
      .put('/api/return/self-employment')
      .set('Cookie', cookies)
      .send([
        {
          businessName: 'Side',
          grossReceipts: 10000,
          expenses: { supplies: 1000 },
        },
      ]);

    const comp = await request(app).get('/api/return/compute').set('Cookie', cookies);
    expect(comp.status).toBe(200);
    expect(comp.body.summary).toBeTruthy();
    expect(comp.body.income).toBeTruthy();
  });
});

// Each list-endpoint PUT has its own try/catch that forwards zod-parse
// errors to the error-handler via `next(err)`. Sending a body that fails
// validation exercises those catch branches.
describe('PUT list endpoints — validation-failure catch paths', () => {
  async function authed() {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    return { user, cookies };
  }

  const LIST_ROUTES = [
    '/api/return/w2',
    '/api/return/interest',
    '/api/return/dividends',
    '/api/return/self-employment',
    '/api/return/capital-gains',
    '/api/return/retirement-income',
    '/api/return/unemployment',
    '/api/return/gambling',
    '/api/return/other-income',
    '/api/return/schedule-e-rental',
    '/api/return/schedule-e-royalty',
    '/api/return/k1-income',
    '/api/return/schedule-f-farm',
    '/api/return/form-4797',
    '/api/return/depreciation-assets',
    '/api/return/home-offices',
    '/api/return/form-8863-students',
    '/api/return/form-8936-vehicles',
    '/api/return/form-1116-baskets',
  ];

  it.each(LIST_ROUTES)('%s returns 400 when body is not an array', async (url) => {
    const { cookies } = await authed();
    const res = await request(app).put(url).set('Cookie', cookies).send({ not: 'array' });
    expect(res.status).toBe(400);
  });
});

describe('PUT single-row endpoints — validation-failure catch paths', () => {
  async function authed() {
    const user = await createUser();
    const cookies = await loginAs(app, user);
    return { user, cookies };
  }

  const SINGLE_ROUTES: Array<[string, unknown]> = [
    ['/api/return/social-security', { grossBenefits: 'not-a-number' }],
    ['/api/return/itemized', { medical: 'bad' }],
    ['/api/return/schedule-1-adjustments', { educatorExpenses: 'bad' }],
    ['/api/return/form-8606', { priorYearBasis: 'bad' }],
    ['/api/return/form-8889', { coverage: 'invalid-enum' }],
    ['/api/return/form-2441', { totalQualifiedExpenses: 'bad' }],
    ['/api/return/form-8880', { elective401kDeferrals: 'bad' }],
    ['/api/return/schedule-r', { disabilityIncome: 'bad' }],
    ['/api/return/form-8396', { certificateRate: 'bad' }],
    ['/api/return/form-5695', { solarElectric: 'bad' }],
    ['/api/return/schedule-8812', { qualifyingChildrenOverride: 'bad' }],
    ['/api/return/eitc-eligibility', { qualifyingChildrenOverride: 'bad' }],
    ['/api/return/form-8962', { householdSize: 'bad' }],
    ['/api/return/form-6251', { privateActivityBondInterest: 'bad' }],
    ['/api/return/form-8960', { investmentInterestExpense: 'bad' }],
    ['/api/return/form-8959', { rrtaCompensation: 'bad' }],
    ['/api/return/form-2555', { foreignEarnedIncome: 'bad' }],
    ['/api/return/schedule-h', { cashWagesSsMedicare: 'bad' }],
    ['/api/return/form-2210', { priorYearTax: 'bad' }],
    ['/api/return/form-5405', { annualInstallment: 'bad' }],
    ['/api/return/form-4972', { qualifyingLumpSum: 'bad' }],
    ['/api/return/form-8995', { reitPtpDividends: 'bad' }],
  ];

  it.each(SINGLE_ROUTES)('%s returns 400 on invalid body', async (url, body) => {
    const { cookies } = await authed();
    const res = await request(app).put(url).set('Cookie', cookies).send(body as never);
    expect(res.status).toBe(400);
  });
});
