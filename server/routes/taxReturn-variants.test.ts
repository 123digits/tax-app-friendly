// Roundtrip tests that exercise the non-default enum values and
// nullable-field branches in `loadFullReturn`. Existing tests tend to
// save forms with whatever sample payload is easiest, so the ternaries
// like `r.term === 'short' ? 'short' : 'long'` never hit the 'short'
// arm. These tests save with every non-default variant and assert the
// load path preserves it.
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

async function get(cookies: string[]) {
  return request(app).get('/api/return').set('Cookie', cookies);
}

describe('loadFullReturn — capital gains variants', () => {
  it('preserves term: short', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/capital-gains')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Day trade',
          dateAcquired: '2024-01-01',
          dateSold: '2024-06-01',
          proceeds: 2000,
          costBasis: 1500,
          term: 'short',
          washSaleLossDisallowed: 0,
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.capitalGains[0].term).toBe('short');
    expect(body.capitalGains[0].dateAcquired).toBe('2024-01-01');
  });

  it('preserves null dates on capital gains rows', async () => {
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/capital-gains')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Section 1202 pool',
          dateAcquired: null,
          dateSold: null,
          proceeds: 100,
          costBasis: 100,
          term: 'long',
          washSaleLossDisallowed: 0,
        },
      ]);
    const body = (await get(cookies)).body;
    expect(body.capitalGains[0].dateAcquired).toBeNull();
    expect(body.capitalGains[0].dateSold).toBeNull();
  });
});

describe('loadFullReturn — K-1 entity variants', () => {
  async function saveK1(cookies: string[], entityKind: string) {
    return request(app)
      .put('/api/return/k1-income')
      .set('Cookie', cookies)
      .send([
        {
          entityKind,
          entityName: `${entityKind} Entity`,
          ein: '12-3456789',
          isPassive: false,
          ordinaryBusinessIncome: 1000,
          netRentalRealEstate: 0,
          otherRentalIncome: 0,
          interestIncome: 0,
          ordinaryDividends: 0,
          qualifiedDividends: 0,
          royalties: 0,
          shortTermCapitalGain: 0,
          longTermCapitalGain: 0,
          section1231Gain: 0,
          priorYearUnallowedLoss: 0,
        },
      ]);
  }

  it('preserves entityKind: s_corp', async () => {
    const { cookies } = await authedUser();
    const res = await saveK1(cookies, 's_corp');
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.k1s[0].entityKind).toBe('s_corp');
  });

  it('preserves entityKind: trust', async () => {
    const { cookies } = await authedUser();
    await saveK1(cookies, 'trust');
    const body = (await get(cookies)).body;
    expect(body.k1s[0].entityKind).toBe('trust');
  });
});

describe('loadFullReturn — Schedule F farm accounting method', () => {
  it('preserves accountingMethod: accrual', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/schedule-f-farm')
      .set('Cookie', cookies)
      .send([
        {
          farmName: 'Acme Farm',
          principalProduct: 'corn',
          accountingMethod: 'accrual',
          grossIncome: 50000,
          expenses: { seed: 1000, feed: 2000 },
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.farms[0].accountingMethod).toBe('accrual');
    expect(body.farms[0].expenses).toEqual({ seed: 1000, feed: 2000 });
  });
});

describe('loadFullReturn — Form 4797 term + null dates', () => {
  it('preserves term: short_ordinary and null dates', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-4797')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Business fixture sale',
          dateAcquired: null,
          dateSold: null,
          proceeds: 5000,
          costBasis: 3000,
          accumulatedDepreciation: 0,
          depreciationRecapture: 0,
          term: 'short_ordinary',
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.form4797Sales[0].term).toBe('short_ordinary');
    expect(body.form4797Sales[0].dateAcquired).toBeNull();
    expect(body.form4797Sales[0].dateSold).toBeNull();
  });
});

