// Form 8396 — Mortgage Interest Credit (from a Mortgage Credit Certificate).
//
// A state/local housing authority issues an MCC with a certificate credit
// rate. The annual credit equals mortgage interest paid times that rate.
// When the certificate rate is greater than 20%, the current-year credit is
// capped at $2,000. Any amount of credit that could not be used against the
// current year's tax (because of the tax liability limit) carries forward
// up to three years; carryforward accumulation is handled elsewhere (Phase
// 10). This module only computes the current-year credit and the gross
// total (current year + prior year unused) available to claim.

import type { Form8396, MortgageCreditConstants } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm8396 {
  currentYearCredit: number; // interest × rate, capped if rate > 20%
  totalCredit: number;        // currentYearCredit + priorYearUnusedCredit
}

export function computeForm8396(
  f: Form8396 | undefined,
  constants?: MortgageCreditConstants,
): ComputedForm8396 {
  const capHighRate = constants?.capHighRate ?? 2000;
  const highRateThreshold = constants?.highRateThreshold ?? 0.20;

  const rate = Math.max(0, Number(f?.certificateRate) || 0);
  const interest = Math.max(0, Number(f?.mortgageInterestPaid) || 0);
  const priorUnused = Math.max(0, Number(f?.priorYearUnusedCredit) || 0);

  const tentative = interest * rate;
  const currentYearCredit =
    rate > highRateThreshold
      ? Math.min(tentative, capHighRate)
      : tentative;

  const totalCredit = currentYearCredit + priorUnused;

  return {
    currentYearCredit: round(currentYearCredit),
    totalCredit: round(totalCredit),
  };
}
