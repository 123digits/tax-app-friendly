// Form 1116 — Foreign Tax Credit.
//
// The Foreign Tax Credit is computed separately for each income "category"
// (a/k/a "basket"). We model the two most common categories: passive
// (portfolio interest, dividends, royalties) and general (wages and active
// business income). Each category has its own limitation, so a large credit
// in one basket cannot absorb limitation room in the other.
//
// Within each category:
//   foreignTaxableIncome = max(0, foreignGrossIncome − definitelyRelatedDeductions)
//   limitation           = usTax × (foreignTaxableIncome / totalTaxableIncome)
//   allowedCredit        = min(foreignTaxPaid, limitation)
//
// Multiple Form 1116 basket rows may be entered for the same category
// (e.g. passive dividends from two different countries); they are summed
// within the category before the limitation is applied.
//
// Carryback (1 year) and carryforward (10 years) of unused foreign tax is
// deferred to Phase 10 along with the cross-year carryforwards table.

import type { Form1116Basket, Form1116Category } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm1116Basket {
  category: Form1116Category;
  foreignTaxableIncome: number;
  foreignTaxPaid: number;
  limitation: number;
  allowedCredit: number;
}

export interface ComputedForm1116 {
  perBasket: ComputedForm1116Basket[];
  total: number;
}

interface Aggregated {
  foreignGross: number;
  definitelyRelated: number;
  foreignTaxPaid: number;
}

const EMPTY: ComputedForm1116 = { perBasket: [], total: 0 };

export function computeForm1116(
  baskets: Form1116Basket[] | undefined,
  usTax: number,
  totalTaxableIncome: number,
): ComputedForm1116 {
  if (!baskets || baskets.length === 0) return { perBasket: [], total: 0 };
  if (!(usTax > 0) || !(totalTaxableIncome > 0)) return EMPTY;

  // Aggregate across baskets in the same category. Passive and general are
  // each computed independently (separate limitations).
  const byCat = new Map<Form1116Category, Aggregated>();
  for (const b of baskets) {
    const cat: Form1116Category = b.category === 'general' ? 'general' : 'passive';
    const agg = byCat.get(cat) ?? {
      foreignGross: 0,
      definitelyRelated: 0,
      foreignTaxPaid: 0,
    };
    agg.foreignGross += Math.max(0, Number(b.foreignGrossIncome) || 0);
    agg.definitelyRelated += Math.max(0, Number(b.definitelyRelatedDeductions) || 0);
    agg.foreignTaxPaid += Math.max(0, Number(b.foreignTaxPaid) || 0);
    byCat.set(cat, agg);
  }

  const perBasket: ComputedForm1116Basket[] = [];
  let total = 0;

  // Preserve a stable output order: passive first, then general.
  const order: Form1116Category[] = ['passive', 'general'];
  for (const cat of order) {
    const agg = byCat.get(cat);
    if (!agg) continue;

    const fti = Math.max(0, agg.foreignGross - agg.definitelyRelated);
    const rawLimitation = usTax * (fti / totalTaxableIncome);
    const limitation = round(Math.max(0, rawLimitation));
    const foreignTaxPaid = round(agg.foreignTaxPaid);
    const allowedCredit = round(Math.min(foreignTaxPaid, limitation));

    perBasket.push({
      category: cat,
      foreignTaxableIncome: round(fti),
      foreignTaxPaid,
      limitation,
      allowedCredit,
    });
    total += allowedCredit;
  }

  return { perBasket, total: round(total) };
}
