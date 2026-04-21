import { describe, it, expect } from 'vitest';
import { applyBrackets, computeIncomeTax, round } from './taxComputation.js';
import type { Bracket, TaxYearConstants } from '../../../shared/types.js';

const constants = {
  brackets: {
    single: [
      { upTo: 10000, rate: 0.1 },
      { upTo: 50000, rate: 0.2 },
      { upTo: null, rate: 0.3 },
    ],
    mfj: [{ upTo: null, rate: 0.2 }],
    mfs: [{ upTo: null, rate: 0.2 }],
    hoh: [{ upTo: null, rate: 0.2 }],
    qw: [{ upTo: null, rate: 0.2 }],
  },
  ltcgBrackets: {
    single: { zeroUpTo: 40000, fifteenUpTo: 500000 },
    mfj: { zeroUpTo: 80000, fifteenUpTo: 600000 },
    mfs: { zeroUpTo: 40000, fifteenUpTo: 500000 },
    hoh: { zeroUpTo: 40000, fifteenUpTo: 500000 },
    qw: { zeroUpTo: 80000, fifteenUpTo: 600000 },
  },
} as unknown as TaxYearConstants;

describe('taxComputation', () => {
  it('round rounds to cents', () => {
    // JS Math.round has a half-even-ish oddness (1.005 → 1.0); test near values.
    expect(round(1.006)).toBe(1.01);
    expect(round(1.004)).toBe(1);
    expect(round(0)).toBe(0);
  });

  it('applyBrackets handles zero and negative', () => {
    expect(applyBrackets(0, constants.brackets.single)).toBe(0);
    expect(applyBrackets(-100, constants.brackets.single)).toBe(0);
  });

  it('applyBrackets applies rates correctly', () => {
    // Income 5000 in 10% bracket
    expect(applyBrackets(5000, constants.brackets.single)).toBe(500);
    // Income 20000 = 10000*0.1 + 10000*0.2 = 1000 + 2000 = 3000
    expect(applyBrackets(20000, constants.brackets.single)).toBe(3000);
    // Income 100000 = 10000*0.1 + 40000*0.2 + 50000*0.3 = 1000+8000+15000 = 24000
    expect(applyBrackets(100000, constants.brackets.single)).toBe(24000);
  });

  it('computeIncomeTax applies LTCG preferential rates', () => {
    const out = computeIncomeTax(50000, 30000, 'single', constants);
    expect(out.regularTax).toBeGreaterThan(0);
    expect(out.ltcgTax).toBeGreaterThanOrEqual(0);
  });

  it('computeIncomeTax handles income entirely in LTCG 0% bracket', () => {
    const out = computeIncomeTax(20000, 20000, 'single', constants);
    expect(out.ltcgTax).toBe(0);
    expect(out.regularTax).toBe(0);
  });

  it('computeIncomeTax pushes LTCG into 15% and 20% brackets', () => {
    // Big ordinary + big LTCG — should ride into 20%
    const out = computeIncomeTax(1_000_000, 100_000, 'single', constants);
    expect(out.ltcgTax).toBeGreaterThan(0);
  });

  it('computeIncomeTax handles ordinary income only', () => {
    const out = computeIncomeTax(60000, 0, 'single', constants);
    expect(out.ltcgTax).toBe(0);
    expect(out.regularTax).toBeGreaterThan(0);
  });

  // --- Boundary + mutation-targeted cases ---

  it('applyBrackets with income exactly at a bracket edge', () => {
    // 10000 straddles first-bracket boundary. Tax = 10000*0.10 = 1000 (all
    // first bracket; second bracket yields 0 because edge - lastEdge = 0).
    expect(applyBrackets(10000, constants.brackets.single)).toBe(1000);
  });

  it('applyBrackets with income exactly at second-bracket top', () => {
    // 50000 = 10000*0.10 + 40000*0.20 = 1000 + 8000 = 9000.
    expect(applyBrackets(50000, constants.brackets.single)).toBe(9000);
  });

  it('applyBrackets income one dollar above bracket edge crosses into next tier', () => {
    // 10001 = 10000*0.10 + 1*0.20 = 1000.20.
    expect(applyBrackets(10001, constants.brackets.single)).toBeCloseTo(1000.2, 2);
  });

  it('applyBrackets integrates to within 1 cent of piecewise integral', () => {
    // Sanity: tax(100k) must equal tax(50k) + (100k-50k) × top-rate
    // when 100k is already past every bounded bracket (this schedule tops
    // at 50000, rate 0.3).
    const at50 = applyBrackets(50000, constants.brackets.single);
    const at100 = applyBrackets(100000, constants.brackets.single);
    expect(at100 - at50).toBeCloseTo(50000 * 0.30, 2);
  });

  it('computeIncomeTax: preferential exactly equal to zeroUpTo bracket room', () => {
    // ordinary=0, preferential=40000 (exactly fills 0% bucket) → ltcgTax=0.
    const out = computeIncomeTax(40000, 40000, 'single', constants);
    expect(out.regularTax).toBe(0);
    expect(out.ltcgTax).toBe(0);
  });

  it('computeIncomeTax: preferential one dollar past zero-bracket pays 15%', () => {
    // ordinary=0, preferential=40001 → 1 dollar at 15% = 0.15.
    const out = computeIncomeTax(40001, 40001, 'single', constants);
    expect(out.ltcgTax).toBeCloseTo(0.15, 2);
  });

  it('computeIncomeTax: ordinary stacked under preferential pushes LTCG into 15%', () => {
    // ordinary=40000, preferential=10000 → preferential starts at 40000 which
    // is exactly at zeroUpTo. 0 room at 0%, all $10k at 15% = 1500.
    const out = computeIncomeTax(50000, 10000, 'single', constants);
    expect(out.ltcgTax).toBeCloseTo(1500, 2);
  });

  it('computeIncomeTax: preferential entirely in 20% tier', () => {
    // ordinary=500000, preferential=100000 → startsAt=500000, beyond
    // fifteenUpTo=500000 → all 100k at 20% = 20000.
    const out = computeIncomeTax(600000, 100000, 'single', constants);
    expect(out.ltcgTax).toBeCloseTo(20000, 2);
  });

  it('computeIncomeTax: preferential capped by taxable income', () => {
    // preferential exceeds taxableIncome; only taxableIncome counts.
    const out = computeIncomeTax(5000, 100000, 'single', constants);
    expect(out.regularTax).toBe(0);
    // 5000 falls in 0% ltcg bracket → 0.
    expect(out.ltcgTax).toBe(0);
  });

  it('computeIncomeTax: negative preferential treated as zero', () => {
    const out = computeIncomeTax(20000, -5000, 'single', constants);
    expect(out.ltcgTax).toBe(0);
    expect(out.regularTax).toBeGreaterThan(0);
  });

  it('applyBrackets never produces negative tax with negative income', () => {
    expect(applyBrackets(-100, constants.brackets.single)).toBe(0);
    expect(applyBrackets(-100000, constants.brackets.single)).toBe(0);
  });

  it('applyBrackets with single unbounded bracket taxes all income at one rate', () => {
    const flat: Bracket[] = [{ upTo: null, rate: 0.25 }];
    expect(applyBrackets(10000, flat)).toBe(2500);
    expect(applyBrackets(1_000_000, flat)).toBe(250000);
    expect(applyBrackets(0, flat)).toBe(0);
  });
});
