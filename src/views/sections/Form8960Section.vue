<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8960 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const investmentInterestExpense = ref(0);
const stateTaxAllocableToInvestment = ref(0);
const miscInvestmentExpenses = ref(0);
const otherModifications = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8960 = taxStore.data?.form8960 ?? {
    investmentInterestExpense: 0,
    stateTaxAllocableToInvestment: 0,
    miscInvestmentExpenses: 0,
    otherModifications: 0,
  };
  investmentInterestExpense.value = f.investmentInterestExpense ?? 0;
  stateTaxAllocableToInvestment.value = f.stateTaxAllocableToInvestment ?? 0;
  miscInvestmentExpenses.value = f.miscInvestmentExpenses ?? 0;
  otherModifications.value = f.otherModifications ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('form-8960', {
    investmentInterestExpense: investmentInterestExpense.value,
    stateTaxAllocableToInvestment: stateTaxAllocableToInvestment.value,
    miscInvestmentExpenses: miscInvestmentExpenses.value,
    otherModifications: otherModifications.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8960 — Net Investment Income Tax"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Net investment income and MAGI are auto-computed; this form captures
        allocable expenses only. The 3.8% tax applies to the lesser of your
        net investment income or the amount by which your MAGI exceeds the
        filing-status threshold.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="investmentInterestExpense"
              label="Investment interest expense allocable to NII (line 9a)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="stateTaxAllocableToInvestment"
              label="State/local income tax allocable to investment income (line 9b)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="miscInvestmentExpenses"
              label="Miscellaneous investment expenses (line 9c)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="otherModifications"
              label="Other §1411 modifications (line 7)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
