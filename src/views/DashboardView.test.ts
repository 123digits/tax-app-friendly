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
});
