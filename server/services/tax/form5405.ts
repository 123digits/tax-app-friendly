// Form 5405 — Repayment of the First-Time Homebuyer Credit.
//
// Recipients of the 2008-era FTHB credit (up to $7,500) repay in 15 equal
// annual installments starting with their 2010 return. Sale or cessation
// of the home as the principal residence accelerates the remaining
// balance. We simply sum the scheduled installment and any acceleration
// entered by the user.

import type {
  Form5405,
  ComputedForm5405,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeForm5405(
  input: Form5405 | undefined,
): ComputedForm5405 {
  if (!input) return { repaymentThisYear: 0 };
  const installment = Math.max(0, Number(input.annualInstallment) || 0);
  const accel = Math.max(0, Number(input.dispositionAccelerated) || 0);
  return { repaymentThisYear: round(installment + accel) };
}
