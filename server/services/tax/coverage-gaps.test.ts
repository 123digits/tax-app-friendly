// Targeted tests to close 100%-branch-coverage gaps in form helpers.
// Each `it` exercises a specific defensive branch that the broader
// integration suites in this folder don't currently hit.
import { describe, it, expect } from 'vitest';
import { computeForm8606 } from './form8606.js';
import { computeForm8880 } from './form8880.js';
import { pickApplicablePercentage, computeForm8962 } from './form8962.js';
import { applyPassiveLossLimits } from './passiveLoss.js';
import { sumKind } from '../carryforwards.js';
import type {
  Carryforward,
  PtcConstants,
  SaversCreditRow,
} from '../../../shared/types.js';

describe('computeForm8606 — denom===0 with positive basis', () => {
  it('returns zero taxable amounts when distributions+conversions+balance is 0 but basis is non-zero', () => {
    // totalValue = totalBasis + denom; with denom=0 and totalBasis>0 the
    // function must continue past the totalValue===0 short-circuit but
    // hit the `denom === 0 ? 0 : ...` branch on line 39.
    const result = computeForm8606({
      priorYearBasis: 5000,
      currentYearNondeductible: 0,
      traditionalIraBalance: 0,
      distributions: 0,
      conversions: 0,
    });
    expect(result.totalBasisAvailable).toBe(5000);
    expect(result.taxableDistribution).toBe(0);
    expect(result.taxableConversion).toBe(0);
    expect(result.endingBasis).toBe(5000);
  });
});

describe("computeForm8880 — saver's credit rates[i] missing", () => {
  it("falls back to 0 rate when the matching tier has no rate entry", () => {
    // tiers.rates is a sparse array — when agi <= agiTiers[i] but
    // rates[i] is undefined, the `?? 0` fallback fires.
    const tiers: SaversCreditRow = {
      agiTiers: [10_000, 20_000, 30_000],
      rates: [0.5, undefined as unknown as number, 0.1],
      perPersonCap: 2000,
    };
    const result = computeForm8880(
      { elective401kDeferrals: 1000, iraContributions: 0,
        spouseElective401kDeferrals: 0, spouseIraContributions: 0,
        distributionsReceived: 0 },
      15_000, // hits the 20_000 tier whose rate is undefined
      'single',
      tiers,
    );
    expect(result.applicableRate).toBe(0);
    expect(result.credit).toBe(0);
  });
});

describe('pickApplicablePercentage — degenerate band span', () => {
  it('returns lo.pct when two consecutive bands have the same fpl threshold (span === 0)', () => {
    // The first band's fpl is undefined so the early `fplPct <= bands[0].fpl`
    // check (and the i=0 iteration) both fall through, letting fplPct land on
    // a duplicate-fpl pair where span === 0 and the line-46 fallback fires.
    const bands = [
      { fpl: undefined as unknown as number, pct: 0 },
      { fpl: 100, pct: 0.04 },
      { fpl: 100, pct: 0.05 }, // duplicate threshold → span = 0
      { fpl: 400, pct: 0.085 },
    ];
    expect(pickApplicablePercentage(100, bands)).toBe(0.04);
  });
});

describe('computeForm8962 — degenerate ptcCap', () => {
  it('returns annualPtc=0 when annualSlcsp < expected contribution (max(0, ...) lower branch)', () => {
    const constants: PtcConstants = {
      contributionBands: [
        { fpl: 100, pct: 0 },
        { fpl: 150, pct: 0 },
        { fpl: 200, pct: 0.04 },
        { fpl: 400, pct: 0.085 },
      ],
      repaymentCapSingle: [
        { fpl: 200, cap: 375 },
        { fpl: 300, cap: 950 },
        { fpl: 400, cap: 1575 },
      ],
      repaymentCapFamily: [
        { fpl: 200, cap: 750 },
        { fpl: 300, cap: 1900 },
        { fpl: 400, cap: 3150 },
      ],
    };
    const result = computeForm8962(
      {
        householdSize: 1,
        federalPovertyLine: 15_000,
        annualEnrollmentPremium: 100,
        annualSlcsp: 50, // tiny — expectedContribution will exceed it
        advancePtcPaid: 0,
        additionalMagi: 0,
      },
      45_000, // 300% FPL → applicablePercentage > 0
      'single',
      constants,
    );
    // ptcCap = max(0, annualSlcsp - expectedContribution) → 0
    expect(result.annualPtc).toBe(0);
  });
});

