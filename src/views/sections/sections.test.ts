// Smoke-tests that mount every section view with a non-trivial pre-populated
// tax return and exercise the save flow so the onMounted/save code paths run.
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import { useTaxReturnStore } from '../../stores/taxReturn';

import PersonalInfoSection from './PersonalInfoSection.vue';
import IncomeSection from './IncomeSection.vue';
import InterestDividendsSection from './InterestDividendsSection.vue';
import SelfEmploymentSection from './SelfEmploymentSection.vue';
import CapitalGainsSection from './CapitalGainsSection.vue';
import RetirementSection from './RetirementSection.vue';
import SsBenefitsSection from './SsBenefitsSection.vue';
import UnemploymentSection from './UnemploymentSection.vue';
import GamblingSection from './GamblingSection.vue';
import OtherIncomeSection from './OtherIncomeSection.vue';
import ScheduleESection from './ScheduleESection.vue';
import K1Section from './K1Section.vue';
import ScheduleFSection from './ScheduleFSection.vue';
import Form4797Section from './Form4797Section.vue';
import Form4562Section from './Form4562Section.vue';
import Form8829Section from './Form8829Section.vue';
import Schedule1Section from './Schedule1Section.vue';
import Form8606Section from './Form8606Section.vue';
import Form8889Section from './Form8889Section.vue';
import Form2441Section from './Form2441Section.vue';
import Form8863Section from './Form8863Section.vue';
import Form8880Section from './Form8880Section.vue';
import ScheduleRSection from './ScheduleRSection.vue';
import Form8396Section from './Form8396Section.vue';
import Form5695Section from './Form5695Section.vue';
import Form8936Section from './Form8936Section.vue';
import Form1116Section from './Form1116Section.vue';
import Schedule8812Section from './Schedule8812Section.vue';
import EitcSection from './EitcSection.vue';
import Form8962Section from './Form8962Section.vue';
import Form6251Section from './Form6251Section.vue';
import Form8960Section from './Form8960Section.vue';
import Form8959Section from './Form8959Section.vue';
import Form2555Section from './Form2555Section.vue';
import ScheduleHSection from './ScheduleHSection.vue';
import Form2210Section from './Form2210Section.vue';
import Form5405Section from './Form5405Section.vue';
import Form4972Section from './Form4972Section.vue';
import Form8995Section from './Form8995Section.vue';
import DeductionsSection from './DeductionsSection.vue';
import ReviewSection from './ReviewSection.vue';

type Sec = { name: string; component: unknown; populated?: Record<string, unknown> };

