<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form6251 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const privateActivityBondInterest = ref(0);
const amtDepreciationAdjustment = ref(0);
const otherAdjustments = ref(0);
const amtNolCarryforward = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form6251 = taxStore.data?.form6251 ?? {
    privateActivityBondInterest: 0,
    amtDepreciationAdjustment: 0,
    otherAdjustments: 0,
    amtNolCarryforward: 0,
  };
  privateActivityBondInterest.value = f.privateActivityBondInterest;
  amtDepreciationAdjustment.value = f.amtDepreciationAdjustment;
  otherAdjustments.value = f.otherAdjustments;
  amtNolCarryforward.value = f.amtNolCarryforward;
});

async function save() {
  await (taxStore as any).savePayload('form-6251', {
    privateActivityBondInterest: privateActivityBondInterest.value,
    amtDepreciationAdjustment: amtDepreciationAdjustment.value,
    otherAdjustments: otherAdjustments.value,
    amtNolCarryforward: amtNolCarryforward.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 6251 — Alternative Minimum Tax"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        AMT is auto-computed from your taxable income, itemized deductions,
        and the preference items below. You owe the LARGER of regular tax
        or AMT. Most filers have zero AMT; this form only captures
        adjustments that aren't already on the return.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="privateActivityBondInterest"
              label="Private activity bond interest (AMT add-back)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="amtDepreciationAdjustment"
              label="AMT depreciation adjustment (regular − AMT, can be negative)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="otherAdjustments"
              label="Other §56/§57 adjustments and preferences"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="amtNolCarryforward"
              label="AMT NOL carryforward from prior years (capped at 90% of AMTI)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
