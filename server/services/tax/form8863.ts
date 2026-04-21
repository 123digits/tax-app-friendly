// Form 8863: Education Credits — American Opportunity Tax Credit (AOTC) and
// Lifetime Learning Credit (LLC).
//
// AOTC is per-student. For each eligible student (first 4 years of post-
// secondary education, at least half-time, no felony drug conviction, and
// fewer than 4 prior AOTC claims), the tentative credit is 100% of the first
// $2,000 of qualified expenses plus 25% of the next $2,000, capped at $2,500
// per student. 40% of the allowed AOTC is refundable (split applied in
// Phase 8); the other 60% is nonrefundable.
//
// LLC is per-return: sum qualified expenses across all LLC students, cap at
// the statutory max ($10,000), then apply the 20% rate for a $2,000 cap.
//
// Both credits phase out by AGI using separate ranges per filing status.

import type {
  Form8863Student,
  EducationConstants,
  FilingStatus,
  PhaseoutRange,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm8863 {
  aotcTentative: number;
  llcTentative: number;
  aotcPhaseoutFactor: number;
  llcPhaseoutFactor: number;
  aotcAllowed: number;
  llcAllowed: number;
  refundablePortion: number;
  nonrefundablePortion: number;
  totalCredit: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function phaseoutFactor(
  agi: number,
  range: PhaseoutRange | undefined,
): number {
  if (!range) return 1;
  const { start, end } = range;
  // MFS-style ineligible status is encoded as start=end=0 in constants.
  if (end <= 0 && start <= 0) return 0;
  if (end <= start) {
    // Degenerate range: treat as cliff at `end`.
    return agi < end ? 1 : 0;
  }
  if (agi <= start) return 1;
  if (agi >= end) return 0;
  return clamp((end - agi) / (end - start), 0, 1);
}

export function aotcTentativeForStudent(
  s: Form8863Student,
  aotcMax: number,
  educationConstants?: EducationConstants,
): number {
  if (s.creditType !== 'aotc') return 0;
  if (!s.isEligibleForAotc) return 0;
  if ((s.priorAotcYears ?? 0) >= 4) return 0;
  const expenses = Math.max(0, Number(s.qualifiedExpenses) || 0);
  // Wave 1 parameterization: §25A tier splits, defaulting to the statutory
  // 100% of first $2,000 + 25% of next $2,000 when constants aren't supplied.
  const firstTier = educationConstants?.aotcFirstTierExpense ?? 2000;
  const firstRate = educationConstants?.aotcFirstTierRate ?? 1.0;
  const secondRate = educationConstants?.aotcSecondTierRate ?? 0.25;
  const firstPart = Math.min(firstTier, expenses) * firstRate;
  const secondPart =
    Math.max(0, Math.min(firstTier, expenses - firstTier)) * secondRate;
  const aotcTentative = firstPart + secondPart;
  return Math.min(aotcTentative, aotcMax);
}

export function computeForm8863(
  students: Form8863Student[] | undefined,
  agi: number,
  filingStatus: FilingStatus,
  constants: EducationConstants | undefined,
): ComputedForm8863 {
  const zero: ComputedForm8863 = {
    aotcTentative: 0,
    llcTentative: 0,
    aotcPhaseoutFactor: 0,
    llcPhaseoutFactor: 0,
    aotcAllowed: 0,
    llcAllowed: 0,
    refundablePortion: 0,
    nonrefundablePortion: 0,
    totalCredit: 0,
  };

  if (!constants) return zero;
  if (!students || students.length === 0) return zero;

  const aotcMax = constants.aotcMax ?? 2500;
  const llcRate = constants.llcRate ?? 0.20;
  const llcMaxExpenses = constants.llcMaxExpenses ?? 10000;
  const refundablePct = constants.aotcRefundablePct ?? 0.40;

  // AOTC: per-student tentative, summed.
  let aotcTentative = 0;
  for (const s of students) {
    aotcTentative += aotcTentativeForStudent(s, aotcMax, constants);
  }

  // LLC: pooled qualified expenses across all LLC students.
  let llcExpenses = 0;
  for (const s of students) {
    if (s.creditType === 'llc') {
      llcExpenses += Math.max(0, Number(s.qualifiedExpenses) || 0);
    }
  }
  const llcTentative = Math.min(llcExpenses, llcMaxExpenses) * llcRate;

  // Phase-out factors per credit per filing status.
  const aotcRange = constants.aotcPhaseout?.[filingStatus];
  const llcRange = constants.llcPhaseout?.[filingStatus];
  const aotcPhaseoutFactor = phaseoutFactor(agi, aotcRange);
  const llcPhaseoutFactor = phaseoutFactor(agi, llcRange);

  const aotcAllowed = round(aotcTentative * aotcPhaseoutFactor);
  const llcAllowed = round(llcTentative * llcPhaseoutFactor);

  const refundablePortion = round(aotcAllowed * refundablePct);
  const nonrefundablePortion = round(
    aotcAllowed - refundablePortion + llcAllowed,
  );
  const totalCredit = round(aotcAllowed + llcAllowed);

  return {
    aotcTentative: round(aotcTentative),
    llcTentative: round(llcTentative),
    aotcPhaseoutFactor,
    llcPhaseoutFactor,
    aotcAllowed,
    llcAllowed,
    refundablePortion,
    nonrefundablePortion,
    totalCredit,
  };
}
