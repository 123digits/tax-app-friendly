// Form 6251 — Alternative Minimum Tax (§§55-59).
//
// AMT runs a parallel tax on AMTI (alternative minimum taxable income) with
// its own exemption and two-rate schedule. The filer owes the LARGER of
// regular tax or tentative minimum tax. Form 6251 reports AMT = max(0, TMT
// − regular tax before credits).
//
// MVP simplification: AMTI = regular-tax taxable income + SALT add-back +
// AMT preferences (private-activity-bond interest, AMT-basis depreciation
// adjustment, other §56/§57 items) − AMT NOL (limited to 90% of AMTI
// before the NOL). Real Form 6251 has ~27 preference/adjustment lines; the
// module captures the MVP handful and exposes a generic "otherAdjustments"
// for anything not modeled.
//
// Preferential rates on net capital gain and qualified dividends: per
// §55(b)(3), TMT is not recomputed at 26/28% on the LTCG/QDI portion;
// instead 26/28% applies to AMTI-after-exemption minus preferential amount,
// and the preferential amount is taxed at regular LTCG rates (0/15/20%) with
// ordinary AMTI stacked underneath for the bracket-threshold calculation.

import type {
  Form6251,
  FilingStatus,
  AmtRow,
  ComputedForm6251,
  LtcgBracketRow,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

function zeros(): ComputedForm6251 {
  return {
    amti: 0,
    exemptionAllowed: 0,
    tentativeMinimumTax: 0,
    regularTaxForAmt: 0,
    amtLiability: 0,
  };
}

export function computeForm6251(
  input: Form6251 | undefined,
  _filingStatus: FilingStatus,
  taxableIncome: number,
  regularTaxBeforeCredits: number,
  itemizedSaltTaken: number,
  miscItemizedNondeductible: number,
  row: AmtRow | undefined,
  preferentialFromRegular: number = 0,
  ltcgRow: LtcgBracketRow | undefined = undefined,
): ComputedForm6251 {
  if (!row) return zeros();

  const ti = Math.max(0, Number(taxableIncome) || 0);
  const salt = Math.max(0, Number(itemizedSaltTaken) || 0);
  const misc = Math.max(0, Number(miscItemizedNondeductible) || 0);

  // Preferences and adjustments.
  const pab = Math.max(0, Number(input?.privateActivityBondInterest) || 0);
  const depAdj = Number(input?.amtDepreciationAdjustment) || 0; // signed
  const otherAdj = Number(input?.otherAdjustments) || 0;
  const amtNolRaw = Math.max(0, Number(input?.amtNolCarryforward) || 0);

  // AMTI before the NOL deduction.
  const amtiBeforeNol = Math.max(0, ti + salt + misc + pab + depAdj + otherAdj);

  // §56(d): AMT NOL deduction limited to 90% of AMTI (computed before the
  // NOL itself). Admin-editable per-status via AmtRow.nolLimitPct.
  const nolLimitPct = row.nolLimitPct ?? 0.9;
  const amtNolAllowed = Math.min(amtNolRaw, nolLimitPct * amtiBeforeNol);

  const amti = Math.max(0, amtiBeforeNol - amtNolAllowed);

  // §55(d) exemption, phased out $0.25 per dollar of AMTI over phaseoutStart.
  const phaseout =
    amti > row.phaseoutStart
      ? (amti - row.phaseoutStart) * row.phaseoutRate
      : 0;
  const exemptionAllowed = Math.max(0, row.exemption - phaseout);

  const amtiAfterExemption = Math.max(0, amti - exemptionAllowed);

  // §55(b)(3) preferential treatment of net capital gain + qualified dividends.
  // The preferential portion is capped at (a) AMTI-after-exemption and (b) the
  // preferential amount used in regular-tax calc. Ordinary AMTI is what's left.
  const preferentialCap = Math.max(0, Number(preferentialFromRegular) || 0);
  const preferentialAmti = Math.min(preferentialCap, amtiAfterExemption);
  const ordinaryAmti = Math.max(0, amtiAfterExemption - preferentialAmti);

  // Two-rate AMT on ordinary portion: 26% on the first rate28Threshold, 28% above.
  const ordLower = Math.min(ordinaryAmti, row.rate28Threshold);
  const ordUpper = Math.max(0, ordinaryAmti - row.rate28Threshold);
  const tmtOrdinary = ordLower * row.rate26 + ordUpper * row.rate28;

  // LTCG portion at 0/15/20% preferential rates, stacked on top of ordinaryAmti.
  // If no LTCG bracket row supplied (or no preferential), skip.
  let tmtPreferential = 0;
  if (preferentialAmti > 0 && ltcgRow) {
    let remaining = preferentialAmti;
    const startsAt = ordinaryAmti;
    const zeroRoom = Math.max(0, ltcgRow.zeroUpTo - startsAt);
    const inZero = Math.min(remaining, zeroRoom);
    remaining -= inZero;
    if (remaining > 0) {
      const fifteenRoom = Math.max(
        0,
        ltcgRow.fifteenUpTo - Math.max(startsAt + inZero, ltcgRow.zeroUpTo),
      );
      const inFifteen = Math.min(remaining, fifteenRoom);
      tmtPreferential += inFifteen * 0.15;
      remaining -= inFifteen;
    }
    if (remaining > 0) {
      tmtPreferential += remaining * 0.20;
    }
  } else if (preferentialAmti > 0 && !ltcgRow) {
    // Fallback: if LTCG bracket not supplied, treat preferential at ordinary
    // AMT rates (the pre-patch behavior) so we never under-tax.
    const lower = Math.min(preferentialAmti, Math.max(0, row.rate28Threshold - ordinaryAmti));
    const upper = Math.max(0, preferentialAmti - lower);
    tmtPreferential = lower * row.rate26 + upper * row.rate28;
  }

  const tentativeMinimumTaxRaw = tmtOrdinary + tmtPreferential;

  const tentativeMinimumTax = round(tentativeMinimumTaxRaw);
  const regularTaxForAmt = round(Math.max(0, Number(regularTaxBeforeCredits) || 0));
  const amtLiability = Math.max(0, round(tentativeMinimumTax - regularTaxForAmt));

  return {
    amti: round(amti),
    exemptionAllowed: round(exemptionAllowed),
    tentativeMinimumTax,
    regularTaxForAmt,
    amtLiability,
  };
}
