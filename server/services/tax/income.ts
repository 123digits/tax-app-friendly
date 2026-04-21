import type {
  W2Income,
  InterestIncome,
  DividendIncome,
  SelfEmployment,
  CapitalGain,
  RetirementIncome,
  UnemploymentIncome,
  GamblingWinnings,
  FilingStatus,
} from '../../../shared/types.js';

export function sumW2Wages(w2s: W2Income[]): number {
  return w2s.reduce((acc, w) => acc + (Number(w.box1Wages) || 0), 0);
}

export function sumW2SsWages(w2s: W2Income[]): number {
  return w2s.reduce((acc, w) => acc + (Number(w.box3SsWages) || 0), 0);
}

/** Sum of taxable interest (excludes rows flagged as tax-exempt). */
export function sumInterest(items: InterestIncome[]): number {
  return items.reduce(
    (acc, i) => acc + (i.taxExempt ? 0 : Number(i.amount) || 0),
    0,
  );
}

/** Sum of tax-exempt interest (added to SS provisional income per §86(b)(2)). */
export function sumTaxExemptInterest(items: InterestIncome[]): number {
  return items.reduce(
    (acc, i) => acc + (i.taxExempt ? Number(i.amount) || 0 : 0),
    0,
  );
}

/**
 * Sum of specified private-activity-bond interest (§57(a)(5)) — an AMT
 * preference item on Form 6251 line 2g. Non-PAB tax-exempt interest is
 * excluded from AMTI. Reported in 1099-INT Box 9.
 */
export function sumPrivateActivityBondInterest(items: InterestIncome[]): number {
  return items.reduce(
    (acc, i) => acc + Math.max(0, Number(i.privateActivityBondInterest) || 0),
    0,
  );
}

export function sumDividends(items: DividendIncome[]): {
  ordinary: number;
  qualified: number;
  totalCapGainDistributions: number;
} {
  let ordinary = 0;
  let qualified = 0;
  let totalCapGainDistributions = 0;
  for (const d of items) {
    const rowOrdinary = Number(d.ordinary) || 0;
    const rowQualified = Number(d.qualified) || 0;
    // 1099-DIV Box 1b (qualified dividends) must not exceed Box 1a (ordinary
    // dividends). Clamp per row so bad data can't inflate the preferential-
    // rate bucket. See Form 1099-DIV instructions.
    const clampedQualified = Math.min(Math.max(0, rowQualified), Math.max(0, rowOrdinary));
    ordinary += rowOrdinary;
    qualified += clampedQualified;
    // 1099-DIV Box 2a: total capital gain distributions (from RICs/REITs).
    // Never negative. Flows to Schedule D line 13 (or 1040 line 7 directly
    // when no Schedule D is required) and qualifies for LTCG preferential
    // rates. Boxes 2b (unrecap §1250) and 2c (§1202) are informational
    // subsets of 2a and do not add to the aggregate here.
    totalCapGainDistributions += Math.max(0, Number(d.totalCapGainDistributions) || 0);
  }
  return { ordinary, qualified, totalCapGainDistributions };
}

export function schedCNetProfit(se: SelfEmployment): number {
  const gross = (Number(se.grossReceipts) || 0) - (Number(se.returnsAllowances) || 0);
  const cogs = Number(se.costOfGoods) || 0;
  const grossProfit = gross - cogs;
  const expenseTotal = Object.values(se.expenses || {}).reduce(
    (a, v) => a + (Number(v) || 0),
    0
  );
  return grossProfit - expenseTotal;
}

export function totalSeNetProfit(items: SelfEmployment[]): number {
  return items.reduce((acc, se) => acc + schedCNetProfit(se), 0);
}

/**
 * Aggregate 1099-R retirement distributions. Gross feeds 1040 line 4a/5a;
 * taxable feeds 4b/5b. Federal + state withholding feed the payments section.
 *
 * Per the IRS 2024 Instructions for Forms 1099-R and 5498, IRA payers are
 * generally required to check Box 2b ("Taxable amount not determined") and
 * leave Box 2a blank because they cannot know the owner's basis. For a
 * traditional IRA (non-rollover) the distribution is fully taxable unless the
 * taxpayer reports basis on Form 8606 (Part I). We therefore default taxable
 * to gross when: the row is flagged as an IRA, Box 2a is blank/zero, Box 2b
 * is checked, and the distribution code is NOT a direct rollover ('G') or a
 * Roth-to-Roth direct rollover ('H') -- those are nontaxable by regulation.
 * Non-IRA rows are left untouched because 401(k)/pension payers do know the
 * taxable amount and Box 2a is authoritative for them.
 */
