import { describe, it, expect } from 'vitest';
import {
  splitCapitalGains,
  sumDividends,
  isScheduleBRequired,
  applyCapitalLossCap,
  computeCapitalLossCarryforward,
  sumRetirementIncome,
  sumW2Wages,
  sumW2SsWages,
  sumInterest,
  sumTaxExemptInterest,
  sumPrivateActivityBondInterest,
  schedCNetProfit,
  totalSeNetProfit,
  sumUnemployment,
  sumGambling,
} from './income.js';
import type {
  CapitalGain,
  DividendIncome,
  RetirementIncome,
  W2Income,
  InterestIncome,
  SelfEmployment,
  UnemploymentIncome,
  GamblingWinnings,
} from '../../../shared/types.js';

function mkRet(overrides: Partial<RetirementIncome>): RetirementIncome {
  return {
    id: overrides.id ?? 'r1',
    payer: overrides.payer ?? null,
    grossDistribution: overrides.grossDistribution ?? 0,
    taxableAmount: overrides.taxableAmount ?? 0,
    federalWithheld: overrides.federalWithheld ?? 0,
    stateWithheld: overrides.stateWithheld ?? 0,
    distributionCode: overrides.distributionCode ?? null,
    isIra: overrides.isIra ?? false,
    isRoth: overrides.isRoth ?? false,
    exceptionCode: overrides.exceptionCode ?? null,
    taxableAmountNotDetermined: overrides.taxableAmountNotDetermined ?? false,
  };
}

describe('splitCapitalGains wash-sale disallowance (§1091 / Form 8949 col g)', () => {
  it('reduces a short-term loss by the wash-sale disallowance amount', () => {
    const items: CapitalGain[] = [
      {
        id: 'a',
        description: null,
        dateAcquired: null,
        dateSold: null,
        proceeds: 1000,
        costBasis: 1500, // raw loss = -500
        term: 'short',
        washSaleLossDisallowed: 300,
      },
    ];
    const out = splitCapitalGains(items);
    // -500 + 300 = -200
    expect(out.short).toBe(-200);
    expect(out.long).toBe(0);
  });

  it('caps wash-sale disallowance at the loss magnitude (never creates a gain)', () => {
    const items: CapitalGain[] = [
      {
        id: 'a',
        description: null,
        dateAcquired: null,
        dateSold: null,
        proceeds: 1000,
        costBasis: 1200, // raw loss = -200
        term: 'long',
        washSaleLossDisallowed: 500, // larger than the loss
      },
    ];
    const out = splitCapitalGains(items);
    // Disallowance should cap at 200, not 500; result = 0, not +300.
    expect(out.long).toBe(0);
    expect(out.short).toBe(0);
  });

  it('ignores wash-sale field on a gain (never inflates the gain)', () => {
    const items: CapitalGain[] = [
      {
        id: 'a',
        description: null,
        dateAcquired: null,
        dateSold: null,
        proceeds: 2000,
        costBasis: 1000, // gain = +1000
        term: 'long',
        washSaleLossDisallowed: 200,
      },
    ];
    const out = splitCapitalGains(items);
    expect(out.long).toBe(1000);
  });

  it('treats missing washSaleLossDisallowed as 0 (backward compat)', () => {
    const items: CapitalGain[] = [
      {
        id: 'a',
        description: null,
        dateAcquired: null,
        dateSold: null,
        proceeds: 1000,
        costBasis: 1500,
        term: 'short',
      },
    ];
    const out = splitCapitalGains(items);
    expect(out.short).toBe(-500);
  });
});

