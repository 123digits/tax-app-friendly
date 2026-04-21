// Form 8606: Traditional IRA basis tracking + pro-rata rule for distributions
// and Roth conversions. When a taxpayer has a mix of pre-tax and after-tax
// (nondeductible) dollars in any traditional IRA, every distribution and
// conversion must treat a proportional slice as nontaxable return of basis.
//
// Pro-rata factor (Form 8606 line 10) =
//   totalBasis / (endOfYearBalance + distributions + conversions)
// where `totalBasis` includes both prior-year carried-forward basis and this
// year's new nondeductible contributions.

import type { Form8606, ComputedForm8606 } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeForm8606(f: Form8606 | undefined): ComputedForm8606 {
  const priorBasis = Math.max(0, Number(f?.priorYearBasis) || 0);
  const currNondeductible = Math.max(0, Number(f?.currentYearNondeductible) || 0);
  const balance = Math.max(0, Number(f?.traditionalIraBalance) || 0);
  const distributions = Math.max(0, Number(f?.distributions) || 0);
  const conversions = Math.max(0, Number(f?.conversions) || 0);

  const totalBasis = priorBasis + currNondeductible;
  // IRS Form 8606 line 10 denominator excludes line 5 (total basis) itself.
  const denom = balance + distributions + conversions;
  const totalValue = totalBasis + denom;

  if (totalValue === 0) {
    return {
      totalBasisAvailable: 0,
      taxableDistribution: 0,
      taxableConversion: 0,
      nontaxablePortion: 0,
      endingBasis: 0,
    };
  }

  // Cap the fraction at 1: if there is no remaining balance (e.g. pure
  // backdoor-Roth where basis == conversion and balance == 0), 100% of the
  // distribution + conversion is return of basis.
  const nontaxableFrac = denom === 0 ? 0 : Math.min(1, totalBasis / denom);
  const nontaxableOfDist = round(distributions * nontaxableFrac);
  const nontaxableOfConv = round(conversions * nontaxableFrac);
  const taxableDistribution = round(distributions - nontaxableOfDist);
  const taxableConversion = round(conversions - nontaxableOfConv);
  const nontaxablePortion = round(nontaxableOfDist + nontaxableOfConv);
  // Ending basis = basis remaining after applying pro-rata to distributions
  // and conversions.
  const endingBasis = round(totalBasis - nontaxablePortion);

  return {
    totalBasisAvailable: round(totalBasis),
    taxableDistribution,
    taxableConversion,
    nontaxablePortion,
    endingBasis,
  };
}
