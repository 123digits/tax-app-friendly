import { describe, it, expect } from 'vitest';
import { computeForm8960 } from './form8960.js';
import type { Form8960, NiitRow } from '../../../shared/types.js';

function row(): NiitRow {
  return { rate: 0.038, threshold: 200000 };
}

function f(p: Partial<Form8960> = {}): Form8960 {
  return {
    investmentInterestExpense: 0,
    stateTaxAllocableToInvestment: 0,
    miscInvestmentExpenses: 0,
    otherModifications: 0,
    ...p,
  };
}

describe('computeForm8960', () => {
  it('no row → zeros', () => {
    const r = computeForm8960(f(), 'single', 500000, 100000, 0, undefined);
    expect(r.niit).toBe(0);
    expect(r.netInvestmentIncome).toBe(0);
    expect(r.magi).toBe(0);
    expect(r.excessOverThreshold).toBe(0);
    expect(r.amountSubjectToNiit).toBe(0);
  });

  it('MAGI below threshold → niit = 0 even with investment income', () => {
    const r = computeForm8960(f(), 'single', 150000, 40000, 0, row());
    expect(r.netInvestmentIncome).toBe(40000);
    expect(r.magi).toBe(150000);
    expect(r.excessOverThreshold).toBe(0);
    expect(r.amountSubjectToNiit).toBe(0);
    expect(r.niit).toBe(0);
  });

  it('$30k NII, $250k MAGI (single, threshold $200k) → $30k × 3.8% = $1,140', () => {
    const r = computeForm8960(f(), 'single', 250000, 30000, 0, row());
    expect(r.netInvestmentIncome).toBe(30000);
    expect(r.magi).toBe(250000);
    expect(r.excessOverThreshold).toBe(50000);
    expect(r.amountSubjectToNiit).toBe(30000);
    expect(r.niit).toBe(1140);
  });

  it('MAGI $210k, NII $50k → niit on min($50k, $10k) = $10k × 3.8% = $380', () => {
    const r = computeForm8960(f(), 'single', 210000, 50000, 0, row());
    expect(r.excessOverThreshold).toBe(10000);
    expect(r.amountSubjectToNiit).toBe(10000);
    expect(r.niit).toBe(380);
  });

  it('allocable expenses reduce NII', () => {
    // Gross $30k − $5k interest expense − $2k state tax − $1k misc = $22k NII.
    // MAGI $250k → excess $50k; subject = min($22k, $50k) = $22k.
    // NIIT = $22,000 × 0.038 = $836.
    const r = computeForm8960(
      f({
        investmentInterestExpense: 5000,
        stateTaxAllocableToInvestment: 2000,
        miscInvestmentExpenses: 1000,
      }),
      'single',
      250000,
      30000,
      0,
      row(),
    );
    expect(r.netInvestmentIncome).toBe(22000);
    expect(r.amountSubjectToNiit).toBe(22000);
    expect(r.niit).toBe(836);
  });

  it('negative net investment income (expenses > gross) → niit = 0', () => {
    const r = computeForm8960(
      f({
        investmentInterestExpense: 8000,
        stateTaxAllocableToInvestment: 4000,
        miscInvestmentExpenses: 3000,
      }),
      'single',
      250000,
      5000, // gross $5k, expenses $15k → NII floored to 0
      0,
      row(),
    );
    expect(r.netInvestmentIncome).toBe(0);
    expect(r.amountSubjectToNiit).toBe(0);
    expect(r.niit).toBe(0);
  });

  it('FEIE add-back pushes MAGI over threshold', () => {
    // AGI $190k (below $200k threshold) but FEIE add-back $30k → MAGI $220k.
    // NII $15k, excess $20k → subject = $15k → niit = $570.
    const r = computeForm8960(f(), 'single', 190000, 15000, 30000, row());
    expect(r.magi).toBe(220000);
    expect(r.excessOverThreshold).toBe(20000);
    expect(r.amountSubjectToNiit).toBe(15000);
    expect(r.niit).toBe(570);
  });

  it('undefined input with MAGI over threshold still computes on gross NII', () => {
    const r = computeForm8960(undefined, 'single', 300000, 20000, 0, row());
    expect(r.netInvestmentIncome).toBe(20000);
    expect(r.excessOverThreshold).toBe(100000);
    expect(r.amountSubjectToNiit).toBe(20000);
    expect(r.niit).toBe(760);
  });
});
