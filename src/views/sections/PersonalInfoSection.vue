<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import SsnInput from '../../components/SsnInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { FilingStatus, Dependent } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

const step = ref(1);
const TOTAL = 4;

const filingStatus = ref<FilingStatus | null>(null);

const firstName = ref<string>('');
const lastName = ref<string>('');
const ssn = ref<string>('');
const dob = ref<string>('');
const addressLine1 = ref<string>('');
const addressLine2 = ref<string>('');
const city = ref<string>('');
const state = ref<string>('');
const zip = ref<string>('');
const spouseFirstName = ref<string>('');
const spouseLastName = ref<string>('');
const spouseSsn = ref<string>('');
const spouseDob = ref<string>('');

const dependents = ref<Array<Dependent & { ssnInput?: string }>>([]);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const r = taxStore.data;
  if (r) {
    filingStatus.value = r.filingStatus;
    firstName.value = r.personalInfo.firstName ?? '';
    lastName.value = r.personalInfo.lastName ?? '';
    dob.value = r.personalInfo.dob ?? '';
    addressLine1.value = r.personalInfo.addressLine1 ?? '';
    addressLine2.value = r.personalInfo.addressLine2 ?? '';
    city.value = r.personalInfo.city ?? '';
    state.value = r.personalInfo.state ?? '';
    zip.value = r.personalInfo.zip ?? '';
    spouseFirstName.value = r.personalInfo.spouseFirstName ?? '';
    spouseLastName.value = r.personalInfo.spouseLastName ?? '';
    spouseDob.value = r.personalInfo.spouseDob ?? '';
    dependents.value = r.dependents.map((d) => ({ ...d, ssnInput: '' }));
  }
});

const FILING_STATUS_OPTIONS: { value: FilingStatus; title: string; hint: string }[] = [
  { value: 'single', title: 'Single', hint: 'Unmarried on Dec 31, 2025' },
  { value: 'mfj', title: 'Married filing jointly', hint: 'Combine income with spouse' },
  { value: 'mfs', title: 'Married filing separately', hint: 'File separately from spouse' },
  { value: 'hoh', title: 'Head of household', hint: 'Unmarried with a qualifying person' },
  { value: 'qw', title: 'Qualifying surviving spouse', hint: 'Spouse died in 2023 or 2024' },
];

const isMarried = () => filingStatus.value === 'mfj' || filingStatus.value === 'mfs';

async function saveFilingStatus() {
  await taxStore.saveMeta({ filingStatus: filingStatus.value });
}

async function savePersonal() {
  await taxStore.savePersonalInfo({
    firstName: firstName.value || null,
    lastName: lastName.value || null,
    ssn: ssn.value || null,
    dob: dob.value || null,
    spouseFirstName: spouseFirstName.value || null,
    spouseLastName: spouseLastName.value || null,
    spouseSsn: spouseSsn.value || null,
    spouseDob: spouseDob.value || null,
  });
  ssn.value = '';
  spouseSsn.value = '';
}

async function saveAddress() {
  await taxStore.savePersonalInfo({
    addressLine1: addressLine1.value || null,
    addressLine2: addressLine2.value || null,
    city: city.value || null,
    state: state.value || null,
    zip: zip.value || null,
  });
}

function addDependent() {
  dependents.value.push({
    id: crypto.randomUUID(),
    name: '',
    ssnLast4: null,
    relationship: 'Child',
    dob: null,
    isQualifyingChild: true,
    ssnInput: '',
  });
}

function removeDependent(i: number) {
  dependents.value.splice(i, 1);
}

async function saveDependents() {
  await taxStore.saveList('dependents', dependents.value.map((d) => ({
    id: d.id,
    name: d.name,
    ssn: d.ssnInput || null,
    relationship: d.relationship,
    dob: d.dob,
    isQualifyingChild: d.isQualifyingChild,
  })));
}

async function onNext() {
  if (step.value === 1) {
    await saveFilingStatus();
  } else if (step.value === 2) {
    await savePersonal();
  } else if (step.value === 3) {
    await saveAddress();
  } else if (step.value === 4) {
    await saveDependents();
    router.push('/');
    return;
  }
  step.value = Math.min(TOTAL, step.value + 1);
}

function onBack() {
  if (step.value === 1) router.push('/');
  else step.value = step.value - 1;
}

