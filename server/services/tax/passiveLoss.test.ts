import { describe, it, expect } from 'vitest';
import { applyPassiveLossLimits } from './passiveLoss.js';

describe('applyPassiveLossLimits', () => {
  it('all pool-A positive → netPassive is sum, no suspensions', () => {
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: 3000, priorYearUnallowedLoss: 0 }],
      [],
      100000,
      'single',
    );
    expect(r.netPassive).toBe(3000);
    expect(r.totalSuspendedRental).toBe(0);
    expect(r.totalSuspendedK1).toBe(0);
    expect(r.specialAllowanceApplied).toBe(0);
  });

  it('pool-A $20k loss, AGI $80k → fully allowed via special allowance', () => {
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -20000, priorYearUnallowedLoss: 0 }],
      [],
      80000,
      'single',
    );
    expect(r.passiveLossesAllowed).toBe(20000);
    expect(r.totalSuspendedRental).toBe(0);
    expect(r.specialAllowanceApplied).toBe(20000);
    expect(r.netPassive).toBe(-20000);
  });

  it('pool-A $20k loss, AGI $125k → $12,500 allowed, $7,500 suspended', () => {
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -20000, priorYearUnallowedLoss: 0 }],
      [],
      125000,
      'single',
    );
    expect(r.passiveLossesAllowed).toBe(12500);
    expect(r.totalSuspendedRental).toBe(7500);
    expect(r.specialAllowanceApplied).toBe(12500);
  });

  it('pool-A $20k loss, AGI $160k → allowance fully phased out, all suspended', () => {
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -20000, priorYearUnallowedLoss: 0 }],
      [],
      160000,
      'single',
    );
    expect(r.passiveLossesAllowed).toBe(0);
    expect(r.totalSuspendedRental).toBe(20000);
    expect(r.specialAllowanceApplied).toBe(0);
  });

  it('pool-B $5k passive loss with zero passive income → fully suspended', () => {
    const r = applyPassiveLossLimits(
      [],
      [{ kind: 'k1', id: 'x', net: -5000, priorYearUnallowedLoss: 0 }],
      100000,
      'single',
    );
    expect(r.passiveLossesAllowed).toBe(0);
    expect(r.totalSuspendedK1).toBe(5000);
  });

  it('prior-year unallowed loss honored whether stored positive or negative', () => {
    // Both conventions should subtract a $2,000 loss magnitude from current-year net.
    // Current year net $0 + $2,000 prior-year unallowed loss → effective -$2,000.
    // AGI $80,000 (full special allowance available) → fully allowed.
    const positiveConvention = applyPassiveLossLimits(
      [{ id: 'a', net: 0, priorYearUnallowedLoss: 2000 }],
      [],
      80000,
      'single',
    );
    const negativeConvention = applyPassiveLossLimits(
      [{ id: 'a', net: 0, priorYearUnallowedLoss: -2000 }],
      [],
      80000,
      'single',
    );
    expect(positiveConvention.passiveLossesAllowed).toBe(2000);
    expect(negativeConvention.passiveLossesAllowed).toBe(2000);
    expect(negativeConvention.passiveLossesAllowed).toBe(
      positiveConvention.passiveLossesAllowed,
    );
  });
});
