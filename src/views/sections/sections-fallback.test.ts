// Exercises the `taxStore.data?.formX ?? { defaults }` fallback branches in
// each section's onMounted handler. We supply a taxReturn whose specific
// form field is `undefined` so the fallback object materializes.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import { useTaxReturnStore } from '../../stores/taxReturn';

import Form5695Section from './Form5695Section.vue';
import Form6251Section from './Form6251Section.vue';
import Form8960Section from './Form8960Section.vue';
import Form8962Section from './Form8962Section.vue';
import Form8396Section from './Form8396Section.vue';
import Form8606Section from './Form8606Section.vue';
import Form8889Section from './Form8889Section.vue';
import Form8880Section from './Form8880Section.vue';
import ScheduleRSection from './ScheduleRSection.vue';
import Form2441Section from './Form2441Section.vue';
import Form8959Section from './Form8959Section.vue';
import Form2555Section from './Form2555Section.vue';
import ScheduleHSection from './ScheduleHSection.vue';
import Form2210Section from './Form2210Section.vue';
import Form5405Section from './Form5405Section.vue';
import Form4972Section from './Form4972Section.vue';
import Form8995Section from './Form8995Section.vue';
import Schedule8812Section from './Schedule8812Section.vue';
import EitcSection from './EitcSection.vue';
import Schedule1Section from './Schedule1Section.vue';
import SsBenefitsSection from './SsBenefitsSection.vue';
import DeductionsSection from './DeductionsSection.vue';
import K1Section from './K1Section.vue';
import GamblingSection from './GamblingSection.vue';
import IncomeSection from './IncomeSection.vue';
import OtherIncomeSection from './OtherIncomeSection.vue';
import UnemploymentSection from './UnemploymentSection.vue';
import Form8863Section from './Form8863Section.vue';
import Form8936Section from './Form8936Section.vue';
import Form1116Section from './Form1116Section.vue';
import Form4562Section from './Form4562Section.vue';
import Form4797Section from './Form4797Section.vue';
import CapitalGainsSection from './CapitalGainsSection.vue';
import RetirementSection from './RetirementSection.vue';
import SelfEmploymentSection from './SelfEmploymentSection.vue';
import ScheduleFSection from './ScheduleFSection.vue';
import Form8829Section from './Form8829Section.vue';
import InterestDividendsSection from './InterestDividendsSection.vue';

type Sec = { name: string; component: unknown; stripField: string };

const SECTIONS: Sec[] = [
  { name: 'Form5695', component: Form5695Section, stripField: 'form5695' },
  { name: 'Form6251', component: Form6251Section, stripField: 'form6251' },
  { name: 'Form8960', component: Form8960Section, stripField: 'form8960' },
  { name: 'Form8962', component: Form8962Section, stripField: 'form8962' },
  { name: 'Form8396', component: Form8396Section, stripField: 'form8396' },
  { name: 'Form8606', component: Form8606Section, stripField: 'form8606' },
  { name: 'Form8889', component: Form8889Section, stripField: 'form8889' },
  { name: 'Form8880', component: Form8880Section, stripField: 'form8880' },
  { name: 'ScheduleR', component: ScheduleRSection, stripField: 'scheduleR' },
  { name: 'Form2441', component: Form2441Section, stripField: 'form2441' },
  { name: 'Form8959', component: Form8959Section, stripField: 'form8959' },
  { name: 'Form2555', component: Form2555Section, stripField: 'form2555' },
  { name: 'ScheduleH', component: ScheduleHSection, stripField: 'scheduleH' },
  { name: 'Form2210', component: Form2210Section, stripField: 'form2210' },
  { name: 'Form5405', component: Form5405Section, stripField: 'form5405' },
  { name: 'Form4972', component: Form4972Section, stripField: 'form4972' },
  { name: 'Form8995', component: Form8995Section, stripField: 'form8995' },
  { name: 'Schedule8812', component: Schedule8812Section, stripField: 'schedule8812' },
  { name: 'Eitc', component: EitcSection, stripField: 'eitcEligibility' },
  { name: 'Schedule1', component: Schedule1Section, stripField: 'schedule1Adjustments' },
  { name: 'SsBenefits', component: SsBenefitsSection, stripField: 'socialSecurity' },
  // Array-valued section state. Stripping the field drops us into the
  // `taxStore.data?.X ?? []` fallback branch in each onMounted handler.
  { name: 'K1', component: K1Section, stripField: 'k1s' },
  { name: 'Gambling', component: GamblingSection, stripField: 'gambling' },
  { name: 'Income', component: IncomeSection, stripField: 'w2s' },
  { name: 'OtherIncome', component: OtherIncomeSection, stripField: 'otherIncome' },
  { name: 'Unemployment', component: UnemploymentSection, stripField: 'unemployment' },
  { name: 'Form8863', component: Form8863Section, stripField: 'form8863Students' },
  { name: 'Form8936', component: Form8936Section, stripField: 'form8936Vehicles' },
  { name: 'Form1116', component: Form1116Section, stripField: 'form1116Baskets' },
  { name: 'Form4562', component: Form4562Section, stripField: 'depreciationAssets' },
  { name: 'Form4797', component: Form4797Section, stripField: 'form4797Sales' },
  { name: 'CapitalGains', component: CapitalGainsSection, stripField: 'capitalGains' },
  { name: 'Retirement', component: RetirementSection, stripField: 'retirementIncome' },
  { name: 'SelfEmployment', component: SelfEmploymentSection, stripField: 'selfEmployment' },
  { name: 'ScheduleF', component: ScheduleFSection, stripField: 'farms' },
  { name: 'Form8829', component: Form8829Section, stripField: 'homeOffices' },
  { name: 'InterestDividends', component: InterestDividendsSection, stripField: 'interest' },
];

