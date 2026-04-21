import type { ItemizedDeductions, FilingStatus } from '../../../shared/types.js';
import { round } from './taxComputation.js';

// IRC §170(b)(1) AGI limits for charitable contributions.
// 60% of AGI for cash gifts to public charities (§170(b)(1)(G)).
// 30% of AGI for long-term appreciated capital-gain property to public
// charities (§170(b)(1)(C)). We conservatively treat all `charitableNoncash`
// as appreciated LTCG property. 5-year carryforward of excess (§170(d)(1))
// is intentionally not modeled here.
const CHARITABLE_CASH_AGI_LIMIT = 0.6;
const CHARITABLE_NONCASH_AGI_LIMIT = 0.3;

// IRC §164(b)(6)(B): SALT cap is halved for MFS filers ($5,000 vs $10,000).
function saltCapFor(filingStatus: FilingStatus, baseCap: number): number {
  return filingStatus === 'mfs' ? baseCap / 2 : baseCap;
}

export function sumItemized(
  it: ItemizedDeductions,
  agi: number,
  saltCap: number,
  medicalThreshold: number,
  filingStatus: FilingStatus = 'single'
): number {
  const safeAgi = Math.max(0, agi);

  // §213(a): medical expenses deductible only above 7.5% of AGI.
  const medicalAllowed = Math.max(
    0,
    (Number(it.medical) || 0) - medicalThreshold * safeAgi
  );

  // §164(b)(6): SALT cap ($10k / $5k MFS) applied to sum of state/local
  // income (or sales) tax + real estate tax.
  const saltUncapped = (Number(it.stateLocalTax) || 0) + (Number(it.realEstateTax) || 0);
  const effectiveSaltCap = saltCapFor(filingStatus, saltCap);
  const salt = Math.min(effectiveSaltCap, saltUncapped);

  const mortgage = Number(it.mortgageInterest) || 0;

  // §170(b)(1): charitable contributions capped by AGI percentage.
  const cashGift = Number(it.charitableCash) || 0;
  const noncashGift = Number(it.charitableNoncash) || 0;
  const cashAllowed = Math.min(cashGift, CHARITABLE_CASH_AGI_LIMIT * safeAgi);
  const noncashAllowed = Math.min(noncashGift, CHARITABLE_NONCASH_AGI_LIMIT * safeAgi);
  const charity = cashAllowed + noncashAllowed;

  return round(medicalAllowed + salt + mortgage + charity);
}
