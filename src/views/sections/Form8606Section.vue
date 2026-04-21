<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8606 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const priorYearBasis = ref(0);
const currentYearNondeductible = ref(0);
const traditionalIraBalance = ref(0);
const distributions = ref(0);
const conversions = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8606 = taxStore.data?.form8606 ?? {
    priorYearBasis: 0,
    currentYearNondeductible: 0,
    traditionalIraBalance: 0,
    distributions: 0,
    conversions: 0,
  };
  priorYearBasis.value = f.priorYearBasis;
  currentYearNondeductible.value = f.currentYearNondeductible;
  traditionalIraBalance.value = f.traditionalIraBalance;
  distributions.value = f.distributions;
  conversions.value = f.conversions;
});

async function save() {
  await (taxStore as any).savePayload('form-8606', {
    priorYearBasis: priorYearBasis.value,
    currentYearNondeductible: currentYearNondeductible.value,
    traditionalIraBalance: traditionalIraBalance.value,
    distributions: distributions.value,
    conversions: conversions.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8606 — IRA Basis"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Form 8606 tracks your basis (after-tax dollars) in traditional IRAs. If you have
        any nondeductible contributions or a mix of pre-tax and after-tax dollars, every
        distribution and Roth conversion must be split pro-rata between taxable and
        nontaxable portions.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="priorYearBasis"
              label="Line 2 — Prior-year basis in traditional IRAs"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="currentYearNondeductible"
              label="Line 1 — Nondeductible contributions this year"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="traditionalIraBalance"
              label="Line 6 — Total value of ALL traditional IRAs at 12/31"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="distributions"
              label="Line 7 — Distributions (excluding conversions/rollovers)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="conversions"
              label="Line 8 — Amounts converted to Roth this year"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
