import { describe, it, expect } from 'vitest';
import { computeForm8863, phaseoutFactor } from './form8863.js';
import type {
  Form8863Student,
  EducationConstants,
} from '../../../shared/types.js';

const EDU: EducationConstants = {
  aotcMax: 2500,
  aotcRefundablePct: 0.40,
  aotcPhaseout: {
    single: { start: 80000, end: 90000 },
    mfj: { start: 160000, end: 180000 },
    mfs: { start: 0, end: 0 },
    hoh: { start: 80000, end: 90000 },
    qw: { start: 160000, end: 180000 },
  },
  llcRate: 0.20,
  llcMaxExpenses: 10000,
  llcPhaseout: {
    single: { start: 80000, end: 90000 },
    mfj: { start: 160000, end: 180000 },
    mfs: { start: 0, end: 0 },
    hoh: { start: 80000, end: 90000 },
    qw: { start: 160000, end: 180000 },
  },
  studentLoanInterestLimit: 2500,
  studentLoanInterestPhaseout: {
    single: { start: 85000, end: 100000 },
    mfj: { start: 170000, end: 200000 },
    mfs: { start: 0, end: 0 },
    hoh: { start: 85000, end: 100000 },
    qw: { start: 170000, end: 200000 },
  },
  educatorExpenseLimit: 300,
};

function student(p: Partial<Form8863Student>): Form8863Student {
  return {
    id: p.id ?? 'x',
    studentName: 'Student',
    studentSsnLast4: null,
    creditType: 'aotc',
    qualifiedExpenses: 0,
    isEligibleForAotc: true,
    priorAotcYears: 0,
    ...p,
  };
}

describe('phaseoutFactor', () => {
  it('AGI at or below start → 1', () => {
    expect(phaseoutFactor(50000, { start: 80000, end: 90000 })).toBe(1);
    expect(phaseoutFactor(80000, { start: 80000, end: 90000 })).toBe(1);
  });

  it('AGI at or above end → 0', () => {
    expect(phaseoutFactor(90000, { start: 80000, end: 90000 })).toBe(0);
    expect(phaseoutFactor(95000, { start: 80000, end: 90000 })).toBe(0);
  });

  it('AGI in phase-out → linear interpolation', () => {
    expect(phaseoutFactor(85000, { start: 80000, end: 90000 })).toBe(0.5);
  });

  it('MFS-style ineligible (0/0) → 0', () => {
    expect(phaseoutFactor(10000, { start: 0, end: 0 })).toBe(0);
  });

  it('undefined range → 1 (no phase-out)', () => {
    expect(phaseoutFactor(100000, undefined)).toBe(1);
  });

  it('degenerate range where end ≤ start → cliff at end', () => {
    // start=end but non-zero → agi < end is 1, else 0.
    expect(phaseoutFactor(79999, { start: 80000, end: 80000 })).toBe(1);
    expect(phaseoutFactor(80000, { start: 80000, end: 80000 })).toBe(0);
    // end < start (inverted / corrupted config) → also cliff at end.
    expect(phaseoutFactor(7000, { start: 20000, end: 10000 })).toBe(1);
    expect(phaseoutFactor(15000, { start: 20000, end: 10000 })).toBe(0);
  });
});

