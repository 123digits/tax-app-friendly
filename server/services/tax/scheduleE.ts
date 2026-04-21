import type { ScheduleERental, ScheduleERoyalty } from '../../../shared/types.js';

/**
 * Net profit/loss for a single rental property BEFORE passive-loss limits.
 * = rentsReceived - sum(expenses). Prior-year unallowed loss is NOT applied
 * here; it is consumed by applyPassiveLossLimits in passiveLoss.ts.
 */
export function rentalNetBeforeLimits(r: ScheduleERental): number {
  const rents = Number(r.rentsReceived) || 0;
  const exp = Object.values(r.expenses || {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0
  );
  return rents - exp;
}

/**
 * Aggregate royalty net income. Royalties are portfolio income (never passive).
 */
export function sumRoyaltyNet(items: ScheduleERoyalty[]): number {
  return items.reduce(
    (acc, r) => acc + (Number(r.grossRoyalties) || 0) - (Number(r.expenses) || 0),
    0
  );
}

export interface RentalEntry {
  id: string;
  net: number;
  priorYearUnallowedLoss: number;
}

export interface RentalClassification {
  nonPassiveNet: number;
  activeParticipationEntries: RentalEntry[];
  otherPassiveEntries: RentalEntry[];
}

/**
 * Split rentals into three buckets for Form 8582 processing.
 *   - Non-passive (real-estate-professional): flows directly to AGI.
 *   - Active-participation + passive: pool A, eligible for the $25k
 *     special allowance.
 *   - Other passive: pool B, only allowed to the extent of passive income.
 */
export function classifyRentals(items: ScheduleERental[]): RentalClassification {
  let nonPassiveNet = 0;
  const activeParticipationEntries: RentalEntry[] = [];
  const otherPassiveEntries: RentalEntry[] = [];
  for (const r of items) {
    const net = rentalNetBeforeLimits(r);
    if (!r.isPassive) {
      nonPassiveNet += net;
      continue;
    }
    const entry: RentalEntry = {
      id: r.id,
      net,
      priorYearUnallowedLoss: Number(r.priorYearUnallowedLoss) || 0,
    };
    if (r.activeParticipation) activeParticipationEntries.push(entry);
    else otherPassiveEntries.push(entry);
  }
  return { nonPassiveNet, activeParticipationEntries, otherPassiveEntries };
}