const canNext = () => {
  if (step.value === 1) return !!filingStatus.value;
  if (step.value === 2) return !!firstName.value && !!lastName.value;
  if (step.value === 3) return !!addressLine1.value && !!city.value && !!state.value && !!zip.value;
  return true;
};

watch(filingStatus, () => { /* keep state in sync */ });
</script>

<template>
  <AppShell>
    <WizardStep
      :title="'Personal info'"
      :step="step"
      :total-steps="TOTAL"
      :can-back="true"
      :can-next="canNext()"
      :next-label="step === TOTAL ? 'Finish section' : 'Next'"
      @back="onBack"
      @next="onNext"
    >
      <!-- Step 1: filing status -->
      <div v-if="step === 1">
        <p class="mb-4">Choose your filing status for 2025.</p>
        <v-radio-group v-model="filingStatus">
          <v-radio
            v-for="opt in FILING_STATUS_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :label="opt.title"
          >
            <template #label>
              <div>
                <div>{{ opt.title }}</div>
                <div class="text-caption text-medium-emphasis">{{ opt.hint }}</div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
      </div>

      <!-- Step 2: name/SSN/DOB -->
      <div v-else-if="step === 2">
        <v-row>
          <v-col cols="6"><v-text-field v-model="firstName" label="First name" variant="outlined" /></v-col>
          <v-col cols="6"><v-text-field v-model="lastName" label="Last name" variant="outlined" /></v-col>
        </v-row>
        <SsnInput v-model="ssn" :last4="taxStore.data?.personalInfo.ssnLast4" />
        <v-text-field v-model="dob" label="Date of birth" type="date" variant="outlined" />

        <template v-if="isMarried()">
          <v-divider class="my-4" />
          <h3 class="text-subtitle-1 mb-2">Spouse</h3>
          <v-row>
            <v-col cols="6"><v-text-field v-model="spouseFirstName" label="Spouse first name" variant="outlined" /></v-col>
            <v-col cols="6"><v-text-field v-model="spouseLastName" label="Spouse last name" variant="outlined" /></v-col>
          </v-row>
          <SsnInput
            v-model="spouseSsn"
            label="Spouse SSN"
            :last4="taxStore.data?.personalInfo.spouseSsnLast4"
          />
          <v-text-field v-model="spouseDob" label="Spouse date of birth" type="date" variant="outlined" />
        </template>
      </div>

      <!-- Step 3: address -->
      <div v-else-if="step === 3">
        <v-text-field v-model="addressLine1" label="Address line 1" variant="outlined" />
        <v-text-field v-model="addressLine2" label="Address line 2 (optional)" variant="outlined" />
        <v-row>
          <v-col cols="6"><v-text-field v-model="city" label="City" variant="outlined" /></v-col>
          <v-col cols="3"><v-text-field v-model="state" label="State" variant="outlined" maxlength="2" /></v-col>
          <v-col cols="3"><v-text-field v-model="zip" label="ZIP" variant="outlined" /></v-col>
        </v-row>
      </div>

      <!-- Step 4: dependents -->
      <div v-else-if="step === 4">
        <p class="mb-4">Add any dependents you'll claim. Leave blank if none.</p>
        <v-card
          v-for="(d, i) in dependents"
          :key="d.id"
          variant="outlined"
          class="mb-3 pa-3"
        >
          <v-row>
            <v-col cols="6"><v-text-field v-model="d.name" label="Full name" variant="outlined" density="comfortable" /></v-col>
            <v-col cols="6"><v-text-field v-model="d.relationship" label="Relationship" variant="outlined" density="comfortable" /></v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <v-text-field v-model="d.dob" label="Date of birth" type="date" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="6">
              <SsnInput v-model="d.ssnInput" label="Dependent SSN" :last4="d.ssnLast4" />
            </v-col>
          </v-row>
          <v-checkbox
            v-model="d.isQualifyingChild"
            label="Qualifying child for Child Tax Credit"
            density="compact"
            hide-details
          />
          <div class="text-right mt-2">
            <v-btn variant="text" color="error" @click="removeDependent(i)">Remove</v-btn>
          </div>
        </v-card>
        <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addDependent">Add dependent</v-btn>
      </div>
    </WizardStep>
  </AppShell>
</template>
