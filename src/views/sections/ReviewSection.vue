<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

const router = useRouter();
const taxStore = useTaxReturnStore();

const estimatedPayments = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  await taxStore.refreshComputed();
  estimatedPayments.value = taxStore.data?.estimatedPayments ?? 0;
});

async function saveEstimated() {
  await taxStore.saveMeta({ estimatedPayments: estimatedPayments.value });
}

function fmt(n: number | undefined) {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

const c = computed(() => taxStore.computed);

const filingStatusLabel: Record<string, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
  qw: 'Qualifying surviving spouse',
};
</script>

<template>
  <AppShell>
    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>2025 return — summary</v-card-title>
          <v-card-text v-if="c">
            <div class="text-caption text-medium-emphasis mb-4">
              Filing status: {{ filingStatusLabel[c.filingStatus] || c.filingStatus }}
            </div>

            <h3 class="text-subtitle-1">Income</h3>
            <v-table density="compact">
              <tbody>
                <tr><td>W-2 wages</td><td class="text-right">{{ fmt(c.income.wages) }}</td></tr>
                <tr><td>Interest</td><td class="text-right">{{ fmt(c.income.interest) }}</td></tr>
                <tr><td>Ordinary dividends</td><td class="text-right">{{ fmt(c.income.ordinaryDividends) }}</td></tr>
                <tr><td class="ps-4">of which qualified</td><td class="text-right">{{ fmt(c.income.qualifiedDividends) }}</td></tr>
                <tr><td>Self-employment net profit</td><td class="text-right">{{ fmt(c.income.seNetProfit) }}</td></tr>
                <tr v-if="c.income.retirementGross">
                  <td>Retirement distributions (gross)</td>
                  <td class="text-right">{{ fmt(c.income.retirementGross) }}</td>
                </tr>
                <tr v-if="c.income.retirementTaxable">
                  <td class="ps-4">of which taxable</td>
                  <td class="text-right">{{ fmt(c.income.retirementTaxable) }}</td>
                </tr>
                <tr v-if="c.income.ssGross">
                  <td>Social Security benefits (gross)</td>
                  <td class="text-right">{{ fmt(c.income.ssGross) }}</td>
                </tr>
                <tr v-if="c.income.ssGross">
                  <td class="ps-4">of which taxable (§86)</td>
                  <td class="text-right">{{ fmt(c.income.ssTaxable) }}</td>
                </tr>
                <tr v-if="c.income.unemployment">
                  <td>Unemployment compensation</td>
                  <td class="text-right">{{ fmt(c.income.unemployment) }}</td>
                </tr>
                <tr v-if="c.income.gamblingWinnings">
                  <td>Gambling winnings</td>
                  <td class="text-right">{{ fmt(c.income.gamblingWinnings) }}</td>
                </tr>
                <tr v-if="c.income.otherIncome">
                  <td>Other income (Sched 1 line 8)</td>
                  <td class="text-right">{{ fmt(c.income.otherIncome) }}</td>
                </tr>
                <tr v-if="c.income.rentalNetIncome">
                  <td>Rental real estate (Schedule E, after §469 limits)</td>
                  <td class="text-right">{{ fmt(c.income.rentalNetIncome) }}</td>
                </tr>
                <tr v-if="c.income.rentalSuspendedLoss">
                  <td class="ps-4 text-medium-emphasis">
                    Suspended rental loss carried forward
                  </td>
                  <td class="text-right text-medium-emphasis">
                    {{ fmt(c.income.rentalSuspendedLoss) }}
                  </td>
                </tr>
                <tr v-if="c.income.royaltyNetIncome">
                  <td>Royalties (Schedule E)</td>
                  <td class="text-right">{{ fmt(c.income.royaltyNetIncome) }}</td>
                </tr>
                <tr v-if="c.income.k1OrdinaryIncome">
                  <td>K-1 ordinary/rental income (after §469)</td>
                  <td class="text-right">{{ fmt(c.income.k1OrdinaryIncome) }}</td>
                </tr>
                <tr v-if="c.income.k1SuspendedLoss">
                  <td class="ps-4 text-medium-emphasis">
                    Suspended K-1 passive loss carried forward
                  </td>
                  <td class="text-right text-medium-emphasis">
                    {{ fmt(c.income.k1SuspendedLoss) }}
                  </td>
                </tr>
                <tr v-if="c.income.k1InterestIncome">
                  <td class="ps-4">K-1 interest</td>
                  <td class="text-right">{{ fmt(c.income.k1InterestIncome) }}</td>
                </tr>
                <tr v-if="c.income.k1OrdinaryDividends">
                  <td class="ps-4">K-1 ordinary dividends</td>
                  <td class="text-right">{{ fmt(c.income.k1OrdinaryDividends) }}</td>
                </tr>
                <tr v-if="c.income.farmNetProfit">
                  <td>Farm net profit (Schedule F)</td>
                  <td class="text-right">{{ fmt(c.income.farmNetProfit) }}</td>
                </tr>
                <tr v-if="c.income.homeOfficeDeduction">
                  <td class="ps-4 text-medium-emphasis">Home office deduction (Form 8829)</td>
                  <td class="text-right text-medium-emphasis">
                    ({{ fmt(c.income.homeOfficeDeduction) }})
                  </td>
                </tr>
                <tr v-if="c.income.section1231NetGain">
                  <td>Form 4797 net §1231 gain (→ LTCG)</td>
                  <td class="text-right">{{ fmt(c.income.section1231NetGain) }}</td>
                </tr>
                <tr v-if="c.income.section1231OrdinaryLoss">
                  <td>Form 4797 §1231 ordinary loss</td>
                  <td class="text-right">{{ fmt(c.income.section1231OrdinaryLoss) }}</td>
                </tr>
                <tr v-if="c.income.depreciationRecapture">
                  <td>Depreciation recapture (§1245/1250 ordinary)</td>
                  <td class="text-right">{{ fmt(c.income.depreciationRecapture) }}</td>
                </tr>
                <tr><td>Short-term capital gain/loss</td><td class="text-right">{{ fmt(c.income.shortTermGain) }}</td></tr>
                <tr><td>Long-term capital gain/loss</td><td class="text-right">{{ fmt(c.income.longTermGain) }}</td></tr>
                <tr v-if="c.income.capitalLossDeduction < 0">
                  <td>Capital loss applied (cap)</td>
                  <td class="text-right">{{ fmt(c.income.capitalLossDeduction) }}</td>
                </tr>
                <tr class="font-weight-bold">
                  <td>Total income</td><td class="text-right">{{ fmt(c.income.totalIncome) }}</td>
                </tr>
              </tbody>
            </v-table>

            <h3 class="text-subtitle-1 mt-4">Adjustments &amp; AGI</h3>
            <v-table density="compact">
              <tbody>
                <tr><td>½ SE tax deduction</td><td class="text-right">{{ fmt(c.adjustments.seTaxDeduction) }}</td></tr>
                <tr v-if="c.adjustments.educatorExpenses">
                  <td>Educator expenses</td>
                  <td class="text-right">{{ fmt(c.adjustments.educatorExpenses) }}</td>
                </tr>
                <tr v-if="c.adjustments.hsaDeduction">
                  <td>HSA deduction (Form 8889)</td>
                  <td class="text-right">{{ fmt(c.adjustments.hsaDeduction) }}</td>
                </tr>
                <tr v-if="c.adjustments.selfEmployedHealthInsurance">
                  <td>Self-employed health insurance</td>
                  <td class="text-right">{{ fmt(c.adjustments.selfEmployedHealthInsurance) }}</td>
                </tr>
                <tr v-if="c.adjustments.sepContribution">
                  <td>SEP-IRA contribution</td>
                  <td class="text-right">{{ fmt(c.adjustments.sepContribution) }}</td>
                </tr>
                <tr v-if="c.adjustments.simpleContribution">
                  <td>SIMPLE-IRA contribution</td>
                  <td class="text-right">{{ fmt(c.adjustments.simpleContribution) }}</td>
                </tr>
                <tr v-if="c.adjustments.solo401kContribution">
                  <td>Solo 401(k) contribution</td>
                  <td class="text-right">{{ fmt(c.adjustments.solo401kContribution) }}</td>
                </tr>
                <tr v-if="c.adjustments.traditionalIraDeduction">
                  <td>Traditional IRA deduction</td>
                  <td class="text-right">{{ fmt(c.adjustments.traditionalIraDeduction) }}</td>
                </tr>
                <tr v-if="c.adjustments.studentLoanInterest">
                  <td>Student loan interest (after phase-out)</td>
                  <td class="text-right">{{ fmt(c.adjustments.studentLoanInterest) }}</td>
                </tr>
                <tr v-if="c.adjustments.penaltyEarlyWithdrawal">
                  <td>Penalty on early withdrawal of savings</td>
                  <td class="text-right">{{ fmt(c.adjustments.penaltyEarlyWithdrawal) }}</td>
                </tr>
                <tr v-if="c.adjustments.alimonyPaid">
                  <td>Alimony paid (pre-2019)</td>
                  <td class="text-right">{{ fmt(c.adjustments.alimonyPaid) }}</td>
                </tr>
                <tr v-if="c.adjustments.reservistExpenses">
                  <td>Reservist expenses</td>
                  <td class="text-right">{{ fmt(c.adjustments.reservistExpenses) }}</td>
                </tr>
                <tr v-if="c.adjustments.performingArtistExpenses">
                  <td>Performing artist expenses</td>
                  <td class="text-right">{{ fmt(c.adjustments.performingArtistExpenses) }}</td>
                </tr>
                <tr v-if="c.adjustments.feeBasisExpenses">
                  <td>Fee-basis government official expenses</td>
                  <td class="text-right">{{ fmt(c.adjustments.feeBasisExpenses) }}</td>
                </tr>
                <tr class="font-weight-bold"><td>Adjusted gross income</td><td class="text-right">{{ fmt(c.taxComputation.agi) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form8606 && (c.form8606.totalBasisAvailable || c.form8606.taxableDistribution || c.form8606.taxableConversion)" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 8606 — IRA basis</th></tr>
              </thead>
              <tbody>
                <tr><td>Total basis available</td><td class="text-right">{{ fmt(c.form8606.totalBasisAvailable) }}</td></tr>
                <tr><td>Taxable portion of distributions</td><td class="text-right">{{ fmt(c.form8606.taxableDistribution) }}</td></tr>
                <tr><td>Taxable portion of conversions</td><td class="text-right">{{ fmt(c.form8606.taxableConversion) }}</td></tr>
                <tr><td>Nontaxable portion</td><td class="text-right">{{ fmt(c.form8606.nontaxablePortion) }}</td></tr>
                <tr><td>Ending basis (carry forward)</td><td class="text-right">{{ fmt(c.form8606.endingBasis) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form8889 && (c.form8889.contributionLimit || c.form8889.allowedDeduction || c.form8889.taxableDistribution)" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 8889 — HSA</th></tr>
              </thead>
              <tbody>
                <tr><td>Contribution limit</td><td class="text-right">{{ fmt(c.form8889.contributionLimit) }}</td></tr>
                <tr><td>Allowed deduction</td><td class="text-right">{{ fmt(c.form8889.allowedDeduction) }}</td></tr>
                <tr v-if="c.form8889.excessContribution">
                  <td>Excess contribution (subject to 6% excise)</td>
                  <td class="text-right">{{ fmt(c.form8889.excessContribution) }}</td>
                </tr>
                <tr v-if="c.form8889.taxableDistribution">
                  <td>Non-qualified distribution (taxable)</td>
                  <td class="text-right">{{ fmt(c.form8889.taxableDistribution) }}</td>
                </tr>
                <tr v-if="c.form8889.additionalTax">
                  <td>20% additional HSA tax</td>
                  <td class="text-right">{{ fmt(c.form8889.additionalTax) }}</td>
                </tr>
              </tbody>
            </v-table>

            <v-expansion-panels multiple class="mt-4">
              <v-expansion-panel title="Schedule 1 — additional income &amp; adjustments">
                <template #text>
                  <p class="text-medium-emphasis">
                    No Schedule 1 items yet. Forms that flow through here will
                    appear in later phases (retirement, alimony, student loan
                    interest, HSA, educator expenses, etc.).
                  </p>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>

            <h3 class="text-subtitle-1 mt-4">Deductions</h3>
            <v-table density="compact">
              <tbody>
                <tr><td>Standard deduction</td><td class="text-right">{{ fmt(c.deductions.standard) }}</td></tr>
                <tr><td>Itemized deduction</td><td class="text-right">{{ fmt(c.deductions.itemized) }}</td></tr>
                <tr class="font-weight-bold"><td>Deduction used</td><td class="text-right">{{ fmt(c.deductions.used) }}</td></tr>
                <tr class="font-weight-bold"><td>Taxable income</td><td class="text-right">{{ fmt(c.taxComputation.taxableIncome) }}</td></tr>
              </tbody>
            </v-table>

            <h3 class="text-subtitle-1 mt-4">Tax</h3>
            <v-table density="compact">
              <tbody>
                <tr><td>Regular tax</td><td class="text-right">{{ fmt(c.taxComputation.regularTax) }}</td></tr>
                <tr><td>LTCG / qualified div tax</td><td class="text-right">{{ fmt(c.taxComputation.ltcgTax) }}</td></tr>
                <tr class="font-weight-bold"><td>Income tax before credits</td><td class="text-right">{{ fmt(c.taxComputation.totalTax) }}</td></tr>
                <tr v-if="c.credits.childTaxCredit"><td>Child tax credit</td><td class="text-right">({{ fmt(c.credits.childTaxCredit) }})</td></tr>
                <tr v-if="c.credits.childDependentCareCredit">
                  <td>Child &amp; dependent care credit (Form 2441)</td>
                  <td class="text-right">({{ fmt(c.credits.childDependentCareCredit) }})</td>
                </tr>
                <tr v-if="c.credits.educationCredits">
                  <td>Education credits (Form 8863)</td>
                  <td class="text-right">({{ fmt(c.credits.educationCredits) }})</td>
                </tr>
                <tr v-if="c.credits.saversCredit">
                  <td>Saver's credit (Form 8880)</td>
                  <td class="text-right">({{ fmt(c.credits.saversCredit) }})</td>
                </tr>
                <tr v-if="c.credits.elderlyDisabledCredit">
                  <td>Elderly/disabled credit (Schedule R)</td>
                  <td class="text-right">({{ fmt(c.credits.elderlyDisabledCredit) }})</td>
                </tr>
                <tr v-if="c.credits.mortgageInterestCredit">
                  <td>Mortgage interest credit (Form 8396)</td>
                  <td class="text-right">({{ fmt(c.credits.mortgageInterestCredit) }})</td>
                </tr>
                <tr v-if="c.credits.residentialEnergyCredit">
                  <td>Residential energy credit (Form 5695)</td>
                  <td class="text-right">({{ fmt(c.credits.residentialEnergyCredit) }})</td>
                </tr>
                <tr v-if="c.credits.evCredit">
                  <td>Clean vehicle credit (Form 8936)</td>
                  <td class="text-right">({{ fmt(c.credits.evCredit) }})</td>
                </tr>
                <tr v-if="c.credits.foreignTaxCredit">
                  <td>Foreign tax credit (Form 1116)</td>
                  <td class="text-right">({{ fmt(c.credits.foreignTaxCredit) }})</td>
                </tr>
                <tr class="font-weight-bold" v-if="c.credits.total">
                  <td>Total nonrefundable credits</td>
                  <td class="text-right">({{ fmt(c.credits.total) }})</td>
                </tr>
                <tr><td>SE tax</td><td class="text-right">{{ fmt(c.otherTaxes.seTax) }}</td></tr>
                <tr v-if="c.otherTaxes.earlyWithdrawalPenalty">
                  <td>10% early-withdrawal penalty (Form 5329)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.earlyWithdrawalPenalty) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.hsaAdditionalTax">
                  <td>20% HSA additional tax (Form 8889)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.hsaAdditionalTax) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.aptcRepayment">
                  <td>Excess APTC repayment (Form 8962)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.aptcRepayment) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.amt">
                  <td>Alternative Minimum Tax (Form 6251)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.amt) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.niit">
                  <td>Net Investment Income Tax (Form 8960)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.niit) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.additionalMedicare">
                  <td>Additional Medicare Tax (Form 8959)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.additionalMedicare) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.householdEmploymentTax">
                  <td>Household employment tax (Schedule H)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.householdEmploymentTax) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.firstTimeHomebuyerRepayment">
                  <td>First-time homebuyer credit repayment (Form 5405)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.firstTimeHomebuyerRepayment) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.lumpSumAveragingTax">
                  <td>Lump-sum averaging tax (Form 4972)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.lumpSumAveragingTax) }}</td>
                </tr>
                <tr v-if="c.otherTaxes.underpaymentPenalty">
                  <td>Underpayment penalty (Form 2210)</td>
                  <td class="text-right">{{ fmt(c.otherTaxes.underpaymentPenalty) }}</td>
                </tr>
                <tr><td>Total other taxes</td><td class="text-right">{{ fmt(c.otherTaxes.total) }}</td></tr>
                <tr v-if="c.refundableCredits.additionalChildTaxCredit">
                  <td>Additional child tax credit (Schedule 8812)</td>
                  <td class="text-right">({{ fmt(c.refundableCredits.additionalChildTaxCredit) }})</td>
                </tr>
                <tr v-if="c.refundableCredits.refundableAotc">
                  <td>Refundable AOTC (Form 8863)</td>
                  <td class="text-right">({{ fmt(c.refundableCredits.refundableAotc) }})</td>
                </tr>
                <tr v-if="c.refundableCredits.earnedIncomeCredit">
                  <td>Earned income credit (EITC)</td>
                  <td class="text-right">({{ fmt(c.refundableCredits.earnedIncomeCredit) }})</td>
                </tr>
                <tr v-if="c.refundableCredits.netPremiumTaxCredit">
                  <td>Net premium tax credit (Form 8962)</td>
                  <td class="text-right">({{ fmt(c.refundableCredits.netPremiumTaxCredit) }})</td>
                </tr>
                <tr class="font-weight-bold" v-if="c.refundableCredits.total">
                  <td>Total refundable credits</td>
                  <td class="text-right">({{ fmt(c.refundableCredits.total) }})</td>
                </tr>
                <tr class="font-weight-bold"><td>Total tax liability</td><td class="text-right">{{ fmt(c.summary.totalTaxAfterCredits) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form6251 && c.form6251.amtLiability" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 6251 — Alternative Minimum Tax</th></tr>
              </thead>
              <tbody>
                <tr><td>AMTI (alternative minimum taxable income)</td><td class="text-right">{{ fmt(c.form6251.amti) }}</td></tr>
                <tr><td>Exemption allowed</td><td class="text-right">{{ fmt(c.form6251.exemptionAllowed) }}</td></tr>
                <tr><td>Tentative minimum tax</td><td class="text-right">{{ fmt(c.form6251.tentativeMinimumTax) }}</td></tr>
                <tr><td>Regular tax (for AMT comparison)</td><td class="text-right">{{ fmt(c.form6251.regularTaxForAmt) }}</td></tr>
                <tr class="font-weight-bold"><td>AMT liability (Schedule 2 line 1)</td><td class="text-right">{{ fmt(c.form6251.amtLiability) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form8960 && c.form8960.niit" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 8960 — Net Investment Income Tax</th></tr>
              </thead>
              <tbody>
                <tr><td>Net investment income</td><td class="text-right">{{ fmt(c.form8960.netInvestmentIncome) }}</td></tr>
                <tr><td>MAGI</td><td class="text-right">{{ fmt(c.form8960.magi) }}</td></tr>
                <tr><td>Excess over threshold</td><td class="text-right">{{ fmt(c.form8960.excessOverThreshold) }}</td></tr>
                <tr><td>Amount subject to NIIT</td><td class="text-right">{{ fmt(c.form8960.amountSubjectToNiit) }}</td></tr>
                <tr class="font-weight-bold"><td>NIIT (3.8%)</td><td class="text-right">{{ fmt(c.form8960.niit) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form8959 && (c.form8959.additionalMedicareTax || c.form8959.additionalMedicareWithheld)" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 8959 — Additional Medicare Tax</th></tr>
              </thead>
              <tbody>
                <tr><td>Medicare wages (W-2 box 5)</td><td class="text-right">{{ fmt(c.form8959.medicareWages) }}</td></tr>
                <tr v-if="c.form8959.seIncome"><td>SE income (× 92.35%)</td><td class="text-right">{{ fmt(c.form8959.seIncome) }}</td></tr>
                <tr v-if="c.form8959.rrtaCompensation"><td>RRTA compensation</td><td class="text-right">{{ fmt(c.form8959.rrtaCompensation) }}</td></tr>
                <tr><td>Threshold</td><td class="text-right">{{ fmt(c.form8959.threshold) }}</td></tr>
                <tr><td>Additional Medicare Tax (0.9%)</td><td class="text-right">{{ fmt(c.form8959.additionalMedicareTax) }}</td></tr>
                <tr v-if="c.form8959.additionalMedicareWithheld"><td>Already withheld (W-2 box 14)</td><td class="text-right">{{ fmt(c.form8959.additionalMedicareWithheld) }}</td></tr>
                <tr class="font-weight-bold"><td>Net additional Medicare tax</td><td class="text-right">{{ fmt(c.form8959.netAdditionalMedicare) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form2555 && c.form2555.totalExclusion" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 2555 — Foreign Earned Income Exclusion</th></tr>
              </thead>
              <tbody>
                <tr><td>Foreign earned income</td><td class="text-right">{{ fmt(c.form2555.foreignEarnedIncome) }}</td></tr>
                <tr><td>Income exclusion allowed</td><td class="text-right">{{ fmt(c.form2555.exclusionAllowed) }}</td></tr>
                <tr v-if="c.form2555.housingExclusion"><td>Housing base amount</td><td class="text-right">{{ fmt(c.form2555.housingBase) }}</td></tr>
                <tr v-if="c.form2555.housingExclusion"><td>Housing cap</td><td class="text-right">{{ fmt(c.form2555.housingCap) }}</td></tr>
                <tr v-if="c.form2555.housingExclusion"><td>Housing exclusion</td><td class="text-right">{{ fmt(c.form2555.housingExclusion) }}</td></tr>
                <tr class="font-weight-bold"><td>Total exclusion (reduces AGI)</td><td class="text-right">{{ fmt(c.form2555.totalExclusion) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.scheduleH && c.scheduleH.totalHouseholdEmploymentTax" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Schedule H — Household Employment Taxes</th></tr>
              </thead>
              <tbody>
                <tr><td>SS + Medicare tax (15.3%)</td><td class="text-right">{{ fmt(c.scheduleH.ssMedicareTax) }}</td></tr>
                <tr v-if="c.scheduleH.futaTax"><td>FUTA tax (0.6% net)</td><td class="text-right">{{ fmt(c.scheduleH.futaTax) }}</td></tr>
                <tr v-if="c.scheduleH.federalIncomeTaxWithheld"><td>Federal income tax withheld</td><td class="text-right">{{ fmt(c.scheduleH.federalIncomeTaxWithheld) }}</td></tr>
                <tr class="font-weight-bold"><td>Total household employment tax</td><td class="text-right">{{ fmt(c.scheduleH.totalHouseholdEmploymentTax) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form2210 && c.form2210.penalty" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 2210 — Underpayment of Estimated Tax</th></tr>
              </thead>
              <tbody>
                <tr><td>Current-year tax</td><td class="text-right">{{ fmt(c.form2210.currentYearTax) }}</td></tr>
                <tr><td>Required annual payment (safe harbor)</td><td class="text-right">{{ fmt(c.form2210.requiredAnnualPayment) }}</td></tr>
                <tr><td>Total paid (withholding + estimated)</td><td class="text-right">{{ fmt(c.form2210.totalPaid) }}</td></tr>
                <tr><td>Underpayment</td><td class="text-right">{{ fmt(c.form2210.underpayment) }}</td></tr>
                <tr class="font-weight-bold"><td>Penalty (§6621)</td><td class="text-right">{{ fmt(c.form2210.penalty) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form5405 && c.form5405.repaymentThisYear" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 5405 — FTHB Credit Repayment</th></tr>
              </thead>
              <tbody>
                <tr class="font-weight-bold"><td>Repayment this year</td><td class="text-right">{{ fmt(c.form5405.repaymentThisYear) }}</td></tr>
              </tbody>
            </v-table>

            <v-table v-if="c.form4972 && c.form4972.electedTax" density="compact" class="mt-3">
              <thead>
                <tr><th colspan="2" class="text-left">Form 4972 — Lump-Sum Averaging</th></tr>
              </thead>
              <tbody>
                <tr class="font-weight-bold"><td>Elected averaging tax</td><td class="text-right">{{ fmt(c.form4972.electedTax) }}</td></tr>
              </tbody>
            </v-table>

            <v-expansion-panels multiple class="mt-4">
              <v-expansion-panel title="Schedule 2 — additional taxes">
                <template #text>
                  <p class="text-medium-emphasis">
                    Schedule 2 has two parts. Part I (line 17) folds into
                    regular tax for §26(a) credit limits and §904 FTC
                    limitation. Part II (line 23) is added AFTER
                    nonrefundable credits and cannot be offset by them.
                  </p>
                  <v-table
                    v-if="c.schedule2 && c.schedule2.partI"
                    density="compact"
                    class="mt-2"
                  >
                    <thead>
                      <tr><th colspan="2" class="text-left">Part I — Additional Taxes (→ 1040 line 17)</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Line 1 — AMT (Form 6251)</td><td class="text-right">{{ fmt(c.schedule2.partI.amt) }}</td></tr>
                      <tr><td>Line 2 — Excess APTC repayment (Form 8962)</td><td class="text-right">{{ fmt(c.schedule2.partI.excessAptcRepayment) }}</td></tr>
                      <tr class="font-weight-bold"><td>Line 3 — Part I total</td><td class="text-right">{{ fmt(c.schedule2.partI.total) }}</td></tr>
                    </tbody>
                  </v-table>
                  <v-table
                    v-if="c.schedule2 && c.schedule2.partII"
                    density="compact"
                    class="mt-3"
                  >
                    <thead>
                      <tr><th colspan="2" class="text-left">Part II — Other Taxes (→ 1040 line 23)</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Line 4 — Self-employment tax</td><td class="text-right">{{ fmt(c.schedule2.partII.seTax) }}</td></tr>
                      <tr><td>Line 8 — Early-withdrawal / HSA add'l tax</td><td class="text-right">{{ fmt(c.schedule2.partII.earlyWithdrawalPenalty) }}</td></tr>
                      <tr><td>Line 11 — Additional Medicare Tax (Form 8959)</td><td class="text-right">{{ fmt(c.schedule2.partII.additionalMedicareTax) }}</td></tr>
                      <tr><td>Line 12 — NIIT (Form 8960)</td><td class="text-right">{{ fmt(c.schedule2.partII.niit) }}</td></tr>
                      <tr><td>Line 9 — Household employment (Schedule H)</td><td class="text-right">{{ fmt(c.schedule2.partII.householdEmploymentTax) }}</td></tr>
                      <tr><td>Line 10 — FTHB credit repayment (Form 5405)</td><td class="text-right">{{ fmt(c.schedule2.partII.firstTimeHomebuyerRepayment) }}</td></tr>
                      <tr><td>Line 17 — Lump-sum averaging (Form 4972)</td><td class="text-right">{{ fmt(c.schedule2.partII.lumpSumAveraging) }}</td></tr>
                      <tr class="font-weight-bold"><td>Line 21 — Part II total</td><td class="text-right">{{ fmt(c.schedule2.partII.total) }}</td></tr>
                    </tbody>
                  </v-table>
                </template>
              </v-expansion-panel>
              <v-expansion-panel title="Schedule 3 — additional credits &amp; payments">
                <template #text>
                  <p class="text-medium-emphasis">
                    No Schedule 3 items yet. Credits like AOTC, LLC, Saver's,
                    FTC, residential energy, and the Premium Tax Credit will
                    appear here as their forms are added.
                  </p>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>

            <h3 class="text-subtitle-1 mt-4">Payments</h3>
            <v-table density="compact">
              <tbody>
                <tr><td>Federal withholding (W-2)</td><td class="text-right">{{ fmt(c.payments.withholding) }}</td></tr>
                <tr><td>Estimated payments</td><td class="text-right">{{ fmt(c.payments.estimatedPayments) }}</td></tr>
                <tr class="font-weight-bold"><td>Total payments</td><td class="text-right">{{ fmt(c.payments.total) }}</td></tr>
              </tbody>
            </v-table>

            <v-alert
              v-if="c.summary.refund > 0"
              type="success"
              class="mt-4"
              prominent
            >
              <strong>Estimated refund: {{ fmt(c.summary.refund) }}</strong>
            </v-alert>
            <v-alert
              v-else-if="c.summary.balanceDue > 0"
              type="warning"
              class="mt-4"
              prominent
            >
              <strong>Estimated balance due: {{ fmt(c.summary.balanceDue) }}</strong>
            </v-alert>
            <v-alert v-else type="info" class="mt-4">No refund or balance due.</v-alert>
          </v-card-text>
          <v-card-text v-else>
            <v-progress-circular indeterminate color="primary" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Estimated payments</v-card-title>
          <v-card-text>
            <CurrencyInput
              v-model="estimatedPayments"
              label="Total 2025 quarterly estimates"
              hint="Enter the sum of your 1040-ES payments."
            />
            <v-btn color="primary" block @click="saveEstimated">Save</v-btn>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
          <v-card-text>
            <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="router.push('/')">
              Back to dashboard
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </AppShell>
</template>
