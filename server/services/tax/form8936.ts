// Form 8936: Clean Vehicle Credit (new and used). For each vehicle the user
// enters the IRS-certified credit amount (from the seller's report / window
// sticker). We cap that amount against the statutory limits:
//   - New vehicles:  up to $7,500 (§30D), subject to §30D(d)(1)(G) final
//                    assembly in North America and §30D(f)(11) MSRP cap
//                    ($80k SUV/van/pickup, $55k other).
//   - Used vehicles: up to $4,000 AND no more than 30% of the sale price;
//                    sale price must be at or below $25,000 (§25E).
//   - Both: §30D(f)(10) / §25E(b)(2) AGI cap, using the lesser of current
//           and prior-year MAGI against a filing-status threshold.
// The resulting per-vehicle base credit is split between personal-use (the
// nonrefundable Phase 7 credit) and business-use (flows to Form 3800,
// outside the scope of Phase 7).

import type {
  Form8936Vehicle,
  EvCreditConstants,
  FilingStatus,
  Form8936VehicleClass,
} from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm8936 {
  perVehicleCredits: number[];  // personal-use credit per vehicle (same order as input)
  personalUseCredit: number;    // sum of personal-use portion
  businessUseCredit: number;    // sum of business-use portion (flows to Form 3800)
}

// §30D(f)(10) AGI cap per filing status (2025 statutory, non-admin-editable
// for now — these are hardcoded in the statute itself, not a Rev. Proc.).
const NEW_AGI_CAP: Record<FilingStatus, number> = {
  single: 150_000,
  mfj:    300_000,
  mfs:    150_000,
  hoh:    225_000,
  qw:     300_000,
};

// §25E(b)(2) AGI cap per filing status for used clean vehicles.
const USED_AGI_CAP: Record<FilingStatus, number> = {
  single:  75_000,
  mfj:    150_000,
  mfs:     75_000,
  hoh:    112_500,
  qw:     150_000,
};

// §30D(f)(11) MSRP caps.
const MSRP_CAP_LARGE = 80_000; // SUV, van, pickup
const MSRP_CAP_OTHER = 55_000; // sedan, hatchback, coupe, etc.

function msrpCapFor(cls: Form8936VehicleClass | undefined): number {
  if (cls === 'suv' || cls === 'van' || cls === 'pickup') return MSRP_CAP_LARGE;
  return MSRP_CAP_OTHER; // 'other' or undefined defaults to the stricter cap
}

/**
 * §30D(f)(10) / §25E(b)(2) modified-AGI cap gate. Taxpayer qualifies if
 * the LESSER of current-year and prior-year MAGI is at or below the cap
 * ("safe harbor" — either year passing is sufficient).
 *
 * When `priorYearAgi` is undefined we fall back to current-year only, which
 * is the legally-correct answer if the taxpayer had no prior-year filing
 * obligation (and is the safe default for pre-wired callers).
 */
function passesAgiCap(
  agi: number,
  priorYearAgi: number | undefined,
  filingStatus: FilingStatus,
  isNew: boolean,
): boolean {
  const cap = isNew ? NEW_AGI_CAP[filingStatus] : USED_AGI_CAP[filingStatus];
  const current = Math.max(0, Number(agi) || 0);
  const prior =
    priorYearAgi === undefined || priorYearAgi === null
      ? current
      : Math.max(0, Number(priorYearAgi) || 0);
  return Math.min(current, prior) <= cap;
}

export function computeForm8936(
  vehicles: Form8936Vehicle[] | undefined,
  constants?: EvCreditConstants,
  agi?: number,
  priorYearAgi?: number,
  filingStatus?: FilingStatus,
): ComputedForm8936 {
  const newVehicleMax = constants?.newVehicleMax ?? 7500;
  const usedVehicleMax = constants?.usedVehicleMax ?? 4000;
  const usedVehicleSalePriceCap = constants?.usedVehicleSalePriceCap ?? 25000;
  const usedVehiclePctCap = constants?.usedVehiclePctCap ?? 0.30;

  // Gate evaluation requires a filing status. When the orchestrator has not
  // yet been wired to pass AGI/filingStatus, we fall through to legacy
  // behavior (no AGI/final-assembly/MSRP gates) to avoid silently zeroing
  // credits on previously-working callers. Tests exercise the gated path
  // by passing these explicitly.
  const gatesEnabled = filingStatus !== undefined;

  const rows = vehicles ?? [];
  const perVehicleCredits: number[] = [];
  let personalUseCredit = 0;
  let businessUseCredit = 0;

  for (const v of rows) {
    const userEntered = Math.max(0, Number(v?.userEnteredCredit) || 0);
    const purchasePrice = Math.max(0, Number(v?.purchasePrice) || 0);
    const rawBusinessPct = Number(v?.businessUsePercent) || 0;
    const businessPct = Math.min(1, Math.max(0, rawBusinessPct));
    const isNew = !!v?.isNew;

    let baseCredit: number;

    // §30D(f)(10) / §25E(b)(2) AGI cap (only when we know filing status).
    if (gatesEnabled && !passesAgiCap(agi ?? 0, priorYearAgi, filingStatus!, isNew)) {
      baseCredit = 0;
    } else if (isNew) {
      // §30D(d)(1)(G): final assembly must be in North America.
      if (gatesEnabled && !v?.finalAssemblyInNorthAmerica) {
        baseCredit = 0;
      } else if (
        // §30D(f)(11): MSRP cap by vehicle class.
        gatesEnabled &&
        Number(v?.msrp) > 0 &&
        Number(v?.msrp) > msrpCapFor(v?.vehicleClass)
      ) {
        baseCredit = 0;
      } else {
        baseCredit = Math.min(userEntered, newVehicleMax);
      }
    } else {
      // Used vehicle: §25E sale-price cap + 30% of sale price + $4,000 cap.
      if (purchasePrice > usedVehicleSalePriceCap) {
        baseCredit = 0;
      } else {
        baseCredit = Math.min(
          userEntered,
          usedVehicleMax,
          purchasePrice * usedVehiclePctCap,
        );
      }
    }

    const personalPortion = round(baseCredit * (1 - businessPct));
    const businessPortion = round(baseCredit * businessPct);

    perVehicleCredits.push(personalPortion);
    personalUseCredit += personalPortion;
    businessUseCredit += businessPortion;
  }

  return {
    perVehicleCredits,
    personalUseCredit: round(personalUseCredit),
    businessUseCredit: round(businessUseCredit),
  };
}
