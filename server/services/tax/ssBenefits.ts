import type { FilingStatus, SocialSecurityBenefits } from '../../../shared/types.js';
import type { SsTaxabilityRow } from '../../../shared/types.js';
import { round } from './taxComputation.js';

/**
 * Compute the taxable portion of Social Security benefits under IRC §86
 * (simplified worksheet).
 *
 * @param ss                  The SocialSecurityBenefits row for the return.
 * @param otherAgiComponents  AGI components EXCLUDING taxable SS (i.e. total
 *                            income minus the taxable SS line so far).
 * @param taxExemptInterest   Tax-exempt interest added to provisional income.
 * @param filingStatus        Filing status (used for documentation / future
 *                            MFS-living-with-spouse rules; tier is already
 *                            resolved by the caller).
 * @param tier                The SsTaxabilityRow from
 *                            constants.ssTaxability[filingStatus].
 * @returns                   `{ gross, taxable }` both rounded to the nearest
 *                            cent via `round`.
 */
export function computeTaxableSocialSecurity(
  ss: SocialSecurityBenefits,
  otherAgiComponents: number,
  taxExemptInterest: number,
  filingStatus: FilingStatus,
  tier: SsTaxabilityRow,
): { gross: number; taxable: number } {
  void filingStatus;

  const gross = Number(ss.grossBenefits) || 0;
  if (gross <= 0) {
    return { gross: 0, taxable: 0 };
  }

  const provisional = otherAgiComponents + taxExemptInterest + gross / 2;

  let taxable: number;

  if (provisional <= tier.tier1) {
    taxable = 0;
  } else if (provisional <= tier.tier2) {
    taxable = Math.min(
      gross * tier.tier1Rate,
      (provisional - tier.tier1) * tier.tier1Rate,
    );
  } else {
    const base = Math.min(
      (tier.tier2 - tier.tier1) * tier.tier1Rate,
      gross * tier.tier1Rate,
    );
    taxable = Math.min(
      gross * tier.tier2Rate,
      base + (provisional - tier.tier2) * tier.tier2Rate,
    );
  }

  return { gross: round(gross), taxable: round(Math.max(0, taxable)) };
}

/**
 * Sum of federal income tax withheld from Social Security benefits (SSA-1099
 * box 6). Currently a single row per return, but factored as a function so
 * callers can treat withholding uniformly alongside W-2 / 1099-R sums.
 */
export function sumSsFederalWithheld(ss: SocialSecurityBenefits): number {
  return Number(ss?.federalWithheld) || 0;
}
