<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form1116Basket } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<Form1116Basket[]>([]);

const CATEGORIES = [
  { value: 'passive', title: 'Passive — dividends, interest, royalties' },
  { value: 'general', title: 'General — wages, active business income' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.form1116Baskets ?? []));
});

function blank(): Form1116Basket {
  return {
    id: crypto.randomUUID(),
    category: 'passive',
    country: '',
    foreignGrossIncome: 0,
    definitelyRelatedDeductions: 0,
    foreignTaxPaid: 0,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('form-1116-baskets', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 1116 — Foreign Tax Credit"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add one row per foreign-income source. Baskets are grouped by category
        (passive vs general) for the limitation calculation; multiple rows in
        the same category are aggregated before the limit is applied. The
        allowed credit is the lesser of the foreign tax you paid and
        US&nbsp;tax&nbsp;&times;&nbsp;(foreign taxable income / total taxable
        income). Carrybacks and carryforwards are handled in a later step.
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No foreign-income baskets yet.
      </div>

      <v-card
        v-for="(r, i) in items"
        :key="r.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="r.category"
              :items="CATEGORIES"
              item-title="title"
              item-value="value"
              label="Category"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="r.country"
              label="Country"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="r.foreignGrossIncome"
              label="Foreign gross income"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="r.definitelyRelatedDeductions"
              label="Definitely-related deductions"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="r.foreignTaxPaid"
              label="Foreign tax paid"
            />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove basket</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add basket</v-btn>
    </WizardStep>
  </AppShell>
</template>
