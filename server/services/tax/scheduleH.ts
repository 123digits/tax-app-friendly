// Schedule H — Household Employment Taxes (IRC §3510).
//
// Employers of household employees (nannies, housekeepers, etc.) owe:
//   • SS + Medicare tax (15.3% combined — employee+employer share) on
//     cash wages >= $2,700 (2024) per employee.
//   • FUTA tax (6% gross on first $7k, reduced to 0.6% net when state
//     unemployment fully paid) if any calendar quarter's wages
//     aggregated >= $1,000.
//   • Any federal income tax voluntarily withheld at employee's request.
//
// Simplification: we apply the full 15.3% rate to `cashWagesSsMedicare`
// (the app-level convention is for the user to enter the aggregate
// across employees, net of the $2,700/employee threshold exclusion).
// FUTA rate is 0.6% (the normal net rate after full 5.4% state credit).

import type {
  ScheduleH,
  ComputedScheduleH,
  HouseholdEmploymentConstants,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export function computeScheduleH(
  input: ScheduleH | undefined,
  constants?: HouseholdEmploymentConstants,
): ComputedScheduleH {
  if (!input) {
    return {
      ssMedicareTax: 0,
      futaTax: 0,
      federalIncomeTaxWithheld: 0,
      totalHouseholdEmploymentTax: 0,
    };
  }

  const ssMedicareRate = constants?.ssMedicareRate ?? 0.153;
  const futaNetRate = constants?.futaNetRate ?? 0.006;

  const ssWages = Math.max(0, Number(input.cashWagesSsMedicare) || 0);
  const ssMedicareTax = ssWages * ssMedicareRate;

  const futaWages = Math.max(0, Number(input.cashWagesFuta) || 0);
  // FUTA only triggers if any calendar quarter's wages >= $1,000.
  const futaTax = input.anyQuarterOver1000 ? futaWages * futaNetRate : 0;

  const fitWithheld = Math.max(0, Number(input.federalIncomeTaxWithheld) || 0);

  const totalHouseholdEmploymentTax = ssMedicareTax + futaTax + fitWithheld;

  return {
    ssMedicareTax: round(ssMedicareTax),
    futaTax: round(futaTax),
    federalIncomeTaxWithheld: round(fitWithheld),
    totalHouseholdEmploymentTax: round(totalHouseholdEmploymentTax),
  };
}
