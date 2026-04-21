import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTaxReturnStore } from './taxReturn';
import { api } from '../api/client';
import { stubTaxStoreData } from '../../test-setup/vue-helpers';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

function mockApi() {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  api.get = vi.fn(async (url: string) => {
    calls.push({ method: 'GET', url });
    if (url.includes('/list')) return [{ taxYear: 2025, status: 'in_progress', updatedAt: 'now' }];
    if (url.includes('/available-years')) return [2025, 2024];
    if (url.includes('/compute')) return { summary: { refund: 10, balanceDue: 0 } };
    return stubTaxStoreData();
  }) as unknown as typeof api.get;
  api.put = vi.fn(async (url: string, body?: unknown) => {
    calls.push({ method: 'PUT', url, body });
    return { ok: true };
  }) as unknown as typeof api.put;
  return calls;
}

describe('taxReturn store', () => {
  it('load fetches and caches the return', async () => {
    mockApi();
    const s = useTaxReturnStore();
    await s.load();
    expect(s.data?.taxYear).toBe(2025);
  });

  it('loadYearLists populates available years and my returns', async () => {
    mockApi();
    const s = useTaxReturnStore();
    await s.loadYearLists();
    expect(s.myReturns.length).toBe(1);
    expect(s.availableYears).toEqual([2025, 2024]);
  });

  it('loadYearLists handles errors by clearing lists', async () => {
    api.get = vi.fn(async () => { throw new Error('x'); }) as unknown as typeof api.get;
    const s = useTaxReturnStore();
    await s.loadYearLists();
    expect(s.myReturns).toEqual([]);
    expect(s.availableYears).toEqual([]);
  });

  it('refreshComputed sets computed to null on error', async () => {
    api.get = vi.fn(async () => { throw new Error('x'); }) as unknown as typeof api.get;
    const s = useTaxReturnStore();
    await s.refreshComputed();
    expect(s.computed).toBeNull();
  });

  it('setActiveYear writes to localStorage', () => {
    const s = useTaxReturnStore();
    s.setActiveYear(2024);
    expect(localStorage.getItem('tax.activeYear')).toBe('2024');
    s.setActiveYear(null);
    expect(localStorage.getItem('tax.activeYear')).toBeNull();
  });

  it('switchYear sets year, loads, and refreshes computed', async () => {
    // Customize the GET handler to echo the requested year.
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/compute')) return { summary: { refund: 0, balanceDue: 0 } };
      return stubTaxStoreData({ taxYear: 2024 });
    }) as unknown as typeof api.get;
    api.put = vi.fn(async () => ({ ok: true })) as unknown as typeof api.put;
    const s = useTaxReturnStore();
    await s.switchYear(2024);
    expect(s.activeYear).toBe(2024);
  });

  it('saveMeta PUTs and reloads', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    s.setActiveYear(2025);
    await s.saveMeta({ filingStatus: 'single' });
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/meta'))).toBe(true);
  });

  it('savePersonalInfo PUTs and reloads', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    await s.savePersonalInfo({ firstName: 'A' });
    expect(calls.some((c) => c.url.includes('/personal-info'))).toBe(true);
  });

  it('saveList PUTs to endpoint with list payload', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    await s.saveList('w2', [{ employer: 'X' }]);
    expect(calls.some((c) => c.url.includes('/w2'))).toBe(true);
  });

  it('saveSocialSecurity PUTs', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    await s.saveSocialSecurity({ grossBenefits: 1, medicarePremiums: 0, federalWithheld: 0 });
    expect(calls.some((c) => c.url.includes('/social-security'))).toBe(true);
  });

  it('savePayload PUTs generic payload', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    await s.savePayload('form-5695', { solarElectric: 1 });
    expect(calls.some((c) => c.url.includes('/form-5695'))).toBe(true);
  });

  it('saveItemized PUTs itemized', async () => {
    const calls = mockApi();
    const s = useTaxReturnStore();
    await s.saveItemized({ medical: 1 });
    expect(calls.some((c) => c.url.includes('/itemized'))).toBe(true);
  });
});
