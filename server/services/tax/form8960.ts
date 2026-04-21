// Form 8960 — Net Investment Income Tax (IRC §1411).
//
// NIIT is 3.8% of the lesser of (a) net investment income or (b) MAGI in
// excess of the filing-status threshold. Thresholds are not indexed for
// inflation and are configured in TaxYearConfig.niit.
//
// Net investment income (NII) = gross investment income (interest, dividends,
// annuities, net rental, net royalty, net capital gains) minus properly
// allocable expenses (investment interest expense, state tax allocable to
// NII, other misc investment expenses) plus/minus §1411 modifications.
// MAGI for §1411 = AGI + FEIE add-back (and a few other rarely-seen items,
// captured here via `additionalMagiModifications`).

import type {
  Form8960,
  FilingStatus,
  NiitRow,
  ComputedForm8960,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeForm8960(
  input: Form8960 | undefined,
  filingStatus: FilingStatus,
  agi: number,
  grossInvestmentIncome: number,
  additionalMagiModifications: number,
  row: NiitRow | undefined,
): ComputedForm8960 {
  // Reference filingStatus to satisfy noUnusedParameters; thresholds are
  // already pre-selected for the filing status by the caller via `row`.
  void filingStatus;

  if (!row) {
    return {
      netInvestmentIncome: 0,
      magi: 0,
      excessOverThreshold: 0,
      amountSubjectToNiit: 0,
      niit: 0,
    };
  }

  const investmentExpenses = Math.max(
    0,
    (input?.investmentInterestExpense ?? 0)
      + (input?.stateTaxAllocableToInvestment ?? 0)
      + (input?.miscInvestmentExpenses ?? 0),
  );

  const netInvestmentIncome = Math.max(
    0,
    grossInvestmentIncome - investmentExpenses + (input?.otherModifications ?? 0),
  );

  const magi = agi + additionalMagiModifications;
  const excessOverThreshold = Math.max(0, magi - row.threshold);
  const amountSubjectToNiit = Math.min(netInvestmentIncome, excessOverThreshold);
  const niit = round(amountSubjectToNiit * row.rate);

  return {
    netInvestmentIncome: round(netInvestmentIncome),
    magi: round(magi),
    excessOverThreshold: round(excessOverThreshold),
    amountSubjectToNiit: round(amountSubjectToNiit),
    niit,
  };
}
