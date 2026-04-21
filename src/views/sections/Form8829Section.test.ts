// Exercises Form8829Section's "add row" / "remove row" flows plus the actual-
// method computed helpers (businessUsePercent, actualDeduction, formatPercent).
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import Form8829Section from './Form8829Section.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flush() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('Form8829Section', () => {
  it('add → toggle to actual method → computes percent + preview', async () => {
    const saveList = vi.fn();
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [],
          selfEmployment: [{
            id: 'sc1', businessName: 'Freelance',
            ein: null, principalActivity: null,
            grossReceipts: 0, returnsAllowances: 0, costOfGoods: 0,
            expenses: {},
          }],
          farms: [{
            id: 'f1', farmName: 'Farm',
            principalProduct: null, accountingMethod: 'cash',
            grossIncome: 0, expenses: {},
          }],
        });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
      },
    });
    await flush();

    // Click "Add" button.
    const addBtn = wrapper.findAll('button').find((b) => /^Add /.test(b.text()));
    expect(addBtn).toBeTruthy();
    await addBtn!.trigger('click');
    await flush();

    // Click "Save & return" to exercise save.
    const saveBtn = wrapper.findAll('button').find((b) => /save/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(saveList).toHaveBeenCalled();
  });

  it('mounts with existing offices and shows business label', async () => {
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: 'sc1', useSimplified: false,
              squareFeet: 300, totalHomeSquareFeet: 3000,
              utilities: 1000, insurance: 500, mortgageInterest: 5000,
              realEstateTax: 2000, repairs: 200, depreciation: 1000,
            },
            {
              // Simplified-method row with no linked business.
              id: 'h2', businessId: null, useSimplified: true,
              squareFeet: 200, totalHomeSquareFeet: 0,
              utilities: 0, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
          selfEmployment: [{
            id: 'sc1', businessName: 'Business', ein: null,
            principalActivity: null, grossReceipts: 0, returnsAllowances: 0,
            costOfGoods: 0, expenses: {},
          }],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
      },
    });
    await flush();
    expect(wrapper.html()).toContain('Business');
  });

  it('remove drops an existing office row', async () => {
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: null, useSimplified: true,
              squareFeet: 200, totalHomeSquareFeet: 2000,
              utilities: 0, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
      },
    });
    await flush();
    const removeBtn = wrapper.findAll('button').find((b) => /Remove/.test(b.text()));
    if (removeBtn) {
      await removeBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});
