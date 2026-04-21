// EITC — Earned Income Tax Credit (§32).
//
// For each (filing status, # qualifying children) combination, the IRS
// publishes a row with:
//   maxCredit:      ceiling of the credit
//   phaseInRate:    rate applied to earned income until credit hits maxCredit
//   phaseOutStart:  "completed phase-in" AGI (or earned income) where the
//                   credit begins to be reduced
//   phaseOutRate:   rate at which the credit is reduced per dollar of the
//                   phase-out measure above phaseOutStart
//   maxAgi:         AGI above which credit is fully zeroed
//
// The "measure" for phase-out is the LARGER of AGI and earned income.
// MFS filers are ineligible. Taxpayers with no qualifying children must
// also be of eligible age (25-64). Investment income above a statutory
// limit disqualifies the taxpayer entirely.

import type {
  EitcEligibility,
  EitcRow,
  Dependent,
  FilingStatus,
  ComputedEitc,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

function zeros(): ComputedEitc {
  return {
    qualifyingChildren: 0,
    earnedIncome: 0,
    investmentIncome: 0,
    disqualifiedByInvestment: false,
    phaseInAmount: 0,
    phaseOutAmount: 0,
    credit: 0,
  };
}

export function computeEitc(
  input: EitcEligibility | undefined,
  dependents: Dependent[] | undefined,
  filingStatus: FilingStatus,
  agi: number,
  w2Wages: number,
  seNetEarnings: number,
  interestIncome: number,
  ordinaryDividends: number,
  netCapitalGain: number,
  royalties: number,
  rentalPassiveIncome: number,
  eitcTable: Record<FilingStatus, Record<string, EitcRow>> | undefined,
  investmentIncomeLimit?: number,
): ComputedEitc {
  const limit = investmentIncomeLimit ?? 11950;
  // MFS is ineligible (TCJA separated-spouse carve-out not modeled in MVP).
  if (filingStatus === 'mfs') return zeros();
  if (!eitcTable) return zeros();

  // Qualifying children (capped at 3 — the EITC table tops out at "3+").
  const autoKids = Array.isArray(dependents)
    ? dependents.filter((d) => d.isQualifyingChild).length
    : 0;
  const qcRaw =
    input?.qualifyingChildrenOverride != null
      ? Math.max(0, Math.floor(Number(input.qualifyingChildrenOverride) || 0))
      : autoKids;
  const qualifyingChildren = Math.min(3, qcRaw);

  // Investment income test.
  const computedInvestment =
    Math.max(0, Number(interestIncome) || 0) +
    Math.max(0, Number(ordinaryDividends) || 0) +
    Math.max(0, Number(netCapitalGain) || 0) +
    Math.max(0, Number(royalties) || 0) +
    Math.max(0, Number(rentalPassiveIncome) || 0);
  const investmentIncome =
    input?.investmentIncomeOverride != null
      ? Math.max(0, Number(input.investmentIncomeOverride) || 0)
      : computedInvestment;
  if (investmentIncome > limit) {
    return {
      ...zeros(),
      qualifyingChildren,
      investmentIncome: round(investmentIncome),
      disqualifiedByInvestment: true,
    };
  }

  // Earned income (with optional combat-pay election per §32(c)(2)(B)(vi)).
  let earnedIncome =
    Math.max(0, Number(w2Wages) || 0) + Math.max(0, Number(seNetEarnings) || 0);
  if (input?.includeCombatPay) {
    earnedIncome += Math.max(0, Number(input.combatPayAmount) || 0);
  }

  // Age test for childless filers (25-64). MVP approximates via a single
  // user-facing toggle; exact age and spouse-age checks deferred.
  if (qualifyingChildren === 0 && !input?.isEligibleAge) {
    return {
      ...zeros(),
      qualifyingChildren,
      earnedIncome: round(earnedIncome),
      investmentIncome: round(investmentIncome),
    };
  }

  // Look up the tier row.
  const row = eitcTable?.[filingStatus]?.[String(qualifyingChildren)];
  if (!row) {
    return {
      ...zeros(),
      qualifyingChildren,
      earnedIncome: round(earnedIncome),
      investmentIncome: round(investmentIncome),
    };
  }

  // Phase-in: rate × earned income, capped at maxCredit.
  const phaseInAmountRaw = Math.min(row.maxCredit, earnedIncome * row.phaseInRate);

  // Phase-out measure = larger of earned income and AGI (per §32(a)(2)).
  const measure = Math.max(earnedIncome, Math.max(0, Number(agi) || 0));

  // Phase-out reduction.
  const phaseOutAmountRaw =
    measure > row.phaseOutStart
      ? (measure - row.phaseOutStart) * row.phaseOutRate
      : 0;

  // Above maxAgi the credit is fully zero.
  let creditRaw = measure > row.maxAgi
    ? 0
    : Math.max(0, phaseInAmountRaw - phaseOutAmountRaw);

  // Never exceed maxCredit (defensive).
  creditRaw = Math.min(row.maxCredit, creditRaw);

  return {
    qualifyingChildren,
    earnedIncome: round(earnedIncome),
    investmentIncome: round(investmentIncome),
    disqualifiedByInvestment: false,
    phaseInAmount: round(phaseInAmountRaw),
    phaseOutAmount: round(phaseOutAmountRaw),
    credit: round(creditRaw),
  };
}
