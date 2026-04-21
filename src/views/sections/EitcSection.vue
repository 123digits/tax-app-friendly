<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { EitcEligibility } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

// Strings for the two overrides so a blank field maps to null (auto-compute).
const qualifyingChildrenOverride = ref<string>('');
const investmentIncomeOverride = ref<string>('');
const isEligibleAge = ref(true);
const includeCombatPay = ref(false);
const combatPayAmount = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: EitcEligibility = taxStore.data?.eitcEligibility ?? {
    qualifyingChildrenOverride: null,
    investmentIncomeOverride: null,
    isEligibleAge: true,
    includeCombatPay: false,
    combatPayAmount: 0,
  };
  qualifyingChildrenOverride.value =
    f.qualifyingChildrenOverride == null ? '' : String(f.qualifyingChildrenOverride);
  investmentIncomeOverride.value =
    f.investmentIncomeOverride == null ? '' : String(f.investmentIncomeOverride);
  isEligibleAge.value = f.isEligibleAge;
  includeCombatPay.value = f.includeCombatPay;
  combatPayAmount.value = f.combatPayAmount;
});

function parseOptionalInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function parseOptionalNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function save() {
  await (taxStore as any).savePayload('eitc-eligibility', {
    qualifyingChildrenOverride: parseOptionalInt(qualifyingChildrenOverride.value),
    investmentIncomeOverride: parseOptionalNumber(investmentIncomeOverride.value),
    isEligibleAge: isEligibleAge.value,
    includeCombatPay: includeCombatPay.value,
    combatPayAmount: includeCombatPay.value ? combatPayAmount.value : 0,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Earned Income Credit (EITC)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        The Earned Income Tax Credit is a refundable credit for low- and
        moderate-income working taxpayers. MFS filers are generally ineligible.
        Qualifying children and investment income are normally picked up from
        other sections of your return; the overrides below are provided for
        edge cases (shared custody, investment income you wish to exclude,
        etc.).
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="qualifyingChildrenOverride"
              label="Qualifying children (override)"
              type="number"
              min="0"
              hint="Blank = auto-counted from dependents flagged as qualifying children."
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="investmentIncomeOverride"
              label="Investment income (override)"
              type="number"
              min="0"
              hint="Blank = auto-sum of interest, dividends, net capital gain, royalties, passive rental. Above the statutory limit ($11,950 for 2025) disqualifies EITC entirely."
              persistent-hint
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="isEligibleAge"
              label="Eligible age (25-64 for childless filers; always check if you have qualifying children)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="includeCombatPay"
              label="Elect to include nontaxable combat pay in earned income"
            />
          </v-col>
        </v-row>
        <v-row v-if="includeCombatPay">
          <v-col cols="12">
            <CurrencyInput
              v-model="combatPayAmount"
              label="Nontaxable combat pay amount"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