describe('sumDividends qualified ≤ ordinary invariant (1099-DIV)', () => {
  it('clamps qualified to ordinary per row when qualified > ordinary', () => {
    const items: DividendIncome[] = [
      { id: '1', payer: null, ordinary: 100, qualified: 500 }, // bad data
    ];
    const out = sumDividends(items);
    expect(out.ordinary).toBe(100);
    expect(out.qualified).toBe(100);
  });

  it('does not cross-subsidize: one row with qualified > ordinary cannot borrow from another row', () => {
    const items: DividendIncome[] = [
      { id: '1', payer: null, ordinary: 100, qualified: 500 }, // clamped to 100
      { id: '2', payer: null, ordinary: 900, qualified: 0 },   // qualified stays 0
    ];
    const out = sumDividends(items);
    expect(out.ordinary).toBe(1000);
    expect(out.qualified).toBe(100); // not 500
  });

  it('leaves qualified unchanged when qualified ≤ ordinary', () => {
    const items: DividendIncome[] = [
      { id: '1', payer: null, ordinary: 500, qualified: 200 },
    ];
    const out = sumDividends(items);
    expect(out.qualified).toBe(200);
  });

  it('treats negative qualified as 0', () => {
    const items: DividendIncome[] = [
      { id: '1', payer: null, ordinary: 500, qualified: -50 },
    ];
    const out = sumDividends(items);
    expect(out.qualified).toBe(0);
  });
});

describe('sumDividends 1099-DIV Box 2a total capital gain distributions', () => {
  it('aggregates Box 2a across rows and does not disturb the qualified-≤-ordinary invariant', () => {
    const items: DividendIncome[] = [
      {
        id: '1', payer: 'Fund A', ordinary: 100, qualified: 500, // bad: qualified > ordinary
        totalCapGainDistributions: 250,
      },
      {
        id: '2', payer: 'Fund B', ordinary: 200, qualified: 150,
        totalCapGainDistributions: 750,
      },
    ];
    const out = sumDividends(items);
    // Qualified still clamped per row (100 + 150 = 250), not cross-subsidized.
    expect(out.ordinary).toBe(300);
    expect(out.qualified).toBe(250);
    // Box 2a aggregated.
    expect(out.totalCapGainDistributions).toBe(1000);
  });

  it('treats missing / negative Box 2a as 0 (never subtracts)', () => {
    const items: DividendIncome[] = [
      { id: '1', payer: null, ordinary: 100, qualified: 0 },
      { id: '2', payer: null, ordinary: 100, qualified: 0, totalCapGainDistributions: -500 },
    ];
    const out = sumDividends(items);
    expect(out.totalCapGainDistributions).toBe(0);
  });
});

describe('applyCapitalLossCap (§1211(b))', () => {
  it('caps a $10k loss at $3,000 for single filers', () => {
    expect(applyCapitalLossCap(-10000, 'single', 3000)).toBe(-3000);
  });

  it('caps a $10k loss at $3,000 for MFJ/HoH/QW', () => {
    expect(applyCapitalLossCap(-10000, 'mfj', 3000)).toBe(-3000);
    expect(applyCapitalLossCap(-10000, 'hoh', 3000)).toBe(-3000);
    expect(applyCapitalLossCap(-10000, 'qw', 3000)).toBe(-3000);
  });

  it('caps a $10k loss at $1,500 for MFS (half of the base limit)', () => {
    expect(applyCapitalLossCap(-10000, 'mfs', 3000)).toBe(-1500);
  });

  it('returns the full loss when below the cap', () => {
    expect(applyCapitalLossCap(-500, 'single', 3000)).toBe(-500);
    expect(applyCapitalLossCap(-500, 'mfs', 3000)).toBe(-500);
  });

  it('returns 0 when netCapital ≥ 0', () => {
    expect(applyCapitalLossCap(0, 'single', 3000)).toBe(0);
    expect(applyCapitalLossCap(5000, 'mfs', 3000)).toBe(0);
  });

  it('honors a custom baseLimit from TaxYearConstants', () => {
    expect(applyCapitalLossCap(-10000, 'single', 4000)).toBe(-4000);
    expect(applyCapitalLossCap(-10000, 'mfs', 4000)).toBe(-2000);
  });
});

describe('isScheduleBRequired (§6012 / Sched B inst.)', () => {
  it('returns false when both interest and dividends are ≤ $1,500', () => {
    expect(isScheduleBRequired(1500, 1500)).toBe(false);
    expect(isScheduleBRequired(0, 0)).toBe(false);
  });

  it('returns true when taxable interest > $1,500', () => {
    expect(isScheduleBRequired(1500.01, 0)).toBe(true);
    expect(isScheduleBRequired(2000, 0)).toBe(true);
  });

  it('returns true when ordinary dividends > $1,500', () => {
    expect(isScheduleBRequired(0, 1500.01)).toBe(true);
    expect(isScheduleBRequired(100, 2500)).toBe(true);
  });
});

