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
  });
});
