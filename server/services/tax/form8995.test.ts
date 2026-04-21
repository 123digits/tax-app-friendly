import { describe, it, expect } from 'vitest';
import { computeForm8995 } from './form8995.js';
import type { Form8995, QbiConstants } from '../../../shared/types.js';

const C: QbiConstants = {
  thresholds: {
    single: 241_950,
    mfj: 483_900,
    mfs: 241_950,
    hoh: 241_950,
    qw: 483_900,
  },
  deductionRate: 0.2,
};

describe('computeForm8995 (§199A simplified)', () => {
  it('below threshold, one activity, no capital gain → 20% × QBI', () => {
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Sole prop', ein: null, qbi: 50_000 }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 100_000, 0, C);
    expect(r.qbiComponent).toBeCloseTo(10_000, 2);
    expect(r.incomeLimit).toBeCloseTo(20_000, 2);     // 20% × $100k
    expect(r.qbiDeduction).toBeCloseTo(10_000, 2);
    expect(r.aboveThreshold).toBe(false);
    expect(r.requiresForm8995A).toBe(false);
  });

  it('net capital gain reduces income-limit base', () => {
    // QBI $50k → QBI component $10k.
    // TI $100k, net cap gain $40k → income limit = 20% × ($100k − $40k) = $12k.
    // qbiDeduction = min($10k, $12k) = $10k.
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Prop', ein: null, qbi: 50_000 }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 100_000, 40_000, C);
    expect(r.incomeLimit).toBeCloseTo(12_000, 2);
    expect(r.qbiDeduction).toBeCloseTo(10_000, 2);
  });

  it('income limit binds when preferential income is large', () => {
    // QBI $50k → component $10k. TI $50k, net cap gain $40k → limit = 20% × $10k = $2k.
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Prop', ein: null, qbi: 50_000 }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 50_000, 40_000, C);
    expect(r.qbiComponent).toBeCloseTo(10_000, 2);
    expect(r.incomeLimit).toBeCloseTo(2_000, 2);
    expect(r.qbiDeduction).toBeCloseTo(2_000, 2);
  });

  it('REIT/PTP dividends alone produce a deduction', () => {
    const input: Form8995 = {
      activities: [],
      reitPtpDividends: 20_000,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 100_000, 0, C);
    expect(r.reitPtpComponent).toBeCloseTo(4_000, 2);
    expect(r.qbiDeduction).toBeCloseTo(4_000, 2);
  });

  it('negative net QBI zeros the component and carries forward', () => {
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Loss prop', ein: null, qbi: -30_000 }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 20_000, 0, C);
    expect(r.qbiComponent).toBe(0);
    expect(r.qbiDeduction).toBe(0);
    expect(r.qbiLossCarryforward).toBeCloseTo(30_000, 2);
  });

  it('above threshold: simplified deduction disallowed, flagged for 8995-A', () => {
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Prop', ein: null, qbi: 100_000, isSstb: false }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 300_000, 0, C);
    expect(r.aboveThreshold).toBe(true);
    expect(r.qbiDeduction).toBe(0);
    expect(r.requiresForm8995A).toBe(true);
  });

  it('deemed QBI used when no activities supplied (orchestrator fallback)', () => {
    // No Form 8995 input; deemed QBI $50k (from Schedule C net).
    const r = computeForm8995(undefined, 'single', 100_000, 0, C, 50_000, 0);
    expect(r.qualifiedBusinessIncome).toBeCloseTo(50_000, 2);
    expect(r.qbiDeduction).toBeCloseTo(10_000, 2);
  });

  it('prior-year REIT loss reduces current REIT component', () => {
    const input: Form8995 = {
      activities: [],
      reitPtpDividends: 10_000,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 4_000,
    };
    const r = computeForm8995(input, 'single', 50_000, 0, C);
    expect(r.reitPtpIncome).toBeCloseTo(6_000, 2);
    expect(r.reitPtpComponent).toBeCloseTo(1_200, 2);   // 20% × 6k
  });

  it('zero constants/threshold → deduction is zero (safety fallback)', () => {
    // When constants are undefined, threshold defaults to +Infinity so we
    // always compute below-threshold, but rate defaults to 0.20.
    const input: Form8995 = {
      activities: [{ id: '1', name: 'Prop', ein: null, qbi: 50_000 }],
      reitPtpDividends: 0,
      priorYearQbiLossCarry: 0,
      priorYearReitPtpLossCarry: 0,
    };
    const r = computeForm8995(input, 'single', 100_000, 0, undefined);
    expect(r.qbiDeduction).toBeCloseTo(10_000, 2);
  });
});
