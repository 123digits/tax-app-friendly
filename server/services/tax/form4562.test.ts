import { describe, it, expect } from 'vitest';
import { summarizeDepreciation } from './form4562.js';
import type { DepreciationAsset, DepreciationConstants } from '../../../shared/types.js';

function asset(a: Partial<DepreciationAsset>): DepreciationAsset {
  return {
    id: a.id ?? 'a1',
    description: a.description ?? null,
    datePlacedInService: a.datePlacedInService ?? null,
    cost: a.cost ?? 0,
    macrsClass: a.macrsClass ?? '5',
    section179Election: a.section179Election ?? 0,
    claimBonus: a.claimBonus ?? false,
    businessUsePercent: a.businessUsePercent ?? 1,
    businessId: a.businessId ?? null,
  };
}

// IRS Table A-1 first-year MACRS rates (half-year convention, 200% DB for
// 3/5/7/10/15/20; straight-line for 27.5/39). Mirrors the schema.sql seed.
const MACRS_TABLE: Record<string, number> = {
  '3': 0.3333,
  '5': 0.2,
  '7': 0.1429,
  '10': 0.1,
  '15': 0.05,
  '20': 0.0375,
  '27.5': 1 / 27.5,
  '39': 1 / 39,
  straight_line: 0.1,
};

const C: DepreciationConstants = {
  section179Limit: 1200000,
  section179Phaseout: 3000000,
  bonusPct: 0.4,
  firstYearMacrs: MACRS_TABLE,
};

