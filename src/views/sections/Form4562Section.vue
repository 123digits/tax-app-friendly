<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { DepreciationAsset, MacrsClass } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

// UI row mirrors DepreciationAsset but stores business use as 0-100 for the
// text input. We convert to/from decimal at the hydrate/save boundaries.
interface AssetRow {
  id: string;
  description: string | null;
  datePlacedInService: string | null;
  cost: number;
  macrsClass: MacrsClass;
  section179Election: number;
  claimBonus: boolean;
  businessUsePercentUi: number; // 0..100 in the UI
  businessId: string | null;
}

const assets = ref<AssetRow[]>([]);

const MACRS_CLASSES: { value: MacrsClass; title: string }[] = [
  { value: '3', title: '3-year (racehorses, tractors)' },
  { value: '5', title: '5-year (autos, computers, office equipment)' },
  { value: '7', title: '7-year (office furniture, appliances)' },
  { value: '10', title: '10-year (water transport)' },
  { value: '15', title: '15-year (land improvements)' },
  { value: '20', title: '20-year (farm buildings)' },
  { value: '27.5', title: '27.5-year (residential rental)' },
  { value: '39', title: '39-year (non-residential real)' },
  { value: 'straight_line', title: 'Straight-line' },
];

function blank(): AssetRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    datePlacedInService: null,
    cost: 0,
    macrsClass: '5',
    section179Election: 0,
    claimBonus: false,
    businessUsePercentUi: 100,
    businessId: null,
  };
}

function fromStored(a: DepreciationAsset): AssetRow {
  return {
    id: a.id,
    description: a.description,
    datePlacedInService: a.datePlacedInService,
    cost: a.cost,
    macrsClass: a.macrsClass,
    section179Election: a.section179Election,
    claimBonus: a.claimBonus,
    businessUsePercentUi: Math.round(a.businessUsePercent * 10000) / 100,
    businessId: a.businessId,
  };
}

function toStored(r: AssetRow): DepreciationAsset {
  const pct = Number(r.businessUsePercentUi);
  const clamped = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 100;
  return {
    id: r.id,
    description: r.description,
    datePlacedInService: r.datePlacedInService,
    cost: Number(r.cost) || 0,
    macrsClass: r.macrsClass,
    section179Election: Number(r.section179Election) || 0,
    claimBonus: !!r.claimBonus,
    businessUsePercent: clamped / 100,
    businessId: r.businessId,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  assets.value = (taxStore.data?.depreciationAssets ?? []).map(fromStored);
});

function addRow() {
  assets.value.push(blank());
}

function remove(i: number) {
  assets.value.splice(i, 1);
}

function macrsLabel(cls: MacrsClass): string {
  const match = MACRS_CLASSES.find((m) => m.value === cls);
  return match ? match.title : cls;
}

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

async function saveAll() {
  const payload = assets.value.map(toStored);
  await taxStore.saveList('depreciation-assets', payload);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 4562 — Depreciation & Amortization"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <v-alert type="info" variant="tonal" class="mb-4">
        Form 4562 computes depreciation on assets placed in service during the
        tax year. §179 expensing and bonus depreciation are elected per-asset.
        Annual §179 limit and bonus percentage are year-configurable by the
        admin.
      </v-alert>

      <div v-if="assets.length === 0" class="text-medium-emphasis mb-3">
        No depreciable assets yet. Click the button below to add one.
      </div>

      <v-expansion-panels
        v-if="assets.length > 0"
        variant="accordion"
        class="mb-4"
      >
        <v-expansion-panel v-for="(a, i) in assets" :key="a.id">
          <v-expansion-panel-title>
            <div
              class="d-flex flex-wrap align-center ga-2"
              style="width: 100%;"
            >
              <span class="font-weight-medium">
                {{ a.description || '(unnamed asset)' }}
              </span>
              <v-chip size="small" variant="tonal">
                {{ macrsLabel(a.macrsClass) }}
              </v-chip>
              <v-spacer />
              <span class="text-medium-emphasis">
                Cost: {{ formatMoney(a.cost) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="a.description"
                  label="Description"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="a.datePlacedInService"
                  type="date"
                  label="Date placed in service"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <CurrencyInput v-model="a.cost" label="Cost" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="a.macrsClass"
                  :items="MACRS_CLASSES"
                  item-title="title"
                  item-value="value"
                  label="MACRS class"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="a.businessUsePercentUi"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  label="Business use %"
                  suffix="%"
                  variant="outlined"
                  density="comfortable"
                  hint="Enter 0-100 (e.g. 100 = fully business use)"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="a.section179Election"
                  label="§179 election"
                />
              </v-col>
              <v-col cols="12" md="4" class="d-flex align-center">
                <v-checkbox
                  v-model="a.claimBonus"
                  label="Claim bonus depreciation"
                  density="comfortable"
                  hide-details
                />
              </v-col>
            </v-row>

            <div class="text-right">
              <v-btn
                variant="text"
                color="error"
                prepend-icon="mdi-delete"
                @click="remove(i)"
              >
                Remove asset
              </v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">
        Add asset
      </v-btn>
    </WizardStep>
  </AppShell>
</template>
