import { describe, it, expect } from 'vitest';
import { sumOtherIncome } from './otherIncome.js';
import type { OtherIncome } from '../../../shared/types.js';

function item(partial: Partial<OtherIncome>): OtherIncome {
  return {
    id: partial.id ?? 'x',
    source: partial.source ?? 'other',
    description: partial.description ?? null,
    amount: partial.amount ?? 0,
  };
}

describe('otherIncome', () => {
  it('empty list returns zero', () => {
    expect(sumOtherIncome([])).toBe(0);
  });

  it('sums multiple entries across sources', () => {
    const items = [
      item({ id: '1', source: 'jury_duty', amount: 100 }),
      item({ id: '2', source: 'hobby', amount: 250 }),
      item({ id: '3', source: 'alimony_received', amount: 500 }),
    ];
    expect(sumOtherIncome(items)).toBeCloseTo(850);
  });
});