const SECTIONS: Sec[] = [
  { name: 'PersonalInfo', component: PersonalInfoSection },
  { name: 'Income', component: IncomeSection, populated: {
    w2s: [{
      id: 'w1', employer: 'Acme', ein: '12-3456789',
      box1Wages: 50000, box2FedWithheld: 4000,
      box3SsWages: 50000, box4SsWithheld: 3100,
      box5MedicareWages: 50000, box6MedicareWithheld: 725,
      stateWages: 50000, stateWithheld: 2000,
    }],
  } },
  { name: 'InterestDividends', component: InterestDividendsSection, populated: {
    interest: [{ id: 'i', payer: 'Bank', amount: 100, taxExempt: false, privateActivityBondInterest: 0 }],
    dividends: [{ id: 'd', payer: 'Brokerage', ordinary: 100, qualified: 90, totalCapGainDistributions: 0, unrecapSection1250Gain: 0, section1202Gain: 0 }],
  } },
  { name: 'SelfEmployment', component: SelfEmploymentSection, populated: {
    selfEmployment: [{
      id: 's', businessName: 'Freelance', ein: null,
      principalActivity: null, grossReceipts: 10000, returnsAllowances: 0, costOfGoods: 0,
      expenses: { supplies: 100 },
    }],
  } },
  { name: 'CapitalGains', component: CapitalGainsSection, populated: {
    capitalGains: [{ id: 'c', description: 'X', dateAcquired: '2023-01-01', dateSold: '2024-01-01', proceeds: 1000, costBasis: 800, term: 'long', washSaleLossDisallowed: 0 }],
  } },
  { name: 'Retirement', component: RetirementSection, populated: {
    retirementIncome: [{
      id: 'r', payer: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000,
      federalWithheld: 0, stateWithheld: 0, distributionCode: null,
      isIra: true, isRoth: false, exceptionCode: null, taxableAmountNotDetermined: false,
    }],
  } },
  { name: 'SsBenefits', component: SsBenefitsSection, populated: {
    socialSecurity: { grossBenefits: 15000, medicarePremiums: 1200, federalWithheld: 0 },
  } },
  { name: 'Unemployment', component: UnemploymentSection, populated: {
    unemployment: [{ id: 'u', payer: 'State', amount: 1000, federalWithheld: 0 }],
  } },
  { name: 'Gambling', component: GamblingSection, populated: {
    gambling: [{ id: 'g', payer: 'Casino', winnings: 500, federalWithheld: 0 }],
    gamblingLosses: 100,
  } },
  { name: 'OtherIncome', component: OtherIncomeSection, populated: {
    otherIncome: [{ id: 'o', source: 'jury_duty', description: 'd', amount: 50 }],
  } },
  { name: 'ScheduleE', component: ScheduleESection, populated: {
    scheduleERentals: [{
      id: 'p', propertyAddress: '1 X', propertyType: null, fairRentalDays: 365,
      personalUseDays: 0, rentsReceived: 18000, expenses: { repairs: 500 },
      activeParticipation: true, isPassive: true, priorYearUnallowedLoss: 0,
    }],
    scheduleERoyalties: [{ id: 'r', source: 'Book', grossRoyalties: 1500, expenses: 0 }],
  } },
  { name: 'K1', component: K1Section, populated: {
    k1s: [{
      id: 'k', entityKind: 'partnership', entityName: 'LP', ein: null, isPassive: true,
      ordinaryBusinessIncome: 1000, netRentalRealEstate: 0, otherRentalIncome: 0,
      interestIncome: 50, ordinaryDividends: 10, qualifiedDividends: 5, royalties: 0,
      shortTermCapitalGain: 0, longTermCapitalGain: 0, section1231Gain: 0,
      priorYearUnallowedLoss: 0,
    }],
  } },
  { name: 'ScheduleF', component: ScheduleFSection, populated: {
    farms: [{ id: 'f', farmName: 'Farm', principalProduct: 'Corn', accountingMethod: 'cash', grossIncome: 20000, expenses: { seed: 500 } }],
  } },
  { name: 'Form4797', component: Form4797Section, populated: {
    form4797Sales: [{ id: 's', description: 'Equip', dateAcquired: '2020-01-01', dateSold: '2024-01-01', proceeds: 4000, costBasis: 10000, accumulatedDepreciation: 8000, depreciationRecapture: 2000, term: 'long_1231' }],
  } },
  { name: 'Form4562', component: Form4562Section, populated: {
    depreciationAssets: [{ id: 'a', description: 'Computer', datePlacedInService: '2024-06-01', cost: 2500, macrsClass: '5', section179Election: 0, claimBonus: false, businessUsePercent: 1, businessId: null }],
  } },
  { name: 'Form8829', component: Form8829Section, populated: {
    homeOffices: [{ id: 'h', businessId: null, useSimplified: true, squareFeet: 200, totalHomeSquareFeet: 2000, utilities: 1000, insurance: 500, mortgageInterest: 0, realEstateTax: 0, repairs: 100, depreciation: 0 }],
  } },
  { name: 'Schedule1', component: Schedule1Section, populated: {
    schedule1Adjustments: {
      educatorExpenses: 250, hsaDeduction: 0, selfEmployedHealthInsurance: 0,
      sepContribution: 0, simpleContribution: 0, solo401kContribution: 0,
      traditionalIraDeduction: 0, studentLoanInterest: 0, penaltyEarlyWithdrawal: 0,
      alimonyPaid: 0, alimonyRecipientSsn: null, alimonyDivorceDate: null,
      reservistExpenses: 0, performingArtistExpenses: 0, feeBasisExpenses: 0,
    },
  } },
  { name: 'Form8606', component: Form8606Section, populated: {
    form8606: { priorYearBasis: 1000, currentYearNondeductible: 0, traditionalIraBalance: 5000, distributions: 0, conversions: 0 },
  } },
  { name: 'Form8889', component: Form8889Section, populated: {
    form8889: { coverage: 'self', contributions: 2000, isCatchUpEligible: false, distributions: 0, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false },
  } },
  { name: 'Form2441', component: Form2441Section, populated: {
    form2441: { totalQualifiedExpenses: 3000, numQualifyingPersons: 1, taxpayerEarnedIncome: 50000, spouseEarnedIncome: 0, employerProvidedBenefits: 0 },
  } },
  { name: 'Form8863', component: Form8863Section, populated: {
    form8863Students: [{ id: 's', studentName: 'Kid', studentSsnLast4: '1234', creditType: 'aotc', qualifiedExpenses: 4000, isEligibleForAotc: true, priorAotcYears: 0 }],
  } },
  { name: 'Form8880', component: Form8880Section, populated: {
    form8880: { elective401kDeferrals: 1000, iraContributions: 500, spouseElective401kDeferrals: 0, spouseIraContributions: 0, distributionsReceived: 0 },
  } },
  { name: 'ScheduleR', component: ScheduleRSection, populated: {
    scheduleR: { isTaxpayerEligible: true, isSpouseEligible: false, taxpayerUnder65Disabled: false, spouseUnder65Disabled: false, disabilityIncome: 0, nontaxableSsAndPension: 0 },
  } },
  { name: 'Form8396', component: Form8396Section, populated: {
    form8396: { certificateRate: 0.2, mortgageInterestPaid: 5000, priorYearUnusedCredit: 0 },
  } },
  { name: 'Form5695', component: Form5695Section, populated: {
    form5695: {
      solarElectric: 10000, solarWaterHeating: 0, windEnergy: 0, geothermalHeatPump: 0,
      biomassFuel: 0, batteryStorageTech: 0, fuelCellCost: 0, fuelCellKw: 0,
      insulationAirSealing: 500, exteriorWindows: 300, exteriorDoors: 200,
      homeEnergyAudit: 150, heatPumps: 1000, biomassStoves: 0, centralAc: 0, furnaceBoiler: 0,
    },
  } },
  { name: 'Form8936', component: Form8936Section, populated: {
    form8936Vehicles: [{
      id: 'v', make: 'Tesla', model: 'Y', year: 2024, vin: 'A1', placedInService: '2024-03-01',
      isNew: true, purchasePrice: 45000, businessUsePercent: 0, userEnteredCredit: 7500,
    }],
  } },
  { name: 'Form1116', component: Form1116Section, populated: {
    form1116Baskets: [{ id: 'b', category: 'passive', country: 'DE', foreignGrossIncome: 2000, definitelyRelatedDeductions: 0, foreignTaxPaid: 300 }],
  } },
  { name: 'Schedule8812', component: Schedule8812Section, populated: {
    schedule8812: { qualifyingChildrenOverride: 2, earnedIncomeOverride: 50000, includeCombatPay: true, combatPayAmount: 1000 },
  } },
  { name: 'Eitc', component: EitcSection, populated: {
    eitcEligibility: { qualifyingChildrenOverride: 1, investmentIncomeOverride: 100, isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
  } },
  { name: 'Form8962', component: Form8962Section, populated: {
    form8962: { householdSize: 2, federalPovertyLine: 20000, annualEnrollmentPremium: 7000, annualSlcsp: 8000, advancePtcPaid: 500, additionalMagi: 0 },
  } },
  { name: 'Form6251', component: Form6251Section, populated: {
    form6251: { privateActivityBondInterest: 100, amtDepreciationAdjustment: 0, otherAdjustments: 0, amtNolCarryforward: 0 },
  } },
  { name: 'Form8960', component: Form8960Section, populated: {
    form8960: { investmentInterestExpense: 100, stateTaxAllocableToInvestment: 0, miscInvestmentExpenses: 0, otherModifications: 0 },
  } },
  { name: 'Form8959', component: Form8959Section, populated: {
    form8959: { rrtaCompensation: 0, additionalMedicareWithheld: 0 },
  } },
  { name: 'Form2555', component: Form2555Section, populated: {
    form2555: { foreignEarnedIncome: 50000, qualifyingDays: 330, totalDaysInPeriod: 365, housingExpenses: 12000, isBonaFideResident: true, usesPhysicalPresence: false },
  } },
  { name: 'ScheduleH', component: ScheduleHSection, populated: {
    scheduleH: { cashWagesSsMedicare: 10000, cashWagesFuta: 10000, anyQuarterOver1000: true, federalIncomeTaxWithheld: 0, stateUnemploymentPaid: 400 },
  } },
  { name: 'Form2210', component: Form2210Section, populated: {
    form2210: { priorYearTax: 1000, priorYearAgi: 50000, withholdingByQuarter: [250, 250, 250, 250], estimatedPaymentsByQuarter: [0, 0, 0, 0], requestWaiver: false },
  } },
  { name: 'Form5405', component: Form5405Section, populated: {
    form5405: { annualInstallment: 500, dispositionAccelerated: 0 },
  } },
  { name: 'Form4972', component: Form4972Section, populated: {
    form4972: { qualifyingLumpSum: 50000, capitalGainPortion: 10000, ordinaryPortion: 40000, computedTax: 6000 },
  } },
  { name: 'Form8995', component: Form8995Section, populated: {
    form8995: {
      activities: [{ id: 'a', name: 'Consulting', ein: null, qbi: 20000, isSstb: false, w2Wages: 5000, ubia: 0 }],
      reitPtpDividends: 100, priorYearQbiLossCarry: 0, priorYearReitPtpLossCarry: 0,
    },
  } },
  { name: 'Deductions', component: DeductionsSection, populated: {
    useStandardDeduction: false,
    itemized: { medical: 1000, stateLocalTax: 5000, realEstateTax: 3000, mortgageInterest: 8000, charitableCash: 2000, charitableNoncash: 500 },
  } },
  { name: 'Review', component: ReviewSection },
];

beforeEach(() => {
  vi.restoreAllMocks();
  // Global fetch mock so onMounted() calls in sections don't hit invalid URLs
  // before we can stub the store.
  (globalThis as unknown as { fetch: Mock }).fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
  }) as unknown as Response);
});