// Per IRS 2024 Instructions for Forms 1099-R and 5498: IRA payers generally
// leave Box 2a blank and check Box 2b because they don't know the owner's
// basis. For non-rollover traditional IRA distributions the full gross is
// taxable absent Form 8606 basis. Rollovers (codes G/H) are nontaxable.
describe('sumRetirementIncome — 1099-R Box 2a / Box 2b default (§408)', () => {
  it('defaults taxable to gross for an IRA with blank Box 2a and Box 2b checked (non-rollover)', () => {
    const items = [
      mkRet({
        isIra: true,
        grossDistribution: 10000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: '7', // normal distribution, not a rollover
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(10000);
    expect(out.taxable).toBe(10000);
  });

  it('does NOT default to gross for a code-G direct rollover IRA (nontaxable)', () => {
    const items = [
      mkRet({
        isIra: true,
        grossDistribution: 25000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: 'G',
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(25000);
    expect(out.taxable).toBe(0);
  });

  it('does NOT default to gross for a code-H Roth-to-Roth direct rollover IRA', () => {
    const items = [
      mkRet({
        isIra: true,
        grossDistribution: 15000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: 'H',
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(15000);
    expect(out.taxable).toBe(0);
  });

  it('does NOT default to gross for a non-IRA row (401(k)/pension Box 2a is authoritative)', () => {
    const items = [
      mkRet({
        isIra: false,
        grossDistribution: 12000,
        taxableAmount: 0, // payer really did determine it is $0 taxable
        taxableAmountNotDetermined: true,
        distributionCode: '7',
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(12000);
    expect(out.taxable).toBe(0);
  });

  it('does NOT override a nonzero Box 2a even if Box 2b is checked (preserves Form 8606 basis)', () => {
    const items = [
      mkRet({
        isIra: true,
        grossDistribution: 10000,
        taxableAmount: 6000, // user/Form 8606 already reduced for basis
        taxableAmountNotDetermined: true,
        distributionCode: '7',
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(10000);
    expect(out.taxable).toBe(6000);
  });

  it('leaves taxable at 0 when Box 2b is NOT checked (no default triggered)', () => {
    const items = [
      mkRet({
        isIra: true,
        grossDistribution: 8000,
        taxableAmount: 0,
        taxableAmountNotDetermined: false,
        distributionCode: '7',
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(8000);
    expect(out.taxable).toBe(0);
  });

  it('sums multiple rows correctly: IRA w/ Box 2b + 401(k) + rollover', () => {
    const items = [
      mkRet({
        id: 'a',
        isIra: true,
        grossDistribution: 10000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: '7',
        federalWithheld: 1000,
      }),
      mkRet({
        id: 'b',
        isIra: false,
        grossDistribution: 20000,
        taxableAmount: 18000,
        distributionCode: '7',
        federalWithheld: 2000,
      }),
      mkRet({
        id: 'c',
        isIra: true,
        grossDistribution: 5000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: 'G', // rollover — stays at 0
      }),
    ];
    const out = sumRetirementIncome(items);
    expect(out.gross).toBe(35000);
    expect(out.taxable).toBe(28000); // 10000 + 18000 + 0
    expect(out.withheld).toBe(3000);
  });
});

describe('computeCapitalLossCarryforward (§1212(b) / Pub 550)', () => {
  it('carries forward a pure short-term loss when there are no current gains (Pub 550 worksheet example)', () => {
    // User entered a $10,000 prior-year ST loss carryforward; no current
    // activity. Caller subtracts the prior-year carryforward from current ST,
    // so stForCapLoss = 0 - 10000 = -10000. Single filer → $3,000 allowed;
    // $7,000 carries forward as short-term.
    const out = computeCapitalLossCarryforward(-10000, 0, 'single', 3000);
    expect(out.allowedDeduction).toBe(-3000);
    expect(out.shortTermCarryforward).toBe(7000);
    expect(out.longTermCarryforward).toBe(0);
    expect(out.totalCarryforward).toBe(7000);
  });

  it('splits carryforward by character with a mix of ST and LT losses plus partial current gains', () => {
    // Scenario: current ST gain $1,000 absorbs part of prior ST loss $4,000 →
    // net ST = -3,000. Current LT loss of $4,000 (unmitigated) → net LT = -4,000.
    // Combined = -7,000. Single filer cap = $3,000.
    // Pub 550 order: ST loss absorbs deduction first ($3k of ST loss used
    // against ordinary income), leaving ST carry = 0 and LT carry = 4,000.
    const out = computeCapitalLossCarryforward(-3000, -4000, 'single', 3000);
    expect(out.allowedDeduction).toBe(-3000);
    expect(out.shortTermCarryforward).toBe(0);
    expect(out.longTermCarryforward).toBe(4000);
    expect(out.totalCarryforward).toBe(4000);
  });

  it('carries ST remainder when ST loss alone exceeds the cap and LT is a gain', () => {
    // Scenario: ST loss $10,000; LT gain $2,000. Cross-netting: LT gain
    // absorbs $2,000 of ST loss → ST remaining = $8,000, LT remaining = 0.
    // Cap $3,000 consumed by ST → ST carry = $5,000.
    const out = computeCapitalLossCarryforward(-10000, 2000, 'single', 3000);
    expect(out.allowedDeduction).toBe(-3000);
    expect(out.shortTermCarryforward).toBe(5000);
    expect(out.longTermCarryforward).toBe(0);
  });

  it('caps at $1,500 for MFS and carries the remainder', () => {
    // Pure ST loss of $5,000, MFS filer → $1,500 allowed, $3,500 carries.
    const out = computeCapitalLossCarryforward(-5000, 0, 'mfs', 3000);
    expect(out.allowedDeduction).toBe(-1500);
    expect(out.shortTermCarryforward).toBe(3500);
    expect(out.longTermCarryforward).toBe(0);
    expect(out.totalCarryforward).toBe(3500);
  });

  it('produces no carryforward on a net gain', () => {
    // Net gain → no §1211(b) deduction and no §1212(b) carryforward.
    const out = computeCapitalLossCarryforward(2000, 5000, 'single', 3000);
    expect(out.allowedDeduction).toBe(0);
    expect(out.shortTermCarryforward).toBe(0);
    expect(out.longTermCarryforward).toBe(0);
    expect(out.totalCarryforward).toBe(0);
  });

  it('produces no carryforward on a small combined loss fully within the cap', () => {
    // Combined loss $1,500 is below $3,000 cap → fully allowed, nothing
    // carries forward.
    const out = computeCapitalLossCarryforward(-500, -1000, 'single', 3000);
    expect(out.allowedDeduction).toBe(-1500);
    expect(out.shortTermCarryforward).toBe(0);
    expect(out.longTermCarryforward).toBe(0);
  });

  it('handles a pure long-term loss: deduction absorbs LT loss, remainder carries as LT', () => {
    // No ST activity; LT loss of $8,000. Single cap $3,000.
    // ST has nothing to absorb; deduction skips to LT → LT carry $5,000.
    const out = computeCapitalLossCarryforward(0, -8000, 'single', 3000);
    expect(out.allowedDeduction).toBe(-3000);
    expect(out.shortTermCarryforward).toBe(0);
    expect(out.longTermCarryforward).toBe(5000);
  });
});

// ----- Unit tests for small sum/* helpers that were only exercised
// transitively through the orchestrator, so some `|| 0` / conditional
// branches never fired. -----

function w2(p: Partial<W2Income> = {}): W2Income {
  return {
    id: p.id ?? 'w1',
    employer: p.employer ?? null,
    ein: p.ein ?? null,
    box1Wages: p.box1Wages ?? 0,
    box2FedWithheld: p.box2FedWithheld ?? 0,
    box3SsWages: p.box3SsWages ?? 0,
    box4SsWithheld: p.box4SsWithheld ?? 0,
    box5MedicareWages: p.box5MedicareWages ?? 0,
    box6MedicareWithheld: p.box6MedicareWithheld ?? 0,
    stateWages: p.stateWages ?? 0,
    stateWithheld: p.stateWithheld ?? 0,
    ...p,
  };
}

describe('sumW2Wages / sumW2SsWages', () => {
  it('empty list sums to 0', () => {
    expect(sumW2Wages([])).toBe(0);
    expect(sumW2SsWages([])).toBe(0);
  });

  it('sums box1Wages across rows', () => {
    expect(sumW2Wages([w2({ box1Wages: 50000 }), w2({ box1Wages: 20000 })])).toBe(70000);
  });

  it('falls back to 0 when box1Wages is non-numeric', () => {
    // Number(undefined) is NaN → `|| 0` fires the 0-branch.
    expect(
      sumW2Wages([w2({ box1Wages: undefined as unknown as number }), w2({ box1Wages: 40000 })]),
    ).toBe(40000);
  });

  it('sums box3SsWages across rows', () => {
    expect(
      sumW2SsWages([
        w2({ box3SsWages: 10000 }),
        w2({ box3SsWages: undefined as unknown as number }),
      ]),
    ).toBe(10000);
  });
});

describe('sumInterest / sumTaxExemptInterest / sumPrivateActivityBondInterest', () => {
  const mkInt = (p: Partial<InterestIncome>): InterestIncome => ({
    id: 'i', payer: null, amount: 0, taxExempt: false, privateActivityBondInterest: 0, ...p,
  });

  it('sumInterest excludes tax-exempt rows', () => {
    expect(
      sumInterest([
        mkInt({ amount: 100, taxExempt: false }),
        mkInt({ amount: 50, taxExempt: true }),
      ]),
    ).toBe(100);
  });

  it('sumTaxExemptInterest sums ONLY tax-exempt rows', () => {
    expect(
      sumTaxExemptInterest([
        mkInt({ amount: 100, taxExempt: false }),
        mkInt({ amount: 50, taxExempt: true }),
        mkInt({ amount: 25, taxExempt: true }),
      ]),
    ).toBe(75);
  });

  it('sumPrivateActivityBondInterest clamps negatives to 0', () => {
    expect(
      sumPrivateActivityBondInterest([
        mkInt({ privateActivityBondInterest: 100 }),
        mkInt({ privateActivityBondInterest: -50 as unknown as number }),
      ]),
    ).toBe(100);
  });

  it('sumInterest with non-numeric amount falls back to 0', () => {
    expect(
      sumInterest([
        mkInt({ amount: undefined as unknown as number, taxExempt: false }),
        mkInt({ amount: 40, taxExempt: false }),
      ]),
    ).toBe(40);
  });
});

describe('sumDividends', () => {
  const mkDiv = (p: Partial<DividendIncome>): DividendIncome => ({
    id: 'd', payer: null, ordinary: 0, qualified: 0, totalCapGainDistributions: 0,
    unrecapSection1250Gain: 0, section1202Gain: 0, ...p,
  });

  it('clamps qualified > ordinary down to ordinary', () => {
    // Bad 1099-DIV data: Box 1b > Box 1a. Clamp so preferential bucket is ≤ 1a.
    const r = sumDividends([mkDiv({ ordinary: 500, qualified: 800 })]);
    expect(r.ordinary).toBe(500);
    expect(r.qualified).toBe(500);
  });

  it('negative totalCapGainDistributions clamps to 0', () => {
    const r = sumDividends([
      mkDiv({ ordinary: 100, totalCapGainDistributions: -5 as unknown as number }),
    ]);
    expect(r.totalCapGainDistributions).toBe(0);
  });

  it('sums across multiple rows', () => {
    const r = sumDividends([
      mkDiv({ ordinary: 200, qualified: 150, totalCapGainDistributions: 30 }),
      mkDiv({ ordinary: 100, qualified: 50, totalCapGainDistributions: 10 }),
    ]);
    expect(r.ordinary).toBe(300);
    expect(r.qualified).toBe(200);
    expect(r.totalCapGainDistributions).toBe(40);
  });
});

describe('schedCNetProfit / totalSeNetProfit', () => {
  const mkSe = (p: Partial<SelfEmployment>): SelfEmployment => ({
    id: 's', businessName: null, ein: null, principalActivity: null,
    grossReceipts: 0, returnsAllowances: 0, costOfGoods: 0, expenses: {}, ...p,
  });

  it('computes gross − returns − cogs − expenses', () => {
    expect(
      schedCNetProfit(mkSe({
        grossReceipts: 100000,
        returnsAllowances: 5000,
        costOfGoods: 30000,
        expenses: { rent: 12000, advertising: 3000 },
      })),
    ).toBe(100000 - 5000 - 30000 - 15000);
  });

  it('treats non-numeric expense values as 0', () => {
    expect(
      schedCNetProfit(mkSe({
        grossReceipts: 50000,
        expenses: { misc: 'nope' as unknown as number, rent: 10000 },
      })),
    ).toBe(40000);
  });

  it('totalSeNetProfit sums across rows', () => {
    expect(
      totalSeNetProfit([
        mkSe({ grossReceipts: 50000, expenses: { rent: 10000 } }),
        mkSe({ grossReceipts: 20000 }),
      ]),
    ).toBe(40000 + 20000);
  });
});

describe('sumRetirementIncome distribution-code branches', () => {
  const mkRet2 = (p: Partial<RetirementIncome>): RetirementIncome => ({
    id: 'r', payer: null, grossDistribution: 0, taxableAmount: 0,
    federalWithheld: 0, stateWithheld: 0, distributionCode: null,
    isIra: false, isRoth: false, exceptionCode: null,
    taxableAmountNotDetermined: false, ...p,
  });

  it('IRA + taxableAmountNotDetermined + code G (rollover) → taxable stays 0', () => {
    // §402(c) direct rollover — not taxable even though "not determined" flag set.
    const r = sumRetirementIncome([
      mkRet2({
        isIra: true,
        grossDistribution: 10000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: 'G',
      }),
    ]);
    expect(r.taxable).toBe(0);
    expect(r.gross).toBe(10000);
  });

  it('IRA + taxableAmountNotDetermined + code H (Roth-to-Roth) → taxable stays 0', () => {
    const r = sumRetirementIncome([
      mkRet2({
        isIra: true,
        grossDistribution: 5000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: 'H',
      }),
    ]);
    expect(r.taxable).toBe(0);
  });

  it('IRA + taxableAmountNotDetermined + code "7" (normal) → taxable defaults to gross', () => {
    const r = sumRetirementIncome([
      mkRet2({
        isIra: true,
        grossDistribution: 8000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
        distributionCode: '7',
      }),
    ]);
    expect(r.taxable).toBe(8000);
  });

  it('non-IRA row leaves stored taxableAmount alone regardless of flag', () => {
    // 401(k)/pension payers DO know the taxable amount — Box 2a wins.
    const r = sumRetirementIncome([
      mkRet2({
        isIra: false,
        grossDistribution: 10000,
        taxableAmount: 6000,
        taxableAmountNotDetermined: true,
      }),
    ]);
    expect(r.taxable).toBe(6000);
  });

  it('aggregates federal + state withholding across rows', () => {
    const r = sumRetirementIncome([
      mkRet2({ federalWithheld: 1000, stateWithheld: 200 }),
      mkRet2({ federalWithheld: 500, stateWithheld: 100 }),
    ]);
    expect(r.withheld).toBe(1500);
    expect(r.stateWithheld).toBe(300);
  });
});

describe('sumUnemployment / sumGambling falsy-value branches', () => {
  const mkU = (p: Partial<UnemploymentIncome>): UnemploymentIncome => ({
    id: 'u', payer: null, amount: 0, federalWithheld: 0, ...p,
  });
  const mkG = (p: Partial<GamblingWinnings>): GamblingWinnings => ({
    id: 'g', payer: null, winnings: 0, federalWithheld: 0, ...p,
  });

  it('sumUnemployment ignores non-numeric rows', () => {
    expect(
      sumUnemployment([
        mkU({ amount: undefined as unknown as number, federalWithheld: 50 }),
        mkU({ amount: 1000, federalWithheld: 100 }),
      ]).amount,
    ).toBe(1000);
  });

  it('sumGambling ignores non-numeric rows', () => {
    expect(
      sumGambling([
        mkG({ winnings: undefined as unknown as number, federalWithheld: 10 }),
        mkG({ winnings: 500, federalWithheld: 50 }),
      ]).winnings,
    ).toBe(500);
  });
});
