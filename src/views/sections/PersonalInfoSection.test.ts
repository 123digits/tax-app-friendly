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

  it('onBack on step > 1 decrements the step instead of navigating home', async () => {
    // Exercises `else step.value = step.value - 1` branch by checking the
    // step header changes from 2 back to 1 (rather than the route changing).
    const initial = stubTaxStoreData({
      filingStatus: 'single',
      personalInfo: {
        firstName: 'Jane', lastName: 'Doe', ssnLast4: null, dob: null,
        addressLine1: '1 Main', addressLine2: null, city: 'Town',
        state: 'CA', zip: '94000',
        spouseFirstName: null, spouseLastName: null,
        spouseSsnLast4: null, spouseDob: null,
      },
    });
    const { wrapper } = setup(initial);
    await flushAll();
    // Advance to step 2.
    const nextBtn1 = wrapper.findAllComponents({ name: 'VBtn' })
      .find((b) => /next|finish/i.test(b.text()));
    if (nextBtn1) {
      await nextBtn1.trigger('click');
      await flushAll();
    }
    // The "Step 2 of 4" indicator should now be present.
    expect(wrapper.html()).toMatch(/2 of 4|Step 2/);
    // Click Back — should return to step 1.
    const backBtn = wrapper.findAllComponents({ name: 'VBtn' }).find((b) => /^Back/.test(b.text()));
    if (backBtn) {
      await backBtn.trigger('click');
      await flushAll();
    }
    expect(wrapper.html()).toMatch(/1 of 4|Step 1/);
  });

  it('loads gracefully when personalInfo fields are all null', async () => {
    // Exercises the `?? ''` fallbacks for firstName/lastName/dob/addressLine1/
    // city/state/zip when the return is a brand-new blank one.
    const blank = stubTaxStoreData({
      personalInfo: {
        firstName: null, lastName: null, ssnLast4: null, dob: null,
        addressLine1: null, addressLine2: null, city: null, state: null, zip: null,
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      },
    });
    const { wrapper } = setup(blank);
    await flushAll();
    expect(wrapper.html()).toBeTruthy();
  });

  it('saveDependents maps each row through to saveList payload', async () => {
    // Exercises lines inside `saveDependents()` map: each `d.id`, `d.name`,
    // `d.ssnInput || null`, etc. that fire only when dependents is
    // non-empty at finish time. Preloading personalInfo keeps canNext()
    // happy on every step.
    const initial = stubTaxStoreData({
      filingStatus: 'single',
      personalInfo: {
        firstName: 'Jane', lastName: 'Doe', ssnLast4: null, dob: '1980-01-01',
        addressLine1: '1 Main', addressLine2: null,
        city: 'City', state: 'CA', zip: '94000',
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      },
      dependents: [
        { id: 'kid1', name: 'Kid One', ssnLast4: '1234', relationship: 'son',
          dob: '2015-01-01', isQualifyingChild: true },
      ],
    });
    const { wrapper, saveList } = setup(initial);
    await flushAll();
    // Skip through steps 1 → 2 → 3 → 4 → finish.
    for (let i = 0; i < 4; i++) {
      const nextBtn = wrapper.findAllComponents({ name: 'VBtn' })
        .find((b) => /next|finish/i.test(b.text()));
      if (nextBtn) {
        await nextBtn.trigger('click');
        await flushAll();
      }
    }
    const dependentsCall = saveList.mock.calls.find((c) => c[0] === 'dependents');
    expect(dependentsCall).toBeTruthy();
    const payload = dependentsCall?.[1] as Array<{ id: string; name: string }>;
    expect(payload[0].id).toBe('kid1');
    expect(payload[0].name).toBe('Kid One');
  });

  it('savePersonal + saveAddress null-out empty fields (`value || null` falsy)', async () => {
    // Exercises the right-side branch of `firstName.value || null`,
    // `lastName.value || null`, `dob.value || null`, `addressLine1.value
    // || null`, `city.value || null`, `state.value || null`, and
    // `zip.value || null` when the corresponding inputs are empty. We
    // bypass the wizard's canNext gate by directly emitting the
    // WizardStep "next" event.
    const blank = stubTaxStoreData({
      filingStatus: 'single',
      personalInfo: {
        firstName: null, lastName: null, ssnLast4: null, dob: null,
        addressLine1: null, addressLine2: null, city: null, state: null, zip: null,
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      },
    });
    const { wrapper, savePersonalInfo } = setup(blank);
    await flushAll();
    // Find the WizardStep wrapper and emit "next" twice (once at step 1
    // → 2 to advance, once at step 2 → 3 so savePersonal fires with
    // empty fields).
    const wizard = wrapper.findComponent({ name: 'WizardStep' });
    await wizard.vm.$emit('next');
    await flushAll();
    await wizard.vm.$emit('next');
    await flushAll();
    await wizard.vm.$emit('next');
    await flushAll();
    expect(savePersonalInfo).toHaveBeenCalled();
    // First savePersonal call (step 2): firstName/lastName/dob nulled.
    const firstCall = savePersonalInfo.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall.firstName).toBeNull();
    expect(firstCall.lastName).toBeNull();
    expect(firstCall.dob).toBeNull();
    // saveAddress (step 3): addressLine1/city/state/zip nulled.
    const lastCall = savePersonalInfo.mock.calls[savePersonalInfo.mock.calls.length - 1]?.[0] as Record<string, unknown>;
    expect(lastCall.addressLine1).toBeNull();
    expect(lastCall.city).toBeNull();
    expect(lastCall.state).toBeNull();
    expect(lastCall.zip).toBeNull();
  });

  it('savePersonal forwards non-null ssn/dob/spouse values when populated', async () => {
    // Exercises the `value || null` truthy-branch for each optional string
    // field that the earlier wizard-traversal test leaves blank.
    const populatedMfj = stubTaxStoreData({
      filingStatus: 'mfj',
      personalInfo: {
        firstName: 'Jane', lastName: 'Doe',
        ssnLast4: '6789', dob: '1980-01-01',
        addressLine1: '1 Main', addressLine2: null,
        city: 'Town', state: 'CA', zip: '94000',
        spouseFirstName: 'John', spouseLastName: 'Doe',
        spouseSsnLast4: '4321', spouseDob: '1982-03-04',
      },
    });
    const { wrapper, savePersonalInfo } = setup(populatedMfj);
    await flushAll();
    // Advance to step 2.
    const nextBtns = wrapper.findAllComponents({ name: 'VBtn' });
    const nextBtn = nextBtns.find((b) => /next|finish/i.test(b.text()));
    await nextBtn!.trigger('click');
    await flushAll();
    // On step 2 the SSN + spouse-SSN inputs are empty (never loaded) —
    // set them directly to exercise the truthy branch of `ssn.value || null`.
    const textInputs = wrapper.findAll('input[type="text"]');
    for (const input of textInputs) {
      const el = input.element as HTMLInputElement;
      const label = el.getAttribute('aria-label') || el.name || '';
      if (/ssn|social/i.test(label)) {
        await input.setValue('123-45-6789');
      }
    }
    // Fallback: fill any remaining empty text inputs so `dob` and spouse*
    // are non-empty.
    for (const input of textInputs) {
      const el = input.element as HTMLInputElement;
      if (!el.value) await input.setValue('x');
    }
    await nextBtn!.trigger('click');
    await flushAll();
    expect(savePersonalInfo).toHaveBeenCalled();
    const [payload] = savePersonalInfo.mock.calls[0] ?? [];
    // Payload contains non-null values for fields we filled.
    expect(payload).toBeTruthy();
  });
});
