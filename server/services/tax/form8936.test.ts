import { describe, it, expect, beforeAll } from 'vitest';
import { computeForm8936 } from './form8936.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type { Form8936Vehicle, TaxYearConstants } from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
});

function v(p: Partial<Form8936Vehicle>): Form8936Vehicle {
  return {
    id: p.id ?? 'vehicle-1',
    make: null,
    model: null,
    year: 2025,
    vin: null,
    placedInService: null,
    isNew: true,
    purchasePrice: 0,
    businessUsePercent: 0,
    userEnteredCredit: 0,
    ...p,
  };
}

describe('computeForm8936', () => {
  it('no vehicles → zeros', () => {
    const r = computeForm8936(undefined, DEFAULT_2025.evCredit);
    expect(r.perVehicleCredits).toEqual([]);
    expect(r.personalUseCredit).toBe(0);
    expect(r.businessUseCredit).toBe(0);
  });

  it('empty list → zeros', () => {
    const r = computeForm8936([], DEFAULT_2025.evCredit);
    expect(r.perVehicleCredits).toEqual([]);
    expect(r.personalUseCredit).toBe(0);
    expect(r.businessUseCredit).toBe(0);
  });

  it('1 new vehicle, $7,500 credit, no business use → personal $7,500', () => {
    const r = computeForm8936(
      [v({ isNew: true, userEnteredCredit: 7500, businessUsePercent: 0 })],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(DEFAULT_2025.evCredit!.newVehicleMax);
    expect(r.businessUseCredit).toBe(0);
    expect(r.perVehicleCredits).toEqual([7500]);
  });

  it('1 new vehicle, $10,000 user-entered (invalid) → capped at $7,500', () => {
    const r = computeForm8936(
      [v({ isNew: true, userEnteredCredit: 10000, businessUsePercent: 0 })],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(DEFAULT_2025.evCredit!.newVehicleMax);
    expect(r.perVehicleCredits).toEqual([7500]);
  });

  it('1 used vehicle, purchasePrice $30,000 → over cap → $0 credit', () => {
    const r = computeForm8936(
      [
        v({
          isNew: false,
          purchasePrice: 30000,
          userEnteredCredit: 4000,
          businessUsePercent: 0,
        }),
      ],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(0);
    expect(r.businessUseCredit).toBe(0);
    expect(r.perVehicleCredits).toEqual([0]);
  });

  it('1 used vehicle, price $10,000, $4,000 entered → 30% cap = $3,000', () => {
    const r = computeForm8936(
      [
        v({
          isNew: false,
          purchasePrice: 10000,
          userEnteredCredit: DEFAULT_2025.evCredit!.usedVehicleMax,
          businessUsePercent: 0,
        }),
      ],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(3000);
    expect(r.perVehicleCredits).toEqual([3000]);
  });

  it('1 new vehicle, $7,500, 50% business use → personal $3,750, business $3,750', () => {
    const r = computeForm8936(
      [v({ isNew: true, userEnteredCredit: 7500, businessUsePercent: 0.5 })],
      DEFAULT_2025.evCredit,
    );
    expect(r.personalUseCredit).toBe(3750);
    expect(r.businessUseCredit).toBe(3750);
    expect(r.perVehicleCredits).toEqual([3750]);
  });

  it('multiple vehicles sum correctly', () => {
    const r = computeForm8936(
      [
        v({ id: 'a', isNew: true, userEnteredCredit: 7500, businessUsePercent: 0 }),
        v({
          id: 'b',
          isNew: false,
          purchasePrice: 20000,
          userEnteredCredit: 4000,
          businessUsePercent: 0,
        }),
      ],
      DEFAULT_2025.evCredit,
    );
    // b: min(4000, 4000, 0.30*20000=6000) = 4000
    expect(r.perVehicleCredits).toEqual([7500, 4000]);
    expect(r.personalUseCredit).toBe(11500);
    expect(r.businessUseCredit).toBe(0);
  });

  it('used vehicle at exactly the $25,000 cap still qualifies', () => {
    const r = computeForm8936(
      [
        v({
          isNew: false,
          purchasePrice: 25000,
          userEnteredCredit: 4000,
          businessUsePercent: 0,
        }),
      ],
      DEFAULT_2025.evCredit,
    );
    // min(4000, 4000, 0.30*25000=7500) = 4000
    expect(r.personalUseCredit).toBe(DEFAULT_2025.evCredit!.usedVehicleMax);
  });

  it('§30D(f)(10): new-vehicle AGI cap — single MAGI $200k (both yrs) > $150k → $0', () => {
    const r = computeForm8936(
      [
        v({
          isNew: true,
          userEnteredCredit: 7500,
          finalAssemblyInNorthAmerica: true,
          vehicleClass: 'other',
          msrp: 40000,
        }),
      ],
      DEFAULT_2025.evCredit,
      200000,  // current-year AGI
      200000,  // prior-year AGI
      'single',
    );
    expect(r.personalUseCredit).toBe(0);
    expect(r.perVehicleCredits).toEqual([0]);
  });

  it('§30D(f)(10): lesser-of safe harbor — prior-year AGI $140k < cap → credit allowed even if current $200k', () => {
    const r = computeForm8936(
      [
        v({
          isNew: true,
          userEnteredCredit: 7500,
          finalAssemblyInNorthAmerica: true,
          vehicleClass: 'other',
          msrp: 40000,
        }),
      ],
      DEFAULT_2025.evCredit,
      200000,
      140000,
      'single',
    );
    expect(r.personalUseCredit).toBe(7500);
  });

  it('§30D(d)(1)(G): new vehicle without North America final assembly → $0', () => {
    const r = computeForm8936(
      [
        v({
          isNew: true,
          userEnteredCredit: 7500,
          finalAssemblyInNorthAmerica: false,
          vehicleClass: 'other',
          msrp: 40000,
        }),
      ],
      DEFAULT_2025.evCredit,
      50000,
      50000,
      'single',
    );
    expect(r.personalUseCredit).toBe(0);
  });

  it('§30D(f)(11): MSRP cap — "other" $60k sedan > $55k cap → $0', () => {
    const r = computeForm8936(
      [
        v({
          isNew: true,
          userEnteredCredit: 7500,
          finalAssemblyInNorthAmerica: true,
          vehicleClass: 'other',
          msrp: 60000,
        }),
      ],
      DEFAULT_2025.evCredit,
      50000,
      50000,
      'single',
    );
    expect(r.personalUseCredit).toBe(0);
  });

  it('§30D(f)(11): MSRP cap — $70k SUV (≤ $80k cap) → credit allowed', () => {
    const r = computeForm8936(
      [
        v({
          isNew: true,
          userEnteredCredit: 7500,
          finalAssemblyInNorthAmerica: true,
          vehicleClass: 'suv',
          msrp: 70000,
        }),
      ],
      DEFAULT_2025.evCredit,
      50000,
      50000,
      'single',
    );
    expect(r.personalUseCredit).toBe(7500);
  });

  it('§25E(b)(2): used-vehicle AGI cap — single $80k MAGI (both yrs) > $75k → $0', () => {
    const r = computeForm8936(
      [
        v({
          isNew: false,
          purchasePrice: 20000,
          userEnteredCredit: 4000,
        }),
      ],
      DEFAULT_2025.evCredit,
      80000,
      80000,
      'single',
    );
    expect(r.personalUseCredit).toBe(0);
  });
});
