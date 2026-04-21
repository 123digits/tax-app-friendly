<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Schedule1Adjustments } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const educatorExpenses = ref(0);
const hsaDeduction = ref(0);
const selfEmployedHealthInsurance = ref(0);
const sepContribution = ref(0);
const simpleContribution = ref(0);
const solo401kContribution = ref(0);
const traditionalIraDeduction = ref(0);
const studentLoanInterest = ref(0);
const penaltyEarlyWithdrawal = ref(0);
const alimonyPaid = ref(0);
const alimonyRecipientSsn = ref<string | null>(null);
const alimonyDivorceDate = ref<string | null>(null);
const reservistExpenses = ref(0);
const performingArtistExpenses = ref(0);
const feeBasisExpenses = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const s: Schedule1Adjustments = taxStore.data?.schedule1Adjustments ?? {
    educatorExpenses: 0,
    hsaDeduction: 0,
    selfEmployedHealthInsurance: 0,
    sepContribution: 0,
    simpleContribution: 0,
    solo401kContribution: 0,
    traditionalIraDeduction: 0,
    studentLoanInterest: 0,
    penaltyEarlyWithdrawal: 0,
    alimonyPaid: 0,
    alimonyRecipientSsn: null,
    alimonyDivorceDate: null,
    reservistExpenses: 0,
    performingArtistExpenses: 0,
    feeBasisExpenses: 0,
  };
  educatorExpenses.value = s.educatorExpenses ?? 0;
  hsaDeduction.value = s.hsaDeduction ?? 0;
  selfEmployedHealthInsurance.value = s.selfEmployedHealthInsurance ?? 0;
  sepContribution.value = s.sepContribution ?? 0;
  simpleContribution.value = s.simpleContribution ?? 0;
  solo401kContribution.value = s.solo401kContribution ?? 0;
  traditionalIraDeduction.value = s.traditionalIraDeduction ?? 0;
  studentLoanInterest.value = s.studentLoanInterest ?? 0;
  penaltyEarlyWithdrawal.value = s.penaltyEarlyWithdrawal ?? 0;
  alimonyPaid.value = s.alimonyPaid ?? 0;
  alimonyRecipientSsn.value = s.alimonyRecipientSsn ?? null;
  alimonyDivorceDate.value = s.alimonyDivorceDate ?? null;
  reservistExpenses.value = s.reservistExpenses ?? 0;
  performingArtistExpenses.value = s.performingArtistExpenses ?? 0;
  feeBasisExpenses.value = s.feeBasisExpenses ?? 0;
});

async function save() {
  await (taxStore as any).savePayload('schedule-1-adjustments', {
    educatorExpenses: educatorExpenses.value,
    hsaDeduction: hsaDeduction.value,
    selfEmployedHealthInsurance: selfEmployedHealthInsurance.value,
    sepContribution: sepContribution.value,
    simpleContribution: simpleContribution.value,
    solo401kContribution: solo401kContribution.value,
    traditionalIraDeduction: traditionalIraDeduction.value,
    studentLoanInterest: studentLoanInterest.value,
    penaltyEarlyWithdrawal: penaltyEarlyWithdrawal.value,
    alimonyPaid: alimonyPaid.value,
    alimonyRecipientSsn: alimonyRecipientSsn.value,
    alimonyDivorceDate: alimonyDivorceDate.value,
    reservistExpenses: reservistExpenses.value,
    performingArtistExpenses: performingArtistExpenses.value,
    feeBasisExpenses: feeBasisExpenses.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule 1 — Adjustments to Income"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Schedule 1 Part II — adjustments to income. These line items reduce your AGI.
        HSA deduction (line 13) is computed separately from Form 8889.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <h3 class="text-subtitle-1 mt-4">Educator &amp; business expenses</h3>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="educatorExpenses"
              label="Educator expenses"
              hint="Up to $300 for eligible K-12 educators"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="reservistExpenses"
              label="Certain business expenses of reservists"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="performingArtistExpenses"
              label="Performing artist expenses"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="feeBasisExpenses"
              label="Fee-basis government official expenses"
            />
          </v-col>
        </v-row>

        <h3 class="text-subtitle-1 mt-4">Self-employed retirement &amp; insurance</h3>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="selfEmployedHealthInsurance"
              label="Self-employed health insurance deduction"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="sepContribution"
              label="SEP contribution"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="simpleContribution"
              label="SIMPLE contribution"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="solo401kContribution"
              label="Solo 401(k) contribution"
            />
          </v-col>
        </v-row>

        <h3 class="text-subtitle-1 mt-4">IRA &amp; student loan</h3>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="traditionalIraDeduction"
              label="Traditional IRA deduction"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="studentLoanInterest"
              label="Student loan interest deduction"
              hint="Up to $2,500; subject to income phase-out"
            />
          </v-col>
        </v-row>

        <h3 class="text-subtitle-1 mt-4">Other</h3>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="penaltyEarlyWithdrawal"
              label="Penalty on early withdrawal of savings"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="alimonyPaid"
              label="Alimony paid"
              hint="Only for divorce/separation agreements executed before 2019"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="alimonyRecipientSsn"
              label="Alimony recipient SSN"
              placeholder="XXX-XX-XXXX"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="alimonyDivorceDate"
              label="Date of original divorce or separation agreement"
              type="date"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
