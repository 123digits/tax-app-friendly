// Form 2441: Child and Dependent Care Expenses nonrefundable credit.
//
// Qualified expenses are capped by number of qualifying persons ($3,000 for
// one, $6,000 for two-or-more), reduced by employer-provided dependent care
// benefits (W-2 box 10), then further limited by earned income (the lesser
// of the taxpayer's and — if MFJ — the spouse's earned income). The credit
// rate is an AGI-tiered percentage (35% at the lowest tier, phasing down to
// 20% for higher AGIs). Credit = allowed expenses × rate.

import type {
  Form2441,
  ChildCareConstants,
  ChildCareTier,
  FilingStatus,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm2441 {
  allowedExpenses: number;
  applicableRate: number;
  credit: number;
}

export function pickChildCareRate(
  agi: number,
  constants: ChildCareConstants | undefined,
): number {
  if (!constants || !Array.isArray(constants.rates) || constants.rates.length === 0) return 0;
  // Tiers are listed in ascending AGI order; first tier whose agi cap >= AGI wins.
  for (const tier of constants.rates as ChildCareTier[]) {
    if (agi <= tier.agi) return tier.rate;
  }
  // AGI exceeds every tier cap → use the last tier's rate (statutory floor 20%).
  return constants.rates[constants.rates.length - 1].rate;
}

export function computeForm2441(
  f: Form2441 | undefined,
  agi: number,
  filingStatus: FilingStatus,
  constants: ChildCareConstants | undefined,
): ComputedForm2441 {
  if (!constants) return { allowedExpenses: 0, applicableRate: 0, credit: 0 };

  const numQualifyingPersons = Math.max(0, Math.floor(Number(f?.numQualifyingPersons) || 0));
  const totalExpenses = Math.max(0, Number(f?.totalQualifiedExpenses) || 0);
  const taxpayerEarnedActual = Math.max(0, Number(f?.taxpayerEarnedIncome) || 0);
  const spouseEarnedActual = Math.max(0, Number(f?.spouseEarnedIncome) || 0);
  const employerBenefits = Math.max(0, Number(f?.employerProvidedBenefits) || 0);
  const mfsException = !!f?.mfsAbandonmentException;
  const taxpayerIsStudentOrDisabled = !!f?.taxpayerIsStudentOrDisabled;
  const spouseIsStudentOrDisabled = !!f?.spouseIsStudentOrDisabled;

  if (numQualifyingPersons <= 0 || totalExpenses <= 0) {
    return { allowedExpenses: 0, applicableRate: 0, credit: 0 };
  }

  // §21(e)(2): MFS is ineligible unless the abandonment/separation exception
  // applies (lived apart from spouse for the last 6 months + qualifying
  // person lived with filer more than half the year). With the exception,
  // the filer is treated as "not married" for §21 purposes (single-style
  // earned-income limit, no spouse imputation).
  if (filingStatus === 'mfs' && !mfsException) {
    return { allowedExpenses: 0, applicableRate: 0, credit: 0 };
  }

  // §21(d)(2): a full-time student or disabled spouse/taxpayer is deemed to
  // have earned income of $250/mo (one QP) or $500/mo (two or more QPs).
  // Only one spouse at a time may use imputation under the statute; we take
  // the max of actual vs imputed on each side, which matches the Form 2441
  // instructions worksheet behavior.
  const imputedAnnual = numQualifyingPersons >= 2 ? 500 * 12 : 250 * 12;
  const applyImputation = (actual: number, isStudentOrDisabled: boolean) =>
    isStudentOrDisabled ? Math.max(actual, imputedAnnual) : actual;

  const treatAsMfj = filingStatus === 'mfj';

  const taxpayerEarned = treatAsMfj
    ? applyImputation(taxpayerEarnedActual, taxpayerIsStudentOrDisabled)
    : taxpayerEarnedActual;
  const spouseEarned = treatAsMfj
    ? applyImputation(spouseEarnedActual, spouseIsStudentOrDisabled)
    : spouseEarnedActual;

  // Cap by qualifying-persons count: 1 → maxExpenseOne; 2+ → maxExpenseTwo.
  const expenseCap =
    numQualifyingPersons >= 2
      ? (constants.maxExpenseTwo ?? 0)
      : (constants.maxExpenseOne ?? 0);

  // Reduce cap by employer-provided dependent care benefits (already excluded from wages).
  const capAfterBenefits = Math.max(0, expenseCap - employerBenefits);

  // Start from the lesser of actual expenses and the adjusted cap.
  let allowed = Math.min(totalExpenses, capAfterBenefits);

  // Earned-income limit: lesser of taxpayer / (MFJ) spouse earned income.
  // MFS-with-exception is treated as single-style (taxpayer-only limit).
  const earnedLimit = treatAsMfj
    ? Math.min(taxpayerEarned, spouseEarned)
    : taxpayerEarned;
  allowed = Math.min(allowed, earnedLimit);
  allowed = Math.max(0, allowed);

  const applicableRate = pickChildCareRate(Math.max(0, agi), constants);
  const allowedExpenses = round(allowed);
  const credit = round(allowedExpenses * applicableRate);

  return { allowedExpenses, applicableRate, credit };
}
