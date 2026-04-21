// Form 5695: Residential Energy Credits.
//
// Part I — Residential Clean Energy Credit. 30% of qualified expenses for
// solar electric, solar water heating, wind, geothermal heat pump, biomass
// fuel, and battery storage technology. Fuel cell property is also 30%, but
// capped at $500 per half-kilowatt of capacity ($1,000 per kW).
//
// Part II — Energy Efficient Home Improvement Credit. 30% of qualified
// expenses with layered caps:
//   - General improvements category has an aggregate $1,200 annual cap,
//     with sub-caps on windows ($600 — §25C(b)(5)(C)), doors ($500
//     aggregate — §25C(b)(2)(B)), home energy audits ($150 —
//     §25C(b)(6)), central AC ($600 — §25C(b)(4)(A)(i)), and
//     furnace/boiler ($600 — §25C(b)(4)(A)(ii)). Insulation/air
//     sealing has no per-item sub-cap within the general bucket.
//   - Heat pumps (incl. heat-pump water heaters) and biomass stoves share
//     a separate $2,000 annual cap (§25C(d)(2); not subject to $1,200).
//
// Total credit = Part I + Part II.

import type { Form5695, ResidentialEnergyConstants } from '../../../shared/types.js';
import { round } from './taxComputation.js';

export interface ComputedForm5695 {
  cleanEnergyCredit: number;        // Part I total
  energyEfficientCredit: number;    // Part II total
  total: number;
}

function nn(n: number | undefined): number {
  return Math.max(0, Number(n) || 0);
}

export function computeForm5695(
  f: Form5695 | undefined,
  constants?: ResidentialEnergyConstants,
): ComputedForm5695 {
  if (!f) {
    return { cleanEnergyCredit: 0, energyEfficientCredit: 0, total: 0 };
  }

  const cleanEnergyRate = constants?.cleanEnergyRate ?? 0.30;
  const fuelCellCapPerHalfKw = constants?.fuelCellCapPerHalfKw ?? 500;
  const energyEfficientRate = constants?.energyEfficientRate ?? 0.30;
  const generalImprovementAnnualCap = constants?.generalImprovementAnnualCap ?? 1200;
  const windowsCap = constants?.windowsCap ?? 600;
  const doorsCap = constants?.doorsCap ?? 500;
  const auditCap = constants?.auditCap ?? 150;
  const centralAcCap = constants?.centralAcCap ?? 600;
  const furnaceBoilerCap = constants?.furnaceBoilerCap ?? 600;
  const heatPumpsBiomassCap = constants?.heatPumpsBiomassCap ?? 2000;

  // --- Part I: Residential Clean Energy Credit (30%) ---
  const uncappedCleanEnergyBase =
    nn(f.solarElectric) +
    nn(f.solarWaterHeating) +
    nn(f.windEnergy) +
    nn(f.geothermalHeatPump) +
    nn(f.biomassFuel) +
    nn(f.batteryStorageTech);

  const fuelCellCost = nn(f.fuelCellCost);
  const fuelCellKw = nn(f.fuelCellKw);
  // Cap = $500 × (2 × kW) = $1,000 × kW.
  const fuelCellCap = fuelCellCapPerHalfKw * (fuelCellKw * 2);
  const fuelCellCredit = Math.min(fuelCellCost * cleanEnergyRate, fuelCellCap);

  const cleanEnergyCredit = round(
    uncappedCleanEnergyBase * cleanEnergyRate + fuelCellCredit,
  );

  // --- Part II: Energy Efficient Home Improvement (30% w/ caps) ---
  // General category (aggregate $1,200 cap):
  const insulation = nn(f.insulationAirSealing) * energyEfficientRate;
  const windows = Math.min(nn(f.exteriorWindows) * energyEfficientRate, windowsCap);
  const doors = Math.min(nn(f.exteriorDoors) * energyEfficientRate, doorsCap);
  const audit = Math.min(nn(f.homeEnergyAudit) * energyEfficientRate, auditCap);
  // Per-item sub-caps under §25C(b)(4)(A): central AC and furnace/boiler
  // are each limited to $600 BEFORE being added into the general $1,200
  // aggregate pool.
  const centralAc = Math.min(nn(f.centralAc) * energyEfficientRate, centralAcCap);
  const furnaceBoiler = Math.min(
    nn(f.furnaceBoiler) * energyEfficientRate,
    furnaceBoilerCap,
  );

  const generalSum = insulation + windows + doors + audit + centralAc + furnaceBoiler;
  const generalCapped = Math.min(generalSum, generalImprovementAnnualCap);

  // Separate $2,000 category: heat pumps + biomass stoves.
  const heatPumpBiomassBase = nn(f.heatPumps) + nn(f.biomassStoves);
  const heatPumpBiomassCredit = Math.min(
    heatPumpBiomassBase * energyEfficientRate,
    heatPumpsBiomassCap,
  );

  const energyEfficientCredit = round(generalCapped + heatPumpBiomassCredit);

  const total = round(cleanEnergyCredit + energyEfficientCredit);

  return {
    cleanEnergyCredit,
    energyEfficientCredit,
    total,
  };
}
