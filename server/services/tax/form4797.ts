import type { Form4797Sale } from '../../../shared/types.js';

export interface Form4797Summary {
  /** Net §1231 gain (positive) or loss (negative) — before recapture split. */
  net1231Raw: number;
  /** If net §1231 is positive after recapture, treat as LTCG. */
  longTermCapitalGain: number;
  /** If net §1231 is negative, the loss is ordinary. */
  ordinaryLoss: number;
  /** Total depreciation recapture (§1245/1250), always ordinary. */
  recapture: number;
  /** Short-term / non-§1231 ordinary gain (trade or business held ≤ 1 yr). */
  shortOrdinaryGain: number;
}

/**
 * Summarize Form 4797 rows.
 *   - long_1231 rows: combine gain/loss; depreciation recapture is split off
 *     as ordinary. Net of the §1231 pool: positive → LTCG, negative → ord loss.
 *   - short_ordinary rows: flow directly to ordinary income.
 */
export function summarizeForm4797(sales: Form4797Sale[]): Form4797Summary {
  let pool1231 = 0;
  let recapture = 0;
  let shortOrdinaryGain = 0;
  for (const s of sales) {
    const gain =
      (Number(s.proceeds) || 0) - (Number(s.costBasis) || 0);
    if (s.term === 'short_ordinary') {
      shortOrdinaryGain += gain;
      continue;
    }
    // §1245(a)(1)/§1250(a): recapture applies only to a gain sale and is
    // capped at the gain itself. A loss sale generates no recapture — the
    // full loss flows into the §1231 pool.
    const rec =
      gain > 0
        ? Math.min(gain, Math.max(0, Number(s.depreciationRecapture) || 0))
        : 0;
    recapture += rec;
    pool1231 += gain - rec;
  }
  const longTermCapitalGain = pool1231 > 0 ? pool1231 : 0;
  const ordinaryLoss = pool1231 < 0 ? pool1231 : 0;
  return {
    net1231Raw: pool1231,
    longTermCapitalGain,
    ordinaryLoss,
    recapture,
    shortOrdinaryGain,
  };
}
