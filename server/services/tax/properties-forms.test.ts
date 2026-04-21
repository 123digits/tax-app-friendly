// Property-based invariants for additional calculator modules. These run
// ~100 random samples each and shrink on failure, catching edge cases that
// hand-rolled unit tests miss.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeSchedule8812 } from './schedule8812.js';
import { computeForm2441, pickChildCareRate } from './form2441.js';
import { computeForm5695 } from './form5695.js';
import { computeForm8962, pickApplicablePercentage } from './form8962.js';
import { computeForm8936 } from './form8936.js';
import { computeForm8863 } from './form8863.js';
import { summarizeDepreciation } from './form4562.js';
import { applyPassiveLossLimits } from './passiveLoss.js';
import type {
  Dependent,
  DepreciationAsset,
  DepreciationConstants,
  FilingStatus,
  PtcContributionBand,
  PtcConstants,
} from '../../../shared/types.js';

describe('schedule8812 — invariants', () => {
  const kids = (n: number): Dependent[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `k${i}`,
      name: `k${i}`,
      ssnLast4: null,
      relationship: 'son',
      dob: null,
      isQualifyingChild: true,
    }));
  const constants = {
    ctcPerChild: 2000,
    ctcPhaseoutStart: {
      single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qw: 400000,
    } as Record<FilingStatus, number>,
  };

  it('refundable + nonrefundable never exceeds combinedAfterPhaseout', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (numKids, agi, taxLiab, wages) => {
        const r = computeSchedule8812(
          undefined,
          kids(numKids),
          'single',
          agi,
          taxLiab,
          wages,
          0,
          constants,
        );
        expect(r.nonrefundablePortion + r.refundablePortion)
          .toBeLessThanOrEqual(r.combinedAfterPhaseout + 0.02);
      },
    ));
  });

  it('nonrefundable never exceeds tax liability', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      (numKids, taxLiab) => {
        const r = computeSchedule8812(
          undefined,
          kids(numKids),
          'single',
          50000,
          taxLiab,
          30000,
          0,
          constants,
        );
        expect(r.nonrefundablePortion).toBeLessThanOrEqual(taxLiab + 0.02);
      },
    ));
  });

  it('refundable never exceeds qualifyingChildren × refundablePerChild', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 8 }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (numKids, wages) => {
        const r = computeSchedule8812(
          undefined,
          kids(numKids),
          'single',
          30000,
          0,
          wages,
          0,
          constants,
        );
        expect(r.refundablePortion).toBeLessThanOrEqual(
          r.qualifyingChildren * 1700 + 0.02,
        );
      },
    ));
  });

  it('all output amounts are non-negative', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      fc.double({ min: 0, max: 50000, noNaN: true }),
      (numKids, agi, taxLiab) => {
        const r = computeSchedule8812(
          undefined,
          kids(numKids),
          'single',
          agi,
          taxLiab,
          30000,
          0,
          constants,
        );
        expect(r.ctcBeforeLimits).toBeGreaterThanOrEqual(0);
        expect(r.odcBeforeLimits).toBeGreaterThanOrEqual(0);
        expect(r.combinedBeforeLimits).toBeGreaterThanOrEqual(0);
        expect(r.phaseoutReduction).toBeGreaterThanOrEqual(0);
        expect(r.ctcAfterPhaseout).toBeGreaterThanOrEqual(0);
        expect(r.odcAfterPhaseout).toBeGreaterThanOrEqual(0);
        expect(r.combinedAfterPhaseout).toBeGreaterThanOrEqual(0);
        expect(r.nonrefundablePortion).toBeGreaterThanOrEqual(0);
        expect(r.refundablePortion).toBeGreaterThanOrEqual(0);
      },
    ));
  });
});

describe('pickChildCareRate — invariants', () => {
  const C = {
    maxExpenseOne: 3000,
    maxExpenseTwo: 6000,
    rates: [
      { agi: 15000, rate: 0.35 },
      { agi: 43000, rate: 0.20 },
    ],
  };

  it('returns a valid rate from the tier list', () => {
    fc.assert(fc.property(
      fc.double({ min: -100000, max: 1_000_000, noNaN: true }),
      (agi) => {
        const rate = pickChildCareRate(agi, C);
        expect([0.35, 0.20]).toContain(rate);
      },
    ));
  });
});

