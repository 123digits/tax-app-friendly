// Form 2555 — Foreign Earned Income Exclusion (IRC §911).
//
// A U.S. taxpayer who is a bona-fide resident of a foreign country for an
// uninterrupted period that includes an entire tax year, OR who is
// physically present in a foreign country or countries for at least 330
// full days during any 12 consecutive months, may exclude foreign earned
// income up to `exclusionLimit` and, in addition, a portion of foreign
// housing costs that exceed a "base housing amount" (16% of the
// exclusion) up to a "housing cap" (simplified here as 30% of the
// exclusion; the IRS publishes location-specific higher caps).
//
// Simplification: the exclusion is pro-rated by qualifying days /
// days-in-period. We do not attempt to distinguish "employer-provided"
// vs "self-employed" housing deduction handling — both reduce AGI here.

import type {
  Form2555,
  FeieConstants,
  ComputedForm2555,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

function zeros(): ComputedForm2555 {
  return {
    foreignEarnedIncome: 0,
    exclusionAllowed: 0,
    housingBase: 0,
    housingCap: 0,
    housingExclusion: 0,
    totalExclusion: 0,
  };
}

export function computeForm2555(
  input: Form2555 | undefined,
  constants: FeieConstants | undefined,
): ComputedForm2555 {
  if (!input || !constants) return zeros();

  // Taxpayer must qualify under bona fide residence OR physical presence.
  const qualifies = Boolean(input.isBonaFideResident || input.usesPhysicalPresence);
  if (!qualifies) return zeros();

  const fei = Math.max(0, Number(input.foreignEarnedIncome) || 0);
  const qDays = Math.max(0, Math.min(366, Number(input.qualifyingDays) || 0));
  const totalDays = Math.max(1, Number(input.totalDaysInPeriod) || 365);
  const fraction = Math.min(1, qDays / totalDays);

  const exclusionAllowed = Math.max(
    0,
    Math.min(fei, constants.exclusionLimit * fraction),
  );

  const housingBase = constants.housingBasePct * constants.exclusionLimit * fraction;
  const housingCap = constants.housingCapPct * constants.exclusionLimit * fraction;
  const housingExpenses = Math.max(0, Number(input.housingExpenses) || 0);
  const housingExclusion = Math.max(
    0,
    Math.min(housingCap, housingExpenses) - housingBase,
  );

  // §911(d)(6): total exclusions (income + housing) cannot exceed the
  // taxpayer's foreign earned income for the year.
  const totalExclusion = Math.min(fei, exclusionAllowed + housingExclusion);

  return {
    foreignEarnedIncome: round(fei),
    exclusionAllowed: round(exclusionAllowed),
    housingBase: round(housingBase),
    housingCap: round(housingCap),
    housingExclusion: round(housingExclusion),
    totalExclusion: round(totalExclusion),
  };
}