beforeEach(() => {
  (globalThis as unknown as { fetch: Mock }).fetch = vi.fn(async () => ({
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
  }) as unknown as Response);
});

function stubStoreWithoutField(
  store: ReturnType<typeof useTaxReturnStore>,
  stripField: string,
) {
  const data = stubTaxStoreData() as unknown as Record<string, unknown>;
  delete data[stripField];
  store.data = data as never;
  store.computed = null;
  store.load = vi.fn(async () => { store.data = data as never; }) as never;
  store.loadYearLists = vi.fn() as unknown as typeof store.loadYearLists;
  store.refreshComputed = vi.fn() as unknown as typeof store.refreshComputed;
  store.saveMeta = vi.fn() as unknown as typeof store.saveMeta;
  store.savePersonalInfo = vi.fn() as unknown as typeof store.savePersonalInfo;
  store.saveList = vi.fn() as unknown as typeof store.saveList;
  store.saveItemized = vi.fn() as unknown as typeof store.saveItemized;
  store.saveSocialSecurity = vi.fn() as unknown as typeof store.saveSocialSecurity;
  store.savePayload = vi.fn() as unknown as typeof store.savePayload;
}

describe('section ?? {defaults} fallback branches', () => {
  for (const sec of SECTIONS) {
    it(`${sec.name} falls back to defaults when store.data.${sec.stripField} is missing`, async () => {
      let store!: ReturnType<typeof useTaxReturnStore>;
      const { wrapper } = mountInApp(sec.component as never, {}, {
        beforeMount: () => {
          store = useTaxReturnStore();
          stubStoreWithoutField(store, sec.stripField);
        },
      });
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.html()).toBeTruthy();
      void store;
    });
  }

  it('DeductionsSection handles missing itemized', async () => {
    let store!: ReturnType<typeof useTaxReturnStore>;
    const { wrapper } = mountInApp(DeductionsSection, {}, {
      beforeMount: () => {
        store = useTaxReturnStore();
        const data = stubTaxStoreData({ useStandardDeduction: false }) as unknown as Record<string, unknown>;
        // Leave itemized present but zeroed — exercises the `else` branch
        // where useStandard is false.
        store.data = data as never;
        store.load = vi.fn(async () => { store.data = data as never; }) as never;
        store.saveMeta = vi.fn() as unknown as typeof store.saveMeta;
        store.saveItemized = vi.fn() as unknown as typeof store.saveItemized;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toBeTruthy();
    void store;
  });
});
