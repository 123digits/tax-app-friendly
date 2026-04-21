<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import { useAdminStore } from '../../stores/admin';
import type { FilingStatus, TaxBracket, TaxYearConfig } from '../../../shared/types';

const route = useRoute();
const router = useRouter();
const admin = useAdminStore();

const year = computed(() => Number(route.params.year));

const cfg = ref<TaxYearConfig | null>(null);
const error = ref<string | null>(null);
const saving = ref(false);
const saved = ref(false);

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'mfs', label: 'Married filing separately' },
  { value: 'hoh', label: 'Head of household' },
  { value: 'qw', label: 'Qualifying surviving spouse' },
];

// Phase 0 grouped constant keys. The editor renders any shape as raw JSON so
// adding fields in later phases (via shared/types.ts + the seed INSERT in
// server/db/schema.sql) shows up here without code changes. Later phases can
// swap individual rows for structured editors.
type GroupKey =
  | 'retirement' | 'hsa' | 'education'
  | 'ssTaxability' | 'additionalMedicare' | 'niit'
  | 'amt' | 'saversCredit' | 'depreciation'
  | 'eitc' | 'feie' | 'childCare'
  // Wave 1 groups
  | 'seTax' | 'penalties' | 'scheduleRCredit' | 'residentialEnergy'
  | 'mortgageCredit' | 'evCredit' | 'homeOffice' | 'passiveLoss'
  | 'underpaymentPenalty' | 'householdEmployment' | 'actc' | 'ptc'
  | 'qbi';

