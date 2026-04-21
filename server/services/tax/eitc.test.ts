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

  // --- Mutation-test gap killers (added after Stryker analysis) ---

  it('auto-computes investment income from portfolio components (kills max/min mutant)', () => {
    const r = computeEitc(
      base(),
      EMPTY_DEPS,
      'single',
      5000,
      5000,
      0,
      100, // interest
      200, // ord div
      50,  // cap gain
      25,  // royalties
      75,  // rental
      makeTable(),
    );
    // Sum of positive investment components = 450, below the limit.
    expect(r.investmentIncome).toBe(450);
    expect(r.disqualifiedByInvestment).toBe(false);
  });

  it('clamps negative investment component to zero', () => {
    // If any investment source arrives negative (e.g. net capital loss), it
    // is clamped to 0 for the investment test — not subtracted from others.
    const r = computeEitc(
      base(),
      EMPTY_DEPS,
      'single',
      5000,
      5000,
      0,
      100, // interest
      100, // ord div
      -500, // negative cap gain → clamped to 0
      0,
      0,
      makeTable(),
    );
    expect(r.investmentIncome).toBe(200);
  });

  it('successful credit returns disqualifiedByInvestment: false explicitly', () => {
    // Stryker mutates `disqualifiedByInvestment: false` → `true` on the
    // happy-path branch. A strong assertion kills that mutant.
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 20000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.disqualifiedByInvestment).toBe(false);
    expect(r.credit).toBe(6600);
  });

  it('single filer at identical inputs to MFS yields a non-zero credit', () => {
    // Contrast test — same inputs under `single` give a credit; under `mfs`
    // the result is all zeros. Kills the `filingStatus === 'mfs'` mutants.
    const single = computeEitc(base(), EMPTY_DEPS, 'single', 5000, 5000, 0, 0, 0, 0, 0, 0, makeTable());
    const mfs = computeEitc(base(), EMPTY_DEPS, 'mfs', 5000, 5000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(single.credit).toBeGreaterThan(0);
    expect(mfs.credit).toBe(0);
    expect(mfs.qualifyingChildren).toBe(0);
    expect(mfs.earnedIncome).toBe(0);
  });

  it('hoh filer is eligible (kills the "filingStatus = empty string" mutant)', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'hoh', 5000, 5000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.credit).toBeGreaterThan(0);
  });

  it('undefined dependents array (not just empty) → 0 kids auto-counted', () => {
    const r = computeEitc(
      base(),
      undefined,
      'single',
      5000,
      5000,
      0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    expect(r.qualifyingChildren).toBe(0);
    // Earned-income phase-in: 5000 × 0.0765 = 382.50 (childless row).
    expect(r.credit).toBeCloseTo(382.5, 2);
  });

  it('ignores non-qualifying dependents (filter kills the `length`-only mutant)', () => {
    const deps: Dependent[] = [
      qcDep('a'),
      qcDep('b'),
      // Two non-qualifying parents → .length would say 4 kids, filter says 2.
      { id: 'p1', name: 'P1', ssnLast4: null, relationship: 'parent', dob: null, isQualifyingChild: false },
      { id: 'p2', name: 'P2', ssnLast4: null, relationship: 'parent', dob: null, isQualifyingChild: false },
    ];
    const r = computeEitc(base(), deps, 'single', 20000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    // 2-kid row: max credit 6600, AGI 20000 < phaseOutStart 22000 → full 6600.
    expect(r.qualifyingChildren).toBe(2);
    expect(r.credit).toBe(6600);
  });

  it('AGI exactly at phaseOutStart triggers no reduction', () => {
    const deps = [qcDep('a'), qcDep('b')];
    // phaseOutStart = 22000 for 2 kids. AGI = 22000 → measure == start → 0 reduction.
    const r = computeEitc(base(), deps, 'single', 22000, 22000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.phaseOutAmount).toBe(0);
    expect(r.credit).toBe(6600);
  });

  it('AGI one dollar past phaseOutStart triggers a phase-out', () => {
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 22001, 22001, 0, 0, 0, 0, 0, 0, makeTable());
    // Reduction = 1 × 0.2106 = 0.2106 → credit = 6599.79.
    expect(r.phaseOutAmount).toBeCloseTo(0.21, 2);
    expect(r.credit).toBeCloseTo(6599.79, 2);
  });

  it('measure uses the larger of AGI and earned income', () => {
    // Earned income = 60k but AGI = 5k → measure = 60k (earnedIncome wins)
    // → 2-kid row maxAgi = 55k → credit zeroed even though AGI is low.
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 5000, 60000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.credit).toBe(0);
  });

  it('measure: AGI higher than earned income wins when phasing out', () => {
    // Earned income = 20k (plateau), AGI = 50k → measure 50k → full reduction.
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 50000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    // Reduction = (50000-22000) × 0.2106 = 5896.80; raw phaseIn = min(6600, 20000×0.4=8000) = 6600
    // credit = max(0, 6600 - 5896.80) = 703.20.
    expect(r.credit).toBeCloseTo(703.2, 1);
  });

  // --- Deep field-level assertions (kill BooleanLiteral / string / number mutants) ---

  it('all fields of the zero return are exactly zero on mfs', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'mfs', 30000, 30000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r).toEqual({
      qualifyingChildren: 0,
      earnedIncome: 0,
      investmentIncome: 0,
      disqualifiedByInvestment: false,
      phaseInAmount: 0,
      phaseOutAmount: 0,
      credit: 0,
    });
  });

  it('disqualified-by-investment return has exact shape (kills BooleanLiteral)', () => {
    const deps = [qcDep('a')];
    const r = computeEitc(
      {
        qualifyingChildrenOverride: null, investmentIncomeOverride: 999999,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0,
      },
      deps,
      'single',
      20000,
      20000,
      0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    expect(r.disqualifiedByInvestment).toBe(true);
    expect(r.qualifyingChildren).toBe(1);
    expect(r.investmentIncome).toBe(999999);
    expect(r.credit).toBe(0);
    expect(r.phaseInAmount).toBe(0);
    expect(r.phaseOutAmount).toBe(0);
    expect(r.earnedIncome).toBe(0);
  });

  it('childless-but-ineligible-age return has exact shape (kills all-false-branch mutants)', () => {
    const r = computeEitc(
      {
        qualifyingChildrenOverride: null,
        investmentIncomeOverride: null,
        isEligibleAge: false,
        includeCombatPay: false,
        combatPayAmount: 0,
      },
      EMPTY_DEPS,
      'single',
      5000,
      5000,
      0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    expect(r.qualifyingChildren).toBe(0);
    expect(r.earnedIncome).toBe(5000);
    expect(r.credit).toBe(0);
    expect(r.disqualifiedByInvestment).toBe(false);
  });

  it('no eitcTable yields full zeros', () => {
    const r = computeEitc(base(), [qcDep('a')], 'single', 20000, 20000, 0, 0, 0, 0, 0, 0, undefined);
    expect(r).toEqual({
      qualifyingChildren: 0,
      earnedIncome: 0,
      investmentIncome: 0,
      disqualifiedByInvestment: false,
      phaseInAmount: 0,
      phaseOutAmount: 0,
      credit: 0,
    });
  });

  it('successful credit has all expected fields populated correctly', () => {
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 20000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r).toEqual({
      qualifyingChildren: 2,
      earnedIncome: 20000,
      investmentIncome: 0,
      disqualifiedByInvestment: false,
      phaseInAmount: 6600,  // capped at maxCredit
      phaseOutAmount: 0,    // AGI < phaseOutStart
      credit: 6600,
    });
  });

  it('combat-pay election adds to earned income only when includeCombatPay is true', () => {
    const withToggle = computeEitc(
      base({ includeCombatPay: true, combatPayAmount: 2000 }),
      EMPTY_DEPS,
      'single',
      3000, 3000, 0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    const withoutToggle = computeEitc(
      base({ includeCombatPay: false, combatPayAmount: 2000 }),  // amount ignored
      EMPTY_DEPS,
      'single',
      3000, 3000, 0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    expect(withToggle.earnedIncome).toBe(5000);
    expect(withoutToggle.earnedIncome).toBe(3000);
  });

  it('undefined input still yields a sensible childless zero-age-ineligible response', () => {
    const r = computeEitc(
      undefined,
      EMPTY_DEPS,
      'single',
      5000, 5000, 0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    // No `input` means isEligibleAge is undefined → treated as not eligible
    // (strict `!== true` check) → credit zero for childless.
    expect(r.credit).toBe(0);
    expect(r.qualifyingChildren).toBe(0);
    expect(r.earnedIncome).toBe(5000);
  });

  it('exact zero-value inputs do not trigger phase-out', () => {
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 0, 0, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.credit).toBe(0);
    expect(r.phaseInAmount).toBe(0);
    expect(r.phaseOutAmount).toBe(0);
  });

  it('fractional qualifyingChildrenOverride is floored', () => {
    const r = computeEitc(
      { qualifyingChildrenOverride: 2.9, investmentIncomeOverride: null,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
      EMPTY_DEPS,
      'single',
      20000, 20000, 0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    expect(r.qualifyingChildren).toBe(2);
  });

  it('negative qualifyingChildrenOverride clamps to 0', () => {
    const r = computeEitc(
      { qualifyingChildrenOverride: -5, investmentIncomeOverride: null,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
      [qcDep('a'), qcDep('b')],
      'single',
      20000, 20000, 0, 0, 0, 0, 0, 0,
      makeTable(),
    );
    // Override wins → 0 kids → childless row, but isEligibleAge=true so proceeds
    expect(r.qualifyingChildren).toBe(0);
  });

  it('measure above maxAgi returns zero credit even though phase-in was positive', () => {
    const deps = [qcDep('a'), qcDep('b')];
    // Earned income in plateau, AGI beyond maxAgi (55000).
    const r = computeEitc(base(), deps, 'single', 100000, 20000, 0, 0, 0, 0, 0, 0, makeTable());
    expect(r.credit).toBe(0);
    // But phaseInAmount is still reported (the raw pre-phaseout value).
    expect(r.phaseInAmount).toBe(6600);
  });

  it('auto-computes investment from interest only (kills arithmetic-operator on sum)', () => {
    const r = computeEitc(
      base(),
      EMPTY_DEPS,
      'single',
      5000, 5000,
      0,
      50, 0, 0, 0, 0,
      makeTable(),
    );
    expect(r.investmentIncome).toBe(50);
  });

  it('auto-computes investment from ordinary dividends only', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'single', 5000, 5000, 0, 0, 77, 0, 0, 0, makeTable());
    expect(r.investmentIncome).toBe(77);
  });

  it('auto-computes investment from royalties only', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'single', 5000, 5000, 0, 0, 0, 0, 33, 0, makeTable());
    expect(r.investmentIncome).toBe(33);
  });

  it('auto-computes investment from rental passive income only', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'single', 5000, 5000, 0, 0, 0, 0, 0, 88, makeTable());
    expect(r.investmentIncome).toBe(88);
  });

  it('auto-computes investment from net capital gain only', () => {
    const r = computeEitc(base(), EMPTY_DEPS, 'single', 5000, 5000, 0, 0, 0, 44, 0, 0, makeTable());
    expect(r.investmentIncome).toBe(44);
  });

  it('investment exactly at limit is not disqualifying (<=, not <)', () => {
    const r = computeEitc(
      base(),
      EMPTY_DEPS,
      'single',
      5000, 5000, 0, 0, 0, 0, 0, 0,
      makeTable(),
      11950, // default limit
    );
    const atLimit = computeEitc(
      { qualifyingChildrenOverride: null, investmentIncomeOverride: 11950,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
      EMPTY_DEPS,
      'single',
      5000, 5000, 0, 0, 0, 0, 0, 0,
      makeTable(),
      11950,
    );
    expect(r.disqualifiedByInvestment).toBe(false);
    expect(atLimit.disqualifiedByInvestment).toBe(false);
    // At one dollar above, disqualified.
    const overLimit = computeEitc(
      { qualifyingChildrenOverride: null, investmentIncomeOverride: 11951,
        isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
      EMPTY_DEPS,
      'single',
      5000, 5000, 0, 0, 0, 0, 0, 0,
      makeTable(),
      11950,
    );
    expect(overLimit.disqualifiedByInvestment).toBe(true);
  });

  it('phaseInAmount capped exactly at maxCredit (min branch)', () => {
    // Earned income × phaseInRate > maxCredit → cap kicks in.
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 20000, 30000, 0, 0, 0, 0, 0, 0, makeTable());
    // phaseIn raw = 30000 × 0.4 = 12000 > 6600 → capped at 6600.
    expect(r.phaseInAmount).toBe(6600);
  });

  it('phaseInAmount below maxCredit (min branch other side)', () => {
    const deps = [qcDep('a'), qcDep('b')];
    const r = computeEitc(base(), deps, 'single', 5000, 5000, 0, 0, 0, 0, 0, 0, makeTable());
    // 5000 × 0.4 = 2000 < 6600 → phaseIn = 2000.
    expect(r.phaseInAmount).toBe(2000);
  });
});
