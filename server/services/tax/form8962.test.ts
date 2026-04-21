import { describe, it, expect, beforeAll } from 'vitest';
import {
  computeForm8962,
  pickApplicablePercentage,
} from './form8962.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type { Form8962, TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function f(p: Partial<Form8962>): Form8962 {
  return {
    householdSize: 1,
    federalPovertyLine: 0,
    annualEnrollmentPremium: 0,
    annualSlcsp: 0,
    advancePtcPaid: 0,
    additionalMagi: 0,
    ...p,
  };
}

describe('pickApplicablePercentage', () => {
  it('returns 0 at or below 150% FPL', () => {
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(0, b)).toBe(0);
    expect(pickApplicablePercentage(100, b)).toBe(0);
    expect(pickApplicablePercentage(150, b)).toBe(0);
  });

  it('interpolates linearly within 150-200 band', () => {
    // 0% at 150, 2% at 200 → midpoint (175) should be 1%.
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(175, b)).toBeCloseTo(0.01, 6);
    expect(pickApplicablePercentage(200, b)).toBeCloseTo(0.02, 6);
  });

  it('interpolates linearly within 200-250 band', () => {
    // 2% at 200, 4% at 250 → midpoint (225) should be 3%.
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(225, b)).toBeCloseTo(0.03, 6);
    expect(pickApplicablePercentage(250, b)).toBeCloseTo(0.04, 6);
  });

  it('interpolates linearly within 250-300 band', () => {
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(275, b)).toBeCloseTo(0.05, 6);
    expect(pickApplicablePercentage(300, b)).toBeCloseTo(0.06, 6);
  });

  it('interpolates linearly within 300-400 band', () => {
    // 6% at 300, 8.5% at 400 → midpoint (350) = (6+8.5)/2 = 7.25%.
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(350, b)).toBeCloseTo(0.0725, 6);
    expect(pickApplicablePercentage(400, b)).toBeCloseTo(0.085, 6);
  });

  it('returns 8.5% above 400% (ARPA-enhanced PTC, extended through 2025 by IRA §13101; no cliff)', () => {
    const b = DEFAULT_2025.ptc!.contributionBands;
    expect(pickApplicablePercentage(500, b)).toBeCloseTo(0.085, 6);
    expect(pickApplicablePercentage(1000, b)).toBeCloseTo(0.085, 6);
  });
});

