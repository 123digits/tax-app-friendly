<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form2555 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const foreignEarnedIncome = ref(0);
const qualifyingDays = ref(0);
const totalDaysInPeriod = ref(365);
const housingExpenses = ref(0);
const isBonaFideResident = ref(false);
const usesPhysicalPresence = ref(false);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form2555 = taxStore.data?.form2555 ?? {
    foreignEarnedIncome: 0,
    qualifyingDays: 0,
    totalDaysInPeriod: 365,
    housingExpenses: 0,
    isBonaFideResident: false,
    usesPhysicalPresence: false,
  };
  foreignEarnedIncome.value = f.foreignEarnedIncome;
  qualifyingDays.value = f.qualifyingDays;
  totalDaysInPeriod.value = f.totalDaysInPeriod;
  housingExpenses.value = f.housingExpenses;
  isBonaFideResident.value = f.isBonaFideResident;
  usesPhysicalPresence.value = f.usesPhysicalPresence;
});

async function save() {
  await (taxStore as any).savePayload('form-2555', {
    foreignEarnedIncome: foreignEarnedIncome.value,
    qualifyingDays: qualifyingDays.value,
    totalDaysInPeriod: totalDaysInPeriod.value,
    housingExpenses: housingExpenses.value,
    isBonaFideResident: isBonaFideResident.value,
    usesPhysicalPresence: usesPhysicalPresence.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 2555 — Foreign Earned Income Exclusion"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        U.S. citizens and resident aliens living abroad may exclude up to
        the annual §911 limit of foreign earned income from AGI, plus a
        portion of foreign housing costs, if they qualify via bona-fide
        residence OR physical presence (330 full days in any 12 consecutive
        months).
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12" md="6">
            <v-checkbox
              v-model="isBonaFideResident"
              label="Bona-fide resident of a foreign country"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-checkbox
              v-model="usesPhysicalPresence"
              label="Physical presence test (≥ 330 days)"
              hide-details
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="foreignEarnedIncome"
              label="Foreign earned income (wages + SE)"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="qualifyingDays"
              type="number"
              label="Qualifying days in period"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="totalDaysInPeriod"
              type="number"
              label="Total days in period (usually 365)"
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="housingExpenses"
              label="Foreign housing expenses"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
