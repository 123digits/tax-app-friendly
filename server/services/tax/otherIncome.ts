import type { OtherIncome } from '../../../shared/types.js';

/**
 * Sum Schedule 1 line 8 "other income" entries (1099-MISC box 3, jury duty,
 * taxable scholarships, hobby income, alimony received from pre-2019 divorces,
 * and generic "other"). All sources flow at face value; there is no
 * source-specific exclusion at this stage.
 */
export function sumOtherIncome(items: OtherIncome[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0);
}