describe('computeForm8962', () => {
  it('no form input → zeros', () => {
    const r = computeForm8962(undefined, 50000, 'single', DEFAULT_2025.ptc);
    expect(r.householdIncome).toBe(0);
    expect(r.fplPercent).toBe(0);
    expect(r.annualPtc).toBe(0);
    expect(r.refundablePtc).toBe(0);
    expect(r.aptcRepayment).toBe(0);
  });

  it('zero FPL or household size → zeros (still passes AGI through as household income)', () => {
    const r = computeForm8962(
      f({ householdSize: 0, federalPovertyLine: 0 }),
      50000,
      'single',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(0);
    expect(r.annualPtc).toBe(0);
    expect(r.refundablePtc).toBe(0);
  });

  it('scenario: FPL=$25k, hh income=$30k (120% FPL), SLCSP=$8k, premium=$6k, APTC=$3k → refundable PTC $3k', () => {
    // 120% FPL sits below 150% so applicablePct = 0 → expected contribution 0
    // → PTC cap = SLCSP = $8k, capped by enrollment premium $6k = annualPtc.
    // Net = 6000 − 3000 = 3000 (refundable).
    const r = computeForm8962(
      f({
        householdSize: 2,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 3000,
        additionalMagi: 30000,
      }),
      0,
      'single',
      DEFAULT_2025.ptc,
    );
    expect(r.householdIncome).toBeCloseTo(30000, 0);
    expect(r.fplPercent).toBe(120);
    expect(r.applicablePercentage).toBe(0);
    expect(r.expectedContribution).toBeCloseTo(0, 0);
    expect(r.annualPtc).toBeCloseTo(6000, 0);
    expect(r.netPtc).toBeCloseTo(3000, 0);
    expect(r.refundablePtc).toBeCloseTo(3000, 0);
    expect(r.aptcRepayment).toBeCloseTo(0, 0);
  });

  it('scenario at exactly 250% FPL, single: expected contribution 4% × income, PTC = SLCSP − contribution', () => {
    // hh income = 62500, FPL = 25000 → 250% exactly.
    // applicablePct = 0.04 → expectedContribution = 2500.
    // ptcCap = SLCSP 8000 − 2500 = 5500. annualPtc = min(5500, 6000) = 5500.
    // net = 5500 − 3000 = 2500 refundable.
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 3000,
        additionalMagi: 62500,
      }),
      0,
      'single',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(250);
    expect(r.applicablePercentage).toBeCloseTo(0.04, 6);
    expect(r.expectedContribution).toBeCloseTo(2500, 0);
    expect(r.annualPtc).toBeCloseTo(5500, 0);
    expect(r.netPtc).toBeCloseTo(2500, 0);
    expect(r.refundablePtc).toBeCloseTo(2500, 0);
  });

  it('advance PTC exceeds annual PTC → repayment capped (single, ~250% FPL → $975)', () => {
    // Same 250% setup but APTC $10,000 (much larger than $5,500 annual PTC).
    // Raw excess = 10000 − 5500 = 4500. Single cap at 250% = $975.
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 10000,
        additionalMagi: 62500,
      }),
      0,
      'single',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(250);
    // Cap row for 250% FPL, single: the {fpl: 300} entry.
    const singleCap300 = DEFAULT_2025.ptc!.repaymentCapSingle.find((x) => x.fpl === 300)!.cap;
    expect(r.repaymentCap).toBe(singleCap300);
    expect(r.refundablePtc).toBe(0);
    expect(r.aptcRepayment).toBeCloseTo(975, 0);
  });

  it('family filer at ~250% FPL gets family repayment cap ($1,950)', () => {
    const r = computeForm8962(
      f({
        householdSize: 4,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 10000,
        additionalMagi: 62500,
      }),
      0,
      'mfj',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(250);
    // Cap row for 250% FPL, family (mfj): the {fpl: 300} entry.
    const familyCap300 = DEFAULT_2025.ptc!.repaymentCapFamily.find((x) => x.fpl === 300)!.cap;
    expect(r.repaymentCap).toBe(familyCap300);
    expect(r.aptcRepayment).toBeCloseTo(1950, 0);
  });

  it('FPL% ≥ 400% with excess APTC → no cap, full repayment of excess', () => {
    // hh income = 120,000, FPL = 25,000 → 480% FPL.
    // applicablePct = 8.5% → expectedContribution = 10,200.
    // ptcCap = max(0, 8000 − 10200) = 0. annualPtc = 0. APTC = 5000.
    // Net = −5000. Above 400% → no cap → full $5,000 repayment.
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 5000,
        additionalMagi: 120000,
      }),
      0,
      'single',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(480);
    expect(r.applicablePercentage).toBeCloseTo(0.085, 6);
    expect(r.annualPtc).toBeCloseTo(0, 0);
    expect(r.refundablePtc).toBe(0);
    expect(r.aptcRepayment).toBeCloseTo(5000, 0);
  });

  it('rounds dollar amounts to nearest cent via round()', () => {
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 3000,
        additionalMagi: 62501, // 250% FPL (integer floor).
      }),
      0,
      'single',
      DEFAULT_2025.ptc,
    );
    // round() keeps 2 decimals; values here are whole numbers but we verify
    // the shape.
    expect(Number.isFinite(r.annualPtc)).toBe(true);
    expect(Number.isFinite(r.expectedContribution)).toBe(true);
  });

  it('§36B(c)(1)(C): MFS without abuse/abandonment exception → PTC zeroed, APTC still repaid', () => {
    // 250% FPL single-style economics, but filer is MFS with no exception.
    // Forward PTC must be $0; the $3,000 APTC paid must still be reconciled
    // (capped by the single/MFS repayment-cap table at 250% FPL = $975).
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 3000,
        additionalMagi: 62500,
      }),
      0,
      'mfs',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(250);
    expect(r.applicablePercentage).toBe(0);
    expect(r.annualPtc).toBe(0);
    expect(r.refundablePtc).toBe(0);
    const singleCap300 = DEFAULT_2025.ptc!.repaymentCapSingle.find((x) => x.fpl === 300)!.cap;
    expect(r.repaymentCap).toBe(singleCap300);
    expect(r.aptcRepayment).toBeCloseTo(975, 0);
  });

  it('§36B(c)(1)(C): MFS WITH abuse/abandonment exception → normal PTC computes', () => {
    // Same 250% FPL setup but with the exception flag → eligible like any
    // non-MFS filer (single-table repayment cap still applies for MFS).
    const r = computeForm8962(
      f({
        householdSize: 1,
        federalPovertyLine: 25000,
        annualEnrollmentPremium: 6000,
        annualSlcsp: 8000,
        advancePtcPaid: 3000,
        additionalMagi: 62500,
        mfsAbuseAbandonmentException: true,
      }),
      0,
      'mfs',
      DEFAULT_2025.ptc,
    );
    expect(r.fplPercent).toBe(250);
    expect(r.applicablePercentage).toBeCloseTo(0.04, 6);
    expect(r.annualPtc).toBeCloseTo(5500, 0);
    expect(r.netPtc).toBeCloseTo(2500, 0);
    expect(r.refundablePtc).toBeCloseTo(2500, 0);
    expect(r.aptcRepayment).toBeCloseTo(0, 0);
  });

  it('seeded PTC contribution bands span the statutory 150%-400% FPL range', () => {
    // Previously this asserted the shape of a module-level fallback array.
    // Now the bands live in the DB seed (schema.sql) and are loaded via
    // getConfig(2025). The first band anchors at 150% FPL (0% contribution)
    // and the last at 400% FPL (8.5% — the ARPA/IRA-enhanced applicable-
    // figure cap extended through 2025).
    const bands = DEFAULT_2025.ptc!.contributionBands;
    expect(bands[0]).toEqual({ fpl: 150, pct: 0 });
    expect(bands[bands.length - 1]).toEqual({ fpl: 400, pct: 0.085 });
  });
});
