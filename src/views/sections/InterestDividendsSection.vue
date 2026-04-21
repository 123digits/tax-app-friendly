<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { InterestIncome, DividendIncome } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const step = ref<1 | 2>(1);
const interest = ref<InterestIncome[]>([]);
const dividends = ref<DividendIncome[]>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  interest.value = JSON.parse(JSON.stringify(taxStore.data?.interest ?? []));
  dividends.value = JSON.parse(JSON.stringify(taxStore.data?.dividends ?? []));
});

function addInterest() {
  interest.value.push({ id: crypto.randomUUID(), payer: '', amount: 0, taxExempt: false });
}
function removeInterest(i: number) { interest.value.splice(i, 1); }

function addDividend() {
  dividends.value.push({ id: crypto.randomUUID(), payer: '', ordinary: 0, qualified: 0 });
}
function removeDividend(i: number) { dividends.value.splice(i, 1); }

async function onNext() {
  if (step.value === 1) {
    await taxStore.saveList('interest', interest.value);
    step.value = 2;
  } else {
    await taxStore.saveList('dividends', dividends.value);
    router.push('/');
  }
}
function onBack() {
  if (step.value === 2) step.value = 1;
  else router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      :title="step === 1 ? 'Interest (1099-INT)' : 'Dividends (1099-DIV)'"
      :step="step"
      :total-steps="2"
      :can-back="true"
      :can-next="true"
      :next-label="step === 2 ? 'Save &amp; return' : 'Next'"
      @back="onBack"
      @next="onNext"
    >
      <div v-if="step === 1">
        <p class="mb-4">Interest from 1099-INT forms. Add an entry per payer.</p>
        <v-card v-for="(r, i) in interest" :key="r.id" variant="outlined" class="mb-3 pa-3">
          <v-row>
            <v-col cols="8">
              <v-text-field v-model="r.payer" label="Payer" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="4">
              <CurrencyInput v-model="r.amount" label="Interest" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <v-checkbox
                v-model="r.taxExempt"
                label="Tax-exempt interest (1099-INT box 8) — excluded from AGI but added to Social Security provisional income"
                density="comfortable"
                hide-details
              />
            </v-col>
          </v-row>
          <div class="text-right">
            <v-btn variant="text" color="error" @click="removeInterest(i)">Remove</v-btn>
          </div>
        </v-card>
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addInterest">Add interest payer</v-btn>
      </div>

      <div v-else>
        <p class="mb-4">Dividends from 1099-DIV. "Qualified" is box 1b on the 1099.</p>
        <v-card v-for="(r, i) in dividends" :key="r.id" variant="outlined" class="mb-3 pa-3">
          <v-row>
            <v-col cols="8">
              <v-text-field v-model="r.payer" label="Payer" variant="outlined" density="comfortable" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <CurrencyInput v-model="r.ordinary" label="Ordinary dividends (1a)" />
            </v-col>
            <v-col cols="6">
              <CurrencyInput v-model="r.qualified" label="Qualified dividends (1b)" />
            </v-col>
          </v-row>
          <div class="text-right">
            <v-btn variant="text" color="error" @click="removeDividend(i)">Remove</v-btn>
          </div>
        </v-card>
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addDividend">Add dividend payer</v-btn>
      </div>
    </WizardStep>
  </AppShell>
</template>
