import type { K1Income } from '../../../shared/types.js';

export interface K1PassiveEntry {
  id: string;
  net: number;
  priorYearUnallowedLoss: number;
}

export interface K1Aggregate {
  // Non-passive business/rental income flows straight to AGI.
  nonPassiveOrdinary: number;
  // Passive business/rental income/loss is subject to Form 8582.
  passiveEntries: K1PassiveEntry[];
  // Portfolio items flow straight through (never passive-limited).
  interest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  royalties: number;
  shortTermGain: number;
  longTermGain: number;
  section1231Gain: number;
}

/**
 * Aggregate K-1 line items.
 *   - "business/rental" lines (boxes 1-3 on 1065/1120-S) are pooled into
 *     either the non-passive bucket or a per-K1 passive entry.
 *   - Portfolio + capital-gain items always flow straight through.
 */
export function aggregateK1s(items: K1Income[]): K1Aggregate {
  let nonPassiveOrdinary = 0;
  const passiveEntries: K1PassiveEntry[] = [];
  let interest = 0;
  let ordinaryDividends = 0;
  let qualifiedDividends = 0;
  let royalties = 0;
  let shortTermGain = 0;
  let longTermGain = 0;
  let section1231Gain = 0;

  for (const k of items) {
    const businessNet =
      k.ordinaryBusinessIncome +
      k.netRentalRealEstate +
      k.otherRentalIncome;
    if (k.isPassive) {
      passiveEntries.push({
        id: k.id,
        net: businessNet,
        priorYearUnallowedLoss: k.priorYearUnallowedLoss,
      });
    } else {
      nonPassiveOrdinary += businessNet;
    }
    interest += k.interestIncome;
    ordinaryDividends += k.ordinaryDividends;
    qualifiedDividends += k.qualifiedDividends;
    royalties += k.royalties;
    shortTermGain += k.shortTermCapitalGain;
    longTermGain += k.longTermCapitalGain;
    section1231Gain += k.section1231Gain;
  }

  return {
    nonPassiveOrdinary,
    passiveEntries,
    interest,
    ordinaryDividends,
    qualifiedDividends,
    royalties,
    shortTermGain,
    longTermGain,
    section1231Gain,
  };
}