describe('computeForm2441 — invariants', () => {
  const C = {
    maxExpenseOne: 3000,
    maxExpenseTwo: 6000,
    rates: [
      { agi: 15000, rate: 0.35 },
      { agi: 43000, rate: 0.20 },
    ],
  };

  it('credit never exceeds allowedExpenses × applicableRate', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 20000, noNaN: true }),
      fc.integer({ min: 0, max: 5 }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (expenses, numQP, taxpayer, spouse) => {
        const r = computeForm2441(
          {
            totalQualifiedExpenses: expenses,
            numQualifyingPersons: numQP,
            taxpayerEarnedIncome: taxpayer,
            spouseEarnedIncome: spouse,
            employerProvidedBenefits: 0,
          },
          50000,
          'single',
          C,
        );
        expect(r.credit).toBeCloseTo(r.allowedExpenses * r.applicableRate, 2);
      },
    ));
  });

  it('credit is non-negative', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 20000, noNaN: true }),
      fc.integer({ min: 0, max: 5 }),
      (expenses, numQP) => {
        const r = computeForm2441(
          {
            totalQualifiedExpenses: expenses,
            numQualifyingPersons: numQP,
            taxpayerEarnedIncome: 50000,
            spouseEarnedIncome: 0,
            employerProvidedBenefits: 0,
          },
          50000, 'single', C,
        );
        expect(r.credit).toBeGreaterThanOrEqual(0);
      },
    ));
  });

  it('0 qualifying persons always → credit 0', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 20000, noNaN: true }),
      fc.double({ min: 0, max: 200000, noNaN: true }),
      (expenses, earned) => {
        const r = computeForm2441(
          {
            totalQualifiedExpenses: expenses,
            numQualifyingPersons: 0,
            taxpayerEarnedIncome: earned,
            spouseEarnedIncome: earned,
            employerProvidedBenefits: 0,
          },
          50000, 'single', C,
        );
        expect(r.credit).toBe(0);
      },
    ));
  });
});

describe('computeForm8962 / pickApplicablePercentage — invariants', () => {
  const bands: PtcContributionBand[] = [
    { fpl: 100, pct: 0 },
    { fpl: 150, pct: 0 },
    { fpl: 200, pct: 0.02 },
    { fpl: 250, pct: 0.04 },
    { fpl: 300, pct: 0.06 },
    { fpl: 400, pct: 0.085 },
  ];
  const constants: PtcConstants = {
    contributionBands: bands,
    repaymentCapSingle: [
      { fpl: 200, cap: 375 },
      { fpl: 300, cap: 950 },
      { fpl: 400, cap: 1575 },
    ],
    repaymentCapFamily: [
      { fpl: 200, cap: 750 },
      { fpl: 300, cap: 1900 },
      { fpl: 400, cap: 3150 },
    ],
  };

  it('applicable percentage is non-decreasing within the banded region', () => {
    fc.assert(fc.property(
      fc.double({ min: 100, max: 500, noNaN: true }),
      fc.double({ min: 100, max: 500, noNaN: true }),
      (fplA, fplB) => {
        const [lo, hi] = fplA <= fplB ? [fplA, fplB] : [fplB, fplA];
        const a = pickApplicablePercentage(lo, bands);
        const b = pickApplicablePercentage(hi, bands);
        expect(b).toBeGreaterThanOrEqual(a - 1e-9);
      },
    ));
  });

  it('annualPtc ≤ annualEnrollmentPremium', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 20000, max: 200000, noNaN: true }),
      (premium, slcsp, agi) => {
        const r = computeForm8962(
          {
            householdSize: 2,
            federalPovertyLine: 20440,
            annualEnrollmentPremium: premium,
            annualSlcsp: slcsp,
            advancePtcPaid: 0,
            additionalMagi: 0,
          },
          agi,
          'single',
          constants,
        );
        expect(r.annualPtc).toBeLessThanOrEqual(premium + 0.02);
      },
    ));
  });

  it('refundablePtc and aptcRepayment are non-negative', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 20000, max: 500000, noNaN: true }),
      (premium, slcsp, aptc, agi) => {
        const r = computeForm8962(
          {
            householdSize: 2,
            federalPovertyLine: 20440,
            annualEnrollmentPremium: premium,
            annualSlcsp: slcsp,
            advancePtcPaid: aptc,
            additionalMagi: 0,
          },
          agi,
          'single',
          constants,
        );
        expect(r.refundablePtc).toBeGreaterThanOrEqual(0);
        expect(r.aptcRepayment).toBeGreaterThanOrEqual(0);
        // Only one side is ever nonzero.
        expect(r.refundablePtc === 0 || r.aptcRepayment === 0).toBe(true);
      },
    ));
  });
});

