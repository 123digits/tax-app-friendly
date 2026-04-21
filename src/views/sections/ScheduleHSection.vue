<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { ScheduleH } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const cashWagesSsMedicare = ref(0);
const cashWagesFuta = ref(0);
const anyQuarterOver1000 = ref(false);
const federalIncomeTaxWithheld = ref(0);
const stateUnemploymentPaid = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: ScheduleH = taxStore.data?.scheduleH ?? {
    cashWagesSsMedicare: 0,
    cashWagesFuta: 0,
    anyQuarterOver1000: false,
    federalIncomeTaxWithheld: 0,
    stateUnemploymentPaid: 0,
  };
  cashWagesSsMedicare.value = f.cashWagesSsMedicare ?? 0;
  cashWagesFuta.value = f.cashWagesFuta ?? 0;
  anyQuarterOver1000.value = !!f.anyQuarterOver1000;
  federalIncomeTaxWithheld.value = f.federalIncomeTaxWithheld ?? 0;
  stateUnemploymentPaid.value = f.stateUnemploymentPaid ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('schedule-h', {
    cashWagesSsMedicare: cashWagesSsMedicare.value,
    cashWagesFuta: cashWagesFuta.value,
    anyQuarterOver1000: anyQuarterOver1000.value,
    federalIncomeTaxWithheld: federalIncomeTaxWithheld.value,
    stateUnemploymentPaid: stateUnemploymentPaid.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule H — Household Employment Taxes"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        If you paid cash wages to household employees (nannies,
        housekeepers, private caregivers), you may owe Social Security,
        Medicare, and FUTA taxes. SS+Medicare applies at 15.3% once any
        single employee's annual wages exceed $2,700. FUTA applies at 0.6%
        net on the first $7,000 per employee if you paid $1,000+ in any
        calendar quarter.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="cashWagesSsMedicare"
              label="Cash wages subject to SS/Medicare (aggregate over $2,700 threshold)"
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="cashWagesFuta"
              label="Wages subject to FUTA (first $7,000 per employee)"
            />
          </v-col>
          <v-col cols="12">
            <v-checkbox
              v-model="anyQuarterOver1000"
              label="Paid ≥ $1,000 in any calendar quarter (FUTA trigger)"
              hide-details
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="federalIncomeTaxWithheld"
              label="Federal income tax voluntarily withheld"
            />
          </v-col>
          <v-col cols="12">
            <CurrencyInput
              v-model="stateUnemploymentPaid"
              label="State unemployment insurance paid (documents FUTA credit)"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
