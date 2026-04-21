import type { FilingStatus, Bracket, TaxYearConstants } from '../../../shared/types.js';

export const round = (n: number): number => Math.round(n * 100) / 100;

/** Treat `upTo: null` as unbounded (top bracket). */
function bracketCap(b: Bracket): number {
  return b.upTo == null ? Number.POSITIVE_INFINITY : b.upTo;
}

export function applyBrackets(taxableIncome: number, brackets: Bracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let lastEdge = 0;
  for (const b of brackets) {
    const cap = bracketCap(b);
    const edge = Math.min(taxableIncome, cap);
    if (edge > lastEdge) {
      tax += (edge - lastEdge) * b.rate;
    }
    if (taxableIncome <= cap) break;
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

  let remaining = preferential;
  let ltcgTax = 0;
  const startsAt = ordinary;
  const zeroRoom = Math.max(0, ltcg.zeroUpTo - startsAt);
  const inZero = Math.min(remaining, zeroRoom);
  remaining -= inZero;
  if (remaining > 0) {
    const topOfFifteen = ltcg.fifteenUpTo;
    const fifteenRoom = Math.max(0, topOfFifteen - Math.max(startsAt + inZero, ltcg.zeroUpTo));
    const inFifteen = Math.min(remaining, fifteenRoom);
    ltcgTax += inFifteen * 0.15;
    remaining -= inFifteen;
  }
  if (remaining > 0) {
    ltcgTax += remaining * 0.20;
  }
  return { regularTax: round(regularTax), ltcgTax: round(ltcgTax) };
}
