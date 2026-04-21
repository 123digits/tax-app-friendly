<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form4797Sale } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const sales = ref<Form4797Sale[]>([]);

const termItems = [
  { title: '\u00A71231 long-term (held > 1 year)', value: 'long_1231' },
  { title: 'Short-term / ordinary', value: 'short_ordinary' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  sales.value = JSON.parse(JSON.stringify(taxStore.data?.form4797Sales ?? []));
});

function blank(): Form4797Sale {
  return {
    id: crypto.randomUUID(),
    description: '',
    dateAcquired: null,
    dateSold: null,
    proceeds: 0,
    costBasis: 0,
    accumulatedDepreciation: 0,
    depreciationRecapture: 0,
    term: 'long_1231',
  };
}

function add() { sales.value.push(blank()); }
function remove(i: number) { sales.value.splice(i, 1); }

async function save() {
  await taxStore.saveList('form-4797-sales', sales.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 4797 — Sales of Business Property"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <v-alert type="info" variant="tonal" class="mb-4">
        Form 4797 reports sales of business property. §1231 long-term sales net to capital gain (if positive) or ordinary loss (if negative). Depreciation recapture (§1245/1250) is always ordinary.
      </v-alert>

      <v-card v-for="(r, i) in sales" :key="r.id" variant="outlined" class="mb-3 pa-3">
        <v-row>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="r.description"
              label="Description (e.g. delivery truck, rental building)"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="r.term"
              :items="termItems"
              label="Term"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="r.dateAcquired"
              label="Date acquired"
              type="date"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="r.dateSold"
              label="Date sold"
              type="date"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="r.proceeds" label="Proceeds" />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="r.costBasis" label="Cost basis" />
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="r.accumulatedDepreciation" label="Accumulated depreciation" />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="r.depreciationRecapture"
              label="Depreciation recapture"
              hint="The §1245/1250 portion reported as ordinary income"
              persistent-hint
            />
          </v-col>
        </v-row>

        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add sale</v-btn>
    </WizardStep>
  </AppShell>
</template>