describe('loadFullReturn — Form 8863 student creditType: llc', () => {
  it('preserves creditType: llc', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-8863-students')
      .set('Cookie', cookies)
      .send([
        {
          studentName: 'Grad Student',
          studentSsn: '222-33-4444',
          creditType: 'llc',
          qualifiedExpenses: 8000,
          isEligibleForAotc: false,
          priorAotcYears: 0,
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.form8863Students[0].creditType).toBe('llc');
    expect(body.form8863Students[0].studentName).toBe('Grad Student');
  });
});

describe('loadFullReturn — Form 1116 basket category: general', () => {
  it('preserves category: general', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-1116-baskets')
      .set('Cookie', cookies)
      .send([
        {
          category: 'general',
          country: 'DE',
          foreignGrossIncome: 10000,
          definitelyRelatedDeductions: 0,
          foreignTaxPaid: 1500,
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.form1116Baskets[0].category).toBe('general');
    expect(body.form1116Baskets[0].country).toBe('DE');
  });
});

describe('loadFullReturn — depreciation asset placedInService: null', () => {
  it('preserves null datePlacedInService', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/depreciation-assets')
      .set('Cookie', cookies)
      .send([
        {
          description: 'Pending asset',
          datePlacedInService: null,
          cost: 5000,
          macrsClass: '7',
          section179Election: 0,
          claimBonus: false,
          businessUsePercent: 100,
          businessId: null,
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.depreciationAssets[0].datePlacedInService).toBeNull();
    expect(body.depreciationAssets[0].macrsClass).toBe('7');
  });
});

describe('loadFullReturn — Form 8936 vehicle nullables', () => {
  it('preserves null placedInService + minimal optional fields', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-8936-vehicles')
      .set('Cookie', cookies)
      .send([
        {
          make: 'Tesla',
          model: 'Model 3',
          year: 2024,
          vin: null,
          placedInService: null,
          isNew: true,
          purchasePrice: 40000,
          businessUsePercent: 0,
          userEnteredCredit: 0,
        },
      ]);
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.form8936Vehicles[0].placedInService).toBeNull();
    expect(body.form8936Vehicles[0].vin).toBeNull();
    expect(body.form8936Vehicles[0].make).toBe('Tesla');
  });

  it('preserves placedInService as ISO date when supplied', async () => {
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/form-8936-vehicles')
      .set('Cookie', cookies)
      .send([
        {
          make: 'Ford',
          model: 'F-150 Lightning',
          year: 2025,
          vin: '1FA0000000000001',
          placedInService: '2025-03-15',
          isNew: true,
          purchasePrice: 60000,
          businessUsePercent: 50,
          userEnteredCredit: 0,
        },
      ]);
    const body = (await get(cookies)).body;
    expect(body.form8936Vehicles[0].placedInService).toBe('2025-03-15');
    expect(body.form8936Vehicles[0].vin).toBe('1FA0000000000001');
  });
});

describe('loadFullReturn — Form 8889 HSA family coverage', () => {
  it('preserves coverage: family', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-8889')
      .set('Cookie', cookies)
      .send({
        coverage: 'family',
        contributions: 6000,
        isCatchUpEligible: false,
        distributions: 0,
        qualifiedMedicalExpenses: 0,
        isDisabledOrOver65: false,
      });
    expect(res.status).toBe(200);
    const body = (await get(cookies)).body;
    expect(body.form8889.coverage).toBe('family');
  });
});

describe('loadFullReturn — Schedule 1 alimony fields', () => {
  it('preserves alimonyDivorceDate', async () => {
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/schedule-1-adjustments')
      .set('Cookie', cookies)
      .send({
        educatorExpenses: 0,
        hsaDeduction: 0,
        selfEmployedHealthInsurance: 0,
        sepContribution: 0,
        simpleContribution: 0,
        solo401kContribution: 0,
        traditionalIraDeduction: 0,
        studentLoanInterest: 0,
        penaltyEarlyWithdrawal: 0,
        alimonyPaid: 6000,
        alimonyRecipientSsn: '111-22-3333',
        alimonyDivorceDate: '2015-06-01',
        reservistExpenses: 0,
        performingArtistExpenses: 0,
        feeBasisExpenses: 0,
      });
    const body = (await get(cookies)).body;
    expect(body.schedule1Adjustments.alimonyDivorceDate).toBe('2015-06-01');
  });
});

