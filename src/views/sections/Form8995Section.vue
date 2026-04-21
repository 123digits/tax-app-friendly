<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { QbiActivity } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

type ActivityRow = QbiActivity;

const activities = ref<ActivityRow[]>([]);
const reitPtpDividends = ref(0);
const priorYearQbiLossCarry = ref(0);
const priorYearReitPtpLossCarry = ref(0);

function emptyActivity(): ActivityRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    ein: null,
    qbi: 0,
    isSstb: false,
    w2Wages: 0,
    ubia: 0,
  };
}

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f = taxStore.data?.form8995;
  activities.value = (f?.activities ?? []).map((a) => ({ ...a }));
  reitPtpDividends.value = f?.reitPtpDividends ?? 0;
  priorYearQbiLossCarry.value = f?.priorYearQbiLossCarry ?? 0;
  priorYearReitPtpLossCarry.value = f?.priorYearReitPtpLossCarry ?? 0;
});

function addActivity() {
  activities.value.push(emptyActivity());
}

function removeActivity(id: string) {
  activities.value = activities.value.filter((a) => a.id !== id);
}

async function save() {
  await (taxStore as any).savePayload('form-8995', {
    activities: activities.value.map((a) => ({
      id: a.id,
      name: a.name,
      ein: a.ein,
      qbi: Number(a.qbi) || 0,
      isSstb: !!a.isSstb,
      w2Wages: Number(a.w2Wages) || 0,
      ubia: Number(a.ubia) || 0,
    })),
    reitPtpDividends: reitPtpDividends.value,
    priorYearQbiLossCarry: priorYearQbiLossCarry.value,
    priorYearReitPtpLossCarry: priorYearReitPtpLossCarry.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8995 — Qualified Business Income Deduction"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Form 8995 (simplified) computes the §199A deduction (Form 1040 line 13)
        when your taxable income is below the threshold
        ($241,950 single / $483,900 MFJ for 2025). If you have business income
        on Schedule C, F, or a K-1, you can list each activity here; otherwise
        the app uses net business income as a fallback "deemed QBI" activity.
        Above the threshold, Form 8995-A is required and this simplified form
        does not apply.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <div class="d-flex justify-space-between align-center mb-2">
          <h3 class="text-subtitle-1">Qualified trade or business activities (line 1)</h3>
          <v-btn size="small" variant="tonal" @click="addActivity">
            <v-icon start>mdi-plus</v-icon>Add activity
          </v-btn>
        </div>

        <div v-if="activities.length === 0" class="text-body-2 text-medium-emphasis">
          No activities — QBI will be deemed from your Schedule C/F/K-1 net income.
        </div>

        <v-card
          v-for="a in activities"
          :key="a.id"
          variant="tonal"
          class="mb-3 pa-3"
        >
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="a.name"
                label="Trade/business name"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="a.ein"
                label="EIN (optional)"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="6">
              <CurrencyInput
                v-model="a.qbi"
                label="Qualified business income (may be negative)"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-checkbox
                v-model="a.isSstb"
                label="Specified Service Trade/Business (SSTB, §199A(d)(2))"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" class="d-flex justify-end">
              <v-btn
                size="small"
                variant="text"
                color="error"
                @click="removeActivity(a.id)"
              >
                <v-icon start>mdi-delete</v-icon>Remove
              </v-btn>
            </v-col>
          </v-row>
        </v-card>
      </v-card>

      <v-card variant="outlined" class="mb-4 pa-3">
        <h3 class="text-subtitle-1 mb-2">REIT / PTP dividends (line 6)</h3>
        <CurrencyInput
          v-model="reitPtpDividends"
          label="Aggregate §199A REIT dividends (1099-DIV box 5) + qualified PTP income"
        />
      </v-card>

      <v-card variant="outlined" class="mb-4 pa-3">
        <h3 class="text-subtitle-1 mb-2">Prior-year loss carryforwards (lines 3 &amp; 7)</h3>
        <p class="text-body-2 text-medium-emphasis mb-2">
          Enter as positive magnitudes — they'll be treated as negative QBI
          per §199A(c)(2) and §199A(c)(4)(B).
        </p>
        <v-row dense>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="priorYearQbiLossCarry"
              label="Prior-year QBI loss carryforward"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="priorYearReitPtpLossCarry"
              label="Prior-year REIT/PTP loss carryforward"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
