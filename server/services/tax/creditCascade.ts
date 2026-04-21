// IRC §26(a) — Ordered nonrefundable-credit cascade.
//
// §26(a) limits the aggregate of nonrefundable credits to the taxpayer's
// "regular tax liability" (1040 line 16 + Schedule 2 Part I). The IRS applies
// credits in the order listed on Schedule 3 Part I (FTC, dependent care,
// education, saver's, residential clean energy 5a, energy efficient 5b,
// mortgage interest 6c, elderly/disabled 6d, clean vehicle 6f). The
// nonrefundable CTC/ODC is computed separately on Schedule 8812 — its
// nonrefundable portion lands on 1040 line 19 and the disallowed excess
// spills to refundable ACTC on line 28.
//
// When credits in aggregate exceed that tax ceiling, §26(a) does NOT specify
// pro-rata reduction — it applies them in order until liability is absorbed,
// and any residual credit is lost (except refundable portions: AOTC 40%,
// ACTC via Schedule 8812, PTC, EITC — those are handled separately).
//
// This helper is pure: caller supplies the credits in the correct order, and
// it returns both the per-credit allowed amounts and the remaining liability
// (which callers pass to Schedule 8812 so the nonrefundable-CTC portion gets
// clipped to what's left, with the disallowed portion spilling to the
// refundable ACTC per §24(h)(5) / §24(k)).

export interface CreditItem {
  /** Stable key for breakdown output (e.g. 'foreignTaxCredit'). */
  name: string;
  /** Nonnegative credit amount after the credit's own phase-outs / caps. */
  amount: number;
}

export interface CascadeResult {
  /** Per-credit allowed amount, keyed by CreditItem.name. */
  allowedByCredit: Record<string, number>;
  /** Sum of all allowed amounts. */
  totalAllowed: number;
  /** Tax liability remaining after the cascade, ≥ 0. */
  remainingLiability: number;
}

/**
 * Apply credits one at a time against a declining liability. Credits supplied
 * AFTER liability is absorbed produce `allowedByCredit[name] === 0`.
 *
 * `initialLiability` is the §26(a) anchor: regular income tax + Schedule 2
 * Part I items (AMT + excess APTC repayment). Part II items are NOT included
 * and are added back AFTER this cascade.
 */
export function applyCreditsInOrder(
  initialLiability: number,
  credits: CreditItem[],
): CascadeResult {
  let remaining = Math.max(0, Number(initialLiability) || 0);
  const allowedByCredit: Record<string, number> = {};
  let totalAllowed = 0;
  for (const c of credits) {
    const amt = Math.max(0, Number(c.amount) || 0);
    const used = Math.min(remaining, amt);
    allowedByCredit[c.name] = used;
    remaining -= used;
    totalAllowed += used;
  }
  return {
    allowedByCredit,
    totalAllowed,
    remainingLiability: remaining,
  };
}
