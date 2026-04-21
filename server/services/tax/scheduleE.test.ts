import { describe, it, expect } from 'vitest';
import { rentalNetBeforeLimits, sumRoyaltyNet, classifyRentals } from './scheduleE.js';
import type { ScheduleERental, ScheduleERoyalty } from '../../../shared/types.js';

function rental(r: Partial<ScheduleERental>): ScheduleERental {
  return {
    id: r.id ?? 'p1',
    propertyAddress: r.propertyAddress ?? null,
    propertyType: r.propertyType ?? null,
    fairRentalDays: r.fairRentalDays ?? 0,
    personalUseDays: r.personalUseDays ?? 0,
    rentsReceived: r.rentsReceived ?? 0,
    expenses: r.expenses ?? {},
    activeParticipation: r.activeParticipation ?? true,
    isPassive: r.isPassive ?? true,
    priorYearUnallowedLoss: r.priorYearUnallowedLoss ?? 0,
  };
}

describe('rentalNetBeforeLimits', () => {
  it('computes rents minus expenses', () => {
    const r = rental({ rentsReceived: 12000, expenses: { mortgage: 3000, repairs: 1000 } });
    expect(rentalNetBeforeLimits(r)).toBe(8000);
  });
});

describe('sumRoyaltyNet', () => {
  it('sums (gross - expenses) across rows', () => {
    const rows: ScheduleERoyalty[] = [
      { id: 'r1', source: 'Book', grossRoyalties: 5000, expenses: 1000 },
      { id: 'r2', source: 'Oil', grossRoyalties: 3000, expenses: 500 },
    ];
    expect(sumRoyaltyNet(rows)).toBe(6500);
  });
});

describe('classifyRentals', () => {
  it('splits into non-passive, active participation, and other passive buckets', () => {
    const rows: ScheduleERental[] = [
      rental({ id: 'a', isPassive: false, rentsReceived: 1000 }),
      rental({
        id: 'b',
        isPassive: true,
        activeParticipation: true,
        rentsReceived: 1000,
        expenses: { mortgage: 6000 },
      }),
      rental({
        id: 'c',
        isPassive: true,
        activeParticipation: false,
        rentsReceived: 5000,
        expenses: { mortgage: 3000 },
      }),
    ];
    const c = classifyRentals(rows);
    expect(c.nonPassiveNet).toBe(1000);
    expect(c.activeParticipationEntries).toHaveLength(1);
    expect(c.activeParticipationEntries[0]).toMatchObject({ id: 'b', net: -5000 });
    expect(c.otherPassiveEntries).toHaveLength(1);
    expect(c.otherPassiveEntries[0]).toMatchObject({ id: 'c', net: 2000 });
  });
});
