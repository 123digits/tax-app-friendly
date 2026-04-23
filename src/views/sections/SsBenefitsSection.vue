<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { SocialSecurityBenefits } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const grossBenefits = ref(0);
const medicarePremiums = ref(0);
const federalWithheld = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const ss: SocialSecurityBenefits = taxStore.data?.socialSecurity ?? {
    grossBenefits: 0,
    medicarePremiums: 0,
    federalWithheld: 0,
  };
  grossBenefits.value = ss.grossBenefits;
  medicarePremiums.value = ss.medicarePremiums;
  federalWithheld.value = ss.federalWithheld;
});

async function save() {
  await (taxStore as any).saveSocialSecurity({
    grossBenefits: grossBenefits.value,
    medicarePremiums: medicarePremiums.value,
    federalWithheld: federalWithheld.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Social Security Benefits"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Enter the amounts from your SSA-1099. Depending on your other income, either
        0%, 50%, or up to 85% of your benefits may be taxable on your federal return.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-row>
          <v-col cols="12">
            <CurrencyInput v-model="grossBenefits" label="Box 5 — Total benefits" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput
              v-model="medicarePremiums"
              label="Box 3 — Medicare premiums paid"
              hint="Informational; does not affect tax"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <CurrencyInput v-model="federalWithheld" label="Box 6 — Federal tax withheld" />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
