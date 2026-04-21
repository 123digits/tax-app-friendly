// Property-based invariants for the core tax computation primitives.
// Unlike unit tests that assert concrete outputs for concrete inputs,
// these assert laws that should hold over a wide random sample space.
// fast-check will run each property ~100 times by default with shrinking
// on failure, so a surviving test is meaningfully stronger than hand-rolled
// examples.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyBrackets, computeIncomeTax, round } from './taxComputation.js';
import { computeSeTax } from './otherTaxes.js';
import { computeForm8606 } from './form8606.js';
import { computeEitc } from './eitc.js';
import { computeForm6251 } from './form6251.js';
import type {
  AmtRow,
  Bracket,
  EitcRow,
  FilingStatus,
  LtcgBracketRow,
  TaxYearConstants,
} from '../../../shared/types.js';

// Ascending-edge bracket arbitrary: generates non-overlapping ascending
// upTo boundaries with an unbounded top bracket.
const bracketArb: fc.Arbitrary<Bracket[]> = fc
  .tuple(
    fc.array(
      fc.record({ cap: fc.integer({ min: 1000, max: 500000 }), rate: fc.double({ min: 0.01, max: 0.5, noNaN: true }) }),
      { minLength: 1, maxLength: 6 },
    ),
    fc.double({ min: 0.01, max: 0.5, noNaN: true }),
  )
  .map(([edges, topRate]) => {
    const sorted = [...edges].sort((a, b) => a.cap - b.cap);
    const out: Bracket[] = [];
    let last = 0;
    for (const e of sorted) {
      if (e.cap > last) {
        out.push({ upTo: e.cap, rate: e.rate });
        last = e.cap;
      }
    }
    out.push({ upTo: null, rate: topRate });
    return out;
  });

const constantsArb: fc.Arbitrary<TaxYearConstants> = bracketArb.map((brackets) => {
  const ltcg: LtcgBracketRow = { zeroUpTo: 40000, fifteenUpTo: 500000 };
  return {
    taxYear: 2025,
    brackets: { single: brackets, mfj: brackets, mfs: brackets, hoh: brackets, qw: brackets },
    standardDeduction: { single: 14600, mfj: 29200, mfs: 14600, hoh: 21900, qw: 29200 },
    ctcPerChild: 2000,
    ctcPhaseoutStart: { single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qw: 200000 },
    ssWageBase: 168600,
    ltcgBrackets: { single: ltcg, mfj: ltcg, mfs: ltcg, hoh: ltcg, qw: ltcg },
    saltCap: 10000,
    medicalAgiThreshold: 0.075,
    capitalLossLimit: 3000,
    notes: null,
  };
});

describe('applyBrackets — invariants', () => {
  it('output is always non-negative', () => {
    fc.assert(fc.property(
      bracketArb,
      fc.double({ min: -100000, max: 1000000, noNaN: true }),
      (brackets, income) => {
        expect(applyBrackets(income, brackets)).toBeGreaterThanOrEqual(0);
      },
    ));
  });

  it('is monotonic in taxable income (more income ⇒ ≥ tax)', () => {
    fc.assert(fc.property(
      bracketArb,
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      (brackets, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(applyBrackets(hi, brackets)).toBeGreaterThanOrEqual(applyBrackets(lo, brackets));
      },
    ));
  });

  it('tax never exceeds income × the highest rate in the schedule', () => {
    fc.assert(fc.property(
      bracketArb,
      fc.double({ min: 0, max: 1000000, noNaN: true }),
      (brackets, income) => {
        const maxRate = Math.max(...brackets.map((b) => b.rate));
        expect(applyBrackets(income, brackets)).toBeLessThanOrEqual(income * maxRate + 0.01);
      },
    ));
  });

  it('returns 0 for zero or negative income', () => {
    fc.assert(fc.property(
      bracketArb,
      fc.double({ min: -1_000_000, max: 0, noNaN: true }),
      (brackets, income) => {
        expect(applyBrackets(income, brackets)).toBe(0);
      },
    ));
  });
});