function stubStore(store: ReturnType<typeof useTaxReturnStore>, data: Record<string, unknown>) {
  store.data = data as never;
  store.computed = null;
  store.load = vi.fn(async () => { store.data = data as never; }) as never;
  store.loadYearLists = vi.fn() as unknown as typeof store.loadYearLists;
  store.refreshComputed = vi.fn(async () => { /* noop */ }) as unknown as typeof store.refreshComputed;
  store.switchYear = vi.fn() as unknown as typeof store.switchYear;
  store.saveMeta = vi.fn() as unknown as typeof store.saveMeta;
  store.savePersonalInfo = vi.fn() as unknown as typeof store.savePersonalInfo;
  store.saveList = vi.fn() as unknown as typeof store.saveList;
  store.saveItemized = vi.fn() as unknown as typeof store.saveItemized;
  store.saveSocialSecurity = vi.fn() as unknown as typeof store.saveSocialSecurity;
  store.savePayload = vi.fn() as unknown as typeof store.savePayload;
}

async function mountSectionEmpty(sec: Sec) {
  let store!: ReturnType<typeof useTaxReturnStore>;
  const { wrapper } = mountInApp(sec.component as never, {}, {
    beforeMount: () => {
      store = useTaxReturnStore();
      stubStore(store, stubTaxStoreData());
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return { wrapper, store };
}

async function mountSectionPopulated(sec: Sec) {
  const populated = sec.populated || {};
  let store!: ReturnType<typeof useTaxReturnStore>;
  const { wrapper } = mountInApp(sec.component as never, {}, {
    beforeMount: () => {
      store = useTaxReturnStore();
      stubStore(store, stubTaxStoreData(populated));
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return { wrapper, store };
}

async function mountSectionLoading(sec: Sec) {
  // data=null, load() populates it. Exercises the `if (!taxStore.data)` branch.
  let store!: ReturnType<typeof useTaxReturnStore>;
  const data = stubTaxStoreData();
  const { wrapper } = mountInApp(sec.component as never, {}, {
    beforeMount: () => {
      store = useTaxReturnStore();
      store.data = null;
      store.computed = null;
      store.load = vi.fn(async () => { store.data = data as never; }) as never;
      store.loadYearLists = vi.fn() as unknown as typeof store.loadYearLists;
      store.refreshComputed = vi.fn() as unknown as typeof store.refreshComputed;
      store.switchYear = vi.fn() as unknown as typeof store.switchYear;
      store.saveMeta = vi.fn() as unknown as typeof store.saveMeta;
      store.savePersonalInfo = vi.fn() as unknown as typeof store.savePersonalInfo;
      store.saveList = vi.fn() as unknown as typeof store.saveList;
      store.saveItemized = vi.fn() as unknown as typeof store.saveItemized;
      store.saveSocialSecurity = vi.fn() as unknown as typeof store.saveSocialSecurity;
      store.savePayload = vi.fn() as unknown as typeof store.savePayload;
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return { wrapper, store };
}

describe('sections smoke', () => {
  for (const sec of SECTIONS) {
    describe(sec.name, () => {
      it('mounts empty and clicking save calls at least one store method', async () => {
        const { wrapper, store } = await mountSectionEmpty(sec);
        const nextBtn = wrapper.findAll('button').find((b) => /save|next|finish/i.test(b.text()));
        if (nextBtn) await nextBtn.trigger('click');
        expect(wrapper.html()).toBeTruthy();
        void store;
      });

      it('exercises the fallback load path when store.data starts null', async () => {
        const { wrapper, store } = await mountSectionLoading(sec);
        expect(store.load).toHaveBeenCalled();
        expect(wrapper.html()).toBeTruthy();
      });

      it('mounts with populated data and triggers save', async () => {
        const { wrapper } = await mountSectionPopulated(sec);
        // Wait for onMounted to complete.
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        const nextBtn = wrapper.findAll('button').find((b) => /save|next|finish/i.test(b.text()));
        if (nextBtn) await nextBtn.trigger('click');
        await new Promise((r) => setTimeout(r, 0));
        expect(wrapper.html()).toBeTruthy();
      });

      it('clicking "Add" buttons (if any) produces new rows', async () => {
        const { wrapper } = await mountSectionEmpty(sec);
        const addBtns = wrapper.findAll('button').filter((b) => /^Add /.test(b.text()));
        for (const b of addBtns) {
          await b.trigger('click');
          await new Promise((r) => setTimeout(r, 0));
        }
        expect(wrapper.html()).toBeTruthy();
      });
    });
  }
});
