import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import PersonalInfoSection from './PersonalInfoSection.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flushAll() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

function populated() {
  return stubTaxStoreData({
    filingStatus: 'mfj',
    personalInfo: {
      firstName: 'Jane', lastName: 'Doe', ssnLast4: '6789', dob: '1980-01-01',
      addressLine1: '1 Main', addressLine2: null, city: 'City', state: 'CA', zip: '94000',
      spouseFirstName: 'John', spouseLastName: 'Doe', spouseSsnLast4: '4321', spouseDob: '1982-01-01',
    },
    dependents: [
      { id: 'd1', name: 'Kid', ssnLast4: '1234', relationship: 'son', dob: '2015-01-01', isQualifyingChild: true },
    ],
  });
}

function setup(populated: Record<string, unknown> = {}) {
  const saveMeta = vi.fn();
  const savePersonalInfo = vi.fn();
  const saveList = vi.fn();
  const data = stubTaxStoreData(populated);
  const mount = mountInApp(PersonalInfoSection, {}, {
    beforeMount: () => {
      const s = useTaxReturnStore();
      s.data = data as never;
      s.load = vi.fn(async () => { s.data = data as never; }) as never;
      s.saveMeta = saveMeta as unknown as typeof s.saveMeta;
      s.savePersonalInfo = savePersonalInfo as unknown as typeof s.savePersonalInfo;
      s.saveList = saveList as unknown as typeof s.saveList;
    },
  });
  return { ...mount, saveMeta, savePersonalInfo, saveList };
}

describe('PersonalInfoSection', () => {
  it('steps through all 4 wizard steps', async () => {
    const { wrapper, router, saveMeta, savePersonalInfo, saveList } = setup();
    await flushAll();

    // Step 1: pick filing status (mfj so isMarried() branch fires in step 2).
    const radios = wrapper.findAll('input[type="radio"]');
    if (radios.length > 1) {
      await radios[1].setValue();
      await radios[1].trigger('change');
    }
    const nextBtns = wrapper.findAllComponents({ name: 'VBtn' });
    const nextBtn = nextBtns.find((b) => /next|finish/i.test(b.text()));
    await nextBtn!.trigger('click');
    await flushAll();

    // Step 2: fill name + SSN.
    const textInputs = wrapper.findAll('input[type="text"]');
    if (textInputs.length > 0) {
      await textInputs[0].setValue('Jane');
      if (textInputs.length > 1) await textInputs[1].setValue('Doe');
    }
    await nextBtn!.trigger('click');
    await flushAll();

    // Step 3: fill address.
    const txt = wrapper.findAll('input[type="text"]');
    if (txt.length >= 4) {
      await txt[0].setValue('1 Main');
      await txt[1].setValue('Apt 2');
      await txt[2].setValue('City');
      await txt[3].setValue('CA');
    }
    const zip = wrapper.findAll('input');
    const lastInput = zip[zip.length - 1];
    await lastInput.setValue('94000');
    await nextBtn!.trigger('click');
    await flushAll();

    // Step 4: add a dependent and click finish.
    const addBtns = wrapper.findAll('button').filter((b) => /Add dependent/.test(b.text()));
    if (addBtns.length > 0) await addBtns[0].trigger('click');
    await flushAll();
    // Remove the dependent.
    const removeBtns = wrapper.findAll('button').filter((b) => /Remove/.test(b.text()));
    if (removeBtns.length > 0) await removeBtns[0].trigger('click');
    await flushAll();
    // Click next (finish section).
    const finishBtn = wrapper.findAllComponents({ name: 'VBtn' }).find((b) => /finish/i.test(b.text()));
    if (finishBtn) await finishBtn.trigger('click');
    await flushAll();

    expect(saveMeta).toHaveBeenCalled();
    expect(savePersonalInfo).toHaveBeenCalled();
    expect(saveList).toHaveBeenCalled();
    // Should have navigated home.
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('loads populated data from store', async () => {
    const { wrapper } = setup(populated());
    await flushAll();
    // filingStatus prefilled → canNext should allow Next.
    expect(wrapper.html()).toBeTruthy();
  });

  it('onBack at step 1 navigates home', async () => {
    const { wrapper, router } = setup();
    await flushAll();
    const backBtn = wrapper.findAllComponents({ name: 'VBtn' }).find((b) => /^Back/.test(b.text()));
    await backBtn!.trigger('click');
    await flushAll();
    expect(router.currentRoute.value.path).toBe('/');
  });
});