const GROUP_LABELS: { key: GroupKey; label: string; hint: string }[] = [
  { key: 'retirement',         label: 'Retirement (IRA, SEP, Solo 401k)',   hint: 'iraLimit, iraCatchUp, sepPercent, solo401kLimit, catchUpAge' },
  { key: 'hsa',                label: 'HSA contribution limits',            hint: 'selfLimit, familyLimit, catchUp' },
  { key: 'education',          label: 'Education (AOTC, LLC, SLI, educator)', hint: 'aotcMax, aotcRefundablePct, aotcPhaseout, llcRate, llcMaxExpenses, llcPhaseout, studentLoanInterestLimit, studentLoanInterestPhaseout, educatorExpenseLimit, aotcFirstTierExpense, aotcFirstTierRate, aotcSecondTierRate' },
  { key: 'ssTaxability',       label: 'Social Security taxability',          hint: 'per filing status: tier1, tier2, tier1Rate, tier2Rate' },
  { key: 'additionalMedicare', label: 'Additional Medicare (Form 8959)',     hint: 'per filing status: rate, threshold' },
  { key: 'niit',               label: 'NIIT (Form 8960)',                    hint: 'per filing status: rate, threshold' },
  { key: 'amt',                label: 'AMT (Form 6251)',                     hint: 'per filing status: exemption, phaseoutStart, phaseoutRate, rate26, rate28, rate28Threshold' },
  { key: 'saversCredit',       label: "Saver's Credit (Form 8880)",          hint: 'per filing status: agiTiers[], rates[]' },
  { key: 'depreciation',       label: 'Depreciation (§179, bonus, MACRS)',   hint: 'section179Limit, section179Phaseout, bonusPct, firstYearMacrs (map of MacrsClass → rate)' },
  { key: 'eitc',               label: 'EITC (Schedule EIC)',                 hint: 'per filing status, per # of qualifying kids (keys "0","1","2","3"): maxAgi, maxCredit, phaseInRate, phaseOutRate, phaseOutStart' },
  { key: 'feie',               label: 'FEIE (Form 2555)',                    hint: 'exclusionLimit, housingBasePct, housingCapPct' },
  { key: 'childCare',          label: 'Dependent care credit (Form 2441)',   hint: 'maxExpenseOne, maxExpenseTwo, rates[] = [{agi, rate}]' },

  // Wave 1 groups
  { key: 'seTax',               label: 'Self-employment tax rates',           hint: 'ssRate, medicareRate, incomeFactor' },
  { key: 'penalties',           label: 'Penalty rates (§72(t), §223(f)(4))',  hint: 'earlyWithdrawalRate, hsaAdditionalTaxRate' },
  { key: 'scheduleRCredit',     label: 'Schedule R — Elderly/Disabled credit', hint: 'rate, baseSingle, baseMfjBoth, baseMfjOne, baseMfs, agiThresholdSingle, agiThresholdMfj, agiThresholdMfs' },
  { key: 'residentialEnergy',   label: 'Residential Energy (Form 5695)',      hint: 'cleanEnergyRate, fuelCellCapPerHalfKw, energyEfficientRate, generalImprovementAnnualCap, windowsCap, doorsCap, auditCap, heatPumpsBiomassCap' },
  { key: 'mortgageCredit',      label: 'Mortgage Interest Credit (Form 8396)', hint: 'capHighRate, highRateThreshold' },
  { key: 'evCredit',            label: 'Clean Vehicle Credit (Form 8936)',    hint: 'newVehicleMax, usedVehicleMax, usedVehicleSalePriceCap, usedVehiclePctCap' },
  { key: 'homeOffice',          label: 'Home office simplified method',       hint: 'simplifiedRatePerSqft, simplifiedMaxSqft' },
  { key: 'passiveLoss',         label: 'Passive-loss §469 allowance',         hint: 'allowanceMaxDefault, allowanceMaxMfsApart, agiStartDefault, agiEndDefault, agiStartMfs, agiEndMfs, phaseoutRate' },
  { key: 'underpaymentPenalty', label: 'Underpayment penalty (Form 2210)',    hint: 'highIncomeSafeHarborMultiplier, regularSafeHarborMultiplier, currentYearPct, deMinimis, estimatedRate, highIncomeThreshold, highIncomeThresholdMfs' },
  { key: 'householdEmployment', label: 'Household employment (Schedule H)',   hint: 'ssMedicareRate, futaNetRate' },
  { key: 'actc',                label: 'ACTC / CTC phase-in (Schedule 8812)', hint: 'refundablePerChild, earnedIncomeThreshold, phaseInRate, phaseoutPer1000' },
  { key: 'ptc',                 label: 'Premium Tax Credit (Form 8962)',      hint: 'contributionBands[], repaymentCapSingle[], repaymentCapFamily[]' },
  { key: 'qbi',                 label: 'QBI Deduction (Form 8995 §199A)',      hint: 'thresholds per filing status (single, mfj, mfs, hoh, qw), deductionRate (e.g. 0.20)' },
];

// Mirror of each group as a JSON string for the textarea. Pre-computed on
// load and written back into cfg.value[key] when the admin edits / saves.
const groupDrafts = ref<Record<string, string>>({});
const groupErrors = ref<Record<string, string | null>>({});

function seedGroupDrafts() {
  if (!cfg.value) return;
  for (const g of GROUP_LABELS) {
    const v = (cfg.value as any)[g.key];
    groupDrafts.value[g.key] = v == null ? '' : JSON.stringify(v, null, 2);
    groupErrors.value[g.key] = null;
  }
}

function applyGroupDrafts(payload: TaxYearConfig): TaxYearConfig {
  const next: any = { ...payload };
  for (const g of GROUP_LABELS) {
    const raw = (groupDrafts.value[g.key] ?? '').trim();
    if (raw === '') {
      next[g.key] = undefined;
      groupErrors.value[g.key] = null;
      continue;
    }
    try {
      next[g.key] = JSON.parse(raw);
      groupErrors.value[g.key] = null;
    } catch (e: any) {
      groupErrors.value[g.key] = `Invalid JSON: ${e?.message || 'parse error'}`;
      throw new Error(`Invalid JSON in group "${g.label}".`);
    }
  }
  return next as TaxYearConfig;
}

onMounted(async () => {
  try {
    cfg.value = await admin.get(year.value);
    seedGroupDrafts();
  } catch (e: any) {
    error.value = e?.message || 'Failed to load tax year config.';
  }
});

