// Form 8889: HSA contributions, deduction limit, distributions, and 20%
// additional tax on non-qualified distributions.
//
// Deduction limit depends on HDHP coverage (self-only vs family) plus an age
// 55+ catch-up. Contributions above the limit are "excess" and subject to a
// separate 6% excise that is not computed here. Distributions in excess of
// qualified medical expenses are taxable and (unless the taxpayer is over 65
// or disabled) subject to an additional 20% tax (Schedule 2).

import type { Form8889, HsaConstants, PenaltyConstants, ComputedForm8889 } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function hsaContributionLimit(
  coverage: Form8889['coverage'],
  catchUp: boolean,
  constants: HsaConstants | undefined,
): number {
  if (!constants) return 0;
  if (coverage !== 'self' && coverage !== 'family') return 0;
  const base = coverage === 'family' ? constants.familyLimit : constants.selfLimit;
  const cu = catchUp ? constants.catchUp : 0;
  return base + cu;
}

export function computeForm8889(
  f: Form8889 | undefined,
  constants: HsaConstants | undefined,
  penalties?: PenaltyConstants,
): ComputedForm8889 {
  const coverage = f?.coverage ?? 'none';
  const contributions = Math.max(0, Number(f?.contributions) || 0);
  const catchUp = !!f?.isCatchUpEligible;
  const distributions = Math.max(0, Number(f?.distributions) || 0);
  const qualified = Math.max(0, Number(f?.qualifiedMedicalExpenses) || 0);
  const exempt = !!f?.isDisabledOrOver65;

  const contributionLimit = round(hsaContributionLimit(coverage, catchUp, constants));
  const allowedDeduction = round(Math.min(contributions, contributionLimit));
  const excessContribution = round(Math.max(0, contributions - contributionLimit));

  const rate = penalties?.hsaAdditionalTaxRate ?? 0.20;
  const taxableDistribution = round(Math.max(0, distributions - qualified));
  const additionalTax = exempt
    ? 0
    : round(taxableDistribution * rate);

  return {
    contributionLimit,
    allowedDeduction,
    excessContribution,
    taxableDistribution,
    additionalTax,
  };
}
