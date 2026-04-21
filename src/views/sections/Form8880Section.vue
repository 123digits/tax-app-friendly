<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8880 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const elective401kDeferrals = ref(0);
const iraContributions = ref(0);
const spouseElective401kDeferrals = ref(0);
const spouseIraContributions = ref(0);
const distributionsReceived = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8880 = taxStore.data?.form8880 ?? {
    elective401kDeferrals: 0,
    iraContributions: 0,
    spouseElective401kDeferrals: 0,
    spouseIraContributions: 0,
    distributionsReceived: 0,
  };
  elective401kDeferrals.value = f.elective401kDeferrals;
  iraContributions.value = f.iraContributions;
  spouseElective401kDeferrals.value = f.spouseElective401kDeferrals;
  spouseIraContributions.value = f.spouseIraContributions;
  distributionsReceived.value = f.distributionsReceived;
});

async function save() {
  await (taxStore as any).savePayload('form-8880', {
    elective401kDeferrals: elective401kDeferrals.value,
    iraContributions: iraContributions.value,
    spouseElective401kDeferrals: spouseElective401kDeferrals.value,
    spouseIraContributions: spouseIraContributions.value,
    distributionsReceived: distributionsReceived.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8880 — Saver's Credit"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        The Saver's Credit (Retirement Savings Contributions Credit) rewards
        lower- and middle-income taxpayers for contributing to a retirement
        account. Eligible contributions (up to $2,000 per person) are
        multiplied by a rate of 50%, 20%, or 10% depending on your AGI and
        filing status. Distributions received during the testing period
        reduce the contributions that count.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="elective401kDeferrals"
              label="Elective deferrals to 401(k)/403(b)/457/SIMPLE (you)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="iraContributions"
              label="Traditional + Roth IRA contributions (you)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="spouseElective401kDeferrals"
              label="Elective deferrals (spouse, MFJ only)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="spouseIraContributions"
              label="IRA contributions (spouse, MFJ only)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="distributionsReceived"
              label="Retirement distributions received during testing period"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
