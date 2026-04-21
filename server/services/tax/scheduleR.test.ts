import { describe, it, expect } from 'vitest';
import { computeScheduleR } from './scheduleR.js';
import type { ScheduleR } from '../../../shared/types.js';

function r(p: Partial<ScheduleR>): ScheduleR {
  return {
    isTaxpayerEligible: false,
    isSpouseEligible: false,
    taxpayerUnder65Disabled: false,
    spouseUnder65Disabled: false,
    disabilityIncome: 0,
    nontaxableSsAndPension: 0,
    ...p,
  };
}

describe('computeScheduleR', () => {
  it('not eligible → all zeros', () => {
    const out = computeScheduleR(r({}), 20000, 'single');
    expect(out.baseAmount).toBe(0);
    expect(out.creditBase).toBe(0);
    expect(out.credit).toBe(0);
  });

  it('undefined input → all zeros', () => {
    const out = computeScheduleR(undefined, 20000, 'single');
    expect(out.credit).toBe(0);
  });

  it('single 65+, $20k AGI, no SS: excess AGI wipes out base → $0 credit', () => {
    const out = computeScheduleR(
      r({ isTaxpayerEligible: true }),
      20000,
      'single',
    );
    expect(out.baseAmount).toBe(5000);
    // (20000 − 7500) / 2 = 6250
    expect(out.excessAgiReduction).toBe(6250);
    expect(out.creditBase).toBe(0);
    expect(out.credit).toBe(0);
  });

  it('single 65+, $10k AGI, no SS: credit ≈ $563', () => {
    const out = computeScheduleR(
      r({ isTaxpayerEligible: true }),
      10000,
      'single',
    );
    expect(out.baseAmount).toBe(5000);
    // (10000 − 7500) / 2 = 1250
    expect(out.excessAgiReduction).toBe(1250);
    expect(out.creditBase).toBe(3750);
    // 3750 × 0.15 = 562.50 → rounds to $563
    expect(out.credit).toBe(563);
  });

  it('MFJ both 65+, $12k AGI, no SS: credit = $975', () => {
    const out = computeScheduleR(
      r({ isTaxpayerEligible: true, isSpouseEligible: true }),
      12000,
      'mfj',
    );
    expect(out.baseAmount).toBe(7500);
    // (12000 − 10000) / 2 = 1000
    expect(out.excessAgiReduction).toBe(1000);
    expect(out.creditBase).toBe(6500);
    expect(out.credit).toBe(975);
  });

  it('MFJ only one spouse eligible → base $5,000', () => {
    const out = computeScheduleR(
      r({ isTaxpayerEligible: true, isSpouseEligible: false }),
      10000,
      'mfj',
    );
    expect(out.baseAmount).toBe(5000);
    // (10000 − 10000) / 2 = 0
    expect(out.excessAgiReduction).toBe(0);
    expect(out.creditBase).toBe(5000);
    expect(out.credit).toBe(750);
  });

  it('MFS eligible (lived apart all year) → base $3,750', () => {
    const out = computeScheduleR(
      r({ isTaxpayerEligible: true }),
      5000,
      'mfs',
    );
    expect(out.baseAmount).toBe(3750);
    expect(out.excessAgiReduction).toBe(0);
    expect(out.creditBase).toBe(3750);
    // 3750 × 0.15 = 562.50 → rounds to $563
    expect(out.credit).toBe(563);
  });

  it('single under-65 disabled: base capped by disabilityIncome → credit $413', () => {
    const out = computeScheduleR(
      r({
        isTaxpayerEligible: true,
        taxpayerUnder65Disabled: true,
        disabilityIncome: 3000,
      }),
      8000,
      'single',
    );
    // base = min(5000, 3000) = 3000
    expect(out.baseAmount).toBe(3000);
    // (8000 − 7500) / 2 = 250
    expect(out.excessAgiReduction).toBe(250);
    expect(out.creditBase).toBe(2750);
    // 2750 × 0.15 = 412.50 → rounds to $413
    expect(out.credit).toBe(413);
  });

  it('nontaxable SS reduces credit base', () => {
    const out = computeScheduleR(
      r({
        isTaxpayerEligible: true,
        nontaxableSsAndPension: 2000,
      }),
      7500,
      'single',
    );
    expect(out.baseAmount).toBe(5000);
    expect(out.nontaxableSsReduction).toBe(2000);
    expect(out.excessAgiReduction).toBe(0);
    expect(out.creditBase).toBe(3000);
    expect(out.credit).toBe(450);
  });

  it('reductions drive credit base below zero → floored at zero', () => {
    const out = computeScheduleR(
      r({
        isTaxpayerEligible: true,
        nontaxableSsAndPension: 10000,
      }),
      7500,
      'single',
    );
    expect(out.creditBase).toBe(0);
    expect(out.credit).toBe(0);
  });
});
