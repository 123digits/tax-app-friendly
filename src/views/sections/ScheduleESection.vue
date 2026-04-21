<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { ScheduleERental, ScheduleERoyalty } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const tab = ref<'rentals' | 'royalties'>('rentals');
const rentals = ref<ScheduleERental[]>([]);
const royalties = ref<ScheduleERoyalty[]>([]);

const PROPERTY_TYPES = [
  { value: 'residential', title: 'Residential' },
  { value: 'commercial', title: 'Commercial' },
  { value: 'vacation', title: 'Vacation / short-term' },
  { value: 'land', title: 'Land' },
  { value: 'other', title: 'Other' },
];

const RENTAL_EXPENSE_CATEGORIES = [
  'advertising',
  'auto',
  'cleaning',
  'insurance',
  'legal',
  'management',
  'mortgage',
  'repairs',
  'supplies',
  'taxes',
  'utilities',
  'depreciation',
  'other',
];

const RENTAL_EXPENSE_LABELS: Record<string, string> = {
  advertising: 'Advertising',
  auto: 'Auto & travel',
  cleaning: 'Cleaning & maintenance',
  insurance: 'Insurance',
  legal: 'Legal & professional',
  management: 'Management fees',
  mortgage: 'Mortgage interest',
  repairs: 'Repairs',
  supplies: 'Supplies',
  taxes: 'Taxes',
  utilities: 'Utilities',
  depreciation: 'Depreciation',
  other: 'Other',
};

function blankRental(): ScheduleERental {
  const expenses: Record<string, number> = {};
  for (const k of RENTAL_EXPENSE_CATEGORIES) expenses[k] = 0;
  return {
    id: crypto.randomUUID(),
    propertyAddress: '',
    propertyType: 'residential',
    fairRentalDays: 0,
    personalUseDays: 0,
    rentsReceived: 0,
    expenses,
    activeParticipation: true,
    isPassive: true,
    priorYearUnallowedLoss: 0,
  };
}

function blankRoyalty(): ScheduleERoyalty {
  return {
    id: crypto.randomUUID(),
    source: '',
    grossRoyalties: 0,
    expenses: 0,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  rentals.value = (taxStore.data?.scheduleERentals ?? []).map((r) => ({
    ...r,
    expenses: {
      ...Object.fromEntries(RENTAL_EXPENSE_CATEGORIES.map((k) => [k, 0])),
      ...r.expenses,
    },
  }));
  royalties.value = JSON.parse(JSON.stringify(taxStore.data?.scheduleERoyalties ?? []));
});

function addRental() { rentals.value.push(blankRental()); }
function removeRental(i: number) { rentals.value.splice(i, 1); }
function moveRental(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= rentals.value.length) return;
  const tmp = rentals.value[i];
  rentals.value[i] = rentals.value[j];
  rentals.value[j] = tmp;
}

function addRoyalty() { royalties.value.push(blankRoyalty()); }
function removeRoyalty(i: number) { royalties.value.splice(i, 1); }

async function saveAll() {
  await taxStore.saveList('schedule-e-rental', rentals.value);
  await taxStore.saveList('schedule-e-royalty', royalties.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule E — Rental Real Estate & Royalties"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; continue"
      @back="router.push('/')"
      @next="saveAll"
    >
      <v-alert type="info" variant="tonal" class="mb-4">
        Schedule E reports rental real estate and royalty income. Passive losses
        are limited by IRC §469 (Form 8582); up to $25,000 of rental losses may
        offset other income if you actively participate and your AGI is under
        $100,000 (phased out to $150,000).
      </v-alert>

      <v-tabs v-model="tab" class="mb-4" color="primary">
        <v-tab value="rentals">Rental properties</v-tab>
        <v-tab value="royalties">Royalties</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <!-- Rentals -->
        <v-window-item value="rentals">
          <div v-if="rentals.length === 0" class="text-medium-emphasis mb-3">
            No rental properties yet. Add one below.
          </div>

          <v-card
            v-for="(r, i) in rentals"
            :key="r.id"
            variant="outlined"
            class="mb-4 pa-3"
          >
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="r.propertyAddress"
                  label="Property address"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="r.propertyType"
                  :items="PROPERTY_TYPES"
                  item-title="title"
                  item-value="value"
                  label="Property type"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="r.fairRentalDays"
                  type="number"
                  label="Fair rental days"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="r.personalUseDays"
                  type="number"
                  label="Personal use days"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="6">
                <CurrencyInput v-model="r.rentsReceived" label="Rents received" />
              </v-col>
            </v-row>

            <h4 class="text-subtitle-1 mt-2">Expenses</h4>
            <v-row>
              <v-col
                v-for="cat in RENTAL_EXPENSE_CATEGORIES"
                :key="cat"
                cols="6"
                md="4"
              >
                <CurrencyInput
                  :model-value="r.expenses[cat] || 0"
                  @update:model-value="(v) => (r.expenses[cat] = v)"
                  :label="RENTAL_EXPENSE_LABELS[cat]"
                />
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" md="4">
                <v-checkbox
                  v-model="r.activeParticipation"
                  label="Active participation"
                  density="comfortable"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-checkbox
                  v-model="r.isPassive"
                  label="Passive activity"
                  density="comfortable"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="r.priorYearUnallowedLoss"
                  label="Prior-year unallowed loss"
                />
              </v-col>
            </v-row>

            <div class="d-flex justify-space-between mt-2">
              <div>
                <v-btn
                  icon="mdi-arrow-up"
                  size="small"
                  variant="text"
                  :disabled="i === 0"
                  @click="moveRental(i, -1)"
                />
                <v-btn
                  icon="mdi-arrow-down"
                  size="small"
                  variant="text"
                  :disabled="i === rentals.length - 1"
                  @click="moveRental(i, 1)"
                />
              </div>
              <v-btn
                variant="text"
                color="error"
                prepend-icon="mdi-delete"
                @click="removeRental(i)"
              >
                Remove property
              </v-btn>
            </div>
          </v-card>

          <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRental">
            Add rental property
          </v-btn>
        </v-window-item>

        <!-- Royalties -->
        <v-window-item value="royalties">
          <div v-if="royalties.length === 0" class="text-medium-emphasis mb-3">
            No royalty entries yet.
          </div>

          <v-card
            v-for="(y, i) in royalties"
            :key="y.id"
            variant="outlined"
            class="mb-4 pa-3"
          >
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="y.source"
                  label="Source (payer / property)"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="6" md="3">
                <CurrencyInput v-model="y.grossRoyalties" label="Gross royalties" />
              </v-col>
              <v-col cols="6" md="3">
                <CurrencyInput v-model="y.expenses" label="Expenses" />
              </v-col>
            </v-row>
            <div class="text-right">
              <v-btn
                variant="text"
                color="error"
                prepend-icon="mdi-delete"
                @click="removeRoyalty(i)"
              >
                Remove royalty
              </v-btn>
            </div>
          </v-card>

          <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRoyalty">
            Add royalty
          </v-btn>
        </v-window-item>
      </v-window>
    </WizardStep>
  </AppShell>
</template>
