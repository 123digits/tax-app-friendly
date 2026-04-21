import type { ScheduleFFarm } from '../../../shared/types.js';

/**
 * Net profit/loss for a single farm. Same shape as Schedule C:
 *   grossIncome - sum(expenses).
 */
export function farmNetProfit(f: ScheduleFFarm): number {
  const expTotal = Object.values(f.expenses || {}).reduce(
    (a, v) => a + (Number(v) || 0),
    0
  );
  return (Number(f.grossIncome) || 0) - expTotal;
}

/** Aggregate farm net profit across all Sched F farms. */
export function totalFarmNetProfit(items: ScheduleFFarm[]): number {
  return items.reduce((acc, f) => acc + farmNetProfit(f), 0);
}
