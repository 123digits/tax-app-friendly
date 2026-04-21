<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form2210 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const priorYearTax = ref(0);
const priorYearAgi = ref(0);
const whQ1 = ref(0);
const whQ2 = ref(0);
const whQ3 = ref(0);
const whQ4 = ref(0);
const estQ1 = ref(0);
const estQ2 = ref(0);
const estQ3 = ref(0);
const estQ4 = ref(0);
const requestWaiver = ref(false);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form2210 = taxStore.data?.form2210 ?? {
    priorYearTax: 0,
    priorYearAgi: 0,
    withholdingByQuarter: [0, 0, 0, 0],
    estimatedPaymentsByQuarter: [0, 0, 0, 0],
    requestWaiver: false,
  };
  priorYearTax.value = f.priorYearTax ?? 0;
  priorYearAgi.value = f.priorYearAgi ?? 0;
  whQ1.value = f.withholdingByQuarter?.[0] ?? 0;
  whQ2.value = f.withholdingByQuarter?.[1] ?? 0;
  whQ3.value = f.withholdingByQuarter?.[2] ?? 0;
  whQ4.value = f.withholdingByQuarter?.[3] ?? 0;
  estQ1.value = f.estimatedPaymentsByQuarter?.[0] ?? 0;
  estQ2.value = f.estimatedPaymentsByQuarter?.[1] ?? 0;
  estQ3.value = f.estimatedPaymentsByQuarter?.[2] ?? 0;
  estQ4.value = f.estimatedPaymentsByQuarter?.[3] ?? 0;
  requestWaiver.value = !!f.requestWaiver;
});

async function save() {
  await (taxStore as any).savePayload('form-2210', {
    priorYearTax: priorYearTax.value,
    priorYearAgi: priorYearAgi.value,
    withholdingByQuarter: [whQ1.value, whQ2.value, whQ3.value, whQ4.value],
    estimatedPaymentsByQuarter: [estQ1.value, estQ2.value, estQ3.value, estQ4.value],
    requestWaiver: requestWaiver.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 2210 — Underpayment of Estimated Tax"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        A penalty may apply if your total withholding + estimated payments
        fall short of the lesser of (a) 90% of current-year tax or
        (b) 100% of prior-year tax (110% if prior AGI &gt; $150k / $75k MFS).
        Underpayments under $1,000 are de minimis.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="priorYearTax" label="Prior-year total tax" />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="priorYearAgi" label="Prior-year AGI (for 110% rule)" />
          </v-col>

          <v-col cols="12"><strong>Withholding by quarter</strong></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="whQ1" label="Q1" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="whQ2" label="Q2" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="whQ3" label="Q3" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="whQ4" label="Q4" /></v-col>

          <v-col cols="12"><strong>Estimated payments by quarter</strong></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="estQ1" label="Q1" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="estQ2" label="Q2" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="estQ3" label="Q3" /></v-col>
          <v-col cols="12" md="3"><CurrencyInput v-model="estQ4" label="Q4" /></v-col>

          <v-col cols="12">
            <v-checkbox
              v-model="requestWaiver"
              label="Request waiver (casualty, disaster, disability)"
              hide-details
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
