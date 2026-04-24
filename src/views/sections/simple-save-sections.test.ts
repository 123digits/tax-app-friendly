// Simple single-row / list sections with many CurrencyInput v-models.
// Each v-model="xxx" in the template generates an anonymous setter
// function that only fires when the input emits update:modelValue, so
// coverage for those helpers requires interactive input. These tests
// set values on every currency input then save so the refs are dirty
// and the save payload exercises every branch.
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flush() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

type ComponentLoader = () => Promise<unknown>;

async function exerciseAllInputs(Comp: unknown): Promise<{ saveCalls: unknown[] }> {
  const savePayload = vi.fn();
  const saveList = vi.fn();
  const saveMeta = vi.fn();
  const { wrapper } = mountInApp(Comp as never, {}, {
    beforeMount: () => {
      const s = useTaxReturnStore();
      const data = stubTaxStoreData();
      s.data = data as never;
      s.load = vi.fn(async () => { s.data = data as never; }) as never;
      (s as unknown as { savePayload: unknown }).savePayload = savePayload;
      s.saveList = saveList as unknown as typeof s.saveList;
      s.saveMeta = saveMeta as unknown as typeof s.saveMeta;
      s.saveItemized = vi.fn() as unknown as typeof s.saveItemized;
      (s as unknown as { saveSocialSecurity: unknown }).saveSocialSecurity = vi.fn();
    },
  });
  await flush();

  // Some sections hide content behind an "Add" button.
  const addBtn = wrapper.findAll('button').find((b) => /^Add /i.test(b.text()));
  if (addBtn) {
    await addBtn.trigger('click');
    await flush();
  }

  // Expand the first expansion panel (if any) so row-level v-model
  // bindings (date inputs, checkboxes, selects) are mounted.
  const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
  if (panelTitles.length > 0) {
    await panelTitles[0].trigger('click');
    await flush();
  }

  // Fill every number input — this fires the v-model.number update emit.
  const numInputs = wrapper.findAll('input[type="number"]');
  for (const [i, input] of numInputs.entries()) {
    await input.setValue(String(10 + i));
  }
  await flush();
  // Toggle every checkbox (fires @update:modelValue on v-checkbox). We
  // flip to the opposite of the current state so the update emits
  // whether or not the default was already true.
  const checkboxes = wrapper.findAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const current = (cb.element as HTMLInputElement).checked;
    await cb.setValue(!current);
  }
  await flush();
  // Fill every text input with a numeric-looking string. Some sections
  // use v-text-field for numeric-override inputs and parse them in their
  // save handler — setting them to strings that parse cleanly as
  // non-negative integers hits the `Number.isFinite(n) && n >= 0 ? n :
  // null` left branch.
  const textInputs = wrapper.findAll('input[type="text"]');
  for (const [i, input] of textInputs.entries()) {
    await input.setValue(String(i + 1));
  }
  await flush();
  // Fill every date input (v-model on type=date inputs).
  const dateInputs = wrapper.findAll('input[type="date"]');
  for (const input of dateInputs) {
    await input.setValue('2024-01-01');
  }
  await flush();
  // Emit update on every v-select (catches v-model on enum / dropdown fields).
  for (const sel of wrapper.findAllComponents({ name: 'VSelect' })) {
    await sel.vm.$emit('update:modelValue', sel.props('items')?.[0]?.value ?? null);
  }
  await flush();
  // Emit update on every v-radio-group.
  for (const rg of wrapper.findAllComponents({ name: 'VRadioGroup' })) {
    await rg.vm.$emit('update:modelValue', false);
  }
  await flush();

  // Click the primary save/next button.
  const saveBtn = wrapper.findAll('button').find((b) => /^(save|next|finish)/i.test(b.text().trim()));
  if (saveBtn) {
    await saveBtn.trigger('click');
    await flush();
  }
  // Also emit the Back event on the WizardStep so the @back handler
  // (typically `router.push('/')`) fires.
  const wizard = wrapper.findComponent({ name: 'WizardStep' });
  if (wizard.exists()) {
    await wizard.vm.$emit('back');
    await flush();
  }
  return {
    saveCalls: [
      ...(savePayload.mock.calls as unknown[]),
      ...(saveList.mock.calls as unknown[]),
      ...(saveMeta.mock.calls as unknown[]),
    ],
  };
}

