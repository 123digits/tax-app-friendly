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
// §904(d)(2)(F) High-Tax Kickout (HTKO): passive-category income on which
// foreign tax was imposed at an effective rate HIGHER than the highest US
// statutory individual rate is "kicked out" of the passive basket into the
// general basket, item-by-item. Applied before aggregation below. The test
// is: foreignTaxPaid > highestUsRate × foreignTaxableIncome for that item.
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
  /** Magnitude of foreign tax that was HTKO-shifted INTO this basket. */
  htkoReceived: number;
  /** Magnitude of foreign tax that was HTKO-shifted OUT of this basket. */
  htkoRemoved: number;
}

export interface ComputedForm1116 {
  perBasket: ComputedForm1116Basket[];
  total: number;
  /** True iff any individual basket row triggered §904(d)(2)(F) HTKO. */
  htkoApplied: boolean;
}

interface Aggregated {
  foreignGross: number;
  definitelyRelated: number;
  foreignTaxPaid: number;
  htkoReceived: number;
  htkoRemoved: number;
}

const EMPTY: ComputedForm1116 = { perBasket: [], total: 0, htkoApplied: false };

/** Default highest US individual statutory marginal rate (§1 top bracket). */
const DEFAULT_HIGHEST_US_RATE = 0.37;

export function computeForm1116(
  baskets: Form1116Basket[] | undefined,
  usTax: number,
  totalTaxableIncome: number,
  highestUsRate: number = DEFAULT_HIGHEST_US_RATE,
): ComputedForm1116 {
  if (!baskets || baskets.length === 0)
    return { perBasket: [], total: 0, htkoApplied: false };
  if (!(usTax > 0) || !(totalTaxableIncome > 0)) return EMPTY;

  const rate = Math.max(0, Number(highestUsRate) || 0) || DEFAULT_HIGHEST_US_RATE;

  // Aggregate across baskets in the same category. Passive and general are
  // each computed independently (separate limitations). Passive rows that
  // exceed the HTKO threshold are reclassified to general BEFORE aggregation.
  const byCat = new Map<Form1116Category, Aggregated>();
  let htkoApplied = false;
  for (const b of baskets) {
    const rawCat: Form1116Category = b.category === 'general' ? 'general' : 'passive';
    const gross = Math.max(0, Number(b.foreignGrossIncome) || 0);
    const defRel = Math.max(0, Number(b.definitelyRelatedDeductions) || 0);
    const paid = Math.max(0, Number(b.foreignTaxPaid) || 0);
    const fti = Math.max(0, gross - defRel);

    // §904(d)(2)(F) HTKO: only applies to passive rows. Kick out if the
    // foreign tax on this item alone exceeds the highest US rate × FTI.
    // FTI ≤ 0 rows are left in place (no meaningful rate, HTKO undefined).
    let cat: Form1116Category = rawCat;
    let kickedOut = false;
    if (rawCat === 'passive' && fti > 0 && paid > rate * fti) {
      cat = 'general';
      kickedOut = true;
      htkoApplied = true;
    }

    const agg = byCat.get(cat) ?? {
      foreignGross: 0,
      definitelyRelated: 0,
      foreignTaxPaid: 0,
      htkoReceived: 0,
      htkoRemoved: 0,
    };
    agg.foreignGross += gross;
    agg.definitelyRelated += defRel;
    agg.foreignTaxPaid += paid;
    if (kickedOut) agg.htkoReceived += paid;
    byCat.set(cat, agg);

    if (kickedOut) {
      // Record the removal on the original (passive) bucket so the per-basket
      // output tells the full story even when the passive bucket ends empty.
      const passiveAgg = byCat.get('passive') ?? {
        foreignGross: 0,
        definitelyRelated: 0,
        foreignTaxPaid: 0,
        htkoReceived: 0,
        htkoRemoved: 0,
      };
      passiveAgg.htkoRemoved += paid;
      byCat.set('passive', passiveAgg);
    }
  }

  const perBasket: ComputedForm1116Basket[] = [];
  let total = 0;

  // Preserve a stable output order: passive first, then general.
  const order: Form1116Category[] = ['passive', 'general'];
  for (const cat of order) {
    const agg = byCat.get(cat);
    if (!agg) continue;
    // Emit only when this bucket retains actual income or foreign tax after
    // any HTKO shifts. A passive bucket whose only content is htkoRemoved
    // (i.e., everything kicked out) is silently omitted — the HTKO fact is
    // already recorded on the destination basket's htkoReceived.
    if (agg.foreignGross === 0 && agg.foreignTaxPaid === 0) {
      continue;
    }

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
      htkoReceived: round(agg.htkoReceived),
      htkoRemoved: round(agg.htkoRemoved),
    });
    total += allowedCredit;
  }

  return { perBasket, total: round(total), htkoApplied };
}
