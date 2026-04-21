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
});
