// Form 8962 — Premium Tax Credit (PTC) reconciliation.
//
// IRC §36B computes a subsidy for Marketplace health-insurance enrollees by
// capping the filer's expected contribution toward the benchmark Second
// Lowest Cost Silver Plan (SLCSP) at an "applicable percentage" of household
// income. ARPA enhanced PTC was extended through 2025 by the Inflation
// Reduction Act of 2022 (IRA §13101): 0% up to 150% FPL, sliding up to 8.5%
// at 400% FPL, and 8.5% flat above 400% FPL (no 400% FPL cliff).
//
// Annual PTC = min( max(0, annual SLCSP − expected contribution),
//                   annual enrollment premium ).
// Net PTC = annual PTC − advance PTC paid to the exchange (1095-A 33C).
// If negative, the excess APTC must be repaid, subject to a repayment cap
// from Form 8962 Table 5 (2025 IRS-published values, sourced from
// PtcConstants in the DB seed).

import type {
  Form8962,
  FilingStatus,
  ComputedForm8962,
  PtcConstants,
  PtcContributionBand,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

/**
 * Linearly interpolate the applicable percentage within the statutory bands.
 * Input is FPL percentage (e.g. 250 = 250% of FPL).
 *
 * Below the lowest band → 0%.
 * Within bands: linear interpolation.
 * Above the highest band → that band's pct (flat through 2025 under ARPA/IRA; no cliff).
 *
 * `bands` is injected from PtcConstants.contributionBands (DB-seeded for 2025).
 */
export function pickApplicablePercentage(
  fplPct: number,
  bands: PtcContributionBand[],
): number {
  if (fplPct <= bands[0].fpl) return 0;
  for (let i = 0; i < bands.length - 1; i += 1) {
    const lo = bands[i];
    const hi = bands[i + 1];
    if (fplPct >= lo.fpl && fplPct <= hi.fpl) {
      const span = hi.fpl - lo.fpl;
      if (span <= 0) return lo.pct;
      const t = (fplPct - lo.fpl) / span;
      return lo.pct + t * (hi.pct - lo.pct);
    }
  }
  // Above highest band (e.g. 400%): ARPA-enhanced PTC (extended through 2025
  // by IRA §13101) keeps the top band's pct flat; no 400% FPL cliff.
  return bands[bands.length - 1].pct;
}

function zeros(): ComputedForm8962 {
  return {
    householdIncome: 0,
    fplPercent: 0,
    applicablePercentage: 0,
    expectedContribution: 0,
    annualPtc: 0,
    advancePtc: 0,
    netPtc: 0,
    repaymentCap: 0,
    refundablePtc: 0,
    aptcRepayment: 0,
  };
}

function repaymentCapFor(
  fplPct: number,
  filingStatus: FilingStatus,
  capSingle: { fpl: number; cap: number }[],
  capFamily: { fpl: number; cap: number }[],
): number {
  // §36B(f)(2)(B): the repayment cap applies in tiers by FPL%, differing
  // between single filers and everyone else (treated as "family" here).
  // MFS is treated as "single" for cap-tier purposes in MVP; real code has
  // additional MFS eligibility restrictions not handled here.
  const isSingle = filingStatus === 'single' || filingStatus === 'mfs';
  const table = isSingle ? capSingle : capFamily;
  // Ascending-FPL scan: return the first row whose fpl threshold is greater
  // than fplPct (strict <), matching the legacy <200 / <300 / <400 semantics.
  for (const row of table) {
    if (fplPct < row.fpl) return row.cap;
  }
  // Beyond the last threshold (e.g. at/above 400% FPL) there is no cap —
  // full repayment applies.
  return Number.POSITIVE_INFINITY;
}

export function computeForm8962(
  f: Form8962 | undefined,
  agi: number,
  filingStatus: FilingStatus,
  constants?: PtcConstants,
): ComputedForm8962 {
  if (!f) return zeros();

  // Wave 1 parameterization: resolve from injected PtcConstants. All three
  // tables come from the DB seed (schema.sql) via PtcConstants. If the DB
  // isn't seeded we crash fast with a clear message rather than silently
  // computing against stale duplicated values.
  const bands = constants?.contributionBands;
  if (!bands) {
    throw new Error(
      'tax config missing ptc.contributionBands — DB not seeded?',
    );
  }
  const capSingle = constants?.repaymentCapSingle;
  if (!capSingle) {
    throw new Error(
      'tax config missing ptc.repaymentCapSingle — DB not seeded?',
    );
  }
  const capFamily = constants?.repaymentCapFamily;
  if (!capFamily) {
    throw new Error(
      'tax config missing ptc.repaymentCapFamily — DB not seeded?',
    );
  }

  const additionalMagi = Math.max(0, Number(f.additionalMagi) || 0);
  const householdIncome = Math.max(0, (Number(agi) || 0) + additionalMagi);

  const fpl = Math.max(0, Number(f.federalPovertyLine) || 0);
  const householdSize = Math.max(0, Number(f.householdSize) || 0);
  const annualSlcsp = Math.max(0, Number(f.annualSlcsp) || 0);
  const annualEnrollmentPremium = Math.max(
    0,
    Number(f.annualEnrollmentPremium) || 0,
  );
  const advancePtcPaid = Math.max(0, Number(f.advancePtcPaid) || 0);

  if (fpl <= 0 || householdSize <= 0) {
    return {
      ...zeros(),
      householdIncome: round(householdIncome),
      advancePtc: round(advancePtcPaid),
    };
  }

  // Integer FPL percentage per Form 8962 Line 5 instruction.
  const fplPercent = Math.floor((householdIncome / fpl) * 100);

  // §36B(c)(1)(C) + Reg. §1.36B-2(b)(2): MFS filers are generally ineligible
  // for PTC unless a domestic-abuse or spousal-abandonment exception is
  // claimed for the year. When ineligible, the forward PTC is zero but the
  // APTC repayment path still applies — the filer must reconcile any
  // advance payments received during the year.
  const mfsException = !!f.mfsAbuseAbandonmentException;
  const mfsIneligible = filingStatus === 'mfs' && !mfsException;

  // Eligibility band: MVP allows 100%-400% FPL. Outside that (and APTC
  // safe-harbor cases) we treat PTC as $0 but still pass through the APTC
  // repayment calculation.
  // ARPA-enhanced subsidies permit >400% eligibility through 2025 (IRA §13101).
  const eligibleForPtc = fplPercent >= 100 && !mfsIneligible;

  const applicablePercentage = eligibleForPtc
    ? pickApplicablePercentage(fplPercent, bands)
    : 0;
  const expectedContribution = applicablePercentage * householdIncome;

  const ptcCap = Math.max(0, annualSlcsp - expectedContribution);
  const annualPtc = eligibleForPtc
    ? Math.max(0, Math.min(ptcCap, annualEnrollmentPremium))
    : 0;

  const netPtc = annualPtc - advancePtcPaid;

  const capValue = repaymentCapFor(fplPercent, filingStatus, capSingle, capFamily);
  const repaymentCap = Number.isFinite(capValue) ? capValue : 0;

  let refundablePtc = 0;
  let aptcRepayment = 0;
  if (netPtc >= 0) {
    refundablePtc = netPtc;
  } else {
    const excess = -netPtc;
    if (!Number.isFinite(capValue)) {
      // No cap at/above 400% FPL — full repayment required.
      aptcRepayment = excess;
    } else {
      aptcRepayment = Math.min(excess, capValue);
    }
  }

  return {
    householdIncome: round(householdIncome),
    fplPercent,
    applicablePercentage,
    expectedContribution: round(expectedContribution),
    annualPtc: round(annualPtc),
    advancePtc: round(advancePtcPaid),
    netPtc: round(netPtc),
    repaymentCap: round(repaymentCap),
    refundablePtc: round(refundablePtc),
    aptcRepayment: round(aptcRepayment),
  };
}
