<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { SelfEmployment } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const businesses = ref<Array<SelfEmployment>>([]);

const EXPENSE_CATEGORIES = [
  'advertising',
  'car_truck',
  'contract_labor',
  'depreciation',
  'insurance',
  'legal_professional',
  'office',
  'rent',
  'repairs',
  'supplies',
  'taxes_licenses',
  'travel',
  'meals',
  'utilities',
  'wages',
  'other',
];

const EXPENSE_LABELS: Record<string, string> = {
  advertising: 'Advertising',
  car_truck: 'Car & truck',
  contract_labor: 'Contract labor',
  depreciation: 'Depreciation',
  insurance: 'Insurance (other than health)',
  legal_professional: 'Legal & professional',
  office: 'Office expense',
  rent: 'Rent / lease',
  repairs: 'Repairs & maintenance',
  supplies: 'Supplies',
  taxes_licenses: 'Taxes & licenses',
  travel: 'Travel',
  meals: 'Meals (50%)',
  utilities: 'Utilities',
  wages: 'Wages',
  other: 'Other expenses',
};

function blank(): SelfEmployment {
  const expenses: Record<string, number> = {};
  for (const k of EXPENSE_CATEGORIES) expenses[k] = 0;
  return {
    id: crypto.randomUUID(),
    businessName: '',
    ein: '',
    principalActivity: '',
    grossReceipts: 0,
    returnsAllowances: 0,
    costOfGoods: 0,
    expenses,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  businesses.value = (taxStore.data?.selfEmployment ?? []).map((s) => ({
    ...s,
    expenses: { ...Object.fromEntries(EXPENSE_CATEGORIES.map((k) => [k, 0])), ...s.expenses },
  }));
});

function add() { businesses.value.push(blank()); }
function remove(i: number) { businesses.value.splice(i, 1); }

async function save() {
  await taxStore.saveList('self-employment', businesses.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Self-Employment (Schedule C)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">Add each self-employed business separately.</p>

      <v-expansion-panels v-if="businesses.length">
        <v-expansion-panel v-for="(b, i) in businesses" :key="b.id">
          <v-expansion-panel-title>
            {{ b.businessName || 'Unnamed business' }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="8">
                <v-text-field v-model="b.businessName" label="Business name" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="4">
                <v-text-field v-model="b.ein" label="EIN (optional)" variant="outlined" density="comfortable" />
              </v-col>
            </v-row>
            <v-text-field v-model="b.principalActivity" label="Principal activity" variant="outlined" density="comfortable" />

            <h4 class="text-subtitle-1 mt-2">Income</h4>
            <v-row>
              <v-col cols="4"><CurrencyInput v-model="b.grossReceipts" label="Gross receipts" /></v-col>
              <v-col cols="4"><CurrencyInput v-model="b.returnsAllowances" label="Returns / allowances" /></v-col>
              <v-col cols="4"><CurrencyInput v-model="b.costOfGoods" label="Cost of goods sold" /></v-col>
            </v-row>

            <h4 class="text-subtitle-1 mt-2">Expenses</h4>
            <v-row>
              <v-col v-for="cat in EXPENSE_CATEGORIES" :key="cat" cols="6" md="4">
                <CurrencyInput
                  :model-value="b.expenses[cat] || 0"
                  @update:model-value="(v) => (b.expenses[cat] = v)"
                  :label="EXPENSE_LABELS[cat]"
                />
              </v-col>
            </v-row>

            <div class="text-right">
              <v-btn variant="text" color="error" @click="remove(i)">Remove business</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <div class="mt-4">
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add business</v-btn>
      </div>
    </WizardStep>
  </AppShell>
</template>
