<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useTaxReturnStore } from '../stores/taxReturn';
import { SECTIONS } from '../config/sections';
import AppShell from '../components/AppShell.vue';
import SectionCard from '../components/SectionCard.vue';

const taxStore = useTaxReturnStore();

onMounted(async () => {
  await taxStore.loadYearLists();
  await taxStore.load();
  await taxStore.refreshComputed();
});

const activeYear = computed(() => taxStore.data?.taxYear ?? taxStore.activeYear ?? null);

const myYears = computed(() => taxStore.myReturns.map((r) => r.taxYear));

const startableYears = computed(() =>
  taxStore.availableYears.filter((y) => !myYears.value.includes(y))
);

async function selectYear(year: number) {
  await taxStore.switchYear(year);
}
</script>

<template>
  <AppShell>
    <div v-if="taxStore.loading" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="taxStore.data">
      <div class="d-flex align-center mb-2 flex-wrap gap-3">
        <h1 class="text-h4 me-4">Your {{ activeYear }} Return</h1>
        <v-select
          v-if="taxStore.myReturns.length > 1"
          :model-value="activeYear"
          :items="taxStore.myReturns.map((r) => r.taxYear)"
          label="Switch year"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px"
          @update:model-value="(y: number) => selectYear(y)"
        />
        <v-menu v-if="startableYears.length">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="tonal" prepend-icon="mdi-plus">
              Start another year
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              v-for="y in startableYears"
              :key="y"
              :title="`Start ${y} return`"
              @click="selectYear(y)"
            />
          </v-list>
        </v-menu>
      </div>
      <p class="text-medium-emphasis mb-6">
        Work through each section. You can revisit and edit anything at any time.
      </p>

      <v-row>
        <v-col
          v-for="section in SECTIONS"
          :key="section.id"
          cols="12"
          sm="6"
          md="4"
        >
          <SectionCard :section="section" :ret="taxStore.data" />
        </v-col>
      </v-row>
    </div>
  </AppShell>
</template>