describe('computeIncomeTax — invariants', () => {
  it('regularTax + ltcgTax ≥ 0', () => {
    fc.assert(fc.property(
      constantsArb,
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (c, ti, pref) => {
        const r = computeIncomeTax(ti, pref, 'single', c);
        expect(r.regularTax + r.ltcgTax).toBeGreaterThanOrEqual(0);
      },
    ));
  });

  it('ltcg preferential portion ≤ taxable income', () => {
    // Total tax ≤ ordinaryTax at top marginal + ltcgAt20
    fc.assert(fc.property(
      constantsArb,
      fc.double({ min: 0, max: 500000, noNaN: true }),
      (c, ti) => {
        // When preferential == taxableIncome, tax-on-preferential is bounded
        // by 20% × preferential.
        const r = computeIncomeTax(ti, ti, 'single', c);
        expect(r.ltcgTax).toBeLessThanOrEqual(ti * 0.20 + 0.01);
      },
    ));
  });
});

describe('round', () => {
  it('always has at most 2 decimal digits of magnitude', () => {
    fc.assert(fc.property(fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }), (n) => {
      const r = round(n);
      // r × 100 should round to an integer.
      expect(Math.abs(r * 100 - Math.round(r * 100))).toBeLessThan(1e-6);
    }));
  });
});

describe('computeSeTax — invariants', () => {
  it('SE tax is non-negative and half of it is the deduction', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (seEarnings, w2SsWages) => {
        const out = computeSeTax(seEarnings, w2SsWages, 168600);
        expect(out.seTax).toBeGreaterThanOrEqual(0);
        expect(Math.abs(out.seTax / 2 - out.seTaxDeduction)).toBeLessThan(0.01);
      },
    ));
  });

  it('bounded by (cap × 12.4% + income × 2.9%) × 92.35%', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 1_000_000, noNaN: true }),
      (seEarnings) => {
        const out = computeSeTax(seEarnings, 0, 168600);
        const ceiling =
          Math.min(seEarnings * 0.9235, 168600) * 0.124 +
          seEarnings * 0.9235 * 0.029;
        // Allow rounding slack.
        expect(out.seTax).toBeLessThanOrEqual(ceiling + 0.02);
      },
    ));
  });

  it('zero earnings always → zero tax', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (w2SsWages) => {
        const out = computeSeTax(0, w2SsWages, 168600);
        expect(out.seTax).toBe(0);
      },
    ));
  });
});

describe('computeForm8606 — invariants', () => {
  it('nontaxable + taxable portions = distributions + conversions', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (priorBasis, currNonded, balance, dist, conv) => {
        const out = computeForm8606({
          priorYearBasis: priorBasis,
          currentYearNondeductible: currNonded,
          traditionalIraBalance: balance,
          distributions: dist,
          conversions: conv,
        });
        const consumed = out.taxableDistribution + out.taxableConversion + out.nontaxablePortion;
        // Parts should sum to the total activity (distributions + conversions)
        // within rounding.
        expect(Math.abs(consumed - (dist + conv))).toBeLessThan(0.02);
      },
    ));
  });

  it('endingBasis never negative and never exceeds totalBasisAvailable', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (priorBasis, currNonded, balance, dist, conv) => {
        const out = computeForm8606({
          priorYearBasis: priorBasis,
          currentYearNondeductible: currNonded,
          traditionalIraBalance: balance,
          distributions: dist,
          conversions: conv,
        });
        expect(out.endingBasis).toBeGreaterThanOrEqual(-0.02);
        expect(out.endingBasis).toBeLessThanOrEqual(out.totalBasisAvailable + 0.02);
      },
    ));
  });
});