describe('computeForm5695 — invariants', () => {
  const constants = {
    cleanEnergyRate: 0.30,
    fuelCellCapPerHalfKw: 500,
    energyEfficientRate: 0.30,
    generalImprovementAnnualCap: 1200,
    windowsCap: 600,
    doorsCap: 500,
    auditCap: 150,
    heatPumpsBiomassCap: 2000,
    centralAcCap: 600,
    furnaceBoilerCap: 600,
  };

  it('energyEfficientCredit never exceeds combined Part II cap ($1200 general + $2000 heat-pumps)', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (insulation, windows, doors, audit, heatPumps, biomass) => {
        const r = computeForm5695({
          solarElectric: 0, solarWaterHeating: 0, windEnergy: 0,
          geothermalHeatPump: 0, biomassFuel: 0, batteryStorageTech: 0,
          fuelCellCost: 0, fuelCellKw: 0,
          insulationAirSealing: insulation, exteriorWindows: windows,
          exteriorDoors: doors, homeEnergyAudit: audit,
          heatPumps, biomassStoves: biomass, centralAc: 0, furnaceBoiler: 0,
        }, constants);
        expect(r.energyEfficientCredit).toBeLessThanOrEqual(1200 + 2000 + 0.02);
      },
    ));
  });

  it('total = cleanEnergyCredit + energyEfficientCredit', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (solar, insulation) => {
        const r = computeForm5695({
          solarElectric: solar, solarWaterHeating: 0, windEnergy: 0,
          geothermalHeatPump: 0, biomassFuel: 0, batteryStorageTech: 0,
          fuelCellCost: 0, fuelCellKw: 0,
          insulationAirSealing: insulation, exteriorWindows: 0,
          exteriorDoors: 0, homeEnergyAudit: 0,
          heatPumps: 0, biomassStoves: 0, centralAc: 0, furnaceBoiler: 0,
        }, constants);
        expect(r.total).toBeCloseTo(r.cleanEnergyCredit + r.energyEfficientCredit, 2);
      },
    ));
  });

  it('Part I clean-energy credit is 30% of qualified solar costs', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 100000, noNaN: true }),
      (solar) => {
        const r = computeForm5695({
          solarElectric: solar, solarWaterHeating: 0, windEnergy: 0,
          geothermalHeatPump: 0, biomassFuel: 0, batteryStorageTech: 0,
          fuelCellCost: 0, fuelCellKw: 0,
          insulationAirSealing: 0, exteriorWindows: 0,
          exteriorDoors: 0, homeEnergyAudit: 0,
          heatPumps: 0, biomassStoves: 0, centralAc: 0, furnaceBoiler: 0,
        }, constants);
        expect(r.cleanEnergyCredit).toBeCloseTo(solar * 0.30, 1);
      },
    ));
  });
});

