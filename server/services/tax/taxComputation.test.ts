import { describe, it, expect } from 'vitest';
import { applyBrackets, computeIncomeTax, round } from './taxComputation.js';
import type { TaxYearConstants } from '../../../shared/types.js';

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
});