function addBracket(status: FilingStatus) {
  if (!cfg.value) return;
  cfg.value.brackets[status].push({ upTo: null, rate: 0 });
}

function removeBracket(status: FilingStatus, i: number) {
  if (!cfg.value) return;
  cfg.value.brackets[status].splice(i, 1);
}

function normalizeBrackets(list: TaxBracket[]): TaxBracket[] {
  // Ensure exactly one unbounded (upTo: null) bracket, and it's last.
  const bounded = list
    .filter((b) => b.upTo !== null && b.upTo !== undefined)
    .map((b) => ({ upTo: Number(b.upTo), rate: Number(b.rate) }))
    .sort((a, b) => (a.upTo as number) - (b.upTo as number));
  const unbounded = list.filter((b) => b.upTo === null || b.upTo === undefined);
  const topRate = unbounded.length
    ? Number(unbounded[unbounded.length - 1].rate)
    : bounded.length
    ? bounded[bounded.length - 1].rate
    : 0;
  return [...bounded, { upTo: null, rate: topRate }];
}

async function save() {
  if (!cfg.value) return;
  error.value = null;
  saved.value = false;
  saving.value = true;
  try {
    let payload: TaxYearConfig = {
      ...cfg.value,
      brackets: {
        single: normalizeBrackets(cfg.value.brackets.single),
        mfj: normalizeBrackets(cfg.value.brackets.mfj),
        mfs: normalizeBrackets(cfg.value.brackets.mfs),
        hoh: normalizeBrackets(cfg.value.brackets.hoh),
        qw: normalizeBrackets(cfg.value.brackets.qw),
      },
      ctcPerChild: Number(cfg.value.ctcPerChild),
      ssWageBase: Number(cfg.value.ssWageBase),
      saltCap: Number(cfg.value.saltCap),
      medicalAgiThreshold: Number(cfg.value.medicalAgiThreshold),
      capitalLossLimit: Number(cfg.value.capitalLossLimit),
      eitcInvestmentIncomeLimit:
        cfg.value.eitcInvestmentIncomeLimit == null || (cfg.value.eitcInvestmentIncomeLimit as any) === ''
          ? undefined
          : Number(cfg.value.eitcInvestmentIncomeLimit),
    };
    payload = applyGroupDrafts(payload);
    await admin.save(payload);
    cfg.value = await admin.get(year.value);
    seedGroupDrafts();
    saved.value = true;
  } catch (e: any) {
    error.value = e?.message || 'Save failed.';
  } finally {
    saving.value = false;
  }
}

function cancel() {
  router.push('/admin');
}
</script>