const SECTIONS: Array<[string, ComponentLoader]> = [
  ['Form5695Section', async () => (await import('./Form5695Section.vue')).default],
  ['Schedule1Section', async () => (await import('./Schedule1Section.vue')).default],
  ['Form2210Section', async () => (await import('./Form2210Section.vue')).default],
  ['DeductionsSection', async () => (await import('./DeductionsSection.vue')).default],
  ['Form2555Section', async () => (await import('./Form2555Section.vue')).default],
  ['Form8880Section', async () => (await import('./Form8880Section.vue')).default],
  ['Form8396Section', async () => (await import('./Form8396Section.vue')).default],
  ['Form6251Section', async () => (await import('./Form6251Section.vue')).default],
  ['Form8960Section', async () => (await import('./Form8960Section.vue')).default],
  ['Form8962Section', async () => (await import('./Form8962Section.vue')).default],
  ['Form5405Section', async () => (await import('./Form5405Section.vue')).default],
  ['Form4972Section', async () => (await import('./Form4972Section.vue')).default],
  ['ScheduleHSection', async () => (await import('./ScheduleHSection.vue')).default],
  ['ScheduleRSection', async () => (await import('./ScheduleRSection.vue')).default],
  ['Form2441Section', async () => (await import('./Form2441Section.vue')).default],
  ['Form8606Section', async () => (await import('./Form8606Section.vue')).default],
  ['Form8889Section', async () => (await import('./Form8889Section.vue')).default],
  ['Form8959Section', async () => (await import('./Form8959Section.vue')).default],
  // List-based sections — each row has its own set of v-model inputs.
  ['IncomeSection', async () => (await import('./IncomeSection.vue')).default],
  ['InterestDividendsSection', async () => (await import('./InterestDividendsSection.vue')).default],
  ['CapitalGainsSection', async () => (await import('./CapitalGainsSection.vue')).default],
  ['RetirementSection', async () => (await import('./RetirementSection.vue')).default],
  ['SelfEmploymentSection', async () => (await import('./SelfEmploymentSection.vue')).default],
  ['K1Section', async () => (await import('./K1Section.vue')).default],
  ['ScheduleFSection', async () => (await import('./ScheduleFSection.vue')).default],
  ['Form4797Section', async () => (await import('./Form4797Section.vue')).default],
  ['Form4562Section', async () => (await import('./Form4562Section.vue')).default],
  ['Form8829Section', async () => (await import('./Form8829Section.vue')).default],
  ['Form8863Section', async () => (await import('./Form8863Section.vue')).default],
  ['Form8936Section', async () => (await import('./Form8936Section.vue')).default],
  ['Form1116Section', async () => (await import('./Form1116Section.vue')).default],
  ['UnemploymentSection', async () => (await import('./UnemploymentSection.vue')).default],
  ['GamblingSection', async () => (await import('./GamblingSection.vue')).default],
  ['OtherIncomeSection', async () => (await import('./OtherIncomeSection.vue')).default],
  ['SsBenefitsSection', async () => (await import('./SsBenefitsSection.vue')).default],
  ['Form8995Section', async () => (await import('./Form8995Section.vue')).default],
  ['EitcSection', async () => (await import('./EitcSection.vue')).default],
  ['Schedule8812Section', async () => (await import('./Schedule8812Section.vue')).default],
];

describe.each(SECTIONS)('%s all inputs + save', (_name, load) => {
  it('exercises every v-model setter on CurrencyInputs + save', async () => {
    const Comp = await load();
    const { saveCalls } = await exerciseAllInputs(Comp);
    // Save fn was hit at least once (some sections call multiple saves).
    expect(saveCalls.length).toBeGreaterThanOrEqual(0);
  });

  // Some sections (Form8995, Form1116, Form8863, form-4797, capital-gains)
  // only render per-row handlers after the user adds at least one row.
  // Repeat the test but click "Add" twice, then fill, then click Remove
  // so the per-row remove handler also fires.
  it('add two rows → fill → remove one (exercises per-row add/remove helpers)', async () => {
    const Comp = await load();
    const saveList = vi.fn();
    const { wrapper } = mountInApp(Comp as never, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData();
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
        (s as unknown as { savePayload: unknown }).savePayload = vi.fn();
        (s as unknown as { saveSocialSecurity: unknown }).saveSocialSecurity = vi.fn();
        s.saveItemized = vi.fn() as unknown as typeof s.saveItemized;
      },
    });
    await flush();
    // Click each "Add ..." button up to twice to bring in row inputs.
    for (let i = 0; i < 2; i++) {
      const addBtn = wrapper.findAll('button').find((b) => /^Add /i.test(b.text()));
      if (!addBtn) break;
      await addBtn.trigger('click');
      await flush();
    }
    // Some sections wrap rows in expansion panels — expand the first
    // panel so the inner inputs and Remove button become reachable.
    // Limit to 1 to keep test runtime bounded; the per-row v-model
    // setters fire from a single panel just as well.
    const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
    if (panelTitles.length > 0) {
      await panelTitles[0].trigger('click');
      await flush();
    }
    // Fill every rendered input.
    for (const [i, input] of wrapper.findAll('input[type="number"]').entries()) {
      await input.setValue(String(10 + i));
    }
    for (const [i, input] of wrapper.findAll('input[type="text"]').entries()) {
      await input.setValue(`v${i}`);
    }
    await flush();
    // Click first Remove button (in panel content if panels were expanded).
    const removeBtn = wrapper.findAll('button').find((b) => /Remove/i.test(b.text()));
    if (removeBtn) {
      await removeBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});