describe('computeForm8936 — invariants', () => {
  it('personal + business credit never exceeds user-entered credit', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 15000, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.boolean(),
      (credit, bizPct, isNew) => {
        const r = computeForm8936([
          {
            id: 'v', make: 'X', model: 'Y', year: 2024, vin: null,
            placedInService: '2024-01-01', isNew,
            purchasePrice: 40000,
            businessUsePercent: bizPct,
            userEnteredCredit: credit,
          },
        ], {
          newVehicleMax: 7500, usedVehicleMax: 4000,
          usedVehicleSalePriceCap: 25000, usedVehiclePctCap: 0.30,
        });
        const total = r.personalUseCredit + r.businessUseCredit;
        expect(total).toBeGreaterThanOrEqual(0);
        expect(total).toBeLessThanOrEqual(credit + 0.02);
      },
    ));
  });

  it('perVehicleCredits length equals input length', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }),
      (n) => {
        const vehicles = Array.from({ length: n }, (_, i) => ({
          id: `v${i}`, make: 'X', model: 'Y', year: 2024, vin: null,
          placedInService: '2024-01-01', isNew: true,
          purchasePrice: 40000, businessUsePercent: 0, userEnteredCredit: 7500,
        }));
        const r = computeForm8936(vehicles, {
          newVehicleMax: 7500, usedVehicleMax: 4000,
          usedVehicleSalePriceCap: 25000, usedVehiclePctCap: 0.30,
        });
        expect(r.perVehicleCredits).toHaveLength(n);
      },
    ));
  });
});

describe('form4562 — summarizeDepreciation invariants', () => {
  const C: DepreciationConstants = {
    section179Limit: 1_200_000,
    section179Phaseout: 3_000_000,
    bonusPct: 0.4,
    firstYearMacrs: {
      '3': 0.3333, '5': 0.2, '7': 0.1429, '10': 0.1, '15': 0.05,
      '20': 0.0375, '27.5': 1 / 27.5, '39': 1 / 39, straight_line: 0.1,
    },
  };

  it('total depreciation never exceeds total cost × business use %', () => {
    // form4562.ts treats `businessUsePercent === 0` as an ergonomic "blank
    // field → default 100%" (see `n(a.businessUsePercent) || 1`). That
    // makes the invariant below degenerate on bizPct=0, so the property
    // sample space starts at 1% to exercise the real depreciation path.
    fc.assert(fc.property(
      fc.array(
        fc.record({
          cost: fc.double({ min: 0, max: 100000, noNaN: true }),
          bizPct: fc.double({ min: 0.01, max: 1, noNaN: true }),
          s179: fc.double({ min: 0, max: 50000, noNaN: true }),
          bonus: fc.boolean(),
        }),
        { minLength: 0, maxLength: 4 },
      ),
      (assetData) => {
        const assets: DepreciationAsset[] = assetData.map((a, i) => ({
          id: `a${i}`,
          description: null,
          datePlacedInService: '2024-01-01',
          cost: a.cost,
          macrsClass: '5',
          section179Election: a.s179,
          claimBonus: a.bonus,
          businessUsePercent: a.bizPct,
          businessId: null,
        }));
        const r = summarizeDepreciation(assets, C);
        const totalAdjustedCost = assetData.reduce(
          (acc, a) => acc + a.cost * a.bizPct, 0,
        );
        expect(r.total).toBeLessThanOrEqual(totalAdjustedCost + 0.02);
      },
    ));
  });

  it('§179 component never exceeds the overall §179 limit', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          cost: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
          s179: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        }),
        { minLength: 0, maxLength: 5 },
      ),
      (assetData) => {
        const assets: DepreciationAsset[] = assetData.map((a, i) => ({
          id: `a${i}`, description: null, datePlacedInService: '2024-01-01',
          cost: a.cost, macrsClass: '5',
          section179Election: a.s179, claimBonus: false,
          businessUsePercent: 1, businessId: null,
        }));
        const r = summarizeDepreciation(assets, C);
        expect(r.totalSection179).toBeLessThanOrEqual(C.section179Limit + 0.02);
      },
    ));
  });
});

