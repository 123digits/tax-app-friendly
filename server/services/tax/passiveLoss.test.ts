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

  it('MFS filer living with spouse → no special allowance', () => {
    // §469(i)(5)(B): MFS taxpayers who lived with their spouse at any time
    // during the year get $0 special allowance.
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -15000, priorYearUnallowedLoss: 0 }],
      [],
      0,
      'mfs',
      false,
    );
    expect(r.specialAllowanceApplied).toBe(0);
    expect(r.passiveLossesAllowed).toBe(0);
    expect(r.totalSuspendedRental).toBe(15000);
  });

  it('MFS filer living apart → half caps ($12,500 max, $50-75k phase-out)', () => {
    // §469(i)(5)(A): MFS-lived-apart gets $12,500 max allowance, phased out
    // $0.50-per-$1 from $50k to $75k MAGI. AGI $60k → reduction 0.5×10000=5000
    // → allowance min(12500, 12500-5000) = $7,500.
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -15000, priorYearUnallowedLoss: 0 }],
      [],
      60000,
      'mfs',
      true,
    );
    expect(r.specialAllowanceApplied).toBe(7500);
    expect(r.passiveLossesAllowed).toBe(7500);
    expect(r.totalSuspendedRental).toBe(7500);
  });

  it('MFS filer living apart at high AGI → allowance fully phased out', () => {
    // MFS-lived-apart AGI $80k (above $75k end) → $0 special allowance.
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -10000, priorYearUnallowedLoss: 0 }],
      [],
      80000,
      'mfs',
      true,
    );
    expect(r.specialAllowanceApplied).toBe(0);
    expect(r.totalSuspendedRental).toBe(10000);
  });

  it('MFS filer living apart at low AGI → full $12,500 allowance available', () => {
    // MFS-lived-apart AGI $40k (below $50k start) → full $12,500 allowance.
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -15000, priorYearUnallowedLoss: 0 }],
      [],
      40000,
      'mfs',
      true,
    );
    expect(r.specialAllowanceApplied).toBe(12500);
    expect(r.passiveLossesAllowed).toBe(12500);
    expect(r.totalSuspendedRental).toBe(2500);
  });

  it('uses statutory defaults when constants arg is omitted', () => {
    // Exercises `constants?.X ?? default` paths in specialAllowanceCap.
    // Single filer, AGI $80k → full default $25,000 allowance.
    const r = applyPassiveLossLimits(
      [{ id: 'a', net: -30000, priorYearUnallowedLoss: 0 }],
      [],
      80000,
      'single',
      false,
      undefined,
    );
    expect(r.specialAllowanceApplied).toBe(25000);
    expect(r.passiveLossesAllowed).toBe(25000);
    expect(r.totalSuspendedRental).toBe(5000);
  });

  it('pool-B k1 entry without explicit kind defaults to rental classification', () => {
    // OtherPassiveEntry shape without a `kind` field — exercises the
    // `kind ?? 'rental'` fallback in the suspended-loss reporting.
    const r = applyPassiveLossLimits(
      [],
      [{ id: 'x', net: -5000, priorYearUnallowedLoss: 0 } as unknown as { id: string; net: number; priorYearUnallowedLoss: number; kind: 'rental' | 'k1' }],
      100000,
      'single',
    );
    expect(r.totalSuspendedRental).toBe(5000);
  });
});
