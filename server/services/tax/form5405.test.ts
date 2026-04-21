import { describe, it, expect } from 'vitest';
import { computeForm5405 } from './form5405.js';

describe('computeForm5405', () => {
  it('no input → zero', () => {
    expect(computeForm5405(undefined).repaymentThisYear).toBe(0);
  });

  it('sums installment + acceleration', () => {
    const r = computeForm5405({
      annualInstallment: 500,
      dispositionAccelerated: 2000,
    });
    expect(r.repaymentThisYear).toBe(2500);
  });

  it('negatives clamped to 0', () => {
    const r = computeForm5405({
      annualInstallment: -100,
      dispositionAccelerated: 0,
    });
    expect(r.repaymentThisYear).toBe(0);
  });
});
