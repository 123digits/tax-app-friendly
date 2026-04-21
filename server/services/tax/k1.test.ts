import { describe, it, expect } from 'vitest';
import { aggregateK1s } from './k1.js';
import type { K1Income } from '../../../shared/types.js';

function k1(partial: Partial<K1Income> = {}): K1Income {
  return {
    id: 'k1',
    entityKind: 'partnership',
    entityName: 'LP',
    ein: null,
    isPassive: false,
    ordinaryBusinessIncome: 0,
    netRentalRealEstate: 0,
    otherRentalIncome: 0,
    interestIncome: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    royalties: 0,
    shortTermCapitalGain: 0,
    longTermCapitalGain: 0,
    section1231Gain: 0,
    priorYearUnallowedLoss: 0,
    ...partial,
  };
}

describe('aggregateK1s', () => {
  it('sums portfolio items across all K1s', () => {
    const out = aggregateK1s([
      k1({ interestIncome: 100, ordinaryDividends: 50, qualifiedDividends: 30, royalties: 20 }),
      k1({ interestIncome: 10, shortTermCapitalGain: 5, longTermCapitalGain: 25, section1231Gain: 15 }),
    ]);
    expect(out.interest).toBe(110);
    expect(out.ordinaryDividends).toBe(50);
    expect(out.qualifiedDividends).toBe(30);
    expect(out.royalties).toBe(20);
    expect(out.shortTermGain).toBe(5);
    expect(out.longTermGain).toBe(25);
    expect(out.section1231Gain).toBe(15);
  });

  it('buckets passive vs non-passive business income', () => {
    const out = aggregateK1s([
      k1({ isPassive: false, ordinaryBusinessIncome: 1000 }),
      k1({ id: 'p1', isPassive: true, ordinaryBusinessIncome: 500, netRentalRealEstate: 200, priorYearUnallowedLoss: 50 }),
    ]);
    expect(out.nonPassiveOrdinary).toBe(1000);
    expect(out.passiveEntries).toHaveLength(1);
    expect(out.passiveEntries[0].net).toBe(700);
    expect(out.passiveEntries[0].priorYearUnallowedLoss).toBe(50);
  });

  it('handles empty array', () => {
    const out = aggregateK1s([]);
    expect(out.nonPassiveOrdinary).toBe(0);
    expect(out.passiveEntries).toEqual([]);
    expect(out.interest).toBe(0);
  });

  it('coerces undefined-valued fields to 0', () => {
    const partial = k1({ interestIncome: undefined as unknown as number });
    const out = aggregateK1s([partial]);
    expect(out.interest).toBe(0);
  });
});