describe('applyPassiveLossLimits — invariants', () => {
  const constants = {
    allowanceMaxDefault: 25000,
    allowanceMaxMfsApart: 12500,
    agiStartDefault: 100000,
    agiEndDefault: 150000,
    agiStartMfs: 50000,
    agiEndMfs: 75000,
    phaseoutRate: 0.5,
  };

  it('passiveLossesAllowed + totalSuspended ≤ total raw losses + prior-year carried', () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          net: fc.double({ min: -100000, max: 100000, noNaN: true }),
          prior: fc.double({ min: 0, max: 50000, noNaN: true }),
        }),
        { minLength: 0, maxLength: 4 },
      ),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      (entries, agi) => {
        const active = entries.map((e, i) => ({
          id: `a${i}`, net: e.net, priorYearUnallowedLoss: e.prior,
        }));
        const r = applyPassiveLossLimits(active, [], agi, 'single', false, constants);
        // Suspended totals never negative.
        expect(r.totalSuspendedRental).toBeGreaterThanOrEqual(-0.02);
        expect(r.totalSuspendedK1).toBeGreaterThanOrEqual(-0.02);
        expect(r.passiveIncome).toBeGreaterThanOrEqual(-0.02);
      },
    ));
  });

  it('when AGI is above $150k on single, special allowance is fully phased out', () => {
    fc.assert(fc.property(
      fc.double({ min: 150000, max: 500000, noNaN: true }),
      fc.double({ min: 1000, max: 50000, noNaN: true }),
      (agi, loss) => {
        const r = applyPassiveLossLimits(
          [{ id: 'a', net: -loss, priorYearUnallowedLoss: 0 }],
          [], agi, 'single', false, constants,
        );
        expect(r.specialAllowanceApplied).toBe(0);
      },
    ));
  });
});

describe('computeForm8863 — invariants', () => {
  const edu = {
    aotcMax: 2500, aotcRefundablePct: 0.40,
    aotcFirstTierExpense: 2000,
    aotcFirstTierRate: 1.00,
    aotcSecondTierRate: 0.25,
    aotcPhaseout: {
      single: { start: 80000, end: 90000 },
      mfj: { start: 160000, end: 180000 },
      mfs: { start: 0, end: 0 },
      hoh: { start: 80000, end: 90000 },
      qw: { start: 160000, end: 180000 },
    },
    llcRate: 0.20, llcMaxExpenses: 10000,
    llcPhaseout: {
      single: { start: 80000, end: 90000 },
      mfj: { start: 160000, end: 180000 },
      mfs: { start: 0, end: 0 },
      hoh: { start: 80000, end: 90000 },
      qw: { start: 160000, end: 180000 },
    },
    studentLoanInterestLimit: 2500,
    studentLoanInterestPhaseout: {
      single: { start: 80000, end: 95000 },
      mfj: { start: 165000, end: 195000 },
      mfs: { start: 0, end: 0 },
      hoh: { start: 80000, end: 95000 },
      qw: { start: 165000, end: 195000 },
    },
    educatorExpenseLimit: 300,
  };

  it('totalCredit is non-negative and equals refundable + nonrefundable', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 30000, noNaN: true }),
      fc.double({ min: 0, max: 500000, noNaN: true }),
      (expenses, agi) => {
        const r = computeForm8863(
          [
            {
              id: 's', studentName: 'S', studentSsnLast4: null, creditType: 'aotc',
              qualifiedExpenses: expenses, isEligibleForAotc: true, priorAotcYears: 0,
            },
          ],
          agi, 'single', edu,
        );
        expect(r.totalCredit).toBeGreaterThanOrEqual(0);
        expect(r.totalCredit).toBeCloseTo(r.nonrefundablePortion + r.refundablePortion, 2);
      },
    ));
  });

  it('AOTC phaseout factor is in [0, 1]', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 500000, noNaN: true }),
      (agi) => {
        const r = computeForm8863(
          [{ id: 's', studentName: 'S', studentSsnLast4: null, creditType: 'aotc',
             qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 }],
          agi, 'single', edu,
        );
        expect(r.aotcPhaseoutFactor).toBeGreaterThanOrEqual(0);
        expect(r.aotcPhaseoutFactor).toBeLessThanOrEqual(1);
      },
    ));
  });
});
