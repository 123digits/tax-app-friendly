<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { ScheduleFFarm } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const farms = ref<Array<ScheduleFFarm>>([]);

const EXPENSE_CATEGORIES = [
  'chemicals',
  'conservation',
  'depreciation',
  'employeeBenefits',
  'feed',
  'fertilizers',
  'freight',
  'fuel',
  'insurance',
  'interestMortgage',
  'interestOther',
  'laborHired',
  'pension',
  'rentLease',
  'repairs',
  'seedsPlants',
  'suppliesOther',
  'taxes',
  'utilities',
  'vetMedicine',
  'other',
];

const EXPENSE_LABELS: Record<string, string> = {
  chemicals: 'Chemicals',
  conservation: 'Conservation expenses',
  depreciation: 'Depreciation',
  employeeBenefits: 'Employee benefit programs',
  feed: 'Feed',
  fertilizers: 'Fertilizers & lime',
  freight: 'Freight & trucking',
  fuel: 'Gasoline, fuel & oil',
  insurance: 'Insurance (other than health)',
  interestMortgage: 'Interest (mortgage)',
  interestOther: 'Interest (other)',
  laborHired: 'Labor hired',
  pension: 'Pension & profit-sharing plans',
  rentLease: 'Rent or lease',
  repairs: 'Repairs & maintenance',
  seedsPlants: 'Seeds & plants',
  suppliesOther: 'Supplies',
  taxes: 'Taxes',
  utilities: 'Utilities',
  vetMedicine: 'Veterinary, breeding & medicine',
  other: 'Other expenses',
};

const ACCOUNTING_METHODS = [
  { title: 'Cash', value: 'cash' },
  { title: 'Accrual', value: 'accrual' },
];

function blank(): ScheduleFFarm {
  const expenses: Record<string, number> = {};
  for (const k of EXPENSE_CATEGORIES) expenses[k] = 0;
  return {
    id: crypto.randomUUID(),
    farmName: '',
    principalProduct: '',
    accountingMethod: 'cash',
    grossIncome: 0,
    expenses,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  farms.value = (taxStore.data?.farms ?? []).map((f) => ({
    ...f,
    expenses: { ...Object.fromEntries(EXPENSE_CATEGORIES.map((k) => [k, 0])), ...f.expenses },
  }));
});

function add() { farms.value.push(blank()); }
function remove(i: number) { farms.value.splice(i, 1); }

async function save() {
  await taxStore.saveList('schedule-f-farm', farms.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Farm Income (Schedule F)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <v-alert type="info" variant="tonal" class="mb-4">
        Schedule F reports farm income and expenses. Net profit flows to 1040 line 3 and is subject to SE tax (Schedule SE).
      </v-alert>

      <p class="mb-4">Add each farm separately.</p>

      <v-expansion-panels v-if="farms.length">
        <v-expansion-panel v-for="(f, i) in farms" :key="f.id">
          <v-expansion-panel-title>
            {{ f.farmName || 'Unnamed farm' }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="8">
                <v-text-field v-model="f.farmName" label="Farm name" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="f.accountingMethod"
                  :items="ACCOUNTING_METHODS"
                  label="Accounting method"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>
            <v-text-field v-model="f.principalProduct" label="Principal product" variant="outlined" density="comfortable" />

            <h4 class="text-subtitle-1 mt-2">Income</h4>
            <v-row>
              <v-col cols="4"><CurrencyInput v-model="f.grossIncome" label="Gross farm income" /></v-col>
            </v-row>

            <h4 class="text-subtitle-1 mt-2">Expenses</h4>
            <v-row>
              <v-col v-for="cat in EXPENSE_CATEGORIES" :key="cat" cols="6" md="4">
                <CurrencyInput
                  :model-value="f.expenses[cat] || 0"
                  @update:model-value="(v) => (f.expenses[cat] = v)"
                  :label="EXPENSE_LABELS[cat]"
                />
              </v-col>
            </v-row>

            <div class="text-right">
              <v-btn variant="text" color="error" @click="remove(i)">Remove farm</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <div class="mt-4">
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add farm</v-btn>
      </div>
    </WizardStep>
  </AppShell>
</template>
