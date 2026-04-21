import { describe, it, expect } from 'vitest';
import { computeForm8606 } from './form8606.js';
import type { Form8606 } from '../../../shared/types.js';

function f(p: Partial<Form8606>): Form8606 {
  return {
    priorYearBasis: 0,
    currentYearNondeductible: 0,
    traditionalIraBalance: 0,
    distributions: 0,
    conversions: 0,
    ...p,
  };
}

describe('computeForm8606', () => {
  it('no activity returns all zeros', () => {
    const r = computeForm8606(f({}));
    expect(r.totalBasisAvailable).toBe(0);
    expect(r.taxableDistribution).toBe(0);
    expect(r.taxableConversion).toBe(0);
    expect(r.endingBasis).toBe(0);
  });

  it('all-pretax IRA: $10k distribution is fully taxable', () => {
    const r = computeForm8606(f({ traditionalIraBalance: 90000, distributions: 10000 }));
    expect(r.taxableDistribution).toBe(10000);
    expect(r.nontaxablePortion).toBe(0);
  });

  it('pure backdoor Roth (basis = contribution, balance = 0): conversion is entirely nontaxable', () => {
    // $7,000 nondeductible contribution, $7,000 converted, $0 balance remaining.
    const r = computeForm8606(f({
      currentYearNondeductible: 7000,
      conversions: 7000,
    }));
    expect(r.taxableConversion).toBe(0);
    expect(r.nontaxablePortion).toBe(7000);
    expect(r.endingBasis).toBe(0);
  });

  it('pro-rata: $5k basis + $95k pretax balance + $10k conversion → ~4.76% nontaxable', () => {
    // IRS Form 8606 line 10 denominator = line 6 + 7 + 8 = 95k bal + 10k conv = 105k
    // nontaxable fraction = 5000 / 105000 ≈ 4.7619%
    // nontaxable portion of conversion = 10000 * 5/105 ≈ 476.19
    // taxable conversion ≈ 10000 - 476 = 9524
    const r = computeForm8606(f({
      priorYearBasis: 5000,
      traditionalIraBalance: 95000,
      conversions: 10000,
    }));
    expect(r.nontaxablePortion).toBeCloseTo(476, 0);
    expect(r.taxableConversion).toBeCloseTo(9524, 0);
  });
});
