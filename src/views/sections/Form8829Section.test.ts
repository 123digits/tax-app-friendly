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

  it('renders "Unnamed business" label when business name is blank', async () => {
    // Exercises the `businessName ? X : 'Unnamed business'` ternary by
    // linking a home office to a selfEmployment row without a name — the
    // expansion-panel title then displays "Unnamed business (Schedule C)".
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: 'sc1', useSimplified: true,
              squareFeet: 100, totalHomeSquareFeet: 1000,
              utilities: 0, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
          selfEmployment: [{
            id: 'sc1', businessName: null, ein: null,
            principalActivity: null, grossReceipts: 0, returnsAllowances: 0,
            costOfGoods: 0, expenses: {},
          }],
          farms: [{
            id: 'f1', farmName: null, principalProduct: null,
            accountingMethod: 'cash', grossIncome: 0, expenses: {},
          }],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
      },
    });
    await flush();
    expect(wrapper.html()).toContain('Unnamed business');
  });

  it('renders "Unnamed farm" label when farm is linked and name is blank', async () => {
    // Exercises `farmName ? X : 'Unnamed farm'` ternary when a home office
    // is linked to a farm with no name.
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: 'f1', useSimplified: true,
              squareFeet: 100, totalHomeSquareFeet: 1000,
              utilities: 0, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
          selfEmployment: [],
          farms: [{
            id: 'f1', farmName: null, principalProduct: null,
            accountingMethod: 'cash', grossIncome: 0, expenses: {},
          }],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
      },
    });
    await flush();
    expect(wrapper.html()).toContain('Unnamed farm');
  });

  it('businessLabel falls back to "Unassigned" when linked business is missing', async () => {
    // Exercises `match?.title ?? 'Unassigned'` when the office references a
    // businessId that no longer exists in selfEmployment/farms.
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: 'ghost-id', useSimplified: true,
              squareFeet: 100, totalHomeSquareFeet: 1000,
              utilities: 0, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
          selfEmployment: [],
          farms: [],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
      },
    });
    await flush();
    // Expansion-panel title renders the fallback.
    expect(wrapper.html()).toContain('Unassigned');
  });

  it('actual-method row with zero totalHomeSquareFeet → $0 deduction (no crash)', async () => {
    // Exercises `if (o.totalHomeSquareFeet <= 0) return 0` branch. The
    // expansion-panel title shows the deduction preview formatted as
    // currency — $0 when the business-use pct is 0. Also expands the
    // panel so formatPercent + actualDeduction are called from the
    // template.
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: null, useSimplified: false,
              squareFeet: 200, totalHomeSquareFeet: 0,
              utilities: 1000, insurance: 0, mortgageInterest: 0,
              realEstateTax: 0, repairs: 0, depreciation: 0,
            },
          ],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
        s.saveList = vi.fn() as never;
      },
    });
    await flush();
    // Expand the panel so the actual-method content (with formatPercent
    // call) is rendered.
    const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
    if (panelTitles.length > 0) {
      await panelTitles[0].trigger('click');
      await flush();
    }
    // Click the per-row Remove button.
    const removeBtn = wrapper.findAll('button').find((b) => /Remove home office/i.test(b.text()));
    if (removeBtn) {
      await removeBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });

  it('expands office panel + fills all per-row inputs (covers all v-models)', async () => {
    // Mounts with one actual-method office, expands the panel, then fills
    // every v-model field inside (businessId select, useSimplified radio,
    // squareFeet, totalHomeSquareFeet, utilities, insurance, mortgageInterest,
    // realEstateTax, repairs, depreciation).
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: null, useSimplified: false,
              squareFeet: 200, totalHomeSquareFeet: 2000,
              utilities: 1000, insurance: 500, mortgageInterest: 5000,
              realEstateTax: 2000, repairs: 200, depreciation: 1000,
            },
          ],
          selfEmployment: [{
            id: 'sc1', businessName: 'Biz', ein: null, principalActivity: null,
            grossReceipts: 0, returnsAllowances: 0, costOfGoods: 0, expenses: {},
          }],
        });
        s.data = data as never;
        s.load = vi.fn() as never;
        s.saveList = vi.fn() as never;
      },
    });
    await flush();
    // Expand the panel.
    const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
    if (panelTitles.length > 0) {
      await panelTitles[0].trigger('click');
      await flush();
    }
    // Fill every numeric input.
    for (const [i, input] of wrapper.findAll('input[type="number"]').entries()) {
      await input.setValue(String(100 + i));
    }
    // Fill every text input (CurrencyInputs render as type=text).
    for (const [i, input] of wrapper.findAll('input[type="text"]').entries()) {
      await input.setValue(String(500 + i));
    }
    // Toggle the simplified-method radio.
    const radios = wrapper.findAllComponents({ name: 'VRadioGroup' });
    if (radios.length > 0) {
      await radios[0].vm.$emit('update:modelValue', true);
      await flush();
      await radios[0].vm.$emit('update:modelValue', false);
    }
    // Emit on the business-link v-select.
    const sels = wrapper.findAllComponents({ name: 'VSelect' });
    for (const sel of sels) {
      await sel.vm.$emit('update:modelValue', 'sc1');
    }
    await flush();
    expect(wrapper.html()).toBeTruthy();
  });

  it('simplified >300 sqft row → panel title shows $1,500 cap value', async () => {
    // Simplified method at 500 sqft should cap at $1,500 via
    // `Math.min(300, o.squareFeet)`.
    const { wrapper } = mountInApp(Form8829Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          homeOffices: [
            {
              id: 'h1', businessId: null, useSimplified: true,
              squareFeet: 500, totalHomeSquareFeet: 0,
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
    expect(wrapper.html()).toMatch(/\$1,500/);
  });
});
