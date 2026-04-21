import { describe, it, expect } from 'vitest';
import {
  cappedEducatorExpenses,
  phasedStudentLoanInterest,
  cappedIraDeduction,
  computeSchedule1Adjustments,
  totalSchedule1Adjustments,
  computeStudentLoanInterestMagi,
} from './adjustments.js';
import type {
  Schedule1Adjustments,
  EducationConstants,
  RetirementConstants,
} from '../../../shared/types.js';

const edu: EducationConstants = {
  aotcMax: 2500,
  aotcRefundablePct: 0.4,
  aotcPhaseout: {
    single: { start: 80000, end: 90000 },
    mfj: { start: 160000, end: 180000 },
    mfs: { start: 0, end: 0 },
    hoh: { start: 80000, end: 90000 },
    qw: { start: 160000, end: 180000 },
  },
  llcRate: 0.2,
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
    single: { start: 80000, end: 95000 },
    mfj: { start: 165000, end: 195000 },
    mfs: { start: 0, end: 0 },
    hoh: { start: 80000, end: 95000 },
    qw: { start: 165000, end: 195000 },
  },
  educatorExpenseLimit: 300,
};

const ret: RetirementConstants = {
  iraLimit: 7000,
  iraCatchUp: 1000,
  sepPercent: 0.25,
  solo401kLimit: 23000,
  catchUpAge: 50,
};

function adj(p: Partial<Schedule1Adjustments>): Schedule1Adjustments {
  return {
    educatorExpenses: 0,
    hsaDeduction: 0,
    selfEmployedHealthInsurance: 0,
    sepContribution: 0,
    simpleContribution: 0,
    solo401kContribution: 0,
    traditionalIraDeduction: 0,
    studentLoanInterest: 0,
    penaltyEarlyWithdrawal: 0,
    alimonyPaid: 0,
    alimonyRecipientSsn: null,
    alimonyDivorceDate: null,
    reservistExpenses: 0,
    performingArtistExpenses: 0,
    feeBasisExpenses: 0,
    ...p,
  };
}

describe('cappedEducatorExpenses', () => {
  it('single: $500 claimed → capped at $300', () => {
    expect(cappedEducatorExpenses(500, 'single', edu)).toBe(300);
  });

  it('mfj: $500 claimed → allowed (2× cap = $600)', () => {
    expect(cappedEducatorExpenses(500, 'mfj', edu)).toBe(500);
  });
});

describe('phasedStudentLoanInterest', () => {
  it('AGI below phase-out: full $2,500 allowed', () => {
    expect(phasedStudentLoanInterest(2500, 70000, 'single', edu)).toBe(2500);
  });

  it('AGI above phase-out end: $0 allowed', () => {
    expect(phasedStudentLoanInterest(2500, 100000, 'single', edu)).toBe(0);
  });

  it('AGI midway through phase-out: proportionally reduced', () => {
    // Midpoint of $80k–$95k is $87,500 → 50% remaining.
    expect(phasedStudentLoanInterest(2500, 87500, 'single', edu)).toBeCloseTo(1250, 0);
  });

  // IRC §221(b)(2)(C): MAGI for the SLI phase-out = AGI + FEIE.
  it('baseline (feie = 0) matches legacy AGI-only behavior', () => {
    // $70k AGI, no FEIE → full $2,500 allowed (AGI below phase-out start).
    expect(phasedStudentLoanInterest(2500, 70000, 'single', edu, 0)).toBe(2500);
    // Default feie=0 when omitted.
    expect(phasedStudentLoanInterest(2500, 70000, 'single', edu)).toBe(2500);
  });

  it('FEIE pushes MAGI into phase-out, reducing SLI', () => {
    // AGI alone $70k (fully allowed $2,500), but MAGI = $70k + $20k FEIE =
    // $90k → 1/3 of the $80–95k band remains → $2,500 × 1/3 ≈ $833.
    const allowed = phasedStudentLoanInterest(2500, 70000, 'single', edu, 20000);
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThan(2500);
    expect(allowed).toBeCloseTo(2500 * (95000 - 90000) / (95000 - 80000), 0);
  });

  it('FEIE large enough that MAGI exceeds phase-out end zeroes SLI', () => {
    // AGI $70k + FEIE $30k = MAGI $100k ≥ $95k end → $0.
    expect(phasedStudentLoanInterest(2500, 70000, 'single', edu, 30000)).toBe(0);
  });
});

describe('computeStudentLoanInterestMagi (§221(b)(2)(C))', () => {
  it('with no FEIE returns AGI unchanged', () => {
    expect(computeStudentLoanInterestMagi(50_000)).toBe(50_000);
    expect(computeStudentLoanInterestMagi(50_000, 0)).toBe(50_000);
  });

  it('adds FEIE (and housing excl) back on top of AGI', () => {
    expect(computeStudentLoanInterestMagi(50_000, 25_000)).toBe(75_000);
  });

  it('treats negative or missing FEIE as zero', () => {
    expect(computeStudentLoanInterestMagi(50_000, -1_000)).toBe(50_000);
  });
});

describe('cappedIraDeduction', () => {
  it('under age 50: capped at $7,000', () => {
    expect(cappedIraDeduction(10000, 40, ret)).toBe(7000);
  });

  it('age 50+: capped at $8,000 (with catch-up)', () => {
    expect(cappedIraDeduction(10000, 55, ret)).toBe(8000);
  });
});

describe('computeSchedule1Adjustments + total', () => {
  it('sums applied lines correctly', () => {
    const lines = computeSchedule1Adjustments(
      adj({
        educatorExpenses: 200,
        traditionalIraDeduction: 3000,
        studentLoanInterest: 1000,
        alimonyPaid: 5000,
      }),
      50000,
      'single',
      35,
      ret,
      edu,
    );
    expect(lines.educatorExpenses).toBe(200);
    expect(lines.traditionalIraDeduction).toBe(3000);
    expect(lines.studentLoanInterest).toBe(1000);
    expect(totalSchedule1Adjustments(lines)).toBe(9200);
  });
});
