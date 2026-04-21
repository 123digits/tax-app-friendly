import { describe, it, expect } from 'vitest';
import { computeScheduleH } from './scheduleH.js';
import type { ScheduleH } from '../../../shared/types.js';

function base(overrides: Partial<ScheduleH> = {}): ScheduleH {
  return {
    cashWagesSsMedicare: 0,
    cashWagesFuta: 0,
    anyQuarterOver1000: false,
    federalIncomeTaxWithheld: 0,
    stateUnemploymentPaid: 0,
    ...overrides,
  };
}

describe('computeScheduleH', () => {
  it('returns zeros when no input', () => {
    const r = computeScheduleH(undefined);
    expect(r.totalHouseholdEmploymentTax).toBe(0);
  });

  it('SS+Medicare 15.3% of $20k wages → $3,060', () => {
    const r = computeScheduleH(base({ cashWagesSsMedicare: 20000 }));
    expect(r.ssMedicareTax).toBeCloseTo(3060, 2);
    expect(r.totalHouseholdEmploymentTax).toBeCloseTo(3060, 2);
  });

  it('FUTA only triggers if any quarter over $1,000', () => {
    const noTrigger = computeScheduleH(
      base({ cashWagesFuta: 7000, anyQuarterOver1000: false }),
    );
    expect(noTrigger.futaTax).toBe(0);
    const triggered = computeScheduleH(
      base({ cashWagesFuta: 7000, anyQuarterOver1000: true }),
    );
    // 0.6% × $7,000 = $42.
    expect(triggered.futaTax).toBeCloseTo(42, 2);
  });

  it('federal income tax withheld passes through', () => {
    const r = computeScheduleH(base({ federalIncomeTaxWithheld: 500 }));
    expect(r.federalIncomeTaxWithheld).toBe(500);
    expect(r.totalHouseholdEmploymentTax).toBe(500);
  });

  it('combined: $20k SS wages + $7k FUTA + $500 FIT', () => {
    const r = computeScheduleH(
      base({
        cashWagesSsMedicare: 20000,
        cashWagesFuta: 7000,
        anyQuarterOver1000: true,
        federalIncomeTaxWithheld: 500,
      }),
    );
    // 3060 + 42 + 500 = 3602.
    expect(r.totalHouseholdEmploymentTax).toBeCloseTo(3602, 2);
  });
});
