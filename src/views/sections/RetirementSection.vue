<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { RetirementIncome } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<RetirementIncome[]>([]);

const DISTRIBUTION_CODES = [
  { value: '1', title: '1 — Early distribution, no known exception' },
  { value: '2', title: '2 — Early distribution, exception applies' },
  { value: '3', title: '3 — Disability' },
  { value: '4', title: '4 — Death' },
  { value: '7', title: '7 — Normal distribution' },
  { value: 'G', title: 'G — Direct rollover' },
  { value: 'B', title: 'B — Designated Roth distribution' },
  { value: 'H', title: 'H — Direct rollover to Roth IRA' },
];

const EXCEPTION_CODES = [
  { value: null, title: '— no exception —' },
  { value: '01', title: '01 — Separation from service, age 55+' },
  { value: '02', title: '02 — Distributions due to total disability' },
  { value: '03', title: '03 — Distributions due to death' },
  { value: '04', title: '04 — Substantially equal periodic payments' },
  { value: '05', title: '05 — Medical expenses > AGI threshold' },
  { value: '06', title: '06 — QDRO (from qualified plan)' },
  { value: '07', title: '07 — IRA distributions while unemployed (health ins.)' },
  { value: '08', title: '08 — IRA higher-education expenses' },
  { value: '09', title: '09 — IRA first-home purchase ($10k max)' },
  { value: '10', title: '10 — IRS levy' },
  { value: '11', title: '11 — Qualified reservist distribution' },
  { value: '12', title: '12 — Other (see instructions)' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.retirementIncome ?? []));
});

function blank(): RetirementIncome {
  return {
    id: crypto.randomUUID(),
    payer: '',
    grossDistribution: 0,
    taxableAmount: 0,
    federalWithheld: 0,
    stateWithheld: 0,
    distributionCode: '7',
    isIra: false,
    isRoth: false,
    exceptionCode: null,
    taxableAmountNotDetermined: false,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('retirement-income', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Retirement Income (1099-R)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add one row per 1099-R. The taxable amount flows to Form 1040 line 4b/5b.
        Distribution code 1 without a valid exception triggers a 10% additional
        tax (Form 5329 Part I).
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No 1099-R entries yet.
      </div>

      <v-card
        v-for="(r, i) in items"
        :key="r.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field v-model="r.payer" label="Payer" variant="outlined" density="comfortable" />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="r.distributionCode"
              :items="DISTRIBUTION_CODES"
              item-title="title"
              item-value="value"
              label="Box 7 — Distribution code"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="r.grossDistribution" label="Box 1 — Gross distribution" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="r.taxableAmount" label="Box 2a — Taxable amount" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="r.federalWithheld" label="Box 4 — Federal tax withheld" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="r.stateWithheld" label="Box 14 — State tax withheld" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="4">
            <v-checkbox v-model="r.isIra" label="IRA/SEP/SIMPLE" density="comfortable" hide-details />
          </v-col>
          <v-col cols="4">
            <v-checkbox v-model="r.isRoth" label="Roth" density="comfortable" hide-details />
          </v-col>
          <v-col cols="4">
            <v-select
              v-model="r.exceptionCode"
              :items="EXCEPTION_CODES"
              item-title="title"
              item-value="value"
              label="Form 5329 exception"
              variant="outlined"
              density="comfortable"
              :disabled="r.distributionCode !== '1'"
            />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove 1099-R</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add 1099-R</v-btn>
    </WizardStep>
  </AppShell>
</template>
