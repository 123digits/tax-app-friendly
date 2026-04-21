import type { OtherIncome } from '../../../shared/types.js';

/**
 * Sum Schedule 1 line 8 "other income" entries (1099-MISC box 3, jury duty,
 * taxable scholarships, hobby income, alimony received from pre-2019 divorces,
 * and generic "other"). All sources flow at face value; there is no
 * source-specific exclusion at this stage.
 */
export function sumOtherIncome(items: OtherIncome[]): number {
  return items.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
}

/**
 * Return a breakdown map keyed by source for UI display. Useful if the review
 * page wants to itemize "Alimony received: $X / Jury duty: $Y".
 */
export function otherIncomeBySource(items: OtherIncome[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    const key = i.source || 'other';
    out[key] = (out[key] || 0) + (Number(i.amount) || 0);
  }
  return out;
}
