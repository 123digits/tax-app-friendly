<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { GamblingWinnings } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const winnings = ref<GamblingWinnings[]>([]);
const losses = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  winnings.value = JSON.parse(JSON.stringify(taxStore.data?.gambling ?? []));
  losses.value = taxStore.data?.gamblingLosses ?? 0;
});

function blank(): GamblingWinnings {
  return {
    id: crypto.randomUUID(),
    payer: '',
    winnings: 0,
    federalWithheld: 0,
  };
}

function addWinning() {
  winnings.value.push(blank());
}

function remove(i: number) {
  winnings.value.splice(i, 1);
}

async function saveAll() {
  await taxStore.saveList('gambling', winnings.value);
  await taxStore.saveMeta({ gamblingLosses: losses.value } as any);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Gambling Winnings (W-2G) and Losses"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Add one row per W-2G. Gambling losses are deductible only if you itemize, and only up to your total winnings.
      </p>

      <div v-if="winnings.length === 0" class="text-medium-emphasis mb-3">
        No W-2G winnings yet. Click the button below to add one.
      </div>

      <v-card
        v-for="(w, i) in winnings"
        :key="w.id"
        variant="outlined"
        class="mb-4 pa-3"
      >
        <v-row>
          <v-col cols="12">
            <v-text-field v-model="w.payer" label="Payer" variant="outlined" density="comfortable" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6">
            <CurrencyInput v-model="w.winnings" label="Winnings" />
          </v-col>
          <v-col cols="6">
            <CurrencyInput v-model="w.federalWithheld" label="Federal tax withheld" />
          </v-col>
        </v-row>
        <div class="text-right">
          <v-btn variant="text" color="error" @click="remove(i)">Remove W-2G</v-btn>
        </div>
      </v-card>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addWinning">Add W-2G</v-btn>

      <v-divider class="my-6" />

      <h3 class="text-subtitle-1 mb-2">Gambling losses</h3>
      <v-row>
        <v-col cols="12" md="6">
          <CurrencyInput v-model="losses" label="Total gambling losses (deductible only if itemizing)" />
        </v-col>
      </v-row>
    </WizardStep>
  </AppShell>
</template>
