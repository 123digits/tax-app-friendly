import { describe, it, expect } from 'vitest';
import { computeForm2441, pickChildCareRate } from './form2441.js';
import type { Form2441, ChildCareConstants } from '../../../shared/types.js';

const CC: ChildCareConstants = {
  maxExpenseOne: 3000,
  maxExpenseTwo: 6000,
  rates: [
    { agi: 15000, rate: 0.35 },
    { agi: 17000, rate: 0.34 },
    { agi: 43000, rate: 0.21 },
    { agi: Number.MAX_SAFE_INTEGER, rate: 0.20 },
  ],
};

function f(p: Partial<Form2441>): Form2441 {
  return {
    totalQualifiedExpenses: 0,
    numQualifyingPersons: 0,
    taxpayerEarnedIncome: 0,
    spouseEarnedIncome: 0,
    employerProvidedBenefits: 0,
    ...p,
  };
}

describe('pickChildCareRate', () => {
  it('lowest tier when AGI at or below first cap', () => {
    expect(pickChildCareRate(10000, CC)).toBe(0.35);
    expect(pickChildCareRate(15000, CC)).toBe(0.35);
  });

  it('high-AGI falls to 20% floor', () => {
    expect(pickChildCareRate(500000, CC)).toBe(0.20);
  });

  it('undefined constants → 0', () => {
    expect(pickChildCareRate(50000, undefined)).toBe(0);
  });
});

describe('computeForm2441', () => {
  it('no constants → zero credit', () => {
    const r = computeForm2441(f({ totalQualifiedExpenses: 5000, numQualifyingPersons: 2 }), 50000, 'single', undefined);
    expect(r.credit).toBe(0);
    expect(r.allowedExpenses).toBe(0);
  });

  it('no qualifying persons → zero credit', () => {
    const r = computeForm2441(
      f({ totalQualifiedExpenses: 5000, numQualifyingPersons: 0, taxpayerEarnedIncome: 50000 }),
      50000,
      'single',
      CC,
    );
    expect(r.credit).toBe(0);
  });

  it('no expenses → zero credit', () => {
    const r = computeForm2441(
      f({ totalQualifiedExpenses: 0, numQualifyingPersons: 1, taxpayerEarnedIncome: 50000 }),
      50000,
      'single',
      CC,
    );
    expect(r.credit).toBe(0);
  });

  it('single, 1 person, $3,500 expenses, $50k AGI → capped at $3,000, 20% → $600', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 3500,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
      }),
      50000,
      'single',
      CC,
    );
    expect(r.allowedExpenses).toBe(3000);
    expect(r.applicableRate).toBe(0.20);
    expect(r.credit).toBe(600);
  });

  it('MFJ, 2 persons, $7,000 expenses, AGI $15k (35% tier), both earn $25k → $6,000 × 35% = $2,100', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 7000,
        numQualifyingPersons: 2,
        taxpayerEarnedIncome: 25000,
        spouseEarnedIncome: 25000,
      }),
      15000,
      'mfj',
      CC,
    );
    expect(r.allowedExpenses).toBe(6000);
    expect(r.applicableRate).toBe(0.35);
    expect(r.credit).toBe(2100);
  });

  it('MFJ with spouse earned income = 0 → allowed expenses = 0', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 5000,
        numQualifyingPersons: 2,
        taxpayerEarnedIncome: 50000,
        spouseEarnedIncome: 0,
      }),
      60000,
      'mfj',
      CC,
    );
    expect(r.allowedExpenses).toBe(0);
    expect(r.credit).toBe(0);
  });

  it('employer benefits reduce allowed expenses', () => {
    // 1 person → cap $3,000; $1,000 employer benefits → cap $2,000.
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 3500,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
        employerProvidedBenefits: 1000,
      }),
      50000,
      'single',
      CC,
    );
    expect(r.allowedExpenses).toBe(2000);
    expect(r.credit).toBe(400);  // 2000 * 0.20
  });

  it('earned-income limit (single) below cap reduces allowed expenses', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 5000,
        numQualifyingPersons: 2,
        taxpayerEarnedIncome: 2500,
      }),
      50000,
      'single',
      CC,
    );
    expect(r.allowedExpenses).toBe(2500);
    expect(r.credit).toBe(500);  // 2500 * 0.20
  });

  it('§21(e)(2): MFS without abandonment exception → zero credit', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 5000,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
      }),
      50000,
      'mfs',
      CC,
    );
    expect(r.allowedExpenses).toBe(0);
    expect(r.credit).toBe(0);
  });

  it('§21(e)(2): MFS WITH abandonment exception → credit computes single-style', () => {
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 5000,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
        mfsAbandonmentException: true,
      }),
      50000,
      'mfs',
      CC,
    );
    // Single-style earned-income limit: $3,000 cap × 20% = $600.
    expect(r.allowedExpenses).toBe(3000);
    expect(r.applicableRate).toBe(0.20);
    expect(r.credit).toBe(600);
  });

  it('§21(d)(2): MFJ with disabled spouse + 1 QP → imputed $3,000 earned income', () => {
    // Spouse actual $0 but disabled → imputed $250/mo × 12 = $3,000.
    // 1 QP cap = $3,000; min(actual-exp $5,000, cap $3,000, min(taxpayer,
    // spouse)=$3,000) = $3,000 allowed × 20% = $600.
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 5000,
        numQualifyingPersons: 1,
        taxpayerEarnedIncome: 50000,
        spouseEarnedIncome: 0,
        spouseIsStudentOrDisabled: true,
      }),
      50000,
      'mfj',
      CC,
    );
    expect(r.allowedExpenses).toBe(3000);
    expect(r.applicableRate).toBe(0.20);
    expect(r.credit).toBe(600);
  });

  it('§21(d)(2): MFJ with student spouse + 2 QPs → imputed $6,000 earned income', () => {
    // Spouse actual $0 but student → imputed $500/mo × 12 = $6,000.
    // 2 QP cap = $6,000; min(exp $7,000, cap $6,000, min(taxpayer,
    // spouse)=$6,000) = $6,000 × 20% = $1,200.
    const r = computeForm2441(
      f({
        totalQualifiedExpenses: 7000,
        numQualifyingPersons: 2,
        taxpayerEarnedIncome: 50000,
        spouseEarnedIncome: 0,
        spouseIsStudentOrDisabled: true,
      }),
      50000,
      'mfj',
      CC,
    );
    expect(r.allowedExpenses).toBe(6000);
    expect(r.applicableRate).toBe(0.20);
    expect(r.credit).toBe(1200);
  });
});
