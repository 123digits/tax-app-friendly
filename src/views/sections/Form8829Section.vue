<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { HomeOfficeExpense } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const offices = ref<Array<HomeOfficeExpense>>([]);

function blank(): HomeOfficeExpense {
  return {
    id: crypto.randomUUID(),
    businessId: null,
    useSimplified: true,
    squareFeet: 0,
    totalHomeSquareFeet: 0,
    utilities: 0,
    insurance: 0,
    mortgageInterest: 0,
    realEstateTax: 0,
    repairs: 0,
    depreciation: 0,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  offices.value = (taxStore.data?.homeOffices ?? []).map((o) => ({ ...o }));
});

// Build list of linkable businesses (Schedule C + Schedule F), with
// "unassigned" sentinel for rows not linked to a specific business.
const businessOptions = computed(() => {
  const out: Array<{ title: string; value: string | null }> = [
    { title: 'Unassigned', value: null },
  ];
  for (const s of taxStore.data?.selfEmployment ?? []) {
    out.push({
      title: s.businessName ? `${s.businessName} (Schedule C)` : 'Unnamed business (Schedule C)',
      value: s.id,
    });
  }
  for (const f of taxStore.data?.farms ?? []) {
    out.push({
      title: f.farmName ? `${f.farmName} (Schedule F)` : 'Unnamed farm (Schedule F)',
      value: f.id,
    });
  }
  return out;
});

function businessLabel(id: string | null): string {
  const match = businessOptions.value.find((o) => o.value === id);
  return match?.title ?? 'Unassigned';
}

// Simplified method: $5/sqft, capped at 300 sqft => $1,500 max.
function simplifiedDeduction(o: HomeOfficeExpense): number {
  const sqft = Math.max(0, Math.min(300, o.squareFeet));
  return sqft * 5;
}

function businessUsePercent(o: HomeOfficeExpense): number {
  if (o.totalHomeSquareFeet <= 0) return 0;
  const pct = o.squareFeet / o.totalHomeSquareFeet;
  return Math.max(0, Math.min(1, pct));
}

function actualDeduction(o: HomeOfficeExpense): number {
  const pct = businessUsePercent(o);
  const total =
    o.utilities +
    o.insurance +
    o.mortgageInterest +
    o.realEstateTax +
    o.repairs +
    o.depreciation;
  return total * pct;
}

function deductionPreview(o: HomeOfficeExpense): number {
  return o.useSimplified ? simplifiedDeduction(o) : actualDeduction(o);
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

function add() { offices.value.push(blank()); }
function remove(i: number) { offices.value.splice(i, 1); }

async function save() {
  await taxStore.saveList('home-offices', offices.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Home Office (Form 8829)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <v-alert type="info" variant="tonal" class="mb-4">
        Form 8829 deducts the business-use portion of your home. The simplified method
        ($5/sqft up to 300 sqft, max $1,500) requires no expense tracking. The actual
        method allocates utilities, insurance, mortgage interest, taxes, repairs, and
        depreciation by the business-use percentage of your home's square footage.
      </v-alert>

      <v-expansion-panels v-if="offices.length">
        <v-expansion-panel v-for="(o, i) in offices" :key="o.id">
          <v-expansion-panel-title>
            {{ businessLabel(o.businessId) }} &mdash;
            {{ o.useSimplified ? 'Simplified' : 'Actual' }} &mdash;
            {{ formatCurrency(deductionPreview(o)) }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="o.businessId"
                  :items="businessOptions"
                  item-title="title"
                  item-value="value"
                  label="Link to business"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <v-radio-group
              v-model="o.useSimplified"
              inline
              hide-details
              class="mb-3"
            >
              <v-radio
                :value="true"
                label="Simplified method ($5/sqft up to 300 sqft)"
              />
              <v-radio
                :value="false"
                label="Actual method (% of home expenses)"
              />
            </v-radio-group>

            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="o.squareFeet"
                  type="number"
                  min="0"
                  label="Square feet used for business"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col v-if="!o.useSimplified" cols="12" md="4">
                <v-text-field
                  v-model.number="o.totalHomeSquareFeet"
                  type="number"
                  min="0"
                  label="Total home square feet"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <template v-if="!o.useSimplified">
              <h4 class="text-subtitle-1 mt-2">Home expenses (total for the year)</h4>
              <v-row>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.utilities" label="Utilities" /></v-col>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.insurance" label="Insurance" /></v-col>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.mortgageInterest" label="Mortgage interest" /></v-col>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.realEstateTax" label="Real estate tax" /></v-col>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.repairs" label="Repairs & maintenance" /></v-col>
                <v-col cols="12" md="4"><CurrencyInput v-model="o.depreciation" label="Depreciation" /></v-col>
              </v-row>

              <v-alert type="success" variant="tonal" class="mt-2">
                Business-use percentage: <strong>{{ formatPercent(businessUsePercent(o)) }}</strong><br />
                Estimated deduction: <strong>{{ formatCurrency(actualDeduction(o)) }}</strong>
              </v-alert>
            </template>

            <template v-else>
              <v-alert type="success" variant="tonal" class="mt-2">
                Estimated simplified deduction:
                <strong>{{ formatCurrency(simplifiedDeduction(o)) }}</strong>
                <span v-if="o.squareFeet > 300" class="ml-1">
                  (capped at 300 sqft / $1,500)
                </span>
              </v-alert>
            </template>

            <div class="text-right mt-2">
              <v-btn variant="text" color="error" @click="remove(i)">Remove home office</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <div class="mt-4">
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add home office</v-btn>
      </div>
    </WizardStep>
  </AppShell>
</template>
