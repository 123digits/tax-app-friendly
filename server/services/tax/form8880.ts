// Form 8880: Retirement Savings Contributions Credit ("Saver's Credit").
//
// Eligible contributions = elective deferrals (401(k)/403(b)/457/SIMPLE) plus
// traditional + Roth IRA contributions, reduced by distributions received
// during the testing period. Each person's base is capped at $2,000; on MFJ
// the spouse's base is tracked separately and added. The applicable rate
// (50/20/10/0%) is picked from an AGI-tiered table driven by filing status.
//
// Phase 7 simplification: distributionsReceived is subtracted from the
// taxpayer base only (not combined). This matches the approximation called
// out in PLAN.md and is sufficient for the single-row credit UI.

import type {
  Form8880,
  FilingStatus,
  SaversCreditRow,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm8880 {
  eligibleContributions: number; // after distribution offset, capped at $2,000 per person
  applicableRate: number;        // 0.50 / 0.20 / 0.10 / 0 based on AGI tier
  credit: number;
}

export function computeForm8880(
  f: Form8880 | undefined,
  agi: number,
  filingStatus: FilingStatus,
  tiers: SaversCreditRow | undefined,
): ComputedForm8880 {
  if (!tiers || !Array.isArray(tiers.agiTiers) || !Array.isArray(tiers.rates)) {
    return { eligibleContributions: 0, applicableRate: 0, credit: 0 };
  }

  const elective = Math.max(0, Number(f?.elective401kDeferrals) || 0);
  const ira = Math.max(0, Number(f?.iraContributions) || 0);
  const spouseElective = Math.max(0, Number(f?.spouseElective401kDeferrals) || 0);
  const spouseIra = Math.max(0, Number(f?.spouseIraContributions) || 0);
  const distributions = Math.max(0, Number(f?.distributionsReceived) || 0);

  const cap = tiers?.perPersonCap ?? 2000;

  // Taxpayer base: contributions minus distributions received in the testing
  // period, floored at zero, then capped at the per-person $2,000 limit.
  const taxpayerBase = Math.min(
    cap,
    Math.max(0, elective + ira - distributions),
  );

  // Spouse base only applies on MFJ (the only status with a joint return).
  const spouseBase =
    filingStatus === 'mfj'
      ? Math.min(cap, Math.max(0, spouseElective + spouseIra))
      : 0;

  const eligibleContributions = taxpayerBase + spouseBase;

  // Walk tiers ascending; first tier where AGI <= cutoff wins. Beyond the
  // highest tier the credit zeros out.
  let applicableRate = 0;
  for (let i = 0; i < tiers.agiTiers.length; i++) {
    if (agi <= tiers.agiTiers[i]) {
      applicableRate = tiers.rates[i] ?? 0;
      break;
    }
  }

  const credit = round(eligibleContributions * applicableRate);

  return {
    eligibleContributions: round(eligibleContributions),
    applicableRate,
    credit,
  };
}
