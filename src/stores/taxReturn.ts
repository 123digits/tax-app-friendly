import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TaxReturn, ComputedReturn } from '../../shared/types';
import { api } from '../api/client';

interface ReturnSummary {
  taxYear: number;
  status: string;
  updatedAt: string;
}

export const useTaxReturnStore = defineStore('taxReturn', () => {
  const data = ref<TaxReturn | null>(null);
  const computed = ref<ComputedReturn | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const activeYear = ref<number | null>(
    Number(localStorage.getItem('tax.activeYear')) || null
  );
  const myReturns = ref<ReturnSummary[]>([]);
  const availableYears = ref<number[]>([]);

  function yearQuery(): string {
    return activeYear.value ? `?year=${activeYear.value}` : '';
  }

  function setActiveYear(y: number | null) {
    activeYear.value = y;
    if (y == null) localStorage.removeItem('tax.activeYear');
    else localStorage.setItem('tax.activeYear', String(y));
  }

  async function loadYearLists() {
    try {
      myReturns.value = await api.get<ReturnSummary[]>('/api/return/list');
      availableYears.value = await api.get<number[]>('/api/return/available-years');
    } catch {
      myReturns.value = [];
      availableYears.value = [];
    }
  }

  async function load() {
    loading.value = true;
    try {
      data.value = await api.get<TaxReturn>(`/api/return${yearQuery()}`);
      // Keep activeYear in sync with what the server returned.
      if (data.value) setActiveYear(data.value.taxYear);
    } finally {
      loading.value = false;
    }
  }

  async function refreshComputed() {
    try {
      computed.value = await api.get<ComputedReturn>(`/api/return/compute${yearQuery()}`);
    } catch {
      computed.value = null;
    }
  }

  async function saveMeta(patch: {
    filingStatus?: string | null;
    useStandardDeduction?: boolean;
    estimatedPayments?: number;
  }) {
    saving.value = true;
    try {
      await api.put(`/api/return/meta${yearQuery()}`, patch);
      await load();
      await refreshComputed();
    } finally {
      saving.value = false;
    }
  }

  async function savePersonalInfo(patch: Record<string, any>) {
    saving.value = true;
    try {
      await api.put(`/api/return/personal-info${yearQuery()}`, patch);
      await load();
    } finally {
      saving.value = false;
    }
  }

  async function saveList(endpoint: string, list: any[]) {
    saving.value = true;
    try {
      await api.put(`/api/return/${endpoint}${yearQuery()}`, list);
      await load();
      await refreshComputed();
    } finally {
      saving.value = false;
    }
  }

  async function saveSocialSecurity(payload: {
    grossBenefits: number;
    medicarePremiums: number;
    federalWithheld: number;
  }) {
    saving.value = true;
    try {
      await api.put(`/api/return/social-security${yearQuery()}`, payload);
      await load();
      await refreshComputed();
    } finally {
      saving.value = false;
    }
  }

  // Generic single-row PUT for endpoints that accept one object payload
  // (as opposed to `saveList` for array-valued endpoints). Used by
  // Schedule 1 adjustments, Form 8606, Form 8889, etc.
  async function savePayload(endpoint: string, payload: any) {
    saving.value = true;
    try {
      await api.put(`/api/return/${endpoint}${yearQuery()}`, payload);
      await load();
      await refreshComputed();
    } finally {
      saving.value = false;
    }
  }

  async function saveItemized(payload: Record<string, number>) {
    saving.value = true;
    try {
      await api.put(`/api/return/itemized${yearQuery()}`, payload);
      await load();
      await refreshComputed();
    } finally {
      saving.value = false;
    }
  }

  async function switchYear(year: number) {
    setActiveYear(year);
    await load();
    await refreshComputed();
  }

  return {
    data, computed, loading, saving,
    activeYear, myReturns, availableYears,
    loadYearLists, load, refreshComputed, switchYear, setActiveYear,
    saveMeta, savePersonalInfo, saveList, saveItemized, saveSocialSecurity,
    savePayload,
  };
});
