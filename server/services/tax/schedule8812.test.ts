import { describe, it, expect, beforeAll } from 'vitest';
import {
  computeSchedule8812,
  type Schedule8812ConstantsSubset,
} from './schedule8812.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type {
  Schedule8812Input,
  Dependent,
  FilingStatus,
  TaxYearConstants,
} from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

const CONSTANTS: Schedule8812ConstantsSubset = {
  ctcPerChild: 2000,
  ctcPhaseoutStart: {
    single: 200000,
    mfj: 400000,
    mfs: 200000,
    hoh: 200000,
    qw: 400000,
  },
};

let depCounter = 0;
function dep(isQc: boolean, id = `dep-${++depCounter}`): Dependent {
  return {
    id,
    name: `Dep ${id}`,
    ssnLast4: null,
    relationship: null,
    dob: null,
    isQualifyingChild: isQc,
  };
}

function input(p: Partial<Schedule8812Input> = {}): Schedule8812Input {
  return {
    qualifyingChildrenOverride: null,
    earnedIncomeOverride: null,
    includeCombatPay: false,
    combatPayAmount: 0,
    ...p,
  };
}

describe('computeSchedule8812', () => {
  it('no dependents → zero refundable and nonrefundable', () => {
    const r = computeSchedule8812(
      input(),
      [],
      'single' as FilingStatus,
      50000,
      5000,
      50000,
      0,
      CONSTANTS,
    );
    expect(r.qualifyingChildren).toBe(0);
    expect(r.ctcBeforeLimits).toBe(0);
    expect(r.nonrefundablePortion).toBe(0);
    expect(r.refundablePortion).toBe(0);
  });

  it('2 qualifying children, AGI $250k single → phase-out applies', () => {
    // Over threshold by $50k. $50k / $1,000 = 50 steps × $50 = $2,500.
    // CTC before = $4,000. After = $4,000 − $2,500 = $1,500.
    const r = computeSchedule8812(
      input(),
      [dep(true, 'a'), dep(true, 'b')],
      'single' as FilingStatus,
      250000,
      20000,
      200000,
      0,
      CONSTANTS,
    );
    expect(r.qualifyingChildren).toBe(2);
    expect(r.ctcBeforeLimits).toBe(4000);
    expect(r.phaseoutReduction).toBe(2500);
    expect(r.ctcAfterPhaseout).toBe(1500);
    // Tax liability $20k > $1,500, nonrefundable fully absorbs it.
    expect(r.nonrefundablePortion).toBe(1500);
    expect(r.refundablePortion).toBe(0);
  });

  it('2 kids, $2k tax, $30k earned → nonref=$2k, ACTC fills up to per-child cap', () => {
    // No phase-out (AGI under threshold). CTC = $4,000. Nonref = $2,000.
    // Unused = $2,000.
    // Phase-in = 15% × ($30,000 − $2,500) = 15% × $27,500 = $4,125.
    // Per-child cap = 2 × $1,700 = $3,400.
    // Refundable = min($2,000, $4,125, $3,400) = $2,000.
    const r = computeSchedule8812(
      input(),
      [dep(true, 'a'), dep(true, 'b')],
      'mfj' as FilingStatus,
      50000,
      2000,
      30000,
      0,
      CONSTANTS,
    );
    expect(r.ctcAfterPhaseout).toBe(4000);
    expect(r.nonrefundablePortion).toBe(2000);
    expect(r.refundablePortion).toBe(2000);
  });

  it('2 kids, $0 tax, $40k earned → refundable = min($4k unused, 15%×$37.5k, 2×$1,700)', () => {
    // Unused = $4,000. Phase-in = 0.15 × $37,500 = $5,625. Per-child = $3,400.
    // Refundable = $3,400 (per-child cap is the binding constraint).
    const r = computeSchedule8812(
      input(),
      [dep(true, 'a'), dep(true, 'b')],
      'single' as FilingStatus,
      40000,
      0,
      40000,
      0,
      CONSTANTS,
    );
    expect(r.nonrefundablePortion).toBe(0);
    expect(r.refundablePortion).toBe(2 * DEFAULT_2025.actc!.refundablePerChild);
    expect(r.refundablePortion).toBe(3400);
  });

  it('3 kids, low earned ($5k) → refundable = 15% × $2,500 = $375', () => {
    // CTC = $6,000. No tax room → unused $6,000.
    // Phase-in = 0.15 × ($5,000 − $2,500) = $375.
    // Per-child cap = 3 × $1,700 = $5,100.
    // Refundable = min($6,000, $375, $5,100) = $375.
    const r = computeSchedule8812(
      input(),
      [dep(true, 'a'), dep(true, 'b'), dep(true, 'c')],
      'single' as FilingStatus,
      5000,
      0,
      5000,
      0,
      CONSTANTS,
    );
    expect(r.qualifyingChildren).toBe(3);
    expect(r.refundablePortion).toBe(375);
  });

  it('includeCombatPay election raises earnedIncome used for phase-in', () => {
    // W-2 $3,000, combat pay $5,000 → earned = $8,000.
    // Phase-in = 0.15 × ($8,000 − $2,500) = $825.
    // 2 kids, CTC $4,000, no tax room. Per-child cap = $3,400.
    // Refundable = min($4,000, $825, $3,400) = $825.
    const r = computeSchedule8812(
      input({ includeCombatPay: true, combatPayAmount: 5000 }),
      [dep(true, 'a'), dep(true, 'b')],
      'single' as FilingStatus,
      3000,
      0,
      3000,
      0,
      CONSTANTS,
    );
    expect(r.earnedIncomeForPhaseIn).toBe(8000);
    expect(r.refundablePortion).toBe(825);
  });

  it('qualifyingChildrenOverride takes precedence over dependents list', () => {
    // Dependents list has 0 QCs, but override says 2.
    const r = computeSchedule8812(
      input({ qualifyingChildrenOverride: 2 }),
      [dep(false, 'x'), dep(false, 'y')],
      'single' as FilingStatus,
      50000,
      10000,
      50000,
      0,
      CONSTANTS,
    );
    expect(r.qualifyingChildren).toBe(2);
    expect(r.ctcBeforeLimits).toBe(4000);
    expect(r.nonrefundablePortion).toBe(4000);
  });

  it('ODC: 2 other dependents (no QCs) → nonrefundable $1,000, no refundable', () => {
    // 2 non-QC dependents → ODC = 2 × $500 = $1,000. No CTC, no ACTC possible.
    const r = computeSchedule8812(
      input(),
      [dep(false, 'a'), dep(false, 'b')],
      'single' as FilingStatus,
      50000,
      5000,
      30000,
      0,
      CONSTANTS,
      DEFAULT_2025.actc,
    );
    expect(r.qualifyingChildren).toBe(0);
    expect(r.otherDependents).toBe(2);
    expect(r.odcBeforeLimits).toBe(1000);
    expect(r.ctcBeforeLimits).toBe(0);
    expect(r.combinedBeforeLimits).toBe(1000);
    expect(r.nonrefundablePortion).toBe(1000);
    expect(r.refundablePortion).toBe(0);
  });

  it('ODC: 1 QC + 1 other dependent → combined $2,500 nonref, ACTC capped by per-child', () => {
    // 1 QC ($2,000 CTC) + 1 OD ($500 ODC) = $2,500 combined. No phaseout.
    // Tax $0 → nonref=0. Unused combined = $2,500.
    // Phase-in = 0.15 × ($30,000 − $2,500) = $4,125.
    // Per-child cap = 1 × $1,700 = $1,700 (OD doesn't increase this).
    // Refundable = min($2,500, $4,125, $1,700) = $1,700.
    const r = computeSchedule8812(
      input(),
      [dep(true, 'qc'), dep(false, 'od')],
      'single' as FilingStatus,
      40000,
      0,
      30000,
      0,
      CONSTANTS,
      DEFAULT_2025.actc,
    );
    expect(r.qualifyingChildren).toBe(1);
    expect(r.otherDependents).toBe(1);
    expect(r.combinedBeforeLimits).toBe(2500);
    expect(r.nonrefundablePortion).toBe(0);
    expect(r.refundablePortion).toBe(1700);
  });

  it('ODC: phaseout allocates to ODC first, preserving CTC for ACTC', () => {
    // 1 QC + 1 OD = $2,500 combined. AGI $205k single → over threshold by $5k
    // → 5 steps × $50 = $250 phaseout. Allocated to ODC first: ODC goes from
    // $500 to $250; CTC still $2,000. Combined after phaseout = $2,250.
    // Tax $0 → nonref=0. Unused $2,250. Phase-in 0.15 × ($30k − $2,500)=$4,125.
    // Per-child cap = 1 × $1,700 = $1,700.
    // Refundable = min($2,250, $4,125, $1,700) = $1,700.
    const r = computeSchedule8812(
      input(),
      [dep(true, 'qc'), dep(false, 'od')],
      'single' as FilingStatus,
      205000,
      0,
      30000,
      0,
      CONSTANTS,
      DEFAULT_2025.actc,
    );
    expect(r.phaseoutReduction).toBe(250);
    expect(r.ctcAfterPhaseout).toBe(2000);
    expect(r.odcAfterPhaseout).toBe(250);
    expect(r.combinedAfterPhaseout).toBe(2250);
    expect(r.refundablePortion).toBe(1700);
  });

});
