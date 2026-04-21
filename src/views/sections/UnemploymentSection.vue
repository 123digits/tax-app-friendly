<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { UnemploymentIncome } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<UnemploymentIncome[]>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.unemployment ?? []));
});

function blank(): UnemploymentIncome {
  return {
    id: crypto.randomUUID(),
    payer: '',
    amount: 0,
    federalWithheld: 0,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('unemployment', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Unemployment Compensation (1099-G)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add a row for each 1099-G you received. Unemployment is fully taxable on the federal return.
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No 1099-G entries yet.
      </div>

      <v-card
        v-for="(u, i) in items"
        :key="u.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12">
            <v-text-field v-model="u.payer" label="Payer" variant="outlined" density="comfortable" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="u.amount" label="Box 1 — Unemployment compensation" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="u.federalWithheld" label="Box 4 — Federal tax withheld" />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove 1099-G</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add 1099-G</v-btn>
    </WizardStep>
  </AppShell>
</template>
