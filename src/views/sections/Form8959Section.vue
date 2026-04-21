<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8959 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const rrtaCompensation = ref(0);
const additionalMedicareWithheld = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form8959 = taxStore.data?.form8959 ?? {
    rrtaCompensation: 0,
    additionalMedicareWithheld: 0,
  };
  rrtaCompensation.value = f.rrtaCompensation ?? 0;
  additionalMedicareWithheld.value = f.additionalMedicareWithheld ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('form-8959', {
    rrtaCompensation: rrtaCompensation.value,
    additionalMedicareWithheld: additionalMedicareWithheld.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8959 — Additional Medicare Tax"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Medicare wages (W-2 box 5) and self-employment earnings are picked
        up automatically. The 0.9% Additional Medicare Tax applies to income
        above a filing-status threshold. This form captures RRTA
        compensation and any Additional Medicare Tax already withheld by
        your employer (reported in W-2 box 14).
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="rrtaCompensation"
              label="RRTA compensation (Railroad Retirement Tier I)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="additionalMedicareWithheld"
              label="Additional Medicare Tax withheld (W-2 box 14)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
