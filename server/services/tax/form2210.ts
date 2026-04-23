// Form 2210 — Underpayment of Estimated Tax by Individuals.
//
// Simplified short-method implementation:
//   required annual payment = lesser of
//     (a) 90% of current-year tax
//     (b) 100% of prior-year tax (110% if prior AGI > $150k; $75k MFS)
//   underpayment = max(0, required − total paid)
//   penalty = underpayment × §6621 rate (annual flat rate, admin-editable).
//
// Taxpayers with total underpayment < $1,000 owe no penalty (de minimis).
// Filers may request a waiver (casualty, disaster, disability) which
// zeros the penalty here.

import type {
  Form2210,
  FilingStatus,
  ComputedForm2210,
  UnderpaymentPenaltyConstants,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeForm2210(
  input: Form2210 | undefined,
  filingStatus: FilingStatus,
  currentYearTax: number,
  constants?: UnderpaymentPenaltyConstants,
): ComputedForm2210 {
  if (!input) {
    return {
      currentYearTax: round(currentYearTax),
      requiredAnnualPayment: 0,
      totalPaid: 0,
      underpayment: 0,
      penalty: 0,
    };
  }

  const highIncomeSafeHarborMultiplier = constants?.highIncomeSafeHarborMultiplier ?? 1.10;
  const regularSafeHarborMultiplier = constants?.regularSafeHarborMultiplier ?? 1.00;
  const currentYearPct = constants?.currentYearPct ?? 0.90;
  const deMinimis = constants?.deMinimis ?? 1000;
  // §6621 short-term AFR + 3%, applied as an annual flat rate (admin-editable per year).
  const estimatedRate = constants?.estimatedRate ?? 0.08;
  const highIncomeThreshold = constants?.highIncomeThreshold ?? 150000;
  const highIncomeThresholdMfs = constants?.highIncomeThresholdMfs ?? 75000;

  const mfsThreshold = filingStatus === 'mfs' ? highIncomeThresholdMfs : highIncomeThreshold;
  const highIncome = (Number(input.priorYearAgi) || 0) > mfsThreshold;
  const priorMultiplier = highIncome
    ? highIncomeSafeHarborMultiplier
    : regularSafeHarborMultiplier;

  const priorTax = Math.max(0, Number(input.priorYearTax) || 0);
  const safeHarborCurrent = Math.max(0, currentYearTax) * currentYearPct;
  const safeHarborPrior = priorTax * priorMultiplier;
  // Per IRC §6654(d)(1)(B)(ii): the prior-year safe harbor is only available
  // when the prior year showed actual tax liability over a 12-month return.
  // When prior tax was $0, only the 90% current-year test applies; otherwise
  // the required annual payment is the lesser of the two safe harbors.
  const requiredAnnualPayment =
    priorTax > 0 ? Math.min(safeHarborCurrent, safeHarborPrior) : safeHarborCurrent;

  const wh = input.withholdingByQuarter;
  const est = input.estimatedPaymentsByQuarter;
  const totalPaid =
    (Number(wh[0]) || 0) + (Number(wh[1]) || 0) +
    (Number(wh[2]) || 0) + (Number(wh[3]) || 0) +
    (Number(est[0]) || 0) + (Number(est[1]) || 0) +
    (Number(est[2]) || 0) + (Number(est[3]) || 0);

  const underpayment = Math.max(0, requiredAnnualPayment - totalPaid);

  let penalty = 0;
  if (!input.requestWaiver && underpayment >= deMinimis) {
    penalty = underpayment * estimatedRate;
  }

  return {
    currentYearTax: round(Math.max(0, currentYearTax)),
    requiredAnnualPayment: round(requiredAnnualPayment),
    totalPaid: round(totalPaid),
    underpayment: round(underpayment),
    penalty: round(penalty),
  };
}
