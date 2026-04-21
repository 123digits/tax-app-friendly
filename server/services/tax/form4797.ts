import type { Form4797Sale } from '../../../shared/types.js';

export interface Form4797Summary {
  /** Net §1231 gain (positive) or loss (negative) — before recapture split. */
  net1231Raw: number;
  /**
   * §1231(c) 5-year lookback: portion of current-year net §1231 gain
   * recharacterized as ORDINARY income up to the sum of nonrecaptured net
   * §1231 losses from the preceding 5 tax years. Always ≥ 0.
   *
   * This is reported on Form 4797 Part I line 8 ("Nonrecaptured net §1231
   * losses from prior years") and then flows through line 12 as ordinary
   * gain instead of LTCG on line 7.
   */
  recaptured1231AsOrdinary: number;
  /** Net §1231 gain AFTER §1231(c) recapture → Schedule D LTCG. */
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
 *
 * §1231(c) 5-year lookback: if the current-year pool is a NET GAIN, any
 * "nonrecaptured net §1231 losses" from the preceding 5 tax years
 * recharacterize that gain as ordinary income (up to the prior-loss amount).
 * The excess above the prior-loss amount remains LTCG. This rule does not
 * apply to current-year losses.
 *
 * @param sales                              Form 4797 Part I/II/III rows
 * @param priorYearNonrecaptured1231Losses   Sum of net §1231 losses from the
 *   preceding 5 tax years that have not yet been recaptured (magnitude ≥ 0).
 *   Caller is responsible for tracking prior-year carry.
 */
export function summarizeForm4797(
  sales: Form4797Sale[],
  priorYearNonrecaptured1231Losses: number = 0,
): Form4797Summary {
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

  // §1231(c): only applies when current-year pool is a net gain.
  const priorLoss = Math.max(0, Number(priorYearNonrecaptured1231Losses) || 0);
  let recaptured1231AsOrdinary = 0;
  let longTermCapitalGain = 0;
  let ordinaryLoss = 0;
  if (pool1231 > 0) {
    recaptured1231AsOrdinary = Math.min(pool1231, priorLoss);
    longTermCapitalGain = pool1231 - recaptured1231AsOrdinary;
  } else if (pool1231 < 0) {
    ordinaryLoss = pool1231;
  }

  return {
    net1231Raw: pool1231,
    recaptured1231AsOrdinary,
    longTermCapitalGain,
    ordinaryLoss,
    recapture,
    shortOrdinaryGain,
  };
}
