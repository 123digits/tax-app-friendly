import { describe, it, expect } from 'vitest';
import { computeForm4972 } from './form4972.js';

describe('computeForm4972', () => {
  it('no input → zero', () => {
    expect(computeForm4972(undefined).electedTax).toBe(0);
  });

  it('no lump-sum amount → zero', () => {
    const r = computeForm4972({
      qualifyingLumpSum: 0,
      capitalGainPortion: 0,
      ordinaryPortion: 0,
      computedTax: 5000,
    });
    expect(r.electedTax).toBe(0);
  });

  it('passes computed tax through', () => {
    const r = computeForm4972({
      qualifyingLumpSum: 150000,
      capitalGainPortion: 30000,
      ordinaryPortion: 120000,
      computedTax: 18350,
    });
    expect(r.electedTax).toBe(18350);
  });

  it('no computed tax (not elected) → zero', () => {
    const r = computeForm4972({
      qualifyingLumpSum: 150000,
      capitalGainPortion: 0,
      ordinaryPortion: 150000,
      computedTax: 0,
    });
    expect(r.electedTax).toBe(0);
  });

  it('participantEligible=false → zero regardless of computedTax (§402(e)(4)(B))', () => {
    const r = computeForm4972({
      qualifyingLumpSum: 150000,
      capitalGainPortion: 30000,
      ordinaryPortion: 120000,
      computedTax: 18350,
      participantEligible: false,
    });
    expect(r.electedTax).toBe(0);
  });
});