export function sumRetirementIncome(items: RetirementIncome[]): {
  gross: number;
  taxable: number;
  withheld: number;
  stateWithheld: number;
} {
  let gross = 0;
  let taxable = 0;
  let withheld = 0;
  let stateWithheld = 0;
  for (const r of items) {
    const rowGross = Number(r.grossDistribution) || 0;
    const storedTaxable = Number(r.taxableAmount) || 0;
    const code = (r.distributionCode ?? '').trim().toUpperCase();
    const isRollover = code === 'G' || code === 'H';
    const shouldDefaultToGross =
      r.isIra === true &&
      storedTaxable === 0 &&
      r.taxableAmountNotDetermined === true &&
      !isRollover;
    const rowTaxable = shouldDefaultToGross ? rowGross : storedTaxable;

    gross += rowGross;
    taxable += rowTaxable;
    withheld += Number(r.federalWithheld) || 0;
    stateWithheld += Number(r.stateWithheld) || 0;
  }
  return { gross, taxable, withheld, stateWithheld };
}

export function sumUnemployment(items: UnemploymentIncome[]): {
  amount: number;
  withheld: number;
} {
  let amount = 0;
  let withheld = 0;
  for (const u of items) {
    amount += Number(u.amount) || 0;
    withheld += Number(u.federalWithheld) || 0;
  }
  return { amount, withheld };
}

export function sumGambling(items: GamblingWinnings[]): {
  winnings: number;
  withheld: number;
} {
  let winnings = 0;
  let withheld = 0;
  for (const g of items) {
    winnings += Number(g.winnings) || 0;
    withheld += Number(g.federalWithheld) || 0;
  }
  return { winnings, withheld };
}

export function splitCapitalGains(items: CapitalGain[]): { short: number; long: number } {
  let short = 0;
  let long = 0;
  for (const c of items) {
    let gain = (Number(c.proceeds) || 0) - (Number(c.costBasis) || 0);
    // Form 8949 column (g) wash-sale adjustment (code "W") per IRC §1091.
    // A wash-sale disallowance can only reduce a loss (never increase a gain
    // or turn a loss into a gain), and is capped at the magnitude of the loss.
    const wash = Math.max(0, Number(c.washSaleLossDisallowed) || 0);
    if (gain < 0 && wash > 0) {
      gain += Math.min(-gain, wash);
    }
    if (c.term === 'short') short += gain;
    else long += gain;
  }
  return { short, long };
}

/**
 * Schedule B (Form 1040) is required when taxable interest > $1,500 OR
 * ordinary dividends > $1,500. Per §6012 and Schedule B instructions, other
 * triggers exist (foreign accounts, seller-financed mortgage, nominee
 * distributions, etc.) that are not evaluated at this layer.
 */
export function isScheduleBRequired(
  totalInterest: number,
  totalOrdinaryDividends: number,
  threshold: number = 1500,
): boolean {
  return (
    (Number(totalInterest) || 0) > threshold ||
    (Number(totalOrdinaryDividends) || 0) > threshold
  );
}

/**
 * Apply the IRC §1211(b) annual capital-loss deduction cap against ordinary
 * income: $3,000 for most filers, $1,500 for married filing separately.
 * `baseLimit` is the statutory default for non-MFS (usually $3,000 from
 * TaxYearConstants.capitalLossLimit).
 *
 * Returns the signed capital-loss deduction (≤ 0). If netCapital ≥ 0, returns 0
 * (callers handle the gain path separately).
 */
export function applyCapitalLossCap(
  netCapital: number,
  filingStatus: FilingStatus,
  baseLimit: number = 3000,
): number {
  if (netCapital >= 0) return 0;
  const limit = filingStatus === 'mfs' ? baseLimit / 2 : baseLimit;
  return Math.max(netCapital, -limit);
}

