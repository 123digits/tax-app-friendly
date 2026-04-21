<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { ScheduleR } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const isTaxpayerEligible = ref(false);
const isSpouseEligible = ref(false);
const taxpayerUnder65Disabled = ref(false);
const spouseUnder65Disabled = ref(false);
const disabilityIncome = ref(0);
const nontaxableSsAndPension = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: ScheduleR = taxStore.data?.scheduleR ?? {
    isTaxpayerEligible: false,
    isSpouseEligible: false,
    taxpayerUnder65Disabled: false,
    spouseUnder65Disabled: false,
    disabilityIncome: 0,
    nontaxableSsAndPension: 0,
  };
  isTaxpayerEligible.value = f.isTaxpayerEligible ?? false;
  isSpouseEligible.value = f.isSpouseEligible ?? false;
  taxpayerUnder65Disabled.value = f.taxpayerUnder65Disabled ?? false;
  spouseUnder65Disabled.value = f.spouseUnder65Disabled ?? false;
  disabilityIncome.value = f.disabilityIncome ?? 0;
  nontaxableSsAndPension.value = f.nontaxableSsAndPension ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('schedule-r', {
    isTaxpayerEligible: isTaxpayerEligible.value,
    isSpouseEligible: isSpouseEligible.value,
    taxpayerUnder65Disabled: taxpayerUnder65Disabled.value,
    spouseUnder65Disabled: spouseUnder65Disabled.value,
    disabilityIncome: disabilityIncome.value,
    nontaxableSsAndPension: nontaxableSsAndPension.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule R — Credit for the Elderly or Disabled"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Schedule R provides a nonrefundable credit for taxpayers who are age
        65 or older by the end of the tax year, or who are under 65 and
        retired on permanent and total disability with taxable disability
        income. The credit is 15% of a base amount, reduced by nontaxable
        Social Security and pension income plus half of any AGI above the
        filing-status threshold.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="isTaxpayerEligible"
              label="Taxpayer is age 65+ or permanently and totally disabled"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="isSpouseEligible"
              label="Spouse is age 65+ or permanently and totally disabled (MFJ only)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="taxpayerUnder65Disabled"
              label="Taxpayer is under 65 and permanently and totally disabled"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="spouseUnder65Disabled"
              label="Spouse is under 65 and permanently and totally disabled"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="disabilityIncome"
              label="Taxable disability income (caps the base for under-65 disabled filers)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="nontaxableSsAndPension"
              label="Nontaxable Social Security and pension amounts (Schedule R line 13)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
