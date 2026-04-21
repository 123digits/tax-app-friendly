// Schedule R — Credit for the Elderly or Disabled (§22).
//
// Eligibility: a taxpayer (or spouse) qualifies if they are age 65+ by the end
// of the tax year, OR under 65 and retired on permanent & total disability
// with taxable disability income.
//
// Base amount (§22(c)(2)):
//   single / HOH / QW, one eligible:        $5,000
//   MFJ, both spouses eligible:             $7,500
//   MFJ, one spouse eligible:               $5,000
//   MFS (lived apart from spouse all year): $3,750
//
// For under-65 disabled filers, the base is further capped by taxable
// disability income (§22(c)(2)(B)(iii)). Phase 7 uses the pragmatic MVP
// approach: if either the taxpayer or the spouse is under-65 disabled, the
// base is capped at min(base, disabilityIncome). Mixed cases (one spouse 65+,
// one spouse under-65 disabled) are approximated with the same single cap —
// an exact split of the $3,750 halves is deferred.
//
// AGI / nontaxable-SS reductions (§22(d)):
//   excessAgiReduction      = max(0, AGI − AGI-threshold) / 2
//   nontaxableSsReduction   = nontaxable SS + pension amounts
//   creditBase              = max(0, base − nontaxableSsReduction − excessAgiReduction)
//   credit                  = 15% × creditBase
//
// AGI thresholds:
//   single / HOH / QW: $7,500
//   MFJ:               $10,000
//   MFS:               $5,000
//
// All amounts are statutory (not admin-configurable) and are baked into this
// module. Credit is reported on Form 1040 as a whole-dollar amount.

import type { ScheduleR, FilingStatus, ScheduleRCreditConstants } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedScheduleR {
  baseAmount: number;            // statutory base after filing-status + disability-income caps
  nontaxableSsReduction: number; // nontaxable SS and pension amounts (line 13)
  excessAgiReduction: number;    // ½ × (AGI − threshold), floored at zero
  creditBase: number;            // max(0, baseAmount − reductions)
  credit: number;                // 15% × creditBase, rounded to whole dollars
}

function zeros(): ComputedScheduleR {
  return {
    baseAmount: 0,
    nontaxableSsReduction: 0,
    excessAgiReduction: 0,
    creditBase: 0,
    credit: 0,
  };
}

function baseForStatus(
  filingStatus: FilingStatus,
  taxpayerEligible: boolean,
  spouseEligible: boolean,
  baseSingle: number,
  baseMfjBoth: number,
  baseMfjOne: number,
  baseMfs: number,
): number {
  if (filingStatus === 'mfj') {
    if (taxpayerEligible && spouseEligible) return baseMfjBoth;
    if (taxpayerEligible || spouseEligible) return baseMfjOne;
    return 0;
  }
  if (filingStatus === 'mfs') {
    // We assume the MFS filer lived apart from their spouse all year; only the
    // taxpayer's own eligibility is consulted.
    return taxpayerEligible ? baseMfs : 0;
  }
  // single / HOH / QW
  return taxpayerEligible ? baseSingle : 0;
}

function agiThresholdForStatus(
  filingStatus: FilingStatus,
  agiThresholdSingle: number,
  agiThresholdMfj: number,
  agiThresholdMfs: number,
): number {
  if (filingStatus === 'mfj') return agiThresholdMfj;
  if (filingStatus === 'mfs') return agiThresholdMfs;
  return agiThresholdSingle;
}

export function computeScheduleR(
  f: ScheduleR | undefined,
  agi: number,
  filingStatus: FilingStatus,
  constants?: ScheduleRCreditConstants,
): ComputedScheduleR {
  const rate = constants?.rate ?? 0.15;
  const baseSingle = constants?.baseSingle ?? 5000;
  const baseMfjBoth = constants?.baseMfjBoth ?? 7500;
  const baseMfjOne = constants?.baseMfjOne ?? 5000;
  const baseMfs = constants?.baseMfs ?? 3750;
  const agiThresholdSingle = constants?.agiThresholdSingle ?? 7500;
  const agiThresholdMfj = constants?.agiThresholdMfj ?? 10000;
  const agiThresholdMfs = constants?.agiThresholdMfs ?? 5000;

  const taxpayerEligible = !!f?.isTaxpayerEligible;
  const spouseEligible = !!f?.isSpouseEligible;

  // 1. If neither spouse is eligible, zero out.
  if (!taxpayerEligible && !spouseEligible) return zeros();

  // 2. Base amount by filing status + who's eligible.
  let base = baseForStatus(
    filingStatus,
    taxpayerEligible,
    spouseEligible,
    baseSingle,
    baseMfjBoth,
    baseMfjOne,
    baseMfs,
  );
  if (base === 0) return zeros();

  // 3. Under-65 disabled path: base is also capped by taxable disability
  //    income. MVP: if either party is under-65 disabled, cap the whole base
  //    by the combined disabilityIncome figure the user provided.
  const taxpayerUnder65Disabled = !!f?.taxpayerUnder65Disabled;
  const spouseUnder65Disabled = !!f?.spouseUnder65Disabled;
  const disabilityIncome = Math.max(0, Number(f?.disabilityIncome) || 0);
  if (taxpayerUnder65Disabled || spouseUnder65Disabled) {
    base = Math.min(base, disabilityIncome);
  }

  // 4. Excess AGI reduction: half of (AGI − threshold), floored at zero.
  const threshold = agiThresholdForStatus(
    filingStatus,
    agiThresholdSingle,
    agiThresholdMfj,
    agiThresholdMfs,
  );
  const excessAgiReduction = Math.max(0, (agi - threshold) / 2);

  // 5. Nontaxable SS + pension reduction (Schedule R line 13).
  const nontaxableSsReduction = Math.max(0, Number(f?.nontaxableSsAndPension) || 0);

  // 6. Credit base, floored at zero.
  const creditBase = Math.max(0, base - nontaxableSsReduction - excessAgiReduction);

  // 7. 15% of credit base. Schedule R reports whole dollars on Form 1040, so
  //    round to the nearest dollar for the final credit figure.
  const credit = Math.round(creditBase * rate);

  return {
    baseAmount: round(base),
    nontaxableSsReduction: round(nontaxableSsReduction),
    excessAgiReduction: round(excessAgiReduction),
    creditBase: round(creditBase),
    credit,
  };
}
