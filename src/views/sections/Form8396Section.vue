<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8396 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const certificateRate = ref(0);
const mortgageInterestPaid = ref(0);
const priorYearUnusedCredit = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8396 = taxStore.data?.form8396 ?? {
    certificateRate: 0,
    mortgageInterestPaid: 0,
    priorYearUnusedCredit: 0,
  };
  certificateRate.value = f.certificateRate ?? 0;
  mortgageInterestPaid.value = f.mortgageInterestPaid ?? 0;
  priorYearUnusedCredit.value = f.priorYearUnusedCredit ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('form-8396', {
    certificateRate: Number(certificateRate.value) || 0,
    mortgageInterestPaid: mortgageInterestPaid.value,
    priorYearUnusedCredit: priorYearUnusedCredit.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8396 — Mortgage Interest Credit"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        If a state or local housing authority issued you a Mortgage Credit
        Certificate (MCC), you may claim a nonrefundable credit equal to your
        certificate credit rate times the mortgage interest you paid during
        the year. When the certificate rate is greater than 20%, the annual
        credit is capped at $2,000. Unused credit carries forward up to
        three years.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model.number="certificateRate"
              type="number"
              step="0.01"
              min="0"
              max="1"
              label="Certificate credit rate (decimal, e.g. 0.25 for 25%)"
              suffix="(decimal)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="mortgageInterestPaid"
              label="Mortgage interest paid this year"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="priorYearUnusedCredit"
              label="Prior-year unused mortgage interest credit (carryforward)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
