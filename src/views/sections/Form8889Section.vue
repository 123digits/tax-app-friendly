<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8889, HsaCoverage } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const coverage = ref<HsaCoverage>('none');
const contributions = ref(0);
const isCatchUpEligible = ref(false);
const distributions = ref(0);
const qualifiedMedicalExpenses = ref(0);
const isDisabledOrOver65 = ref(false);

const coverageItems = [
  { value: 'none', title: 'No HSA coverage' },
  { value: 'self', title: 'Self-only HDHP' },
  { value: 'family', title: 'Family HDHP' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8889 = taxStore.data?.form8889 ?? {
    coverage: 'none',
    contributions: 0,
    isCatchUpEligible: false,
    distributions: 0,
    qualifiedMedicalExpenses: 0,
    isDisabledOrOver65: false,
  };
  coverage.value = f.coverage ?? 'none';
  contributions.value = f.contributions ?? 0;
  isCatchUpEligible.value = f.isCatchUpEligible ?? false;
  distributions.value = f.distributions ?? 0;
  qualifiedMedicalExpenses.value = f.qualifiedMedicalExpenses ?? 0;
  isDisabledOrOver65.value = f.isDisabledOrOver65 ?? false;
});

async function save() {
  await (taxStore as any).savePayload('form-8889', {
    coverage: coverage.value,
    contributions: contributions.value,
    isCatchUpEligible: isCatchUpEligible.value,
    distributions: distributions.value,
    qualifiedMedicalExpenses: qualifiedMedicalExpenses.value,
    isDisabledOrOver65: isDisabledOrOver65.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8889 — Health Savings Account"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Your HSA contributions reduce your AGI up to a limit based on your HDHP
        coverage type. Distributions used for qualified medical expenses are
        tax-free. Non-qualified distributions are taxable and — unless you're
        65+ or disabled — subject to an additional 20% tax.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="coverage"
              :items="coverageItems"
              label="HDHP coverage"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="contributions"
              label="Contributions made directly (not through employer cafeteria plan)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="isCatchUpEligible"
              label="Age 55+ (catch-up eligible)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="distributions"
              label="Total HSA distributions (1099-SA box 1)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="qualifiedMedicalExpenses"
              label="Qualified medical expenses paid from HSA"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="isDisabledOrOver65"
              label="Age 65+ or disabled (exempts non-medical distributions from 20% penalty)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
