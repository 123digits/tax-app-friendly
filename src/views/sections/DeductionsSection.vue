<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

const router = useRouter();
const taxStore = useTaxReturnStore();

const useStandard = ref(true);
const medical = ref(0);
const salt = ref(0);
const realEstate = ref(0);
const mortgage = ref(0);
const charityCash = ref(0);
const charityNonCash = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const r = taxStore.data;
  if (r) {
    useStandard.value = r.useStandardDeduction;
    medical.value = r.itemized.medical;
    salt.value = r.itemized.stateLocalTax;
    realEstate.value = r.itemized.realEstateTax;
    mortgage.value = r.itemized.mortgageInterest;
    charityCash.value = r.itemized.charitableCash;
    charityNonCash.value = r.itemized.charitableNoncash;
  }
});

async function save() {
  await taxStore.saveItemized({
    medical: medical.value,
    stateLocalTax: salt.value,
    realEstateTax: realEstate.value,
    mortgageInterest: mortgage.value,
    charitableCash: charityCash.value,
    charitableNoncash: charityNonCash.value,
  });
  await taxStore.saveMeta({ useStandardDeduction: useStandard.value });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Deductions"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Most filers take the standard deduction. If your itemized total is higher, switch below.
      </p>

      <v-radio-group v-model="useStandard" inline>
        <v-radio :value="true" label="Standard deduction" />
        <v-radio :value="false" label="Itemize (Schedule A)" />
      </v-radio-group>

      <div v-if="!useStandard">
        <v-divider class="my-4" />
        <h3 class="text-subtitle-1 mb-2">Itemized deductions</h3>
        <v-row>
          <v-col cols="6"><CurrencyInput v-model="medical" label="Medical & dental" hint="Deductible amount over 7.5% of AGI" /></v-col>
          <v-col cols="6"><CurrencyInput v-model="salt" label="State & local income/sales tax" /></v-col>
        </v-row>
        <v-row>
          <v-col cols="6"><CurrencyInput v-model="realEstate" label="Real estate taxes" /></v-col>
          <v-col cols="6"><CurrencyInput v-model="mortgage" label="Mortgage interest" /></v-col>
        </v-row>
        <v-row>
          <v-col cols="6"><CurrencyInput v-model="charityCash" label="Charitable — cash" /></v-col>
          <v-col cols="6"><CurrencyInput v-model="charityNonCash" label="Charitable — non-cash" /></v-col>
        </v-row>
        <v-alert type="info" density="compact" class="mt-2">
          SALT + real estate are capped at $10,000 combined ($5,000 MFS).
        </v-alert>
      </div>
    </WizardStep>
  </AppShell>
</template>
