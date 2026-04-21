import type { HomeOfficeExpense, HomeOfficeConstants } from '../../../shared/types.js';

/**
 * Compute home-office deduction for one business. Simplified method caps at
 * $5/sqft × 300 sqft = $1,500. Actual method allocates home expenses by
 * business-use percentage (sqft_business / total_sqft).
 */
export function computeHomeOfficeDeduction(
  h: HomeOfficeExpense,
  constants?: HomeOfficeConstants,
): number {
  const ratePerSqft = constants?.simplifiedRatePerSqft ?? 5;
  const maxSqft = constants?.simplifiedMaxSqft ?? 300;
  const sqft = Math.max(0, Number(h.squareFeet) || 0);
  if (h.useSimplified) {
    const usable = Math.min(sqft, maxSqft);
    return usable * ratePerSqft;
  }
  const total = Math.max(1, Number(h.totalHomeSquareFeet) || 0);
  // Business-use percentage cannot exceed 100% (Form 8829 line 7).
  const pct = Math.min(1, sqft / total);
  const expenses =
    (Number(h.utilities) || 0) +
    (Number(h.insurance) || 0) +
    (Number(h.mortgageInterest) || 0) +
    (Number(h.realEstateTax) || 0) +
    (Number(h.repairs) || 0) +
    (Number(h.depreciation) || 0);
  return expenses * pct;
}

export function totalHomeOfficeDeduction(
  items: HomeOfficeExpense[],
  constants?: HomeOfficeConstants,
): number {
  return items.reduce((acc, h) => acc + computeHomeOfficeDeduction(h, constants), 0);
}
