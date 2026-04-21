import { describe, it, expect, beforeAll } from 'vitest';
import { computeEitc } from './eitc.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type {
  Dependent,
  EitcEligibility,
  EitcRow,
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

// Small synthetic table for testing. Shape mirrors TaxYearConfig.eitc.
function makeTable(): Record<FilingStatus, Record<string, EitcRow>> {
  // Hand-picked round numbers for deterministic tests.
  //   single/0 kids: max $600, phase-in 7.65%, phase-out 7.65%, phase-out start $10,000, max AGI $18k
  //   single/2 kids: max $6,600, phase-in 40%, phase-out 21.06%, phase-out start $22,000, max AGI $55k
  //   single/3 kids: max $7,500, phase-in 45%, phase-out 21.06%, phase-out start $22,000, max AGI $60k
  const single: Record<string, EitcRow> = {
    '0': { maxCredit: 600, phaseInRate: 0.0765, phaseOutRate: 0.0765, phaseOutStart: 10000, maxAgi: 18000 },
    '1': { maxCredit: 4000, phaseInRate: 0.34, phaseOutRate: 0.1598, phaseOutStart: 22000, maxAgi: 49000 },
    '2': { maxCredit: 6600, phaseInRate: 0.4, phaseOutRate: 0.2106, phaseOutStart: 22000, maxAgi: 55000 },
    '3': { maxCredit: 7500, phaseInRate: 0.45, phaseOutRate: 0.2106, phaseOutStart: 22000, maxAgi: 60000 },
  };
  return {
    single,
    mfj: single,
    mfs: single,
    hoh: single,
    qw: single,
  };
}

const EMPTY_DEPS: Dependent[] = [];
function qcDep(name: string): Dependent {
  return {
    id: 'd-' + name,
    name,
    ssnLast4: null,
    relationship: 'child',
    dob: null,
    isQualifyingChild: true,
  };
}

function base(overrides: Partial<EitcEligibility> = {}): EitcEligibility {
  return {
    qualifyingChildrenOverride: null,
    investmentIncomeOverride: null,
    isEligibleAge: true,
    includeCombatPay: false,
    combatPayAmount: 0,
    ...overrides,
  };
}

describe('computeEitc', () => {
  it('returns zero for MFS filers', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'mfs', 20000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.credit).toBe(0);
  });

  it('returns zero with no EITC table', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'single', 20000, 20000, 0, 0, 0, 0, 0, 0, undefined);
    expect(r.credit).toBe(0);
  });

  it('0 qualifying kids + not eligible age → $0', () => {
    const r = computeEitc(
      base({ isEligibleAge: false }),
      EMPTY_DEPS,
      'single',
      5000,
      5000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    expect(r.credit).toBe(0);
  });

  it('0 kids, eligible age, $5k earned → phase-in portion (under maxCredit)', () => {
    const r = computeEitc(
      base(),
      EMPTY_DEPS,
      'single',
      5000,
      5000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    // $5,000 × 7.65% = $382.50 (round() in this module rounds to 2 decimals).
    expect(r.credit).toBeCloseTo(382.5, 2);
  });

  it('2 kids, earned income in plateau → maxCredit', () => {
    const dependents = [qcDep('a'), qcDep('b')];
    const r = computeEitc(
      base(),
      dependents,
      'single',
      20000,
      20000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    // Phase-in: min($6,600, $20,000 × 0.4 = $8,000) = $6,600.
    // Phase-out: measure = max($20k, $20k) = $20k < $22k start → $0 reduction.
    expect(r.credit).toBe(6600);
  });

  it('2 kids, AGI in phase-out range reduces credit', () => {
    const dependents = [qcDep('a'), qcDep('b')];
    // earned $30k, AGI $30k → measure = $30k; reduction = ($30k - $22k) × 0.2106 = $1,684.80
    // credit = $6,600 - $1,684.80 = $4,915.20 → ~4915
    const r = computeEitc(
      base(),
      dependents,
      'single',
      30000,
      30000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    expect(r.credit).toBeCloseTo(4915, 0);
  });

  it('2 kids, AGI above maxAgi → $0', () => {
    const dependents = [qcDep('a'), qcDep('b')];
    const r = computeEitc(
      base(),
      dependents,
      'single',
      60000,
      60000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    expect(r.credit).toBe(0);
  });

  it('investment income above limit disqualifies', () => {
    const dependents = [qcDep('a')];
    const r = computeEitc(
      base(),
      dependents,
      'single',
      20000,
      20000,
      0,
      DEFAULT_2025.eitcInvestmentIncomeLimit! + 1,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    expect(r.credit).toBe(0);
    expect(r.disqualifiedByInvestment).toBe(true);
  });

  it('combat pay election raises earned income', () => {
    // childless, $3k wages, $5k combat pay → earned = $8k
    const r = computeEitc(
      base({ includeCombatPay: true, combatPayAmount: 5000 }),
      EMPTY_DEPS,
      'single',
      3000,
      3000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    // phase-in: min($600, $8k × 7.65% = $612) = $600. Measure = max($8k, $3k) = $8k < $10k.
    expect(r.credit).toBe(600);
  });

  it('qualifyingChildrenOverride takes precedence over dependents list', () => {
    // Provide no dependents but override to 3 → uses 3-kid row.
    const r = computeEitc(
      base({ qualifyingChildrenOverride: 3 }),
      EMPTY_DEPS,
      'single',
      20000,
      20000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    // Phase-in: min($7,500, $20k × 0.45 = $9,000) = $7,500. Measure $20k < $22k start → full $7,500.
    expect(r.credit).toBe(7500);
    expect(r.qualifyingChildren).toBe(3);
  });

  it('caps qualifying children at 3', () => {
    const deps = [qcDep('a'), qcDep('b'), qcDep('c'), qcDep('d')];
    const r = computeEitc(
      base(),
      deps,
      'single',
      20000,
      20000,
      0,
      0,
      0,
      0,
      0,
      0,
      makeTable(),
    );
    expect(r.qualifyingChildren).toBe(3);
  });
});