describe('computeEitc — invariants', () => {
  const table: Record<FilingStatus, Record<string, EitcRow>> = {
    single: {
      '0': { maxCredit: 600, phaseInRate: 0.0765, phaseOutRate: 0.0765, phaseOutStart: 10000, maxAgi: 18000 },
      '1': { maxCredit: 4000, phaseInRate: 0.34, phaseOutRate: 0.1598, phaseOutStart: 22000, maxAgi: 49000 },
      '2': { maxCredit: 6600, phaseInRate: 0.4, phaseOutRate: 0.2106, phaseOutStart: 22000, maxAgi: 55000 },
      '3': { maxCredit: 7500, phaseInRate: 0.45, phaseOutRate: 0.2106, phaseOutStart: 22000, maxAgi: 60000 },
    },
    mfj: {} as Record<string, EitcRow>,
    mfs: {} as Record<string, EitcRow>,
    hoh: {} as Record<string, EitcRow>,
    qw: {} as Record<string, EitcRow>,
  };
  table.mfj = table.single;
  table.hoh = table.single;
  table.qw = table.single;

  it('credit is always ≤ maxCredit of the matched row', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 80000, noNaN: true }),
      fc.double({ min: 0, max: 80000, noNaN: true }),
      fc.integer({ min: 0, max: 3 }),
      (wages, agi, kids) => {
        const out = computeEitc(
          { qualifyingChildrenOverride: kids, investmentIncomeOverride: null,
            isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
          [],
          'single',
          agi, wages, 0, 0, 0, 0, 0, 0,
          table,
        );
        const row = table.single[String(Math.min(kids, 3))];
        expect(out.credit).toBeLessThanOrEqual(row.maxCredit + 0.01);
        expect(out.credit).toBeGreaterThanOrEqual(0);
      },
    ));
  });

  it('AGI above maxAgi ⇒ credit is zero', () => {
    fc.assert(fc.property(
      fc.double({ min: 70000, max: 200000, noNaN: true }),
      fc.integer({ min: 0, max: 3 }),
      (agi, kids) => {
        const out = computeEitc(
          { qualifyingChildrenOverride: kids, investmentIncomeOverride: null,
            isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
          [],
          'single',
          agi, agi, 0, 0, 0, 0, 0, 0,
          table,
        );
        expect(out.credit).toBe(0);
      },
    ));
  });

  it('MFS filing status never yields a credit', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 80000, noNaN: true }),
      fc.integer({ min: 0, max: 3 }),
      (wages, kids) => {
        const out = computeEitc(
          { qualifyingChildrenOverride: kids, investmentIncomeOverride: null,
            isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
          [],
          'mfs',
          wages, wages, 0, 0, 0, 0, 0, 0,
          table,
        );
        expect(out.credit).toBe(0);
      },
    ));
  });
});

describe('computeForm6251 — invariants', () => {
  const row: AmtRow = {
    exemption: 85700,
    phaseoutStart: 609350,
    phaseoutRate: 0.25,
    rate26: 0.26,
    rate28: 0.28,
    rate28Threshold: 232600,
    nolLimitPct: 0.9,
  };

  it('AMT liability is never negative', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 1_000_000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 20000, noNaN: true }),
      (ti, salt, otherAdj, pab) => {
        const out = computeForm6251(
          { privateActivityBondInterest: pab, amtDepreciationAdjustment: 0,
            otherAdjustments: otherAdj, amtNolCarryforward: 0 },
          'single', ti, 0, salt, 0, row,
        );
        expect(out.amtLiability).toBeGreaterThanOrEqual(0);
      },
    ));
  });

  it('exemption allowed never exceeds the base exemption', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 2_000_000, noNaN: true }),
      (ti) => {
        const out = computeForm6251(
          { privateActivityBondInterest: 0, amtDepreciationAdjustment: 0,
            otherAdjustments: 0, amtNolCarryforward: 0 },
          'single', ti, 0, 0, 0, row,
        );
        expect(out.exemptionAllowed).toBeLessThanOrEqual(row.exemption);
      },
    ));
  });
});
