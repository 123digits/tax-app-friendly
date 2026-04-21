<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { CapitalGain } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const rows = ref<CapitalGain[]>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  rows.value = JSON.parse(JSON.stringify(taxStore.data?.capitalGains ?? []));
});

function blank(): CapitalGain {
  return {
    id: crypto.randomUUID(),
    description: '',
    dateAcquired: null,
    dateSold: null,
    proceeds: 0,
    costBasis: 0,
    term: 'long',
  };
}

function add() { rows.value.push(blank()); }
function remove(i: number) { rows.value.splice(i, 1); }

async function save() {
  await taxStore.saveList('capital-gains', rows.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Capital Gains (Schedule D / 8949)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">One row per asset sale. Term is short if held ≤ 1 year, otherwise long.</p>

      <v-card v-for="(r, i) in rows" :key="r.id" variant="outlined" class="mb-3 pa-3">
        <v-row>
          <v-col cols="8">
            <v-text-field v-model="r.description" label="Description (e.g. 100 sh AAPL)" variant="outlined" density="comfortable" />
          </v-col>
          <v-col cols="4">
            <v-select v-model="r.term" :items="[{title:'Short-term', value:'short'},{title:'Long-term', value:'long'}]" label="Term" variant="outlined" density="comfortable" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <v-text-field v-model="r.dateAcquired" label="Date acquired" type="date" variant="outlined" density="comfortable" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="r.dateSold" label="Date sold" type="date" variant="outlined" density="comfortable" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6"><CurrencyInput v-model="r.proceeds" label="Proceeds" /></v-col>
          <v-col cols="6"><CurrencyInput v-model="r.costBasis" label="Cost basis" /></v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add sale</v-btn>
    </WizardStep>
  </AppShell>
</template>
