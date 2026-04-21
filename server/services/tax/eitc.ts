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
  // --- Step 1: qualifying children (before any early-return path). ---
  const override = input?.qualifyingChildrenOverride;
  const autoKids = (dependents ?? []).filter((d) => d.isQualifyingChild).length;
  const qualifyingChildren = Math.min(
    3,
    override != null ? Math.max(0, Math.floor(override)) : autoKids,
  );

  // --- Step 2: investment income. ---
  const investmentIncome = round(
    input?.investmentIncomeOverride != null
      ? Math.max(0, input.investmentIncomeOverride)
      : Math.max(0, interestIncome) +
        Math.max(0, ordinaryDividends) +
        Math.max(0, netCapitalGain) +
        Math.max(0, royalties) +
        Math.max(0, rentalPassiveIncome),
  );

  // --- Step 3: earned income (W-2 + SE + optional combat-pay election). ---
  const combatPay = input?.includeCombatPay ? Math.max(0, input.combatPayAmount) : 0;
  const earnedIncome = round(
    Math.max(0, w2Wages) + Math.max(0, seNetEarnings) + combatPay,
  );

  // --- Step 4: eligibility flags. ---
  const limit = investmentIncomeLimit ?? 11950;
  const disqualifiedByInvestment = investmentIncome > limit;
  const isMfs = filingStatus === 'mfs';
  const hasTable = !!eitcTable;
  const childlessButIneligibleAge =
    qualifyingChildren === 0 && input?.isEligibleAge !== true;
  const row = eitcTable?.[filingStatus]?.[String(qualifyingChildren)];

  // Any of these means the credit is 0 — the intermediate fields still
  // surface on the response though.
  const ineligible =
    isMfs || !hasTable || disqualifiedByInvestment ||
    childlessButIneligibleAge || !row;

  // MFS and "no table" skip exposing kids / earned income for parity with
  // the statute: MFS is fully ineligible and does not "have" EITC-qualifying
  // children in the §32 sense.
  const surfaceKids = isMfs || !hasTable ? 0 : qualifyingChildren;
  const surfaceEarned = isMfs || !hasTable || disqualifiedByInvestment ? 0 : earnedIncome;
  const surfaceInvestment = isMfs || !hasTable ? 0 : investmentIncome;

  if (ineligible) {
    return {
      qualifyingChildren: surfaceKids,
      earnedIncome: surfaceEarned,
      investmentIncome: surfaceInvestment,
      disqualifiedByInvestment,
      phaseInAmount: 0,
      phaseOutAmount: 0,
      credit: 0,
    };
  }

  // --- Step 5: phase-in / phase-out math. ---
  const phaseInAmountRaw = Math.min(row.maxCredit, earnedIncome * row.phaseInRate);
  // Phase-out measure = larger of earned income and AGI (per §32(a)(2)).
  const measure = Math.max(earnedIncome, Math.max(0, agi));
  const phaseOutAmountRaw =
    measure > row.phaseOutStart
      ? (measure - row.phaseOutStart) * row.phaseOutRate
      : 0;
  const creditRaw =
    measure > row.maxAgi ? 0 : Math.max(0, phaseInAmountRaw - phaseOutAmountRaw);

  return {
    qualifyingChildren,
    earnedIncome,
    investmentIncome,
    disqualifiedByInvestment: false,
    phaseInAmount: round(phaseInAmountRaw),
    phaseOutAmount: round(phaseOutAmountRaw),
    credit: round(creditRaw),
  };
}
