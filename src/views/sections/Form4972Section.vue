<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form4972 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const qualifyingLumpSum = ref(0);
const capitalGainPortion = ref(0);
const ordinaryPortion = ref(0);
const computedTax = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form4972 = taxStore.data?.form4972 ?? {
    qualifyingLumpSum: 0,
    capitalGainPortion: 0,
    ordinaryPortion: 0,
    computedTax: 0,
  };
  qualifyingLumpSum.value = f.qualifyingLumpSum ?? 0;
  capitalGainPortion.value = f.capitalGainPortion ?? 0;
  ordinaryPortion.value = f.ordinaryPortion ?? 0;
  computedTax.value = f.computedTax ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('form-4972', {
    qualifyingLumpSum: qualifyingLumpSum.value,
    capitalGainPortion: capitalGainPortion.value,
    ordinaryPortion: ordinaryPortion.value,
    computedTax: computedTax.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 4972 — Lump-Sum Distribution 10-Year Averaging"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Available only to participants born before January 2, 1936 (or
        their beneficiaries) who receive a qualifying lump-sum
        distribution from a qualified retirement plan. Complete the Form
        4972 worksheet in the IRS instructions and enter the computed tax
        below — if lower than the default treatment, electing §402(d)
        averaging can reduce the tax on the distribution.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput v-model="qualifyingLumpSum" label="Qualifying lump-sum distribution" />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="capitalGainPortion" label="Capital gain portion (pre-1974)" />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="ordinaryPortion" label="Ordinary income portion" />
          </v-col>
          <v-col cols="12">
            <CurrencyInput v-model="computedTax" label="Computed tax from Form 4972 worksheet" />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
