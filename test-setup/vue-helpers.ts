import { mount, type MountingOptions } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { defineComponent, h, type Component } from 'vue';

const RouterViewStub = defineComponent({
  name: 'RouterViewStub',
  render() { return h('div'); },
});

function makeVuetify() {
  return createVuetify({ components, directives });
}

export function makeTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: RouterViewStub },
      { path: '/section/:x', component: RouterViewStub },
      { path: '/login', name: 'login', component: RouterViewStub },
      { path: '/admin', name: 'admin', component: RouterViewStub },
      { path: '/admin/tax-years/:year', name: 'admin-tax-year', component: RouterViewStub },
      { path: '/two-factor', name: 'two-factor', component: RouterViewStub },
      { path: '/register', name: 'register', component: RouterViewStub },
    ],
  });
}

export function mountWith<T extends Component>(
  component: T,
  opts: MountingOptions<unknown> = {},
  hooks: { beforeMount?: () => void } = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const vuetify = makeVuetify();
  const router = makeTestRouter();
  hooks.beforeMount?.();
  const mountOpts = {
    ...opts,
    global: {
      plugins: [pinia, vuetify, router],
      stubs: {
        transition: false,
        ...(opts.global?.stubs || {}),
      },
      ...(opts.global || {}),
    },
    attachTo: document.body,
  } as MountingOptions<unknown>;
  return {
    // Component mount options vary by component; we're using the generic
    // overload so cast-through `unknown` keeps TS happy without weakening the
    // callers' generic type.
    wrapper: mount(component, mountOpts as never),
    pinia,
    router,
  };
}

/**
 * Mount a component inside a v-app wrapper. Required for components that use
 * layout-injecting Vuetify primitives like v-app-bar / v-main.
 *
 * The optional `beforeMount` hook runs after a pinia instance is activated but
 * before the component tree is created, giving tests a chance to stub stores.
 */
export function mountInApp<T extends Component>(
  component: T,
  opts: MountingOptions<unknown> = {},
  hooks: { beforeMount?: () => void } = {},
) {
  const slots = (opts as { slots?: Record<string, string> }).slots;
  const props = opts.props as Record<string, unknown> | undefined;
  const AppWrapper = defineComponent({
    render() {
      const inner = h(
        component as object,
        props,
        slots
          ? Object.fromEntries(
              Object.entries(slots).map(([name, html]) => [
                name,
                () => h('div', { innerHTML: html }),
              ]),
            )
          : undefined,
      );
      return h(components.VApp, {}, () => [inner]);
    },
  });
  return mountWith(AppWrapper as unknown as T, { ...opts, props: undefined }, hooks);
}

