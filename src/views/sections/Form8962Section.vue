<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8962 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const householdSize = ref(1);
const federalPovertyLine = ref(0);
const annualEnrollmentPremium = ref(0);
const annualSlcsp = ref(0);
const advancePtcPaid = ref(0);
const additionalMagi = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8962 = taxStore.data?.form8962 ?? {
    householdSize: 1,
    federalPovertyLine: 0,
    annualEnrollmentPremium: 0,
    annualSlcsp: 0,
    advancePtcPaid: 0,
    additionalMagi: 0,
  };
  householdSize.value = f.householdSize;
  federalPovertyLine.value = f.federalPovertyLine;
  annualEnrollmentPremium.value = f.annualEnrollmentPremium;
  annualSlcsp.value = f.annualSlcsp;
  advancePtcPaid.value = f.advancePtcPaid;
  additionalMagi.value = f.additionalMagi;
});

async function save() {
  await (taxStore as any).savePayload('form-8962', {
    householdSize: Number(householdSize.value) || 0,
    federalPovertyLine: federalPovertyLine.value,
    annualEnrollmentPremium: annualEnrollmentPremium.value,
    annualSlcsp: annualSlcsp.value,
    advancePtcPaid: advancePtcPaid.value,
    additionalMagi: additionalMagi.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8962 — Premium Tax Credit"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        If you (or anyone in your tax household) enrolled in Marketplace
        health coverage and received Form 1095-A, use this section to
        reconcile the advance premium tax credit (APTC) paid to the exchange
        with the Premium Tax Credit you are actually entitled to based on
        your household income, family size, and the Federal Poverty Line.
        Any difference is either refunded to you or repaid (subject to an
        income-based cap).
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="householdSize"
              type="number"
              min="0"
              step="1"
              label="Tax household size (filer + spouse + dependents)"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="federalPovertyLine"
              label="Federal Poverty Line for your household size (HHS guidelines)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="annualEnrollmentPremium"
              label="Annual enrollment premium (1095-A, sum of column A)"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="annualSlcsp"
              label="Annual SLCSP premium (1095-A, sum of column B)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="advancePtcPaid"
              label="Advance PTC paid to the exchange (1095-A, sum of column C)"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="additionalMagi"
              label="Additional MAGI adjustments (tax-exempt interest, excluded FEIE, excluded SS)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
