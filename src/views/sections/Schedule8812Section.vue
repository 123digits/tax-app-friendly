<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Schedule8812Input } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

// Blank string == "auto" (use dependents list / derived earned income).
const qualifyingChildrenOverride = ref<string>('');
const earnedIncomeOverride = ref<string>('');
const includeCombatPay = ref(false);
const combatPayAmount = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const s: Schedule8812Input = taxStore.data?.schedule8812 ?? {
    qualifyingChildrenOverride: null,
    earnedIncomeOverride: null,
    includeCombatPay: false,
    combatPayAmount: 0,
  };
  qualifyingChildrenOverride.value =
    s.qualifyingChildrenOverride == null
      ? ''
      : String(s.qualifyingChildrenOverride);
  earnedIncomeOverride.value =
    s.earnedIncomeOverride == null ? '' : String(s.earnedIncomeOverride);
  includeCombatPay.value = s.includeCombatPay;
  combatPayAmount.value = s.combatPayAmount;
});

function parseOptionalInt(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseOptionalNumber(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function save() {
  const payload: Schedule8812Input = {
    qualifyingChildrenOverride: parseOptionalInt(qualifyingChildrenOverride.value),
    earnedIncomeOverride: parseOptionalNumber(earnedIncomeOverride.value),
    includeCombatPay: includeCombatPay.value,
    combatPayAmount: includeCombatPay.value
      ? Number(combatPayAmount.value) || 0
      : 0,
  };
  await (taxStore as any).savePayload('schedule-8812', payload);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule 8812 — Child Tax Credit &amp; ACTC"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Schedule 8812 splits the Child Tax Credit into a nonrefundable portion
        (which reduces the tax you owe) and a refundable portion — the
        Additional Child Tax Credit (ACTC). The refundable ACTC is limited to
        15% of your earned income above $2,500, up to a statutory cap per
        qualifying child. In most cases you can leave the fields below blank
        and the numbers will be taken from your dependents and income entries.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="qualifyingChildrenOverride"
              type="number"
              min="0"
              step="1"
              label="Qualifying children override (leave blank for auto)"
              hint="Overrides the count derived from your dependents list. Use for shared-custody proration or unusual cases."
              persistent-hint
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="earnedIncomeOverride"
              type="number"
              min="0"
              step="1"
              label="Earned income override (leave blank for auto)"
              hint="Overrides W-2 wages plus self-employment net earnings used in the 15% phase-in. Leave blank to auto-compute."
              persistent-hint
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="includeCombatPay"
              label="Elect to include nontaxable combat pay in earned income"
              hint="Adding combat pay can increase the refundable ACTC (and EITC)."
              persistent-hint
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
