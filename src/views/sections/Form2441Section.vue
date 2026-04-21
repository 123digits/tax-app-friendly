<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form2441 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const totalQualifiedExpenses = ref(0);
const numQualifyingPersons = ref(0);
const taxpayerEarnedIncome = ref(0);
const spouseEarnedIncome = ref(0);
const employerProvidedBenefits = ref(0);

const qualifyingPersonsItems = [
  { value: 0, title: '0 — no qualifying persons' },
  { value: 1, title: '1 qualifying person' },
  { value: 2, title: '2 or more qualifying persons' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form2441 = taxStore.data?.form2441 ?? {
    totalQualifiedExpenses: 0,
    numQualifyingPersons: 0,
    taxpayerEarnedIncome: 0,
    spouseEarnedIncome: 0,
    employerProvidedBenefits: 0,
  };
  totalQualifiedExpenses.value = f.totalQualifiedExpenses;
  numQualifyingPersons.value = f.numQualifyingPersons;
  taxpayerEarnedIncome.value = f.taxpayerEarnedIncome;
  spouseEarnedIncome.value = f.spouseEarnedIncome;
  employerProvidedBenefits.value = f.employerProvidedBenefits;
});

async function save() {
  await (taxStore as any).savePayload('form-2441', {
    totalQualifiedExpenses: totalQualifiedExpenses.value,
    numQualifyingPersons: numQualifyingPersons.value,
    taxpayerEarnedIncome: taxpayerEarnedIncome.value,
    spouseEarnedIncome: spouseEarnedIncome.value,
    employerProvidedBenefits: employerProvidedBenefits.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 2441 — Child and Dependent Care Expenses"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        If you paid someone to care for a qualifying child under 13 (or a
        disabled spouse or dependent) so you could work or look for work, you
        may qualify for this credit. Qualified expenses are capped at $3,000
        for one qualifying person or $6,000 for two or more, reduced by any
        dependent care benefits your employer provided (W-2 box 10). The
        credit rate ranges from 35% down to 20% depending on your AGI. If
        you're married filing jointly, both spouses must have earned income.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="numQualifyingPersons"
              :items="qualifyingPersonsItems"
              label="Number of qualifying persons"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="totalQualifiedExpenses"
              label="Total qualified care expenses paid"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="taxpayerEarnedIncome"
              label="Your earned income"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="spouseEarnedIncome"
              label="Spouse's earned income (MFJ only; leave 0 otherwise)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="employerProvidedBenefits"
              label="Employer-provided dependent care benefits (W-2 box 10)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