export function stubTaxStoreData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    taxYear: 2025,
    filingStatus: 'single',
    status: 'in_progress',
    personalInfo: {
      firstName: 'Jane', lastName: 'Doe', ssnLast4: null, dob: '1980-01-01',
      addressLine1: '1 Main', addressLine2: null, city: 'City', state: 'CA', zip: '94000',
      spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
    },
    dependents: [],
    w2s: [],
    interest: [],
    dividends: [],
    selfEmployment: [],
    capitalGains: [],
    retirementIncome: [],
    socialSecurity: { grossBenefits: 0, medicarePremiums: 0, federalWithheld: 0 },
    unemployment: [],
    gambling: [],
    gamblingLosses: 0,
    otherIncome: [],
    scheduleERentals: [],
    scheduleERoyalties: [],
    k1s: [],
    farms: [],
    form4797Sales: [],
    depreciationAssets: [],
    homeOffices: [],
    schedule1Adjustments: {
      educatorExpenses: 0, hsaDeduction: 0, selfEmployedHealthInsurance: 0,
      sepContribution: 0, simpleContribution: 0, solo401kContribution: 0,
      traditionalIraDeduction: 0, studentLoanInterest: 0, penaltyEarlyWithdrawal: 0,
      alimonyPaid: 0, alimonyRecipientSsn: null, alimonyDivorceDate: null,
      reservistExpenses: 0, performingArtistExpenses: 0, feeBasisExpenses: 0,
    },
    form8606: { priorYearBasis: 0, currentYearNondeductible: 0, traditionalIraBalance: 0, distributions: 0, conversions: 0 },
    form8889: { coverage: 'none', contributions: 0, isCatchUpEligible: false, distributions: 0, qualifiedMedicalExpenses: 0, isDisabledOrOver65: false },
    form2441: { totalQualifiedExpenses: 0, numQualifyingPersons: 0, taxpayerEarnedIncome: 0, spouseEarnedIncome: 0, employerProvidedBenefits: 0 },
    form8863Students: [],
    form8880: { elective401kDeferrals: 0, iraContributions: 0, spouseElective401kDeferrals: 0, spouseIraContributions: 0, distributionsReceived: 0 },
    scheduleR: { isTaxpayerEligible: false, isSpouseEligible: false, taxpayerUnder65Disabled: false, spouseUnder65Disabled: false, disabilityIncome: 0, nontaxableSsAndPension: 0 },
    form8396: { certificateRate: 0, mortgageInterestPaid: 0, priorYearUnusedCredit: 0 },
    form5695: {
      solarElectric: 0, solarWaterHeating: 0, windEnergy: 0, geothermalHeatPump: 0,
      biomassFuel: 0, batteryStorageTech: 0, fuelCellCost: 0, fuelCellKw: 0,
      insulationAirSealing: 0, exteriorWindows: 0, exteriorDoors: 0, homeEnergyAudit: 0,
      heatPumps: 0, biomassStoves: 0, centralAc: 0, furnaceBoiler: 0,
    },
    form8936Vehicles: [],
    form1116Baskets: [],
    schedule8812: { qualifyingChildrenOverride: null, earnedIncomeOverride: null, includeCombatPay: false, combatPayAmount: 0 },
    eitcEligibility: { qualifyingChildrenOverride: null, investmentIncomeOverride: null, isEligibleAge: true, includeCombatPay: false, combatPayAmount: 0 },
    form8962: { householdSize: 0, federalPovertyLine: 0, annualEnrollmentPremium: 0, annualSlcsp: 0, advancePtcPaid: 0, additionalMagi: 0 },
    form6251: { privateActivityBondInterest: 0, amtDepreciationAdjustment: 0, otherAdjustments: 0, amtNolCarryforward: 0 },
    form8960: { investmentInterestExpense: 0, stateTaxAllocableToInvestment: 0, miscInvestmentExpenses: 0, otherModifications: 0 },
    form8959: { rrtaCompensation: 0, additionalMedicareWithheld: 0 },
    form2555: { foreignEarnedIncome: 0, qualifyingDays: 0, totalDaysInPeriod: 365, housingExpenses: 0, isBonaFideResident: false, usesPhysicalPresence: false },
    scheduleH: { cashWagesSsMedicare: 0, cashWagesFuta: 0, anyQuarterOver1000: false, federalIncomeTaxWithheld: 0, stateUnemploymentPaid: 0 },
    form2210: { priorYearTax: 0, priorYearAgi: 0, withholdingByQuarter: [0, 0, 0, 0], estimatedPaymentsByQuarter: [0, 0, 0, 0], requestWaiver: false },
    form5405: { annualInstallment: 0, dispositionAccelerated: 0 },
    form4972: { qualifyingLumpSum: 0, capitalGainPortion: 0, ordinaryPortion: 0, computedTax: 0 },
    form8995: { activities: [], reitPtpDividends: 0, priorYearQbiLossCarry: 0, priorYearReitPtpLossCarry: 0 },
    itemized: { medical: 0, stateLocalTax: 0, realEstateTax: 0, mortgageInterest: 0, charitableCash: 0, charitableNoncash: 0 },
    useStandardDeduction: true,
    estimatedPayments: 0,
    priorYearShortTermLossCarryforward: 0,
    priorYearLongTermLossCarryforward: 0,
    schedule1: {},
    schedule2: {},
    schedule3: {},
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