describe('summarizeDepreciation', () => {
  it('5-year property with no §179 or bonus uses 20% first year', () => {
    const r = summarizeDepreciation(
      [asset({ cost: 10000, macrsClass: '5' })],
      C,
    );
    expect(r.totalMacrs).toBeCloseTo(2000, 2);
    expect(r.totalSection179).toBe(0);
    expect(r.totalBonus).toBe(0);
  });

  it('§179 election fully covers basis within limit', () => {
    const r = summarizeDepreciation(
      [asset({ cost: 50000, macrsClass: '5', section179Election: 50000 })],
      C,
    );
    expect(r.totalSection179).toBe(50000);
    expect(r.totalMacrs).toBe(0);
    expect(r.total).toBe(50000);
  });

  it('bonus depreciation + MACRS on remaining', () => {
    const r = summarizeDepreciation(
      [asset({ cost: 10000, macrsClass: '5', claimBonus: true })],
      C,
    );
    expect(r.totalBonus).toBeCloseTo(4000, 2);  // 10000 * 0.4
    expect(r.totalMacrs).toBeCloseTo(1200, 2);   // 6000 * 0.2
  });

  it('§179 phase-out uses full cost, not business-use-adjusted basis (§179(b)(2))', () => {
    // Single asset at 50% business use, cost $4,000,000. Phase-out starts at
    // $3,000,000 in the test config. Full-cost investment = $4,000,000
    // triggers $1,000,000 reduction; business-use-adjusted would be only
    // $2,000,000 and would not trigger phase-out.
    // effectiveLimit = $1,200,000 - $1,000,000 = $200,000.
    // Basis for deduction = $4,000,000 × 0.5 = $2,000,000; §179 elected
    // $2,000,000 is pro-rata-reduced to $200,000.
    const r = summarizeDepreciation(
      [
        asset({
          cost: 4_000_000,
          macrsClass: '5',
          section179Election: 2_000_000,
          businessUsePercent: 0.5,
        }),
      ],
      C,
    );
    expect(r.totalSection179).toBeCloseTo(200_000, 2);
  });

  it('§179 elections exceeding the cap are pro-rata reduced', () => {
    const small: DepreciationConstants = {
      section179Limit: 1000,
      section179Phaseout: 10_000_000,
      bonusPct: 0,
      firstYearMacrs: MACRS_TABLE,
    };
    const r = summarizeDepreciation(
      [
        asset({ id: 'a', cost: 2000, macrsClass: '5', section179Election: 2000 }),
        asset({ id: 'b', cost: 2000, macrsClass: '5', section179Election: 2000 }),
      ],
      small,
    );
    expect(r.totalSection179).toBeCloseTo(1000, 2);
  });

  it('disallowed §179 rolls forward into bonus + MACRS on pro-rata reduce path', () => {
    // Exercises the `a.claimBonus ? remainingAfterS179 * bonusPct : 0` path
    // inside the §179-excess proration block.
    const small: DepreciationConstants = {
      section179Limit: 1000,
      section179Phaseout: 10_000_000,
      bonusPct: 0.5,
      firstYearMacrs: MACRS_TABLE,
    };
    const r = summarizeDepreciation(
      [
        asset({ id: 'a', cost: 4000, macrsClass: '5', section179Election: 4000, claimBonus: true }),
        asset({ id: 'b', cost: 4000, macrsClass: '5', section179Election: 4000, claimBonus: true }),
      ],
      small,
    );
    expect(r.totalSection179).toBeCloseTo(1000, 2);
    // $1,000 cap allocated proportionally → $500 each. Remaining $3,500 each
    // gets 50% bonus ($1,750) + MACRS on $1,750 × 20% ($350).
    expect(r.totalBonus).toBeCloseTo(3500, 2);
    expect(r.totalMacrs).toBeCloseTo(700, 2);
  });

  it('businessUsePercent of 0 falls back to 1 (legacy-blank-field fallback)', () => {
    // `n(a.businessUsePercent) || 1` — 0 is treated as 100% for ergonomics
    // when users leave the field blank.
    const r = summarizeDepreciation(
      [asset({ cost: 10000, macrsClass: '5', businessUsePercent: 0 })],
      C,
    );
    expect(r.totalMacrs).toBeCloseTo(2000, 2);
  });

  it('unknown macrsClass falls back to 10% first-year rate', () => {
    const r = summarizeDepreciation(
      [asset({ cost: 10000, macrsClass: 'nonexistent' as '5' })],
      C,
    );
    expect(r.totalMacrs).toBeCloseTo(1000, 2);
  });

  it('throws when depreciation constants lack firstYearMacrs map', () => {
    expect(() =>
      summarizeDepreciation(
        [asset({ cost: 10000, macrsClass: '5' })],
        { section179Limit: 1000, section179Phaseout: 0, bonusPct: 0 } as unknown as DepreciationConstants,
      ),
    ).toThrow(/firstYearMacrs/);
  });

  it('falls back to zero limits when all numeric constants are omitted', () => {
    // `constants?.section179Limit ?? 0` etc. default paths.
    const r = summarizeDepreciation(
      [asset({ cost: 10000, macrsClass: '5', section179Election: 50000 })],
      { firstYearMacrs: MACRS_TABLE } as unknown as DepreciationConstants,
    );
    // Limit 0 → all §179 elections zeroed via pro-rata.
    expect(r.totalSection179).toBe(0);
  });

  it('pro-rata §179 reduction with unknown macrs class + zero businessUsePercent', () => {
    // Inside the §179-excess reduction branch (second pass), exercises the
    // `n(a.businessUsePercent) || 1` and `macrsTable[a.macrsClass] ?? 0.1`
    // right-side branches simultaneously.
    const small: DepreciationConstants = {
      section179Limit: 500,
      section179Phaseout: 10_000_000,
      bonusPct: 0,
      firstYearMacrs: MACRS_TABLE,
    };
    const r = summarizeDepreciation(
      [
        asset({ id: 'a', cost: 2000,
          macrsClass: 'unknown-class' as '5',
          section179Election: 2000,
          businessUsePercent: 0 }),
        asset({ id: 'b', cost: 2000, macrsClass: '5', section179Election: 2000 }),
      ],
      small,
    );
    // §179 cap $500 → pro-rata → two assets split $500. Unknown macrs
    // class falls back to 10% MACRS rate on the reduced basis.
    expect(r.totalSection179).toBeCloseTo(500, 2);
  });
});