/**
 * IRC §1212(b) / IRS Pub 550 "Capital Loss Carryover Worksheet":
 * when the combined net capital loss exceeds the §1211(b) annual cap, the
 * disallowed portion carries forward to the next tax year, preserving
 * character (short-term vs long-term).
 *
 * Algorithm (Pub 550 worksheet, simplified):
 *   1. Net short-term position = shortNet (ST gains − ST losses; signed).
 *   2. Net long-term position  = longNet  (LT gains − LT losses; signed).
 *   3. Combined net = shortNet + longNet.
 *   4. If combined net ≥ 0 → no carryforward.
 *   5. Allowed deduction this year = min(|combined net|, cap).
 *   6. Total disallowed loss = |combined net| − allowed deduction.
 *   7. Split disallowed loss by character per the worksheet:
 *        - ST carryover = max(0, -shortNet) reduced by the portion of the
 *          allowed deduction that ST loss "absorbs". Short-term loss is used
 *          FIRST to offset long-term gain and then the §1211(b) deduction.
 *        - LT carryover = max(0, -longNet) reduced by whatever the deduction
 *          pool has left after short-term consumes it.
 *
 * Returns positive magnitudes of carryforward (0 if no carryforward).
 * `allowedDeduction` is returned as a signed number (≤ 0), matching the
 * convention of `applyCapitalLossCap`.
 */
export function computeCapitalLossCarryforward(
  shortNet: number,
  longNet: number,
  filingStatus: FilingStatus,
  baseLimit: number = 3000,
): {
  allowedDeduction: number;          // signed (≤ 0)
  shortTermCarryforward: number;     // positive magnitude
  longTermCarryforward: number;      // positive magnitude
  totalCarryforward: number;         // positive magnitude
} {
  const combined = shortNet + longNet;
  if (combined >= 0) {
    return {
      allowedDeduction: 0,
      shortTermCarryforward: 0,
      longTermCarryforward: 0,
      totalCarryforward: 0,
    };
  }
  const cap = filingStatus === 'mfs' ? baseLimit / 2 : baseLimit;
  const allowedMag = Math.min(-combined, cap);               // positive
  const allowedDeduction = -allowedMag;                      // signed ≤ 0

  // Pub 550 worksheet: short-term loss is applied first. The amount of the
  // §1211(b) deduction that the short-term loss "uses up" is:
  //   stLossAfterNetting = max(0, -shortNet) but reduced by any LT gain that
  //   already offset it. Because `shortNet` already reflects ST gains vs ST
  //   losses, and `longNet` reflects LT gains vs LT losses, the only cross-
  //   character netting that happens BEFORE the deduction is:
  //     if shortNet < 0 and longNet > 0: LT gain absorbs part of ST loss.
  //     if longNet  < 0 and shortNet > 0: ST gain absorbs part of LT loss.
  //   After that cross-netting, whichever side is still a loss contributes
  //   to the §1211(b) deduction pool in character order (ST then LT).
  let stLossRemaining = Math.max(0, -shortNet);
  let ltLossRemaining = Math.max(0, -longNet);
  const stGainRemaining = Math.max(0, shortNet);
  const ltGainRemaining = Math.max(0, longNet);

  // Cross-character netting: gains on one side reduce losses on the other.
  const ltAbsorbsSt = Math.min(stLossRemaining, ltGainRemaining);
  stLossRemaining -= ltAbsorbsSt;
  const stAbsorbsLt = Math.min(ltLossRemaining, stGainRemaining);
  ltLossRemaining -= stAbsorbsLt;

  // Short-term loss absorbs the deduction first, then long-term.
  const stAbsorbedByDed = Math.min(stLossRemaining, allowedMag);
  const remainingDed = allowedMag - stAbsorbedByDed;
  const ltAbsorbedByDed = Math.min(ltLossRemaining, remainingDed);

  const stCarry = Math.max(0, stLossRemaining - stAbsorbedByDed);
  const ltCarry = Math.max(0, ltLossRemaining - ltAbsorbedByDed);

  return {
    allowedDeduction,
    shortTermCarryforward: stCarry,
    longTermCarryforward: ltCarry,
    totalCarryforward: stCarry + ltCarry,
  };
}
