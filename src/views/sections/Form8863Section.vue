<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8863Student } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<Form8863Student[]>([]);

const CREDIT_TYPES = [
  { value: 'aotc', title: 'AOTC — American Opportunity Credit' },
  { value: 'llc', title: 'LLC — Lifetime Learning Credit' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.form8863Students ?? []));
});

function blank(): Form8863Student {
  return {
    id: crypto.randomUUID(),
    studentName: '',
    studentSsnLast4: null,
    creditType: 'aotc',
    qualifiedExpenses: 0,
    isEligibleForAotc: true,
    priorAotcYears: 0,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('form-8863-students', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8863 — Education Credits (AOTC &amp; LLC)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add one row per student. AOTC: 100% of first $2,000 + 25% of next
        $2,000 (max $2,500/student); first 4 years of post-secondary only, must
        be at least half-time, no felony drug conviction, and fewer than 4
        prior AOTC claims. LLC: 20% of up to $10,000 in pooled expenses across
        all LLC students (max $2,000). Both phase out by AGI.
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No students yet.
      </div>

      <v-card
        v-for="(s, i) in items"
        :key="s.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="s.studentName"
              label="Student name"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="s.studentSsnLast4"
              label="Student SSN (optional)"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="s.creditType"
              :items="CREDIT_TYPES"
              item-title="title"
              item-value="value"
              label="Credit type"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="s.qualifiedExpenses"
              label="Qualified expenses"
            />
          </v-col>
        </v-row>
        <v-row v-if="s.creditType === 'aotc'">
          <v-col cols="12" md="6">
            <v-checkbox
              v-model="s.isEligibleForAotc"
              label="Eligible for AOTC (half-time+, no felony drug, first 4 yrs)"
              density="comfortable"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="s.priorAotcYears"
              type="number"
              min="0"
              max="4"
              label="Prior years AOTC claimed (must be &lt; 4)"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove student</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add student</v-btn>
    </WizardStep>
  </AppShell>
</template>
