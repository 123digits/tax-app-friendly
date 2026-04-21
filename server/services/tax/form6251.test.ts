import { describe, it, expect } from 'vitest';
import { computeForm6251 } from './form6251.js';
import type { AmtRow, Form6251, LtcgBracketRow } from '../../../shared/types.js';

function row(): AmtRow {
  return {
    exemption: 90000,
    phaseoutStart: 650000,
    phaseoutRate: 0.25,
    rate26: 0.26,
    rate28: 0.28,
    rate28Threshold: 250000,
  };
}

function base(overrides: Partial<Form6251> = {}): Form6251 {
  return {
    privateActivityBondInterest: 0,
    amtDepreciationAdjustment: 0,
    otherAdjustments: 0,
    amtNolCarryforward: 0,
    ...overrides,
  };
}

describe('computeForm6251', () => {
  it('returns zeros with no AMT config row', () => {
    const r = computeForm6251(base(), 'single', 100000, 15000, 0, 0, undefined);
    expect(r.amtLiability).toBe(0);
    expect(r.tentativeMinimumTax).toBe(0);
  });

  it('low taxable income with no preferences → no AMT', () => {
    // TI $60k; AMTI $60k < exemption $90k → amtiAfterExemption = 0 → TMT = 0.
    const r = computeForm6251(base(), 'single', 60000, 6500, 0, 0, row());
    expect(r.tentativeMinimumTax).toBe(0);
    expect(r.amtLiability).toBe(0);
  });

  it('SALT add-back can push AMTI above exemption', () => {
    // TI $200k, SALT $30k, no preferences, regular tax $35k.
    // AMTI before exemption = $230k.
    // Exemption = $90k (below phase-out start), AMTI after exemption = $140k.
    // TMT = $140k × 26% = $36,400.
    // AMT liability = max(0, 36,400 − 35,000) = $1,400.
    const r = computeForm6251(base(), 'single', 200000, 35000, 30000, 0, row());
    expect(r.amti).toBeCloseTo(230000, 2);
    expect(r.exemptionAllowed).toBe(90000);
    expect(r.tentativeMinimumTax).toBeCloseTo(36400, 2);
    expect(r.amtLiability).toBeCloseTo(1400, 2);
  });

  it('exemption phases out above threshold', () => {
    // AMTI = $750k; phase-out = ($750k − $650k) × 0.25 = $25k.
    // Exemption = $90k − $25k = $65k.
    const r = computeForm6251(base(), 'mfj', 750000, 0, 0, 0, row());
    expect(r.exemptionAllowed).toBeCloseTo(65000, 2);
    expect(r.amti).toBeCloseTo(750000, 2);
  });

  it('AMTI above rate28Threshold taxed at 28% on excess', () => {
    // AMTI after exemption = $500k (force via preferences).
    // Taxable AMTI base = exemption $90k + $500k = $590k → TI input = $590k, no salt.
    // But exemption not phased since $590k < $650k phase-out start.
    // Lower chunk $250k × 26% = $65,000.
    // Upper chunk $250k × 28% = $70,000.
    // TMT = $135,000.
    const r = computeForm6251(base(), 'mfj', 590000, 0, 0, 0, row());
    expect(r.tentativeMinimumTax).toBeCloseTo(135000, 2);
  });

  it('AMT NOL capped at 90% of AMTI', () => {
    // TI $100k, AMT NOL carryforward $200k. 90% × $100k = $90k cap.
    // AMTI = max(0, 100k − 90k) = $10k → below exemption → TMT = 0.
    const r = computeForm6251(
      base({ amtNolCarryforward: 200000 }),
      'single',
      100000,
      15000,
      0,
      0,
      row(),
    );
    expect(r.amti).toBeCloseTo(10000, 2);
    expect(r.tentativeMinimumTax).toBe(0);
  });

  it('§55(b)(3): LTCG/QDI portion of AMTI taxed at preferential 0/15/20% rates', () => {
    // TI $200k, SALT $30k → AMTI $230k; exemption $90k → after-exemption $140k.
    // Suppose $100k of that is preferential (net LTCG + QDI), $40k ordinary.
    // LTCG brackets: 0% up to $100k, 15% up to $500k.
    // Ordinary AMTI $40k × 26% = $10,400.
    // Preferential $100k stacks on top of $40k ordinary: zero-bracket room =
    //   max(0, $100k − $40k) = $60k → $60k at 0%. Remaining $40k at 15% = $6,000.
    // TMT = $10,400 + $6,000 = $16,400.
    // If instead we (wrongly) applied 26% to preferential: $100k × 26% = $26,000,
    // TMT would be $10,400 + $26,000 = $36,400. Fix saves $20,000.
    const ltcg: LtcgBracketRow = { zeroUpTo: 100000, fifteenUpTo: 500000 };
    const r = computeForm6251(
      base(),
      'single',
      200000,
      35000,
      30000,
      0,
      row(),
      100000, // preferential
      ltcg,
    );
    expect(r.tentativeMinimumTax).toBeCloseTo(16400, 2);
  });

  it('preferential that overflows zero bracket falls through 15% and 20%', () => {
    // Ordinary AMTI $0 (contrived). preferential $600k stacks from $0.
    // Zero bracket $100k, 15% up to $500k → $400k at 15% = $60,000.
    // Above $500k → $100k at 20% = $20,000.
    // Total preferential tax = $80,000. Ordinary tax = $0. TMT = $80,000.
    const ltcg: LtcgBracketRow = { zeroUpTo: 100000, fifteenUpTo: 500000 };
    const custom: AmtRow = { ...row(), exemption: 0, phaseoutStart: Number.POSITIVE_INFINITY };
    const r = computeForm6251(base(), 'single', 600000, 0, 0, 0, custom, 600000, ltcg);
    expect(r.tentativeMinimumTax).toBeCloseTo(80000, 2);
  });

  it('PAB interest and depreciation adjustment increase AMTI', () => {
    // TI $100k, PAB $20k, depAdj $5k → AMTI = $125k; exemption $90k.
    // AmtiAfterExemp = $35k × 26% = $9,100. Regular tax $16,000 → AMT = 0.
    const r = computeForm6251(
      base({ privateActivityBondInterest: 20000, amtDepreciationAdjustment: 5000 }),
      'single',
      100000,
      16000,
      0,
      0,
      row(),
    );
    expect(r.amti).toBeCloseTo(125000, 2);
    expect(r.tentativeMinimumTax).toBeCloseTo(9100, 2);
    expect(r.amtLiability).toBe(0);
  });

  it('zero PAB interest does NOT increase AMTI (non-PAB tax-exempt excluded)', () => {
    // Regular tax-exempt muni interest does not flow to Form 6251 line 2g.
    // Only PAB interest does. This test confirms the PAB field is additive
    // only when populated — a baseline of zero should leave AMTI untouched.
    const baseline = computeForm6251(
      base({ privateActivityBondInterest: 0 }),
      'single', 100000, 16000, 0, 0, row(),
    );
    const withPab = computeForm6251(
      base({ privateActivityBondInterest: 5000 }),
      'single', 100000, 16000, 0, 0, row(),
    );
    expect(withPab.amti - baseline.amti).toBeCloseTo(5000, 2);
  });

  it('large PAB interest alone can trigger AMT', () => {
    // TI $50k, PAB $200k → AMTI $250k; exemption $90k; after-exempt $160k.
    // TMT = $160k × 26% = $41,600. Regular tax $5,000 → AMT $36,600.
    const r = computeForm6251(
      base({ privateActivityBondInterest: 200000 }),
      'single', 50000, 5000, 0, 0, row(),
    );
    expect(r.tentativeMinimumTax).toBeCloseTo(41600, 2);
    expect(r.amtLiability).toBeCloseTo(36600, 2);
  });
});
