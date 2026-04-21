// Form 8959 — Additional Medicare Tax (§3101(b)(2), §1401(b)(2), §3201(a)).
//
// 0.9% extra Medicare tax on wages, SE earnings, and RRTA compensation
// above a filing-status threshold. The three kinds of income are tested
// separately but share ONE threshold that cascades: SE's threshold is
// reduced (but not below zero) by Medicare wages, and RRTA uses its own
// full threshold (IRS worksheet simplification).
//
// Employer withholds 0.9% once a single employee's wages cross $200k in a
// calendar year (per §3102(f)), regardless of filing status. That extra
// withholding is reported in W-2 box 14 and reconciled here against the
// actual liability.

import type {
  Form8959,
  FilingStatus,
  AdditionalMedicareRow,
  ComputedForm8959,
  SeTaxConstants,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

function zeros(): ComputedForm8959 {
  return {
    medicareWages: 0,
    seIncome: 0,
    rrtaCompensation: 0,
    threshold: 0,
    additionalMedicareTax: 0,
    additionalMedicareWithheld: 0,
    netAdditionalMedicare: 0,
  };
}

export function computeForm8959(
  input: Form8959 | undefined,
  _filingStatus: FilingStatus,
  medicareWages: number,
  seNetEarnings: number,
  row: AdditionalMedicareRow | undefined,
  seTaxConstants?: SeTaxConstants,
): ComputedForm8959 {
  if (!row) return zeros();

  const incomeFactor = seTaxConstants?.incomeFactor ?? 0.9235;
  const wages = Math.max(0, Number(medicareWages) || 0);
  const seGross = Math.max(0, Number(seNetEarnings) || 0);
  const seIncomeForMedicare = seGross * incomeFactor;
  const rrta = Math.max(0, Number(input?.rrtaCompensation) || 0);

  // Part I — wages.
  const wagesOver = Math.max(0, wages - row.threshold);
  const partI = wagesOver * row.rate;

  // Part II — SE. SE threshold reduced by wages already counted.
  const seThreshold = Math.max(0, row.threshold - wages);
  const seOver = Math.max(0, seIncomeForMedicare - seThreshold);
  const partII = seOver * row.rate;

  // Part III — RRTA. Uses its own threshold (per IRS instructions).
  const rrtaOver = Math.max(0, rrta - row.threshold);
  const partIII = rrtaOver * row.rate;

  const additionalMedicareTax = round(partI + partII + partIII);

  // Part V line 24 — employer-required withholding per §3102(f)(1): 0.9% on
  // the portion of Medicare wages above $200,000, regardless of filing
  // status. This flows to Form 1040 line 25c as a PAYMENT (not a credit
  // against the Part IV tax). Priority: computed statutory amount;
  // fall back to user-entered input.additionalMedicareWithheld only if it
  // exceeds the computed statutory amount (e.g., over-withholding).
  const EMPLOYER_WITHHOLDING_THRESHOLD = 200_000;
  const ADDITIONAL_MEDICARE_RATE = 0.009;
  const statutoryPartV = Math.max(0, wages - EMPLOYER_WITHHOLDING_THRESHOLD) * ADDITIONAL_MEDICARE_RATE;
  const userWithheld = Math.max(0, Number(input?.additionalMedicareWithheld) || 0);
  const additionalMedicareWithheld = round(Math.max(statutoryPartV, userWithheld));

  const netAdditionalMedicare = Math.max(
    0,
    round(additionalMedicareTax - additionalMedicareWithheld),
  );

  return {
    medicareWages: round(wages),
    seIncome: round(seIncomeForMedicare),
    rrtaCompensation: round(rrta),
    threshold: row.threshold,
    additionalMedicareTax,
    additionalMedicareWithheld,
    netAdditionalMedicare,
  };
}
