import type { FilingStatus, Bracket, TaxYearConstants } from '../../../shared/types.js';

export const round = (n: number): number => Math.round(n * 100) / 100;

/** Treat `upTo: null` as unbounded (top bracket). */
function bracketCap(b: Bracket): number {
  return b.upTo == null ? Number.POSITIVE_INFINITY : b.upTo;
}

export function applyBrackets(taxableIncome: number, brackets: Bracket[]): number {
  const ti = Math.max(0, taxableIncome);
  let tax = 0;
  let lastEdge = 0;
  for (const b of brackets) {
    const cap = bracketCap(b);
    const edge = Math.min(ti, cap);
    tax += Math.max(0, edge - lastEdge) * b.rate;
    if (ti <= cap) break;
    lastEdge = cap;
  }
  return round(tax);
}

export function computeIncomeTax(
  taxableIncome: number,
  netLtcgAndQualDiv: number,
  filingStatus: FilingStatus,
  constants: TaxYearConstants
): { regularTax: number; ltcgTax: number } {
  const brackets = constants.brackets[filingStatus];
  const ltcg = constants.ltcgBrackets[filingStatus];
  const preferential = Math.max(0, Math.min(netLtcgAndQualDiv, taxableIncome));
  const ordinary = Math.max(0, taxableIncome - preferential);

  const regularTax = applyBrackets(ordinary, brackets);

  // Fill the 0%, 15%, and 20% LTCG brackets in order, stacking on top of
  // ordinary income. Each bracket's `room` clamps non-negative so we can
  // drop the `remaining > 0` guards — zero-width bands simply contribute 0.
  const startsAt = ordinary;
  const zeroRoom = Math.max(0, ltcg.zeroUpTo - startsAt);
  const inZero = Math.min(preferential, zeroRoom);
  const fifteenRoom = Math.max(
    0,
    ltcg.fifteenUpTo - Math.max(startsAt + inZero, ltcg.zeroUpTo),
  );
  const inFifteen = Math.min(Math.max(0, preferential - inZero), fifteenRoom);
  const inTwenty = Math.max(0, preferential - inZero - inFifteen);
  const ltcgTax = inFifteen * 0.15 + inTwenty * 0.20;
  return { regularTax: round(regularTax), ltcgTax: round(ltcgTax) };
}
