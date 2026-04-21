// Phase 6: Schedule 1 Part II adjustments to income (IRS Form 1040 line 10).
// The ½ SE-tax deduction is produced by `computeSeTax` in `otherTaxes.ts` and
// is re-exported from here for historical compatibility. Other adjustment
// lines are capped / phased out per §62 and §221 rules.

import type {
  Schedule1Adjustments,
  FilingStatus,
  EducationConstants,
  RetirementConstants,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export { computeSeTax } from './otherTaxes.js';

export interface ComputedAdjustmentLines {
  educatorExpenses: number;
  selfEmployedHealthInsurance: number;
  sepContribution: number;
  simpleContribution: number;
  solo401kContribution: number;
  traditionalIraDeduction: number;
  studentLoanInterest: number;
  penaltyEarlyWithdrawal: number;
  alimonyPaid: number;
  reservistExpenses: number;
  performingArtistExpenses: number;
  feeBasisExpenses: number;
}

/**
 * Educator expenses capped per taxpayer at `educatorExpenseLimit` (statutorily
 * $300 for 2025). MFJ couples where both spouses are eligible educators get
 * 2× the cap; users who only have one eligible spouse should enter the
 * correct raw amount.
 */
export function cappedEducatorExpenses(
  entered: number,
  fs: FilingStatus,
  edu: EducationConstants | undefined,
): number {
  const base = edu?.educatorExpenseLimit ?? 0;
  const cap = fs === 'mfj' ? base * 2 : base;
  return Math.max(0, Math.min(Number(entered) || 0, cap));
}

/**
 * MAGI for the Student Loan Interest deduction, per IRC §221(b)(2)(C):
 *   MAGI = AGI (before the SLI deduction itself)
 *        + Form 2555 foreign earned income exclusion
 *        + Form 2555 foreign housing exclusion/deduction
 *        + income excluded under §§911, 931, 933 (Puerto Rico / possessions)
 *        + any Schedule 1 "predecessor" adjustment add-backs that are
 *          themselves adjustments to income (but NOT the SLI itself).
 *
 * In practice for the vast majority of returns MAGI collapses to
 *   AGI + FEIE (+ housing exclusion).
 * This helper takes AGI computed BEFORE subtracting SLI and an optional
 * Form 2555 total exclusion, so the caller does not need to thread any
 * further Phase-10 plumbing to get correct behavior today.
 *
 * TODO(Phase 10): when §931/§933 possession-income and any additional
 * Schedule 1 predecessor adjustments become modeled, extend `feie` into
 * a richer `addbacks` bag. The call sites below already pass AGI-before-
 * SLI, so the only missing inputs will be those new addbacks.
 */
export function computeStudentLoanInterestMagi(
  agiBeforeSli: number,
  feie: number = 0,
): number {
  return (Number(agiBeforeSli) || 0) + Math.max(0, Number(feie) || 0);
}

/**
 * Student loan interest deduction (§221): capped at `studentLoanInterestLimit`
 * ($2,500) and phased out linearly over the MAGI range for the filing status.
 *
 * Per §221(b)(2)(C), MAGI is AGI computed WITHOUT this deduction, plus the
 * Form 2555 foreign earned income exclusion and housing exclusion (and a
 * handful of possession-income add-backs not yet modeled). Callers pass
 * `agi` = AGI computed before SLI, and the optional `feie` total exclusion.
 */
export function phasedStudentLoanInterest(
  entered: number,
  agi: number,
  fs: FilingStatus,
  edu: EducationConstants | undefined,
  feie: number = 0,
): number {
  if (!edu) return 0;
  const cap = edu.studentLoanInterestLimit ?? 0;
  const raw = Math.max(0, Math.min(Number(entered) || 0, cap));
  const range = edu.studentLoanInterestPhaseout?.[fs];
  if (!range || range.end <= range.start) return raw;
  const magi = computeStudentLoanInterestMagi(agi, feie);
  if (magi <= range.start) return raw;
  if (magi >= range.end) return 0;
  const frac = (range.end - magi) / (range.end - range.start);
  return round(raw * frac);
}

/**
 * Traditional IRA deduction capped at statutory annual limit (+catch-up if
 * age 50+). Phase-out based on participation in an employer plan is NOT
 * modeled here; users are trusted to enter only their deductible portion
 * and route the rest to Form 8606 as a nondeductible contribution.
 */
export function cappedIraDeduction(
  entered: number,
  age: number | null,
  ret: RetirementConstants | undefined,
): number {
  if (!ret) return Math.max(0, Number(entered) || 0);
  const base = ret.iraLimit ?? 0;
  const catchUp = age != null && age >= (ret.catchUpAge ?? 50) ? (ret.iraCatchUp ?? 0) : 0;
  const cap = base + catchUp;
  return Math.max(0, Math.min(Number(entered) || 0, cap));
}

/**
 * Compute all Schedule 1 Part II adjustment lines with their caps/phase-outs
 * applied. HSA deduction is NOT here — it is computed by Form 8889 and
 * merged by the orchestrator.
 */
export function computeSchedule1Adjustments(
  adj: Schedule1Adjustments,
  agi: number,
  fs: FilingStatus,
  age: number | null,
  retirement: RetirementConstants | undefined,
  education: EducationConstants | undefined,
  feie: number = 0,
): ComputedAdjustmentLines {
  return {
    educatorExpenses: cappedEducatorExpenses(adj.educatorExpenses, fs, education),
    selfEmployedHealthInsurance: Math.max(0, Number(adj.selfEmployedHealthInsurance) || 0),
    sepContribution: Math.max(0, Number(adj.sepContribution) || 0),
    simpleContribution: Math.max(0, Number(adj.simpleContribution) || 0),
    solo401kContribution: Math.max(0, Number(adj.solo401kContribution) || 0),
    traditionalIraDeduction: cappedIraDeduction(adj.traditionalIraDeduction, age, retirement),
    studentLoanInterest: phasedStudentLoanInterest(adj.studentLoanInterest, agi, fs, education, feie),
    penaltyEarlyWithdrawal: Math.max(0, Number(adj.penaltyEarlyWithdrawal) || 0),
    alimonyPaid: Math.max(0, Number(adj.alimonyPaid) || 0),
    reservistExpenses: Math.max(0, Number(adj.reservistExpenses) || 0),
    performingArtistExpenses: Math.max(0, Number(adj.performingArtistExpenses) || 0),
    feeBasisExpenses: Math.max(0, Number(adj.feeBasisExpenses) || 0),
  };
}

/**
 * Sum of all Schedule 1 Part II lines — excludes the HSA deduction (merged
 * separately) and the ½-SE-tax deduction (merged separately).
 */
export function totalSchedule1Adjustments(lines: ComputedAdjustmentLines): number {
  return (
    lines.educatorExpenses +
    lines.selfEmployedHealthInsurance +
    lines.sepContribution +
    lines.simpleContribution +
    lines.solo401kContribution +
    lines.traditionalIraDeduction +
    lines.studentLoanInterest +
    lines.penaltyEarlyWithdrawal +
    lines.alimonyPaid +
    lines.reservistExpenses +
    lines.performingArtistExpenses +
    lines.feeBasisExpenses
  );
}
