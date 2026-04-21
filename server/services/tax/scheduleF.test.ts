import { describe, it, expect } from 'vitest';
import { farmNetProfit, totalFarmNetProfit } from './scheduleF.js';
import type { ScheduleFFarm } from '../../../shared/types.js';

function farm(f: Partial<ScheduleFFarm>): ScheduleFFarm {
  return {
    id: f.id ?? 'f1',
    farmName: f.farmName ?? null,
    principalProduct: f.principalProduct ?? null,
    accountingMethod: f.accountingMethod ?? 'cash',
    grossIncome: f.grossIncome ?? 0,
    expenses: f.expenses ?? {},
  };
}

describe('farmNetProfit', () => {
  it('gross minus expenses', () => {
    expect(
      farmNetProfit(farm({ grossIncome: 50000, expenses: { feed: 20000, fuel: 5000 } }))
    ).toBe(25000);
  });

  it('returns negative when expenses exceed gross', () => {
    expect(
      farmNetProfit(farm({ grossIncome: 1000, expenses: { feed: 5000 } }))
    ).toBe(-4000);
  });
});

describe('totalFarmNetProfit', () => {
  it('sums across farms', () => {
    expect(
      totalFarmNetProfit([
        farm({ grossIncome: 10000, expenses: { feed: 2000 } }),
        farm({ grossIncome: 5000, expenses: { fuel: 1000 } }),
      ])
    ).toBe(12000);
  });
});
