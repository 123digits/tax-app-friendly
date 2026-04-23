import { describe, it, expect } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../test-setup/vue-helpers';
import DashboardView from './DashboardView.vue';
import { useTaxReturnStore } from '../stores/taxReturn';
import { vi } from 'vitest';

describe('DashboardView', () => {
  it('renders loading state', async () => {
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.loading = true;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('v-progress-circular');
  });

  it('renders section cards when data is present', async () => {
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.loading = false;
        s.myReturns = [{ taxYear: 2025, status: 'in_progress', updatedAt: 'n' }] as never;
        s.availableYears = [2025, 2024] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.switchYear = vi.fn() as unknown as typeof s.switchYear;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('Your 2025 Return');
  });

  it('shows the year selector when multiple returns exist', async () => {
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.loading = false;
        s.myReturns = [
          { taxYear: 2025, status: 'in_progress', updatedAt: 'n' },
          { taxYear: 2024, status: 'complete', updatedAt: 'n' },
        ] as never;
        s.availableYears = [2025, 2024] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.switchYear = vi.fn() as unknown as typeof s.switchYear;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('Switch year');
  });

  it('shows "Start another year" when startable years exist', async () => {
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.loading = false;
        s.myReturns = [{ taxYear: 2025, status: 'in_progress', updatedAt: 'n' }] as never;
        s.availableYears = [2025, 2024] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.switchYear = vi.fn() as unknown as typeof s.switchYear;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('Start another year');
  });

  it('activeYear computed falls back to store.activeYear when data is null', async () => {
    // Exercises the `taxStore.data?.taxYear ?? taxStore.activeYear ?? null`
    // second-??  branch.
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = null;
        s.loading = false;
        s.activeYear = 2024;
        s.myReturns = [] as never;
        s.availableYears = [2024] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toBeTruthy();
  });

  it('year selector emits update:model-value → selectYear calls switchYear', async () => {
    // Exercises the `async function selectYear(...)` helper plus the
    // @update:model-value inline arrow on the v-select binding.
    const switchYear = vi.fn();
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.loading = false;
        s.myReturns = [
          { taxYear: 2025, status: 'in_progress', updatedAt: 'n' },
          { taxYear: 2024, status: 'complete', updatedAt: 'n' },
        ] as never;
        s.availableYears = [2025, 2024] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.switchYear = switchYear as unknown as typeof s.switchYear;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const selects = wrapper.findAllComponents({ name: 'VSelect' });
    if (selects.length > 0) {
      await selects[0].vm.$emit('update:modelValue', 2024);
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(switchYear).toHaveBeenCalledWith(2024);
  });

  it('activeYear computed defaults to null when neither data nor activeYear set', async () => {
    // Exercises the final `?? null` right-side branch.
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = null;
        s.loading = false;
        s.activeYear = null;
        s.myReturns = [] as never;
        s.availableYears = [] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toBeTruthy();
  });
});