<template>
  <AppShell>
    <div class="d-flex align-center mb-4">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/admin">Back to admin</v-btn>
      <h1 class="text-h4 ms-4">Tax year {{ year }}</h1>
    </div>

    <v-alert v-if="error" type="error" class="mb-3" closable @click:close="error = null">
      {{ error }}
    </v-alert>
    <v-alert v-if="saved" type="success" class="mb-3" closable @click:close="saved = false">
      Saved. Every return for {{ year }} will recompute against these values.
    </v-alert>

    <div v-if="!cfg" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <v-card class="mb-4">
        <v-card-title>Brackets</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis mb-2">
            Rates are decimals (e.g. <code>0.22</code> for 22%). The last bracket
            should be "and above" — leave its upper limit empty.
          </p>
          <v-expansion-panels multiple>
            <v-expansion-panel
              v-for="fs in FILING_STATUSES"
              :key="fs.value"
              :title="fs.label"
            >
              <template #text>
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th>Up to</th>
                      <th>Rate (decimal)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(b, i) in cfg.brackets[fs.value]" :key="i">
                      <td>
                        <v-text-field
                          v-model.number="b.upTo"
                          type="number"
                          density="compact"
                          variant="outlined"
                          hide-details
                          placeholder="(and above)"
                        />
                      </td>
                      <td>
                        <v-text-field
                          v-model.number="b.rate"
                          type="number"
                          step="0.001"
                          density="compact"
                          variant="outlined"
                          hide-details
                        />
                      </td>
                      <td>
                        <v-btn
                          icon="mdi-delete"
                          size="small"
                          variant="text"
                          color="error"
                          @click="removeBracket(fs.value, i)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </v-table>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-plus"
                  class="mt-2"
                  @click="addBracket(fs.value)"
                >
                  Add bracket
                </v-btn>
              </template>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Standard deduction</v-card-title>
        <v-card-text>
          <v-row>
            <v-col v-for="fs in FILING_STATUSES" :key="fs.value" cols="12" md="4">
              <v-text-field
                v-model.number="cfg.standardDeduction[fs.value]"
                :label="fs.label"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Child Tax Credit</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="cfg.ctcPerChild"
                label="Credit per qualifying child"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
          </v-row>
          <h4 class="text-subtitle-2 mb-2">Phase-out begins at MAGI</h4>
          <v-row>
            <v-col v-for="fs in FILING_STATUSES" :key="fs.value" cols="12" md="4">
              <v-text-field
                v-model.number="cfg.ctcPhaseoutStart[fs.value]"
                :label="fs.label"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Long-term capital gains &amp; qualified dividends</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis mb-2">
            Taxable income thresholds where the 0% and 15% rates end. Anything
            above the 15% threshold is taxed at 20%.
          </p>
          <v-row>
            <v-col v-for="fs in FILING_STATUSES" :key="fs.value" cols="12" md="6">
              <v-card variant="tonal" class="pa-3">
                <div class="text-subtitle-2 mb-2">{{ fs.label }}</div>
                <v-row>
                  <v-col cols="6">
                    <v-text-field
                      v-model.number="cfg.ltcgBrackets[fs.value].zeroUpTo"
                      label="0% up to"
                      type="number"
                      variant="outlined"
                      density="comfortable"
                      prefix="$"
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field
                      v-model.number="cfg.ltcgBrackets[fs.value].fifteenUpTo"
                      label="15% up to"
                      type="number"
                      variant="outlined"
                      density="comfortable"
                      prefix="$"
                    />
                  </v-col>
                </v-row>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Additional constant groups</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis mb-2">
            Each group below is edited as raw JSON for now. Leave a group empty
            to fall back to the server's default for this tax year.
            Individual forms in later phases will replace these JSON editors
            with structured inputs.
          </p>
          <v-expansion-panels multiple>
            <v-expansion-panel
              v-for="g in GROUP_LABELS"
              :key="g.key"
              :title="g.label"
            >
              <template #text>
                <p class="text-caption text-medium-emphasis mb-2">
                  Keys: <code>{{ g.hint }}</code>
                </p>
                <v-textarea
                  v-model="groupDrafts[g.key]"
                  :error-messages="groupErrors[g.key] || undefined"
                  variant="outlined"
                  density="comfortable"
                  rows="8"
                  class="font-monospace"
                  spellcheck="false"
                  placeholder="(empty — uses server default)"
                />
              </template>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Other constants</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="cfg.ssWageBase"
                label="Social Security wage base"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="cfg.saltCap"
                label="SALT cap"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="cfg.medicalAgiThreshold"
                label="Medical AGI threshold (decimal)"
                type="number"
                step="0.001"
                variant="outlined"
                density="comfortable"
                hint="0.075 = 7.5%"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="cfg.capitalLossLimit"
                label="Capital loss limit"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="cfg.eitcInvestmentIncomeLimit"
                label="EITC investment-income limit"
                type="number"
                variant="outlined"
                density="comfortable"
                prefix="$"
                hint="§32(i) disqualifier"
                persistent-hint
              />
            </v-col>
          </v-row>
          <v-textarea
            v-model="cfg.notes"
            label="Notes (admin-only)"
            variant="outlined"
            rows="3"
            class="mt-2"
          />
        </v-card-text>
      </v-card>

      <div class="d-flex gap-2 mb-6">
        <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
      </div>
    </template>
  </AppShell>
</template>
