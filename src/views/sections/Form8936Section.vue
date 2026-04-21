<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form8936Vehicle } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const items = ref<Form8936Vehicle[]>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  items.value = JSON.parse(JSON.stringify(taxStore.data?.form8936Vehicles ?? []));
});

function blank(): Form8936Vehicle {
  return {
    id: crypto.randomUUID(),
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    placedInService: null,
    isNew: true,
    purchasePrice: 0,
    businessUsePercent: 0,
    userEnteredCredit: 0,
  };
}

function addRow() {
  items.value.push(blank());
}

function remove(i: number) {
  items.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('form-8936-vehicles', items.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 8936 &mdash; Clean Vehicle Credit"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add one row per qualifying clean vehicle (by VIN). New vehicles are
        eligible for up to $7,500; used clean vehicles are eligible for up to
        $4,000 and no more than 30% of the sale price, with a $25,000 sale
        price cap. Enter the IRS-certified credit amount from the seller's
        report or the vehicle window sticker &mdash; this app will apply the
        statutory caps. Any business-use portion flows to Form 3800 and is
        not part of the nonrefundable personal credit.
      </p>

      <div v-if="items.length === 0" class="text-medium-emphasis mb-3">
        No vehicles yet.
      </div>

      <v-card
        v-for="(row, i) in items"
        :key="row.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="row.make"
              label="Make"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="row.model"
              label="Model"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="row.year"
              type="number"
              label="Year"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="row.vin"
              label="VIN"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="row.placedInService"
              type="date"
              label="Placed in service"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <v-checkbox
              v-model="row.isNew"
              label="New vehicle (uncheck for used)"
              density="comfortable"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="4">
            <CurrencyInput
              v-model="row.purchasePrice"
              label="Purchase price"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="row.businessUsePercent"
              type="number"
              min="0"
              max="1"
              step="0.01"
              label="Business-use fraction (0 = none, 1 = all)"
              hint="Enter as a decimal, e.g. 0.25 for 25% business use"
              persistent-hint
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="row.userEnteredCredit"
              label="IRS-certified credit per window sticker"
            />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove vehicle</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">Add vehicle</v-btn>
    </WizardStep>
  </AppShell>
</template>
