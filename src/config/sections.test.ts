import { describe, it, expect } from 'vitest';
import { SECTIONS } from './sections';
import { stubTaxStoreData } from '../../test-setup/vue-helpers';
import type { TaxReturn } from '../../shared/types';

function base(overrides: Record<string, unknown> = {}): TaxReturn {
  return stubTaxStoreData(overrides) as unknown as TaxReturn;
}

describe('SECTIONS config', () => {
  it('exports a non-empty list', () => {
    expect(SECTIONS.length).toBeGreaterThan(30);
  });

  it('every section has id, title, route, progress', () => {
    for (const s of SECTIONS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.route).toMatch(/^\//);
      expect(typeof s.progress).toBe('function');
    }
  });

  it('each progress function returns a number between 0 and stepCount for an empty return', () => {
    const empty = base();
    for (const s of SECTIONS) {
      const p = s.progress(empty);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(s.stepCount);
    }
  });

  it('personal progress counts filing status + name + address', () => {
    const personal = SECTIONS.find((s) => s.id === 'personal')!;
    const r = base({
      filingStatus: 'single',
      personalInfo: {
        firstName: 'A', lastName: 'B',
        addressLine1: '1 Main',
        ssnLast4: null, dob: null, addressLine2: null, city: null, state: null, zip: null,
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      },
    });
    expect(personal.progress(r)).toBe(3);
  });

  it('income progress is 1 when w2s exist', () => {
    const sec = SECTIONS.find((s) => s.id === 'income')!;
    expect(sec.progress(base({ w2s: [{ id: '1', employer: 'X', ein: null, box1Wages: 1, box2FedWithheld: 0, box3SsWages: 0, box4SsWithheld: 0, box5MedicareWages: 0, box6MedicareWithheld: 0, stateWages: 0, stateWithheld: 0 }] as never }))).toBe(1);
  });

  it('interest-dividends counts each type separately', () => {
    const sec = SECTIONS.find((s) => s.id === 'interest-dividends')!;
    expect(sec.progress(base({ interest: [{ id: '1' }] as never, dividends: [{ id: '1' }] as never }))).toBe(2);
  });

  it('ss-benefits is 1 when grossBenefits > 0', () => {
    const sec = SECTIONS.find((s) => s.id === 'ss-benefits')!;
    expect(sec.progress(base({ socialSecurity: { grossBenefits: 100, medicarePremiums: 0, federalWithheld: 0 } }))).toBe(1);
  });

  it('gambling is 1 when losses > 0 even without winnings', () => {
    const sec = SECTIONS.find((s) => s.id === 'gambling')!;
    expect(sec.progress(base({ gamblingLosses: 100, gambling: [] as never }))).toBe(1);
  });

  it('schedule-1-adjustments reflects any non-zero field', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-1-adjustments')!;
    const r = base();
    expect(sec.progress(r)).toBe(0);
    r.schedule1Adjustments.educatorExpenses = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8606 reflects any non-zero field', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8606')!;
    const r = base();
    r.form8606.priorYearBasis = 50;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8889 reflects coverage or contribution', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8889')!;
    const r = base({ form8889: { coverage: 'self', contributions: 0, isCatchUpEligible: false, distributions: 0, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false } });
    expect(sec.progress(r)).toBe(1);
  });

  it('form-2441 reflects expense or num persons', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-2441')!;
    const r = base();
    r.form2441.numQualifyingPersons = 1;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8880 reflects contributions', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8880')!;
    const r = base();
    r.form8880.iraContributions = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('schedule-r reflects eligibility', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-r')!;
    const r = base();
    r.scheduleR.isTaxpayerEligible = true;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8396 reflects certificate or interest', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8396')!;
    const r = base();
    r.form8396.mortgageInterestPaid = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-5695 reflects any spend', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-5695')!;
    const r = base();
    r.form5695.solarElectric = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('schedule-8812 reflects any override', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-8812')!;
    const r = base();
    r.schedule8812.qualifyingChildrenOverride = 1;
    expect(sec.progress(r)).toBe(1);
  });

  it('eitc reflects override / !isEligibleAge', () => {
    const sec = SECTIONS.find((s) => s.id === 'eitc')!;
    const r = base();
    r.eitcEligibility.isEligibleAge = false;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8962 reflects enrollment premium', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8962')!;
    const r = base();
    r.form8962.annualEnrollmentPremium = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-6251 reflects AMT adjustments', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-6251')!;
    const r = base();
    r.form6251.otherAdjustments = 50;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8960 reflects NIIT adjustments', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8960')!;
    const r = base();
    r.form8960.investmentInterestExpense = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8959 reflects RRTA or withholding', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8959')!;
    const r = base();
    r.form8959.rrtaCompensation = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-2555 reflects FEIE fields', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-2555')!;
    const r = base();
    r.form2555.foreignEarnedIncome = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('schedule-h reflects wage fields', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-h')!;
    const r = base();
    r.scheduleH.cashWagesSsMedicare = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-2210 reflects quarterly withholding', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-2210')!;
    const r = base();
    r.form2210.withholdingByQuarter = [100, 0, 0, 0];
    expect(sec.progress(r)).toBe(1);
  });

  it('form-5405 reflects installment', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-5405')!;
    const r = base();
    r.form5405.annualInstallment = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-4972 reflects lump sum', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-4972')!;
    const r = base();
    r.form4972.qualifyingLumpSum = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('form-8995 reflects activities', () => {
    const sec = SECTIONS.find((s) => s.id === 'form-8995')!;
    const r = base();
    if (r.form8995) {
      r.form8995.activities = [{ id: '1', name: 'x', qbi: 100 } as never];
      expect(sec.progress(r)).toBe(1);
    }
  });

  it('deductions reflects itemized when useStandardDeduction is false', () => {
    const sec = SECTIONS.find((s) => s.id === 'deductions')!;
    const r = base({ useStandardDeduction: false });
    expect(sec.progress(r)).toBe(0);
    r.itemized.medical = 100;
    expect(sec.progress(r)).toBe(1);
  });

  it('review always returns 0', () => {
    const sec = SECTIONS.find((s) => s.id === 'review')!;
    expect(sec.progress(base())).toBe(0);
  });

  // Covers the populated-array branch (`X.length > 0 ? 1 : 0` → 1) for
  // every section whose progress comes directly from a list field.
  it.each([
    ['self-employment', 'selfEmployment'],
    ['capital-gains', 'capitalGains'],
    ['retirement', 'retirementIncome'],
    ['unemployment', 'unemployment'],
    ['other-income', 'otherIncome'],
    ['k1', 'k1s'],
    ['schedule-f', 'farms'],
    ['form-4797', 'form4797Sales'],
    ['form-4562', 'depreciationAssets'],
    ['form-8829', 'homeOffices'],
    ['form-8863', 'form8863Students'],
    ['form-8936', 'form8936Vehicles'],
    ['form-1116', 'form1116Baskets'],
  ])('%s → 1 when %s has at least one row', (sectionId, field) => {
    const sec = SECTIONS.find((s) => s.id === sectionId)!;
    const r = base({ [field]: [{ id: '1' } as Record<string, unknown>] });
    expect(sec.progress(r)).toBe(1);
  });

  it('schedule-e → 1 when rentals exist', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-e')!;
    expect(sec.progress(base({ scheduleERentals: [{ id: '1' } as never] }))).toBe(1);
  });

  it('schedule-e → 1 when royalties exist', () => {
    const sec = SECTIONS.find((s) => s.id === 'schedule-e')!;
    expect(sec.progress(base({ scheduleERoyalties: [{ id: '1' } as never] }))).toBe(1);
  });

  it('handles missing optional form bags gracefully (legacy data)', () => {
    // Section progress helpers defensively accept missing form objects —
    // required arrays like w2s/socialSecurity are always produced by the
    // backend loader, so we only exercise the optional-form bag paths.
    const r = base() as unknown as Record<string, unknown>;
    delete r.scheduleR;
    delete r.form8396;
    delete r.form5695;
    delete r.schedule8812;
    delete r.eitcEligibility;
    delete r.form8962;
    delete r.form6251;
    delete r.form8960;
    delete r.form8959;
    delete r.form2555;
    delete r.scheduleH;
    delete r.form2210;
    delete r.form5405;
    delete r.form4972;
    delete r.form8995;
    delete r.form8889;
    delete r.form2441;
    delete r.form8880;
    delete r.form8606;
    delete r.schedule1Adjustments;
    for (const s of SECTIONS) {
      const out = s.progress(r as unknown as TaxReturn);
      expect(out).toBeGreaterThanOrEqual(0);
    }
  });
});
