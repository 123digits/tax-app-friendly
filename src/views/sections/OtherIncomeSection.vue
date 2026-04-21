<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { OtherIncome, OtherIncomeSource } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<OtherIncome[]>([]);

const SOURCE_OPTIONS: { value: OtherIncomeSource; title: string }[] = [
  { value: '1099misc_box3', title: '1099-MISC box 3 — prizes/awards' },
  { value: 'jury_duty', title: 'Jury duty' },
  { value: 'scholarship_taxable', title: 'Taxable scholarship / fellowship' },
  { value: 'hobby', title: 'Hobby income' },
  { value: 'alimony_received', title: 'Alimony received (pre-2019 divorce)' },
  { value: 'other', title: 'Other (specify)' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.otherIncome ?? []));
});

function blank(): OtherIncome {
  return {
    id: crypto.randomUUID(),
    source: 'other' as const,
    description: '',
    amount: 0,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('other-income', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Other Income (Schedule 1 line 8)"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add any income that doesn't fit W-2, 1099-INT/DIV, 1099-R, SSA, 1099-G,
        Schedule C, or Schedule D. Examples: 1099-MISC prizes/awards (box 3),
        jury duty, taxable scholarships, hobby income, alimony from a pre-2019
        divorce.
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No other income entries yet.
      </div>

      <v-card
        v-for="(item, i) in items"
        :key="item.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="item.source"
              :items="SOURCE_OPTIONS"
              item-title="title"
              item-value="value"
              label="Source"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="item.description"
              label="Description"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput v-model="item.amount" label="Amount" />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove entry</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add other income</v-btn>
    </WizardStep>
  </AppShell>
</template>
