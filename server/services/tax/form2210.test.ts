import { describe, it, expect } from 'vitest';
import { computeForm2210 } from './form2210.js';
import type { Form2210 } from '../../../shared/types.js';

function base(overrides: Partial<Form2210> = {}): Form2210 {
  return {
    priorYearTax: 0,
    priorYearAgi: 0,
    withholdingByQuarter: [0, 0, 0, 0],
    estimatedPaymentsByQuarter: [0, 0, 0, 0],
    requestWaiver: false,
    ...overrides,
  };
}

describe('computeForm2210', () => {
  it('no input → zeros', () => {
    const r = computeForm2210(undefined, 'single', 10000);
    expect(r.penalty).toBe(0);
  });

  it('paid ≥ required → no penalty', () => {
    // 90% of $10k = $9,000 required; paid $10,000.
    const r = computeForm2210(
      base({
        priorYearTax: 20000,
        priorYearAgi: 100000,
        withholdingByQuarter: [2500, 2500, 2500, 2500],
      }),
      'single',
      10000,
    );
    expect(r.requiredAnnualPayment).toBeCloseTo(9000, 2);
    expect(r.underpayment).toBe(0);
    expect(r.penalty).toBe(0);
  });

  it('chooses lesser of 90% current / 100% prior', () => {
    // Current 90% × $10k = $9k; prior 100% × $5k = $5k → required $5k.
    const r = computeForm2210(
      base({ priorYearTax: 5000, priorYearAgi: 50000 }),
      'single',
      10000,
    );
    expect(r.requiredAnnualPayment).toBeCloseTo(5000, 2);
  });

  it('high-income MFJ: 110% prior-year safe harbor', () => {
    // AGI $200k > $150k → 110% × $10k = $11k; 90% current × $20k = $18k.
    const r = computeForm2210(
      base({ priorYearTax: 10000, priorYearAgi: 200000 }),
      'mfj',
      20000,
    );
    expect(r.requiredAnnualPayment).toBeCloseTo(11000, 2);
  });

  it('MFS high-income threshold is $75k', () => {
    // AGI $80k MFS > $75k → 110% rule.
    const r = computeForm2210(
      base({ priorYearTax: 10000, priorYearAgi: 80000 }),
      'mfs',
      20000,
    );
    expect(r.requiredAnnualPayment).toBeCloseTo(11000, 2);
  });

  it('underpayment < $1,000 de minimis → no penalty', () => {
    // Required $9,000; paid $8,500 → $500 underpayment < $1,000.
    const r = computeForm2210(
      base({
        priorYearTax: 20000,
        withholdingByQuarter: [2125, 2125, 2125, 2125],
      }),
      'single',
      10000,
    );
    expect(r.underpayment).toBeCloseTo(500, 2);
    expect(r.penalty).toBe(0);
  });

  it('underpayment ≥ $1,000 → penalty at 8%', () => {
    // Required $9,000; paid $5,000 → $4,000 underpayment × 8% = $320.
    const r = computeForm2210(
      base({
        priorYearTax: 20000,
        withholdingByQuarter: [1250, 1250, 1250, 1250],
      }),
      'single',
      10000,
    );
    expect(r.underpayment).toBeCloseTo(4000, 2);
    expect(r.penalty).toBeCloseTo(320, 2);
  });

  it('prior-year tax = $0 → only 90% current-year safe harbor applies (§6654(d)(1)(B)(ii))', () => {
    // Prior-year safe harbor is unavailable when prior tax was $0 — only
    // the 90% current-year test applies. Otherwise Math.min(current,0)=0 and
    // every first-time filer / zero-prior-tax filer would escape the penalty.
    // 90% × $10k = $9,000 required. Paid $0 → $9,000 underpayment × 8% = $720.
    const r = computeForm2210(
      base({ priorYearTax: 0, priorYearAgi: 50000 }),
      'single',
      10000,
    );
    expect(r.requiredAnnualPayment).toBeCloseTo(9000, 2);
    expect(r.underpayment).toBeCloseTo(9000, 2);
    expect(r.penalty).toBeCloseTo(720, 2);
  });

  it('waiver zeros the penalty', () => {
    const r = computeForm2210(
      base({
        priorYearTax: 20000,
        withholdingByQuarter: [1250, 1250, 1250, 1250],
        requestWaiver: true,
      }),
      'single',
      10000,
    );
    expect(r.penalty).toBe(0);
  });
});
