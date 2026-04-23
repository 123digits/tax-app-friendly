<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { K1Income, K1EntityKind } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const k1s = ref<K1Income[]>([]);

const ENTITY_KINDS: { value: K1EntityKind; title: string }[] = [
  { value: 'partnership', title: 'Partnership (Form 1065)' },
  { value: 's_corp', title: 'S-Corporation (Form 1120-S)' },
  { value: 'trust', title: 'Trust/Estate (Form 1041)' },
];

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  k1s.value = JSON.parse(JSON.stringify(taxStore.data?.k1s ?? []));
});

function blank(): K1Income {
  return {
    id: crypto.randomUUID(),
    entityKind: 'partnership',
    entityName: '',
    ein: '',
    isPassive: true,
    ordinaryBusinessIncome: 0,
    netRentalRealEstate: 0,
    otherRentalIncome: 0,
    interestIncome: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    royalties: 0,
    shortTermCapitalGain: 0,
    longTermCapitalGain: 0,
    section1231Gain: 0,
    priorYearUnallowedLoss: 0,
  };
}

function addRow() {
  k1s.value.push(blank());
}

function remove(i: number) {
  k1s.value.splice(i, 1);
}

function entityKindLabel(kind: K1EntityKind): string {
  // Every K1EntityKind value has a matching entry in ENTITY_KINDS, so the
  // find() is always defined. The non-null assertion is safer than a
  // fallback to the raw kind which the type system would not allow us to
  // reach at runtime anyway.
  return ENTITY_KINDS.find((k) => k.value === kind)!.title;
}

function netFor(k: K1Income): number {
  return (
    k.ordinaryBusinessIncome +
    k.netRentalRealEstate +
    k.otherRentalIncome +
    k.interestIncome +
    k.ordinaryDividends +
    k.royalties +
    k.shortTermCapitalGain +
    k.longTermCapitalGain +
    k.section1231Gain
  );
}

function formatMoney(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

async function saveAll() {
  await taxStore.saveList('k1-income', k1s.value);
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Schedule K-1 Income"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="saveAll"
    >
      <p class="mb-4">
        Enter each Schedule K-1 you received from a partnership (Form 1065),
        S-corporation (Form 1120-S), or trust/estate (Form 1041). Passive losses
        are subject to IRC §469 limits on Form 8582.
      </p>

      <div v-if="k1s.length === 0" class="text-medium-emphasis mb-3">
        No K-1s yet. Click the button below to add one.
      </div>

      <v-expansion-panels v-if="k1s.length > 0" variant="accordion" class="mb-4">
        <v-expansion-panel v-for="(k, i) in k1s" :key="k.id">
          <v-expansion-panel-title>
            <div class="d-flex flex-wrap align-center ga-2" style="width: 100%;">
              <span class="font-weight-medium">
                {{ k.entityName || '(unnamed entity)' }}
              </span>
              <v-chip size="small" variant="tonal">
                {{ entityKindLabel(k.entityKind) }}
              </v-chip>
              <v-spacer />
              <span class="text-medium-emphasis">
                Net: {{ formatMoney(netFor(k)) }}
              </span>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="k.entityKind"
                  :items="ENTITY_KINDS"
                  item-title="title"
                  item-value="value"
                  label="Entity kind"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="k.entityName"
                  label="Entity name"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="k.ein"
                  label="EIN"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12" md="6" class="d-flex align-center">
                <v-checkbox
                  v-model="k.isPassive"
                  label="Passive activity (subject to §469 limits)"
                  density="comfortable"
                  hide-details
                />
              </v-col>
            </v-row>

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-2">Ordinary / rental income</div>
            <v-row>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.ordinaryBusinessIncome"
                  label="Ordinary business income/(loss)"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.netRentalRealEstate"
                  label="Net rental real estate income/(loss)"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.otherRentalIncome"
                  label="Other rental income/(loss)"
                />
              </v-col>
            </v-row>

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-2">Portfolio income</div>
            <v-row>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.interestIncome"
                  label="Interest income"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.ordinaryDividends"
                  label="Ordinary dividends"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.qualifiedDividends"
                  label="Qualified dividends"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="4">
                <CurrencyInput v-model="k.royalties" label="Royalties" />
              </v-col>
            </v-row>

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-2">Capital gains / §1231</div>
            <v-row>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.shortTermCapitalGain"
                  label="Short-term capital gain/(loss)"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.longTermCapitalGain"
                  label="Long-term capital gain/(loss)"
                />
              </v-col>
              <v-col cols="12" md="4">
                <CurrencyInput
                  v-model="k.section1231Gain"
                  label="Section 1231 gain/(loss)"
                />
              </v-col>
            </v-row>

            <v-divider class="my-3" />
            <div class="text-subtitle-2 mb-2">Carryforwards</div>
            <v-row>
              <v-col cols="12" md="6">
                <CurrencyInput
                  v-model="k.priorYearUnallowedLoss"
                  label="Prior year unallowed passive loss (Form 8582)"
                />
              </v-col>
            </v-row>

            <div class="text-right">
              <v-btn variant="text" color="error" @click="remove(i)">
                Remove K-1
              </v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addRow">
        Add K-1
      </v-btn>
    </WizardStep>
  </AppShell>
</template>
