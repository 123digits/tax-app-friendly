import { describe, it, expect } from 'vitest';
import { computeForm1116 } from './form1116.js';
import type { Form1116Basket } from '../../../shared/types.js';

function b(p: Partial<Form1116Basket>): Form1116Basket {
  return {
    id: p.id ?? 'x',
    category: 'passive',
    country: null,
    foreignGrossIncome: 0,
    definitelyRelatedDeductions: 0,
    foreignTaxPaid: 0,
    ...p,
  };
}

describe('computeForm1116', () => {
  it('no baskets → zero', () => {
    const r = computeForm1116(undefined, 20_000, 100_000);
    expect(r.total).toBe(0);
    expect(r.perBasket).toEqual([]);

    const r2 = computeForm1116([], 20_000, 100_000);
    expect(r2.total).toBe(0);
    expect(r2.perBasket).toEqual([]);
  });

  it('usTax = 0 → zero', () => {
    const r = computeForm1116(
      [b({ foreignGrossIncome: 10_000, foreignTaxPaid: 1_000 })],
      0,
      100_000,
    );
    expect(r.total).toBe(0);
    expect(r.perBasket).toEqual([]);
  });

  it('totalTaxableIncome = 0 → zero', () => {
    const r = computeForm1116(
      [b({ foreignGrossIncome: 10_000, foreignTaxPaid: 1_000 })],
      20_000,
      0,
    );
    expect(r.total).toBe(0);
    expect(r.perBasket).toEqual([]);
  });

  it('single passive basket: credit limited by foreign tax paid (under limitation)', () => {
    // fti = 10_000, limitation = 20_000 × (10_000/100_000) = 2_000
    // foreignTaxPaid = 1_000 → allowedCredit = min(1_000, 2_000) = 1_000
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          definitelyRelatedDeductions: 0,
          foreignTaxPaid: 1_000,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket).toHaveLength(1);
    expect(r.perBasket[0].category).toBe('passive');
    expect(r.perBasket[0].foreignTaxableIncome).toBe(10_000);
    expect(r.perBasket[0].limitation).toBe(2_000);
    expect(r.perBasket[0].allowedCredit).toBe(1_000);
    expect(r.total).toBe(1_000);
  });

  it('foreign tax exceeds limitation → capped at limitation', () => {
    // fti = 10_000, limitation = 2_000, paid = 3_000 → allowed = 2_000
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          foreignTaxPaid: 3_000,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket[0].limitation).toBe(2_000);
    expect(r.perBasket[0].foreignTaxPaid).toBe(3_000);
    expect(r.perBasket[0].allowedCredit).toBe(2_000);
    expect(r.total).toBe(2_000);
  });

  it('definitely-related deductions reduce foreign taxable income', () => {
    // fti = 10_000 − 4_000 = 6_000
    // limitation = 20_000 × 6_000/100_000 = 1_200
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          definitelyRelatedDeductions: 4_000,
          foreignTaxPaid: 1_500,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket[0].foreignTaxableIncome).toBe(6_000);
    expect(r.perBasket[0].limitation).toBe(1_200);
    expect(r.perBasket[0].allowedCredit).toBe(1_200);
    expect(r.total).toBe(1_200);
  });

  it('two passive baskets (different countries) aggregate into one category', () => {
    // Combined fti = 6_000 + 4_000 = 10_000, limitation = 2_000
    // Combined foreignTaxPaid = 500 + 700 = 1_200 → allowed = 1_200
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          country: 'Canada',
          foreignGrossIncome: 6_000,
          foreignTaxPaid: 500,
        }),
        b({
          id: '2',
          category: 'passive',
          country: 'Germany',
          foreignGrossIncome: 4_000,
          foreignTaxPaid: 700,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket).toHaveLength(1);
    expect(r.perBasket[0].category).toBe('passive');
    expect(r.perBasket[0].foreignTaxableIncome).toBe(10_000);
    expect(r.perBasket[0].foreignTaxPaid).toBe(1_200);
    expect(r.perBasket[0].limitation).toBe(2_000);
    expect(r.perBasket[0].allowedCredit).toBe(1_200);
    expect(r.total).toBe(1_200);
  });

  it('separate passive and general baskets compute independently and sum', () => {
    // passive: fti 10_000, limitation 20_000×10/100 = 2_000, paid 1_000 → 1_000
    // general: fti 5_000,  limitation 20_000×5/100  = 1_000, paid 1_500 → 1_000
    // total = 1_000 + 1_000 = 2_000
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          foreignTaxPaid: 1_000,
        }),
        b({
          id: '2',
          category: 'general',
          foreignGrossIncome: 5_000,
          foreignTaxPaid: 1_500,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket).toHaveLength(2);

    const passive = r.perBasket.find((x) => x.category === 'passive')!;
    const general = r.perBasket.find((x) => x.category === 'general')!;

    expect(passive.foreignTaxableIncome).toBe(10_000);
    expect(passive.limitation).toBe(2_000);
    expect(passive.allowedCredit).toBe(1_000);

    expect(general.foreignTaxableIncome).toBe(5_000);
    expect(general.limitation).toBe(1_000);
    expect(general.allowedCredit).toBe(1_000);

    expect(r.total).toBe(2_000);
  });

  it('higher usTax (including APTC repayment) raises the limitation and allowed credit', () => {
    // Per Form 1116 (2024) line 20 the US-tax anchor includes Schedule 2
    // line 1b (excess APTC repayment). Holding everything else constant,
    // raising usTax must strictly increase the limitation (and, when
    // foreignTaxPaid exceeds the baseline limitation, the allowed credit).
    const baseline = computeForm1116(
      [b({ id: '1', category: 'passive', foreignGrossIncome: 10_000, foreignTaxPaid: 3_000 })],
      20_000,
      100_000,
    );
    const withAptc = computeForm1116(
      [b({ id: '1', category: 'passive', foreignGrossIncome: 10_000, foreignTaxPaid: 3_000 })],
      20_000 + 1_500, // + APTC repayment anchor
      100_000,
    );
    expect(baseline.perBasket[0].limitation).toBe(2_000);
    expect(baseline.perBasket[0].allowedCredit).toBe(2_000);
    expect(withAptc.perBasket[0].limitation).toBe(2_150);
    expect(withAptc.perBasket[0].allowedCredit).toBe(2_150);
    expect(withAptc.total).toBeGreaterThan(baseline.total);
  });

  it('definitely-related deductions exceeding gross floors foreign taxable income at zero', () => {
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 3_000,
          definitelyRelatedDeductions: 10_000,
          foreignTaxPaid: 500,
        }),
      ],
      20_000,
      100_000,
    );
    expect(r.perBasket[0].foreignTaxableIncome).toBe(0);
    expect(r.perBasket[0].limitation).toBe(0);
    expect(r.perBasket[0].allowedCredit).toBe(0);
    expect(r.total).toBe(0);
  });

  // ----- §904(d)(2)(F) High-Tax Kickout -----

  it('HTKO: passive basket taxed above top US rate is kicked to general', () => {
    // passive: fti 10_000, foreignTaxPaid 4_500 → effective 45% > 37% → HTKO.
    // The basket moves into the general category for limitation purposes.
    // Limitation = 20_000 × 10_000/100_000 = 2_000. Paid 4_500 → allowed 2_000.
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          foreignTaxPaid: 4_500,
        }),
      ],
      20_000,
      100_000,
      0.37,
    );
    expect(r.htkoApplied).toBe(true);
    expect(r.perBasket).toHaveLength(1);
    expect(r.perBasket[0].category).toBe('general');
    expect(r.perBasket[0].foreignTaxableIncome).toBe(10_000);
    expect(r.perBasket[0].foreignTaxPaid).toBe(4_500);
    expect(r.perBasket[0].limitation).toBe(2_000);
    expect(r.perBasket[0].allowedCredit).toBe(2_000);
    expect(r.perBasket[0].htkoReceived).toBe(4_500);
    expect(r.total).toBe(2_000);
  });

  it('HTKO: passive basket taxed at/below top US rate stays in passive', () => {
    // passive: fti 10_000, paid 3_000 → 30% ≤ 37% → stays passive.
    const r = computeForm1116(
      [
        b({
          id: '1',
          category: 'passive',
          foreignGrossIncome: 10_000,
          foreignTaxPaid: 3_000,
        }),
      ],
      20_000,
      100_000,
      0.37,
    );
    expect(r.htkoApplied).toBe(false);
    expect(r.perBasket[0].category).toBe('passive');
    expect(r.perBasket[0].htkoReceived).toBe(0);
    expect(r.perBasket[0].htkoRemoved).toBe(0);
  });

  it('HTKO: mixed — high-taxed passive kicks out, low-taxed passive stays', () => {
    // Two passive rows:
    //   low:  fti 5_000,  paid 500  → 10% → stays passive
    //   high: fti 8_000,  paid 4_000 → 50% → HTKO → general
    // Passive bucket: fti 5_000, paid 500, limitation 20k×5/100=1_000, credit 500.
    // General bucket: fti 8_000, paid 4_000, limitation 20k×8/100=1_600, credit 1_600.
    // Total credit = 500 + 1_600 = 2_100.
    const r = computeForm1116(
      [
        b({ id: '1', category: 'passive', foreignGrossIncome: 5_000, foreignTaxPaid: 500 }),
        b({ id: '2', category: 'passive', foreignGrossIncome: 8_000, foreignTaxPaid: 4_000 }),
      ],
      20_000,
      100_000,
      0.37,
    );
    expect(r.htkoApplied).toBe(true);
    expect(r.perBasket).toHaveLength(2);

    const passive = r.perBasket.find((x) => x.category === 'passive')!;
    const general = r.perBasket.find((x) => x.category === 'general')!;

    expect(passive.foreignTaxableIncome).toBe(5_000);
    expect(passive.foreignTaxPaid).toBe(500);
    expect(passive.allowedCredit).toBe(500);
    expect(passive.htkoRemoved).toBe(4_000);

    expect(general.foreignTaxableIncome).toBe(8_000);
    expect(general.foreignTaxPaid).toBe(4_000);
    expect(general.limitation).toBe(1_600);
    expect(general.allowedCredit).toBe(1_600);
    expect(general.htkoReceived).toBe(4_000);

    expect(r.total).toBe(2_100);
  });

  it('HTKO: basket with zero FTI is not HTKO-tested (avoids div-by-zero)', () => {
    // fti = max(0, 0 − 0) = 0; we skip the HTKO rate test entirely and
    // leave the row in its original category. With no income and no tax,
    // the row still appears because it's the only passive entry (but both
    // foreignGross and foreignTaxPaid are zero so it's filtered out).
    const r = computeForm1116(
      [
        b({ id: '1', category: 'passive', foreignGrossIncome: 0, foreignTaxPaid: 0 }),
      ],
      20_000,
      100_000,
    );
    expect(r.htkoApplied).toBe(false);
    expect(r.perBasket).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('HTKO: default top rate = 37% when no rate passed', () => {
    // fti 10_000, paid 3_800 → 38% > 37% default → HTKO
    const r = computeForm1116(
      [b({ id: '1', category: 'passive', foreignGrossIncome: 10_000, foreignTaxPaid: 3_800 })],
      20_000,
      100_000,
    );
    expect(r.htkoApplied).toBe(true);
    expect(r.perBasket[0].category).toBe('general');
  });

  it('HTKO: custom top rate (e.g. 39.6% historical) shifts the threshold', () => {
    // fti 10_000, paid 3_800 → 38% < 39.6% → NO HTKO
    const r = computeForm1116(
      [b({ id: '1', category: 'passive', foreignGrossIncome: 10_000, foreignTaxPaid: 3_800 })],
      20_000,
      100_000,
      0.396,
    );
    expect(r.htkoApplied).toBe(false);
    expect(r.perBasket[0].category).toBe('passive');
  });

  it('falls back to DEFAULT_HIGHEST_US_RATE (0.37) when highestUsRate is 0', () => {
    // Exercises `Math.max(0, Number(highestUsRate) || 0) || DEFAULT_HIGHEST_US_RATE`
    // right-side branch when the supplied rate is exactly 0.
    const r = computeForm1116(
      [b({ category: 'passive', foreignGrossIncome: 100, foreignTaxPaid: 50 })],
      1000,
      10000,
      0,
    );
    // HTKO threshold = 0.37 × 100 = 37; foreignTaxPaid 50 > 37 → HTKO applies.
    expect(r.htkoApplied).toBe(true);
  });

  it('falls back to DEFAULT_HIGHEST_US_RATE (0.37) when highestUsRate is NaN', () => {
    const r = computeForm1116(
      [b({ category: 'passive', foreignGrossIncome: 100, foreignTaxPaid: 50 })],
      1000,
      10000,
      NaN,
    );
    expect(r.htkoApplied).toBe(true);
  });
});
