import { describe, it, expect } from 'vitest';
import { summarizeForm4797 } from './form4797.js';
import type { Form4797Sale } from '../../../shared/types.js';

function sale(s: Partial<Form4797Sale>): Form4797Sale {
  return {
    id: s.id ?? 's1',
    description: s.description ?? null,
    dateAcquired: s.dateAcquired ?? null,
    dateSold: s.dateSold ?? null,
    proceeds: s.proceeds ?? 0,
    costBasis: s.costBasis ?? 0,
    accumulatedDepreciation: s.accumulatedDepreciation ?? 0,
    depreciationRecapture: s.depreciationRecapture ?? 0,
    term: s.term ?? 'long_1231',
  };
}

describe('summarizeForm4797', () => {
  it('net §1231 gain → LTCG, recapture split off as ordinary', () => {
    const r = summarizeForm4797([
      sale({ proceeds: 50000, costBasis: 30000, depreciationRecapture: 5000, term: 'long_1231' }),
    ]);
    expect(r.recapture).toBe(5000);
    expect(r.longTermCapitalGain).toBe(15000);  // 20000 gain - 5000 recapture
    expect(r.ordinaryLoss).toBe(0);
  });

  it('net §1231 loss → ordinary loss', () => {
    const r = summarizeForm4797([
      sale({ proceeds: 10000, costBasis: 40000, term: 'long_1231' }),
    ]);
    expect(r.ordinaryLoss).toBe(-30000);
    expect(r.longTermCapitalGain).toBe(0);
  });

  it('short_ordinary rows flow as shortOrdinaryGain', () => {
    const r = summarizeForm4797([
      sale({ proceeds: 8000, costBasis: 5000, term: 'short_ordinary' }),
    ]);
    expect(r.shortOrdinaryGain).toBe(3000);
    expect(r.longTermCapitalGain).toBe(0);
    expect(r.ordinaryLoss).toBe(0);
  });

  it('loss sale ignores depreciationRecapture input (§1245(a)(1): recapture only on gain)', () => {
    // $10k proceeds - $40k basis = -$30k loss. Any recapture input must be
    // ignored; the full $30k loss flows to §1231 → ordinary loss.
    const r = summarizeForm4797([
      sale({
        proceeds: 10000,
        costBasis: 40000,
        depreciationRecapture: 8000,
        term: 'long_1231',
      }),
    ]);
    expect(r.recapture).toBe(0);
    expect(r.ordinaryLoss).toBe(-30000);
    expect(r.longTermCapitalGain).toBe(0);
  });

  it('gain sale caps recapture at gain (§1245(a)(1): lesser of depreciation or gain)', () => {
    // $30k proceeds - $25k basis = $5k gain. User provided $20k recapture
    // (e.g. depreciation taken), but recapture is capped at the $5k gain.
    // §1231 pool contribution is 0 (gain - rec = 0).
    const r = summarizeForm4797([
      sale({
        proceeds: 30000,
        costBasis: 25000,
        depreciationRecapture: 20000,
        term: 'long_1231',
      }),
    ]);
    expect(r.recapture).toBe(5000);
    expect(r.net1231Raw).toBe(0);
    expect(r.longTermCapitalGain).toBe(0);
    expect(r.ordinaryLoss).toBe(0);
    expect(r.recaptured1231AsOrdinary).toBe(0);
  });

  // ----- §1231(c) 5-year lookback -----

  it('§1231(c): no prior-year losses → full current-year gain stays LTCG', () => {
    const r = summarizeForm4797(
      [sale({ proceeds: 50000, costBasis: 30000, term: 'long_1231' })],
      0,
    );
    expect(r.net1231Raw).toBe(20000);
    expect(r.recaptured1231AsOrdinary).toBe(0);
    expect(r.longTermCapitalGain).toBe(20000);
    expect(r.ordinaryLoss).toBe(0);
  });

  it('§1231(c): current-year gain partially recharacterized up to prior-5yr losses', () => {
    // Current net §1231 gain = $20,000; prior-5-year nonrecaptured §1231
    // losses = $8,000. §1231(c) pulls $8,000 of the current gain out of
    // LTCG and reports it as ordinary income; the remaining $12,000 stays
    // LTCG on Schedule D.
    const r = summarizeForm4797(
      [sale({ proceeds: 50000, costBasis: 30000, term: 'long_1231' })],
      8000,
    );
    expect(r.net1231Raw).toBe(20000);
    expect(r.recaptured1231AsOrdinary).toBe(8000);
    expect(r.longTermCapitalGain).toBe(12000);
    expect(r.ordinaryLoss).toBe(0);
  });

  it('§1231(c): prior-5yr losses exceed current gain → entire gain is ordinary', () => {
    // Current net §1231 gain = $5,000; prior-5-year nonrecaptured §1231
    // losses = $12,000. §1231(c) recharacterizes the entire $5,000 as
    // ordinary; no LTCG. (Unabsorbed $7,000 of prior losses remain for the
    // caller to carry to the next year.)
    const r = summarizeForm4797(
      [sale({ proceeds: 35000, costBasis: 30000, term: 'long_1231' })],
      12000,
    );
    expect(r.net1231Raw).toBe(5000);
    expect(r.recaptured1231AsOrdinary).toBe(5000);
    expect(r.longTermCapitalGain).toBe(0);
    expect(r.ordinaryLoss).toBe(0);
  });

  it('§1231(c): current-year LOSS is NOT subject to the lookback', () => {
    // §1231(c)(1) only recaptures when current-year net §1231 is a GAIN.
    // Current-year losses always flow as ordinary loss regardless of history.
    const r = summarizeForm4797(
      [sale({ proceeds: 10000, costBasis: 40000, term: 'long_1231' })],
      100000, // irrelevant — current year is a loss
    );
    expect(r.net1231Raw).toBe(-30000);
    expect(r.recaptured1231AsOrdinary).toBe(0);
    expect(r.longTermCapitalGain).toBe(0);
    expect(r.ordinaryLoss).toBe(-30000);
  });

  it('§1231(c): negative priorYear input is clamped to zero (defensive)', () => {
    const r = summarizeForm4797(
      [sale({ proceeds: 50000, costBasis: 30000, term: 'long_1231' })],
      -99999,
    );
    expect(r.recaptured1231AsOrdinary).toBe(0);
    expect(r.longTermCapitalGain).toBe(20000);
  });
});
