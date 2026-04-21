<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { W2Income } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const w2s = ref<W2Income[]>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  w2s.value = JSON.parse(JSON.stringify(taxStore.data?.w2s ?? []));
});

function blank(): W2Income {
  return {
    id: crypto.randomUUID(),
    employer: '',
    ein: '',
    box1Wages: 0,
    box2FedWithheld: 0,
    box3SsWages: 0,
    box4SsWithheld: 0,
    box5MedicareWages: 0,
    box6MedicareWithheld: 0,
    stateWages: 0,
    stateWithheld: 0,
  };
}

function addW2() {
  w2s.value.push(blank());
}

function remove(i: number) {
  w2s.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('w2', w2s.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="W-2 Income"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">Add a W-2 for each employer. Amounts come straight off your W-2 form.</p>

      <div v-if="w2s.length === 0" class="text-medium-emphasis mb-3">
        No W-2s yet. Click the button below to add one.
      </div>

      <v-card
        v-for="(w, i) in w2s"
        :key="w.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="8">
            <v-text-field v-model="w.employer" label="Employer" variant="outlined" density="comfortable" />
          </v-col>
          <v-col cols="4">
            <v-text-field v-model="w.ein" label="EIN" variant="outlined" density="comfortable" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="w.box1Wages" label="Box 1 — Wages" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="w.box2FedWithheld" label="Box 2 — Federal tax withheld" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="w.box3SsWages" label="Box 3 — SS wages" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="w.box4SsWithheld" label="Box 4 — SS tax withheld" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="w.box5MedicareWages" label="Box 5 — Medicare wages" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="w.box6MedicareWithheld" label="Box 6 — Medicare tax withheld" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="w.stateWages" label="State wages" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="w.stateWithheld" label="State tax withheld" />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove W-2</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addW2">Add W-2</v-btn>
    </WizardStep>
  </AppShell>
</template>