// Minimal-payload roundtrips that exercise the save-side `?? null`
// fallback for each list endpoint's nullable-optional string fields
// (payer / employer / description / businessName / etc.).
describe('loadFullReturn — minimal-payload save-side null fallbacks', () => {
  async function post(path: string, body: object, cookies: string[]) {
    return request(app).put(`/api/return/${path}`).set('Cookie', cookies).send(body);
  }

  it('accepts a w2 row with only box1Wages (employer/ein omitted → null)', async () => {
    const { cookies } = await authedUser();
    const res = await post('w2', [{ box1Wages: 1000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts an interest row with only amount (payer omitted → null)', async () => {
    const { cookies } = await authedUser();
    const res = await post('interest', [{ amount: 50 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a dividend row with only ordinary (payer omitted → null)', async () => {
    const { cookies } = await authedUser();
    const res = await post('dividends', [{ ordinary: 100 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a self-employment row with only grossReceipts', async () => {
    const { cookies } = await authedUser();
    const res = await post('self-employment', [{ grossReceipts: 50000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a capital-gains row with only proceeds + term', async () => {
    const { cookies } = await authedUser();
    const res = await post('capital-gains', [{ proceeds: 500, term: 'long' }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a retirement row with only grossDistribution', async () => {
    const { cookies } = await authedUser();
    const res = await post('retirement-income', [{ grossDistribution: 1000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts an unemployment row with only amount', async () => {
    const { cookies } = await authedUser();
    const res = await post('unemployment', [{ amount: 200 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a gambling row with only winnings', async () => {
    const { cookies } = await authedUser();
    const res = await post('gambling', [{ winnings: 300 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts an other-income row with only source + amount', async () => {
    const { cookies } = await authedUser();
    const res = await post('other-income', [{ source: 'jury_duty', amount: 75 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a schedule-e-rental row with ONLY rentsReceived (address omitted)', async () => {
    const { cookies } = await authedUser();
    const res = await post('schedule-e-rental', [{ rentsReceived: 12000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a schedule-e-royalty row with ONLY grossRoyalties (source omitted)', async () => {
    const { cookies } = await authedUser();
    const res = await post('schedule-e-royalty', [{ grossRoyalties: 500 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a k1 row with only entityKind + ordinaryBusinessIncome', async () => {
    const { cookies } = await authedUser();
    const res = await post('k1-income', [{
      entityKind: 'partnership',
      ordinaryBusinessIncome: 1000,
    }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a farm row with only grossIncome (farmName omitted)', async () => {
    const { cookies } = await authedUser();
    const res = await post('schedule-f-farm', [{ grossIncome: 5000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a form4797 row with only proceeds + term', async () => {
    const { cookies } = await authedUser();
    const res = await post('form-4797', [{ proceeds: 1000, term: 'long_1231' }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a depreciation-asset row with only cost', async () => {
    const { cookies } = await authedUser();
    const res = await post('depreciation-assets', [{ cost: 5000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a home-office row with only squareFeet', async () => {
    const { cookies } = await authedUser();
    const res = await post('home-offices', [{ squareFeet: 150 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a form8863-student row with only creditType + qualifiedExpenses', async () => {
    const { cookies } = await authedUser();
    const res = await post('form-8863-students', [{
      creditType: 'llc',
      qualifiedExpenses: 3000,
    }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a form8936-vehicle row with only purchasePrice', async () => {
    const { cookies } = await authedUser();
    const res = await post('form-8936-vehicles', [{ purchasePrice: 30000 }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts a form1116-basket row with only category + foreignTaxPaid', async () => {
    const { cookies } = await authedUser();
    const res = await post('form-1116-baskets', [{
      category: 'passive',
      foreignTaxPaid: 100,
    }], cookies);
    expect(res.status).toBe(200);
  });

  it('accepts personal-info with every optional field omitted', async () => {
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/personal-info')
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(200);
  });

  it('schedule-8812 with explicit qualifying-children + earned-income overrides', async () => {
    // Exercises the truthy branch of `s8812Row?.qualifying_children_override
    // == null ? null : Number(...)` and the earned-income counterpart in
    // loadFullReturn.
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/schedule-8812')
      .set('Cookie', cookies)
      .send({
        qualifyingChildrenOverride: 3,
        earnedIncomeOverride: 25000,
        includeCombatPay: false,
        combatPayAmount: 0,
      });
    const body = (await get(cookies)).body;
    expect(body.schedule8812.qualifyingChildrenOverride).toBe(3);
    expect(body.schedule8812.earnedIncomeOverride).toBe(25000);
  });

  it('eitc-eligibility with explicit qualifying-children + investment-income overrides', async () => {
    // Same shape — exercises eitcRow overrides' truthy ternary branches.
    const { cookies } = await authedUser();
    await request(app)
      .put('/api/return/eitc-eligibility')
      .set('Cookie', cookies)
      .send({
        qualifyingChildrenOverride: 2,
        investmentIncomeOverride: 100,
        isEligibleAge: true,
        includeCombatPay: false,
        combatPayAmount: 0,
      });
    const body = (await get(cookies)).body;
    expect(body.eitcEligibility.qualifyingChildrenOverride).toBe(2);
    expect(body.eitcEligibility.investmentIncomeOverride).toBe(100);
  });

  it('GET /api/return/list returns a populated tax-year list', async () => {
    // Exercises the row-mapping branch in `router.get('/list', ...)` after a
    // return has been created for the user.
    const { cookies } = await authedUser();
    await request(app).get('/api/return').set('Cookie', cookies); // auto-creates a return
    const res = await request(app).get('/api/return/list').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ taxYear: 2025 });
  });

  it('accepts form-8995 with an activity lacking name + ein', async () => {
    // Exercises `a.name ?? null` and `a.ein ?? null` null-fallback branches
    // for a QBI activity row that only has a qbi number.
    const { cookies } = await authedUser();
    const res = await request(app)
      .put('/api/return/form-8995')
      .set('Cookie', cookies)
      .send({
        activities: [{ qbi: 50000 }],
        reitPtpDividends: 0,
        priorYearQbiLossCarry: 0,
        priorYearReitPtpLossCarry: 0,
      });
    expect(res.status).toBe(200);
  });
});