describe('applyPassiveLossLimits — defensive Map fallbacks', () => {
  // These entries cause the §469 worksheet to allocate exactly the
  // entire available passive loss across both pools, leaving no
  // suspended residue. The combination still routes through the
  // `?? 0` fallback path on lines 149/155.
  it('handles entries whose effective net is exactly 0 alongside a loss', () => {
    const r = applyPassiveLossLimits(
      [
        { id: 'rentalA', net: 0, priorYearUnallowedLoss: 0 },
        { id: 'rentalB', net: -1000, priorYearUnallowedLoss: 0 },
      ],
      [
        { kind: 'k1', id: 'k1A', net: 0, priorYearUnallowedLoss: 0 },
        { kind: 'k1', id: 'k1B', net: -500, priorYearUnallowedLoss: 0 },
      ],
      80_000,
      'single',
    );
    expect(r.passiveLossesAllowed).toBeGreaterThan(0);
  });

  it('handles a loss entry whose share rounds to zero (no suspended residue)', () => {
    // Pool A losses are fully absorbed by the special allowance; pool B
    // losses (no passive income, no special allowance) all suspend.
    // The `if (s > 0)` short-circuit fires for the pool-A entries
    // (suspended === 0) and not for the pool-B entries.
    const r = applyPassiveLossLimits(
      [
        { id: 'r1', net: -500, priorYearUnallowedLoss: 0 },
        { id: 'r2', net: -1500, priorYearUnallowedLoss: 0 },
      ],
      [
        { kind: 'rental', id: 'k1r', net: -200, priorYearUnallowedLoss: 0 },
        { kind: 'k1', id: 'k1k', net: -300, priorYearUnallowedLoss: 0 },
      ],
      80_000, // well below phaseout — full $25k allowance
      'single',
    );
    // Pool A fully absorbed → no suspended rentals from pool A.
    // Pool B "rental" still suspends ($200) and pool B "k1" suspends ($300).
    expect(r.totalSuspendedRental).toBe(200);
    expect(r.totalSuspendedK1).toBe(300);
  });
});

describe('sumKind — non-numeric amount falls through to `|| 0`', () => {
  it('treats a row whose Number(amount) is NaN as 0', () => {
    const rows: Carryforward[] = [
      {
        id: 'a',
        userId: 'u',
        taxYear: 2024,
        kind: 'capital_loss_short',
        refId: null,
        amount: Number.NaN,
        sourceReturnId: null,
        notes: null,
      },
      {
        id: 'b',
        userId: 'u',
        taxYear: 2024,
        kind: 'capital_loss_short',
        refId: null,
        amount: 1500,
        sourceReturnId: null,
        notes: null,
      },
    ];
    expect(sumKind(rows, 'capital_loss_short')).toBe(1500);
  });

  it('filters by refId when provided (non-undefined refId argument)', () => {
    const rows: Carryforward[] = [
      {
        id: 'a',
        userId: 'u',
        taxYear: 2024,
        kind: 'ftc',
        refId: 'passive',
        amount: 100,
        sourceReturnId: null,
        notes: null,
      },
      {
        id: 'b',
        userId: 'u',
        taxYear: 2024,
        kind: 'ftc',
        refId: 'general',
        amount: 200,
        sourceReturnId: null,
        notes: null,
      },
    ];
    expect(sumKind(rows, 'ftc', 'general')).toBe(200);
  });
});
