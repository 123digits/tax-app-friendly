import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TaxYearConfig } from '../../shared/types';
import { api } from '../api/client';

export const useAdminStore = defineStore('admin', () => {
  const configs = ref<TaxYearConfig[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      configs.value = await api.get<TaxYearConfig[]>('/api/admin/tax-years');
    } finally {
      loading.value = false;
    }
  }

  async function get(year: number): Promise<TaxYearConfig> {
    return api.get<TaxYearConfig>(`/api/admin/tax-years/${year}`);
  }

  async function create(cfg: TaxYearConfig): Promise<void> {
    await api.post('/api/admin/tax-years', cfg);
    await load();
  }

  async function save(cfg: TaxYearConfig): Promise<void> {
    await api.put(`/api/admin/tax-years/${cfg.taxYear}`, cfg);
    await load();
  }

  async function clone(sourceYear: number, targetYear: number): Promise<void> {
    await api.post('/api/admin/tax-years/clone', { sourceYear, targetYear });
    await load();
  }

  async function remove(year: number): Promise<void> {
    await api.delete(`/api/admin/tax-years/${year}`);
    await load();
  }

  return { configs, loading, load, get, create, save, clone, remove };
});
