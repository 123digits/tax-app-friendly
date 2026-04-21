// Form 8995 — Qualified Business Income Deduction (Simplified Computation).
//
// IRC §199A authorizes a 20% deduction against "qualified business income"
// (QBI) for pass-through entities, sole proprietors, and §199A(e)(3) REIT
// dividends / §199A(j) qualified PTP income. This module implements the
// simplified method that applies when taxable income (before the QBI
// deduction) is at or below the §199A(e) threshold:
//
//   • ≤ threshold: Form 8995 simplified — no SSTB exclusion, no W-2 wage
//     limit, no UBIA limit. Just 20% × net QBI + 20% × (REIT + PTP income),
//     capped by 20% × (taxable income − net capital gain).
//
//   • > threshold: Form 8995-A is required. §199A(b)(2) phases in W-2-wage
//     and UBIA limits; §199A(d)(3) phases out the deduction entirely for
//     SSTB (law, health, consulting, accounting, actuarial science,
//     performing arts, athletics, financial services, brokerage services,
//     investment management, trading, dealing in securities, etc.). This
//     module returns `requiresForm8995A: true` and `qbiDeduction: 0` in
//     that regime so the caller can flag it for the user.
//
// Loss netting per §199A(c)(2)/(c)(4):
//   - Net QBI combines positive + negative QBI across all activities. If
//     the combined amount is negative, the QBI component is 0 and the
//     loss carries forward to next year (reducing next year's QBI).
//   - REIT/PTP income is netted separately; a negative combined amount
//     zeros the REIT/PTP component and carries forward.
//
// Income limit per §199A(a)(1)(B):
//   - The deduction is capped at 20% × (taxable income before QBI −
//     net capital gain). Net capital gain per §1(h) = net LTCG + qualified
//     dividends. This module takes `netCapitalGain` as a pre-computed input
//     so the orchestrator can thread in the exact Schedule D / §1(h) value.

import type {
  Form8995,
  ComputedForm8995,
  QbiConstants,
  FilingStatus,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

function nn(n: number | null | undefined): number {
  return Math.max(0, Number(n) || 0);
}

/**
 * Compute the §199A QBI deduction (simplified method, Form 8995).
 *
 * `taxableIncomeBeforeQbi` is 1040 line 11 minus line 12 (standard or
 * itemized) — i.e. taxable income before the QBI deduction itself. The
 * income limit uses this value.
 *
 * `netCapitalGain` is net LTCG + qualified dividends (§1(h) definition),
 * floored at zero. Passed in so the orchestrator can supply the exact
 * preferential-rate amount already computed for Schedule D / 1040 line 7.
 *
 * `deemedQbi` is a fallback QBI amount when `input.activities` is empty
 * or undefined — lets the orchestrator use Schedule C/F net profit +
 * passive rental + qualified K-1 ordinary income as a reasonable default
 * so taxpayers without Form 8995 input still receive a deduction.
 */
export function computeForm8995(
  input: Form8995 | undefined,
  filingStatus: FilingStatus,
  taxableIncomeBeforeQbi: number,
  netCapitalGain: number,
  constants: QbiConstants | undefined,
  deemedQbi = 0,
  deemedReitPtpDividends = 0,
): ComputedForm8995 {
  const rate = constants?.deductionRate ?? 0.20;
  const threshold = constants?.thresholds?.[filingStatus] ?? Number.POSITIVE_INFINITY;
  const aboveThreshold = taxableIncomeBeforeQbi > threshold;

  const activities = input?.activities ?? [];
  const activityQbi = activities.reduce((a, x) => a + (Number(x.qbi) || 0), 0);
  // Use deemedQbi as fallback only when activities not explicitly provided.
  const rawQbi = activities.length > 0 ? activityQbi : deemedQbi;
  // §199A(c)(2): prior-year negative QBI carryforward reduces current QBI.
  const priorQbiLoss = nn(input?.priorYearQbiLossCarry);
  const netQbi = rawQbi - priorQbiLoss;

  const inputReit = Number(input?.reitPtpDividends) || 0;
  const reitPtpDividends = inputReit > 0 ? inputReit : Math.max(0, deemedReitPtpDividends);
  const priorReitLoss = nn(input?.priorYearReitPtpLossCarry);
  const netReitPtp = reitPtpDividends - priorReitLoss;

  // Has any SSTB activity — used to flag 8995-A requirement above threshold.
  const hasSstb = activities.some((a) => a.isSstb === true);

  // Components (20% × positive portions)
  const qbiComponent = aboveThreshold ? 0 : round(rate * Math.max(0, netQbi));
  const reitPtpComponent = aboveThreshold ? 0 : round(rate * Math.max(0, netReitPtp));
  const combinedComponent = round(qbiComponent + reitPtpComponent);

  // Income limit: 20% × (taxable income − net capital gain)
  const ncg = Math.max(0, Number(netCapitalGain) || 0);
  const tiBeforeQbi = Math.max(0, Number(taxableIncomeBeforeQbi) || 0);
  const incomeLimit = aboveThreshold ? 0 : round(rate * Math.max(0, tiBeforeQbi - ncg));

  const qbiDeduction = Math.min(combinedComponent, incomeLimit);

  // Carryforward (positive magnitude) — only the NEGATIVE portion of net
  // QBI/REIT carries forward per §199A(c)(2).
  const qbiLossCarryforward = Math.max(0, -netQbi);
  const reitPtpLossCarryforward = Math.max(0, -netReitPtp);

  return {
    qualifiedBusinessIncome: round(netQbi),
    reitPtpIncome: round(netReitPtp),
    qbiComponent,
    reitPtpComponent,
    combinedComponent,
    taxableIncomeBeforeQbi: round(tiBeforeQbi),
    netCapitalGain: round(ncg),
    incomeLimit,
    qbiDeduction: round(qbiDeduction),
    qbiLossCarryforward: round(qbiLossCarryforward),
    reitPtpLossCarryforward: round(reitPtpLossCarryforward),
    aboveThreshold,
    requiresForm8995A: aboveThreshold && (hasSstb || activities.length > 0),
  };
}
