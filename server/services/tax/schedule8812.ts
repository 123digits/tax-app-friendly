// Schedule 8812 — Credits for Qualifying Children and Other Dependents.
//
// This module splits the Child Tax Credit (CTC) and the $500 Credit for
// Other Dependents (ODC, §24(h)(4)) into:
//   - the nonrefundable portion (applied against tax liability), and
//   - the refundable portion — the Additional Child Tax Credit (ACTC).
// ODC is nonrefundable only; only unused CTC can flow to ACTC.
//
// Logic per IRC §24 / Schedule 8812:
//   1. Tentative CTC = qualifyingChildren × ctcPerChild.
//   2. Tentative ODC = otherDependents  × odcPerDependent.
//   3. Combined = CTC + ODC.
//   4. §24(b) phase-out applied to the combined amount: reduce by $50 per
//      $1,000 (or fraction) of AGI over the filing-status threshold. Phase-out
//      reduction is allocated to ODC first, then CTC, so the maximum possible
//      CTC survives for ACTC purposes (favorable to taxpayer, matches the
//      form's line ordering).
//   5. Nonrefundable portion = min(combined after phase-out, tax liability
//      before CTC).
//   6. Unused combined = combined after phase-out − nonrefundable absorbed.
//   7. ACTC (refundable) = min of:
//        - Unused combined credit,
//        - qualifyingChildren × refundablePerChild (statutory per-child cap),
//        - 15% × max(0, earned income − $2,500 threshold).
//      Earned income may optionally include nontaxable combat pay by election.

import type {
  Schedule8812Input,
  Dependent,
  FilingStatus,
  ComputedSchedule8812,
  ActcConstants,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface Schedule8812ConstantsSubset {
  ctcPerChild: number;
  ctcPhaseoutStart: Record<FilingStatus, number>;
}

export function computeSchedule8812(
  input: Schedule8812Input | undefined,
  dependents: Dependent[] | undefined,
  filingStatus: FilingStatus,
  agi: number,
  taxLiabilityBeforeCtc: number,
  w2Wages: number,
  seNetEarnings: number,
  constants: Schedule8812ConstantsSubset,
  actcConstants?: ActcConstants,
): ComputedSchedule8812 {
  const refundablePerChild = actcConstants?.refundablePerChild ?? 1700;
  const earnedIncomeThreshold = actcConstants?.earnedIncomeThreshold ?? 2500;
  const phaseInRate = actcConstants?.phaseInRate ?? 0.15;
  const phaseoutPer1000 = actcConstants?.phaseoutPer1000 ?? 50;
  const odcPerDependent = actcConstants?.odcPerDependent ?? 500;

  // Step 1: determine qualifying children (override wins over dependents list).
  const deps = dependents ?? [];
  const override = input?.qualifyingChildrenOverride;
  const autoCount = deps.filter((d) => d.isQualifyingChild).length;
  const qualifyingChildren =
    override != null && override >= 0 ? Math.floor(override) : autoCount;

  // Other dependents = total dependents minus qualifying children, floored at 0.
  // (When the QC count is overridden upward past the dep list, ODC count is 0.)
  const otherDependents = Math.max(0, deps.length - qualifyingChildren);

  // Step 2: tentative credits before phase-out.
  const ctcBeforeLimits = qualifyingChildren * constants.ctcPerChild;
  const odcBeforeLimits = otherDependents * odcPerDependent;
  const combinedBeforeLimits = ctcBeforeLimits + odcBeforeLimits;

  // Step 3: §24(b) phase-out — $50 per $1,000 (or fraction) of AGI over the
  // threshold, applied to the combined credit.
  const threshold = constants.ctcPhaseoutStart[filingStatus];
  const overage = Math.max(0, agi - threshold);
  const phaseoutSteps = Math.ceil(overage / 1000);
  const rawPhaseoutReduction = phaseoutSteps * phaseoutPer1000;
  const phaseoutReduction = Math.min(rawPhaseoutReduction, combinedBeforeLimits);

  const combinedAfterPhaseout = Math.max(0, combinedBeforeLimits - phaseoutReduction);

  // Allocate phase-out reduction to ODC first, then CTC. This preserves as
  // much CTC as possible for the refundable (ACTC) calculation.
  const odcPhaseoutAbsorbed = Math.min(odcBeforeLimits, phaseoutReduction);
  const odcAfterPhaseout = Math.max(0, odcBeforeLimits - odcPhaseoutAbsorbed);
  const ctcPhaseoutAbsorbed = phaseoutReduction - odcPhaseoutAbsorbed;
  const ctcAfterPhaseout = Math.max(0, ctcBeforeLimits - ctcPhaseoutAbsorbed);

  // Step 4: nonrefundable portion absorbs up to tax liability.
  const taxRoom = Math.max(0, taxLiabilityBeforeCtc);
  const nonrefundablePortion = Math.min(combinedAfterPhaseout, taxRoom);

  // Step 5: earned income for the 15% phase-in.
  const w2 = Math.max(0, w2Wages);
  const se = Math.max(0, seNetEarnings);
  const baseEarned = w2 + se;

  let earnedIncome: number;
  if (input?.earnedIncomeOverride != null) {
    earnedIncome = Math.max(0, input.earnedIncomeOverride);
  } else {
    earnedIncome = baseEarned;
  }
  if (input?.includeCombatPay) {
    earnedIncome += Math.max(0, input.combatPayAmount ?? 0);
  }

  // Step 6: refundable ACTC computation. Only CTC (not ODC) can be refundable;
  // the per-child cap enforces that.
  const unusedCombined = Math.max(0, combinedAfterPhaseout - nonrefundablePortion);
  const earnedIncomePhaseIn = Math.max(
    0,
    (earnedIncome - earnedIncomeThreshold) * phaseInRate,
  );
  const perChildCap = qualifyingChildren * refundablePerChild;

  const refundablePortion = Math.max(
    0,
    Math.min(unusedCombined, earnedIncomePhaseIn, perChildCap),
  );

  return {
    qualifyingChildren,
    otherDependents,
    ctcBeforeLimits: round(ctcBeforeLimits),
    odcBeforeLimits: round(odcBeforeLimits),
    combinedBeforeLimits: round(combinedBeforeLimits),
    phaseoutReduction: round(phaseoutReduction),
    ctcAfterPhaseout: round(ctcAfterPhaseout),
    odcAfterPhaseout: round(odcAfterPhaseout),
    combinedAfterPhaseout: round(combinedAfterPhaseout),
    nonrefundablePortion: round(nonrefundablePortion),
    refundablePortion: round(refundablePortion),
    earnedIncomeForPhaseIn: round(earnedIncome),
  };
}
