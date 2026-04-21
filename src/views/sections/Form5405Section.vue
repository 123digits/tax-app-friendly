<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form5405 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const annualInstallment = ref(0);
const dispositionAccelerated = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form5405 = taxStore.data?.form5405 ?? {
    annualInstallment: 0,
    dispositionAccelerated: 0,
  };
  annualInstallment.value = f.annualInstallment ?? 0;
  dispositionAccelerated.value = f.dispositionAccelerated ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('form-5405', {
    annualInstallment: annualInstallment.value,
    dispositionAccelerated: dispositionAccelerated.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 5405 — First-Time Homebuyer Credit Repayment"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Taxpayers who claimed the 2008 First-Time Homebuyer Credit repay
        in 15 equal installments starting in 2010. Sale or cessation of
        the home as your principal residence accelerates the remaining
        balance into the year of disposition.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="annualInstallment"
              label="Scheduled installment for this year"
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="dispositionAccelerated"
              label="Accelerated balance (if sold / ceased as principal residence)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
