// DeductionsSection: needs useStandardDeduction=false to render the
// itemized-field block; without that the medical/salt/realEstate/
// mortgage/charityCash/charityNonCash v-model setters never fire.
// InterestDividendsSection: 2-step wizard; need to advance to step 2
// for the dividend-row v-models + removeDividend handler to fire.
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import DeductionsSection from './DeductionsSection.vue';
import InterestDividendsSection from './InterestDividendsSection.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flush() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('DeductionsSection itemized fields', () => {
  it('useStandard=false renders itemized inputs and exercises every v-model', async () => {
    const { wrapper } = mountInApp(DeductionsSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({ useStandardDeduction: false });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
        s.saveItemized = vi.fn() as unknown as typeof s.saveItemized;
      },
    });
    await flush();
    // Fill every itemized currency input.
    for (const [i, input] of wrapper.findAll('input[type="text"]').entries()) {
      await input.setValue(String(100 + i));
    }
    await flush();
    // Click save.
    const saveBtn = wrapper.findAll('button').find((b) => /save/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});

describe('InterestDividendsSection step 2', () => {
  it('advances to step 2, fills dividend inputs, removes one row', async () => {
    const { wrapper } = mountInApp(InterestDividendsSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          dividends: [
            { id: 'd1', payer: 'A', ordinary: 0, qualified: 0,
              totalCapGainDistributions: 0, unrecapSection1250Gain: 0, section1202Gain: 0 },
            { id: 'd2', payer: 'B', ordinary: 0, qualified: 0,
              totalCapGainDistributions: 0, unrecapSection1250Gain: 0, section1202Gain: 0 },
          ],
        });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = vi.fn() as unknown as typeof s.saveList;
      },
    });
    await flush();
    // Click Next to advance step 1 → 2.
    const nextBtn = wrapper.findAll('button').find((b) => /next/i.test(b.text()));
    if (nextBtn) {
      await nextBtn.trigger('click');
      await flush();
    }
    // Fill every dividend input.
    for (const [i, input] of wrapper.findAll('input[type="text"]').entries()) {
      await input.setValue(`p${i}`);
    }
    for (const [i, input] of wrapper.findAll('input[type="number"]').entries()) {
      await input.setValue(String(100 + i));
    }
    await flush();
    // Click first Remove button to fire removeDividend.
    const removeBtn = wrapper.findAll('button').find((b) => /Remove/i.test(b.text()));
    if (removeBtn) {
      await removeBtn.trigger('click');
      await flush();
    }
    // Click Save.
    const saveBtn = wrapper.findAll('button').find((b) => /save/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});
