import { describe, it, expect } from 'vitest';
import { computeForm5695 } from './form5695.js';
import type { Form5695 } from '../../../shared/types.js';

function f(p: Partial<Form5695>): Form5695 {
  return {
    solarElectric: 0,
    solarWaterHeating: 0,
    windEnergy: 0,
    geothermalHeatPump: 0,
    biomassFuel: 0,
    batteryStorageTech: 0,
    fuelCellCost: 0,
    fuelCellKw: 0,
    insulationAirSealing: 0,
    exteriorWindows: 0,
    exteriorDoors: 0,
    homeEnergyAudit: 0,
    heatPumps: 0,
    biomassStoves: 0,
    centralAc: 0,
    furnaceBoiler: 0,
    ...p,
  };
}

describe('computeForm5695', () => {
  it('no form → zeros', () => {
    const r = computeForm5695(undefined);
    expect(r.cleanEnergyCredit).toBe(0);
    expect(r.energyEfficientCredit).toBe(0);
    expect(r.total).toBe(0);
  });

  it('empty form → zeros', () => {
    const r = computeForm5695(f({}));
    expect(r.cleanEnergyCredit).toBe(0);
    expect(r.energyEfficientCredit).toBe(0);
    expect(r.total).toBe(0);
  });

  it('solar electric $20k only → 30% = $6,000 clean energy credit', () => {
    const r = computeForm5695(f({ solarElectric: 20000 }));
    expect(r.cleanEnergyCredit).toBe(6000);
    expect(r.energyEfficientCredit).toBe(0);
    expect(r.total).toBe(6000);
  });

  it('fuel cell $10k with 1 kW → 30% × $10k = $3,000 vs cap $1,000 → $1,000', () => {
    const r = computeForm5695(f({ fuelCellCost: 10000, fuelCellKw: 1 }));
    expect(r.cleanEnergyCredit).toBe(1000);
    expect(r.total).toBe(1000);
  });

  it('fuel cell under cap → 30% applies without cap binding', () => {
    // 30% × $2,000 = $600; cap = $1,000 × 1 kW = $1,000 → $600 wins.
    const r = computeForm5695(f({ fuelCellCost: 2000, fuelCellKw: 1 }));
    expect(r.cleanEnergyCredit).toBe(600);
  });

  it('windows $5,000 → 30% = $1,500 capped at $600 windows sub-cap', () => {
    const r = computeForm5695(f({ exteriorWindows: 5000 }));
    expect(r.energyEfficientCredit).toBe(600);
    expect(r.total).toBe(600);
  });

  it('doors $5,000 → 30% = $1,500 capped at $500 doors sub-cap', () => {
    const r = computeForm5695(f({ exteriorDoors: 5000 }));
    expect(r.energyEfficientCredit).toBe(500);
  });

  it('audit $1,000 → 30% = $300 capped at $150', () => {
    const r = computeForm5695(f({ homeEnergyAudit: 1000 }));
    expect(r.energyEfficientCredit).toBe(150);
  });

  it('insulation $10,000 → 30% = $3,000 but capped by general $1,200', () => {
    const r = computeForm5695(f({ insulationAirSealing: 10000 }));
    expect(r.energyEfficientCredit).toBe(1200);
    expect(r.total).toBe(1200);
  });

  it('central AC $5,000 → 30% = $1,500 capped at $600 per-item (§25C(b)(4)(A)(i))', () => {
    const r = computeForm5695(f({ centralAc: 5000 }));
    expect(r.energyEfficientCredit).toBe(600);
    expect(r.total).toBe(600);
  });

  it('furnace/boiler $5,000 → 30% = $1,500 capped at $600 per-item (§25C(b)(4)(A)(ii))', () => {
    const r = computeForm5695(f({ furnaceBoiler: 5000 }));
    expect(r.energyEfficientCredit).toBe(600);
    expect(r.total).toBe(600);
  });

  it('AC + furnace + windows + doors + audit → each sub-capped, then general $1,200', () => {
    // Pre-general-cap: AC 600 + furnace 600 + windows 600 + doors 500 + audit 150 = 2,450
    // Capped at aggregate general $1,200.
    const r = computeForm5695(
      f({
        centralAc: 5000,
        furnaceBoiler: 5000,
        exteriorWindows: 5000,
        exteriorDoors: 5000,
        homeEnergyAudit: 1000,
      }),
    );
    expect(r.energyEfficientCredit).toBe(1200);
  });

  it('heat pumps $10k + biomass stoves $5k → 30% × $15k = $4,500 capped at $2,000', () => {
    const r = computeForm5695(f({ heatPumps: 10000, biomassStoves: 5000 }));
    expect(r.energyEfficientCredit).toBe(2000);
    expect(r.total).toBe(2000);
  });

  it('combined: insulation + heat pumps → general $1,200 + heat pump $2,000 = $3,200', () => {
    const r = computeForm5695(f({ insulationAirSealing: 10000, heatPumps: 10000 }));
    expect(r.energyEfficientCredit).toBe(3200);
    expect(r.total).toBe(3200);
  });

  it('Part I + Part II combine into total', () => {
    const r = computeForm5695(
      f({ solarElectric: 20000, insulationAirSealing: 10000, heatPumps: 10000 }),
    );
    expect(r.cleanEnergyCredit).toBe(6000);
    expect(r.energyEfficientCredit).toBe(3200);
    expect(r.total).toBe(9200);
  });

  it('multiple Part I items aggregate at 30%', () => {
    const r = computeForm5695(
      f({
        solarElectric: 10000,
        solarWaterHeating: 2000,
        windEnergy: 3000,
        geothermalHeatPump: 5000,
        biomassFuel: 1000,
        batteryStorageTech: 4000,
      }),
    );
    // 25,000 × 0.30 = 7,500
    expect(r.cleanEnergyCredit).toBe(7500);
  });
});