describe('computeForm8863', () => {
  it('no constants → zeros', () => {
    const r = computeForm8863([student({})], 50000, 'single', undefined);
    expect(r.totalCredit).toBe(0);
    expect(r.aotcAllowed).toBe(0);
    expect(r.llcAllowed).toBe(0);
  });

  it('no students → zeros', () => {
    const r = computeForm8863([], 50000, 'single', EDU);
    expect(r.totalCredit).toBe(0);
    expect(r.refundablePortion).toBe(0);
    expect(r.nonrefundablePortion).toBe(0);
  });

  it('undefined students → zeros', () => {
    const r = computeForm8863(undefined, 50000, 'single', EDU);
    expect(r.totalCredit).toBe(0);
  });

  it('1 AOTC student, $4,000 expenses, eligible, below phase-out → $2,500', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 })],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcTentative).toBe(2500);    // 2000 + 0.25*2000
    expect(r.aotcAllowed).toBe(2500);
    expect(r.refundablePortion).toBe(1000); // 40%
    expect(r.nonrefundablePortion).toBe(1500); // 60%
    expect(r.totalCredit).toBe(2500);
  });

  it('AOTC student with priorAotcYears = 4 → tentative 0', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 4 })],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcTentative).toBe(0);
    expect(r.aotcAllowed).toBe(0);
    expect(r.totalCredit).toBe(0);
  });

  it('AOTC student not eligible flag → tentative 0', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: false, priorAotcYears: 0 })],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcTentative).toBe(0);
  });

  it('AOTC caps at $2,500 even with very high expenses', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 50000, isEligibleForAotc: true, priorAotcYears: 0 })],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcTentative).toBe(2500);
    expect(r.aotcAllowed).toBe(2500);
  });

  it('2 LLC students, $6k each → sum $12k capped at $10k × 20% = $2,000', () => {
    const r = computeForm8863(
      [
        student({ id: 'a', creditType: 'llc', qualifiedExpenses: 6000 }),
        student({ id: 'b', creditType: 'llc', qualifiedExpenses: 6000 }),
      ],
      50000,
      'single',
      EDU,
    );
    expect(r.llcTentative).toBe(2000);
    expect(r.llcAllowed).toBe(2000);
    expect(r.refundablePortion).toBe(0);       // LLC has no refundable portion
    expect(r.nonrefundablePortion).toBe(2000);
    expect(r.totalCredit).toBe(2000);
  });

  it('Single filer AGI $85k, phase-out range 80-90k → AOTC halved', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 })],
      85000,
      'single',
      EDU,
    );
    expect(r.aotcPhaseoutFactor).toBe(0.5);
    expect(r.aotcTentative).toBe(2500);
    expect(r.aotcAllowed).toBe(1250);          // 2500 * 0.5
    expect(r.refundablePortion).toBe(500);
    expect(r.nonrefundablePortion).toBe(750);
  });

  it('AGI above phase-out end → aotcAllowed = 0', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 })],
      95000,
      'single',
      EDU,
    );
    expect(r.aotcAllowed).toBe(0);
    expect(r.llcAllowed).toBe(0);
    expect(r.totalCredit).toBe(0);
  });

  it('mixed AOTC + LLC students: both credits computed independently', () => {
    const r = computeForm8863(
      [
        student({ id: 'a', creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 }),
        student({ id: 'b', creditType: 'llc', qualifiedExpenses: 5000 }),
      ],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcAllowed).toBe(2500);
    expect(r.llcAllowed).toBe(1000);           // 5000 * 0.20
    expect(r.totalCredit).toBe(3500);
    expect(r.refundablePortion).toBe(1000);    // 40% of 2500 AOTC
    expect(r.nonrefundablePortion).toBe(2500); // 1500 + 1000 LLC
  });

  it('MFS filing status → phase-out factor 0 (ineligible)', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 })],
      10000,
      'mfs',
      EDU,
    );
    expect(r.aotcPhaseoutFactor).toBe(0);
    expect(r.aotcAllowed).toBe(0);
    expect(r.totalCredit).toBe(0);
  });

  it('AOTC student with only $1,500 expenses → 100% tier only', () => {
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 1500, isEligibleForAotc: true, priorAotcYears: 0 })],
      50000,
      'single',
      EDU,
    );
    expect(r.aotcTentative).toBe(1500);        // 100% of first tier only
    expect(r.aotcAllowed).toBe(1500);
    expect(r.refundablePortion).toBe(600);
    expect(r.nonrefundablePortion).toBe(900);
  });

  it('falls back to statutory defaults when constants fields are absent', () => {
    // Partial constants object — missing aotcMax / llcRate / llcMaxExpenses /
    // aotcRefundablePct → defaults fire ($2500 / 20% / $10k / 40%).
    const minimalEdu = {
      aotcPhaseout: EDU.aotcPhaseout,
      llcPhaseout: EDU.llcPhaseout,
      studentLoanInterestLimit: 2500,
      studentLoanInterestPhaseout: EDU.studentLoanInterestPhaseout,
      educatorExpenseLimit: 300,
      aotcFirstTierExpense: 2000,
      aotcFirstTierRate: 1,
      aotcSecondTierRate: 0.25,
    } as unknown as EducationConstants;
    const r = computeForm8863(
      [student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 })],
      50000,
      'single',
      minimalEdu,
    );
    // 2000 @ 100% + 2000 @ 25% = $2,500 (default aotcMax).
    expect(r.aotcTentative).toBe(2500);
    expect(r.aotcAllowed).toBe(2500);
    expect(r.refundablePortion).toBe(1000); // default 40%
  });

  it('AOTC student without priorAotcYears field falls through ?? 0 default', () => {
    // priorAotcYears absent → treated as 0 → eligible.
    const s = student({ creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true });
    delete (s as { priorAotcYears?: number }).priorAotcYears;
    const r = computeForm8863([s], 50000, 'single', EDU);
    expect(r.aotcTentative).toBe(2500);
  });
});
