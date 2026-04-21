// Form 4972 — Tax on Lump-Sum Distributions (IRC §402(d), as preserved
// for participants born before January 2, 1936). Qualifying participants
// may elect 10-year averaging on the ordinary portion and a flat 20%
// capital gains rate on the pre-1974 portion of a qualifying lump-sum
// distribution.
//
// The averaging worksheet in the IRS instructions is page-long. We accept
// `computedTax` directly from the user (or an upstream worksheet) and
// pass it through. When no lump-sum amount or no computed tax is
// present, we report zero — this means the filer is not electing.

import type {
  Form4972,
  ComputedForm4972,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeForm4972(
  input: Form4972 | undefined,
): ComputedForm4972 {
  if (!input) return { electedTax: 0 };
  // §402(e)(4)(B) eligibility gate: the election is only available to
  // participants born before Jan 2, 1936 (or their beneficiaries). When
  // the caller explicitly flags the participant as ineligible, disallow
  // the election regardless of the user-supplied `computedTax`. When the
  // flag is omitted (undefined), we preserve prior pass-through behavior
  // for backwards compatibility.
  if (input.participantEligible === false) return { electedTax: 0 };
  const lumpSum = Math.max(0, Number(input.qualifyingLumpSum) || 0);
  const computed = Math.max(0, Number(input.computedTax) || 0);
  if (lumpSum <= 0 || computed <= 0) return { electedTax: 0 };
  return { electedTax: round(computed) };
}
