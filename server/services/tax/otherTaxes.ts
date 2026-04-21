import type {
  RetirementIncome,
  SeTaxConstants,
  PenaltyConstants,
  FilingStatus,
  OwnerSpouse,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

// Per-spouse SE earnings + W-2 SS wages already withheld. On MFJ each spouse
// has their own SS wage-base ceiling per IRC §1402(b); Medicare has no cap
// so it is always aggregated.
export interface PerOwnerSeInput {
  owner: OwnerSpouse;
  seEarnings: number;   // gross SE net profit attributed to this owner
  w2SsWages: number;    // box-3 SS wages already collected for this owner
}

// Form 5329 Part I exception codes (01..12). A row with a valid exception code
// avoids the 10% additional tax even if box 7 is '1'.
const VALID_EXCEPTION_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12',
]);

// Box 7 distribution codes that trigger the 10% additional tax when unmitigated.
// '1' = early distribution, no known exception. Other early-with-exception
// codes ('2','3','4') are exempt by definition.
const EARLY_NO_EXCEPTION_CODE = '1';

/**
 * Self-employment tax: 15.3% on 92.35% of SE earnings, split between SS (12.4%
 * up to wage base, reduced by W-2 SS wages already collected) and Medicare
 * (2.9%, no cap). One-half of SE tax is an above-the-line deduction.
 *
 * On MFJ, IRC §1402(b) applies the SS wage-base ceiling to each spouse's
 * own SE earnings, and Schedule SE Part I line 8a reduces that ceiling by
 * each spouse's own W-2 box-3 SS wages. To get correct per-spouse behavior
 * pass a `PerOwnerSeInput[]` (one entry per spouse) along with the filing
 * status. The legacy aggregate signature is preserved for single / HoH /
 * MFS and for callers that don't yet split by owner — on those paths the
 * single ceiling is correct.
 */
export function computeSeTax(
  seEarnings: number,
  w2SsWages: number,
  ssWageBase: number,
  seTaxConstants?: SeTaxConstants
): { seTax: number; seTaxDeduction: number };
export function computeSeTax(
  perOwner: PerOwnerSeInput[],
  filingStatus: FilingStatus,
  ssWageBase: number,
  seTaxConstants?: SeTaxConstants
): { seTax: number; seTaxDeduction: number };
export function computeSeTax(
  seEarningsOrPerOwner: number | PerOwnerSeInput[],
  w2SsWagesOrFilingStatus: number | FilingStatus,
  ssWageBase: number,
  seTaxConstants?: SeTaxConstants
): { seTax: number; seTaxDeduction: number } {
  const ssRate = seTaxConstants?.ssRate ?? 0.124;
  const medicareRate = seTaxConstants?.medicareRate ?? 0.029;
  const incomeFactor = seTaxConstants?.incomeFactor ?? 0.9235;

  // Per-owner overload: array of {owner, seEarnings, w2SsWages}.
  if (Array.isArray(seEarningsOrPerOwner)) {
    const perOwner = seEarningsOrPerOwner;
    const filingStatus = w2SsWagesOrFilingStatus as FilingStatus;

    // Collapse to per-owner totals. On non-MFJ filing statuses, even if
    // the caller passed entries tagged 'spouse' there is no separate
    // ceiling — merge everyone into 'taxpayer'.
    const grouping = new Map<OwnerSpouse, { seEarnings: number; w2SsWages: number }>();
    for (const p of perOwner) {
      const key: OwnerSpouse =
        filingStatus === 'mfj' ? (p.owner ?? 'taxpayer') : 'taxpayer';
      const cur = grouping.get(key) ?? { seEarnings: 0, w2SsWages: 0 };
      cur.seEarnings += Math.max(0, Number(p.seEarnings) || 0);
      cur.w2SsWages += Math.max(0, Number(p.w2SsWages) || 0);
      grouping.set(key, cur);
    }

    let ssPortion = 0;
    let totalNetSe = 0;
    for (const { seEarnings, w2SsWages } of grouping.values()) {
      if (seEarnings <= 0) continue;
      const netSe = seEarnings * incomeFactor;
      totalNetSe += netSe;
      // IRC §1402(b): each spouse has their own SS wage-base ceiling on MFJ.
      // Schedule SE Part I line 8a: ceiling reduced by that spouse's own
      // W-2 box-3 SS wages.
      const ssBaseRemaining = Math.max(0, ssWageBase - w2SsWages);
      ssPortion += Math.min(netSe, ssBaseRemaining) * ssRate;
    }
    // Medicare (2.9%) has no cap and so is always based on total net SE.
    const medicarePortion = totalNetSe * medicareRate;
    const seTax = round(ssPortion + medicarePortion);
    return { seTax, seTaxDeduction: round(seTax / 2) };
  }

  // Legacy aggregate signature: a single SE-earnings total + a single W-2
  // SS-wages total + one ceiling. Correct for non-MFJ (and for MFJ where
  // only one spouse has SE income, once the caller passes that spouse's
  // own W-2 SS wages).
  const seEarnings = seEarningsOrPerOwner;
  const w2SsWages = w2SsWagesOrFilingStatus as number;
  if (seEarnings <= 0) return { seTax: 0, seTaxDeduction: 0 };
  const netSe = seEarnings * incomeFactor;
  const ssBaseRemaining = Math.max(0, ssWageBase - Math.max(0, w2SsWages));
  const ssPortion = Math.min(netSe, ssBaseRemaining) * ssRate;
  const medicarePortion = netSe * medicareRate;
  const seTax = round(ssPortion + medicarePortion);
  return { seTax, seTaxDeduction: round(seTax / 2) };
}

/**
 * Form 5329 Part I: 10% additional tax on early distributions from qualified
 * plans / IRAs. Applies to the taxable amount of any 1099-R row whose box 7
 * distribution code is '1' (early, no known exception) AND that does not carry
 * a valid Form 5329 Part I exception code.
 */
export function computeEarlyWithdrawalPenalty(
  items: RetirementIncome[],
  penalties?: PenaltyConstants
): number {
  const rate = penalties?.earlyWithdrawalRate ?? 0.10;
  let penaltyBase = 0;
  for (const r of items) {
    if (r.distributionCode !== EARLY_NO_EXCEPTION_CODE) continue;
    if (r.exceptionCode && VALID_EXCEPTION_CODES.has(r.exceptionCode)) continue;
    penaltyBase += Math.max(0, Number(r.taxableAmount) || 0);
  }
  return round(penaltyBase * rate);
}
