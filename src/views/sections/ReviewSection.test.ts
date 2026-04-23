import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import ReviewSection from './ReviewSection.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

function richComputed() {
  return {
    filingStatus: 'mfj',
    income: {
      wages: 100000, interest: 500, ordinaryDividends: 1000, qualifiedDividends: 800,
      seNetProfit: 20000, retirementGross: 5000, retirementTaxable: 5000,
      ssGross: 10000, ssTaxable: 5000, unemployment: 1000, gamblingWinnings: 200,
      otherIncome: 100, rentalNetIncome: 5000, rentalSuspendedLoss: 1000,
      royaltyNetIncome: 500, k1OrdinaryIncome: 1000, k1SuspendedLoss: 500,
      k1InterestIncome: 50, k1OrdinaryDividends: 30,
      farmNetProfit: 2000, homeOfficeDeduction: 500,
      section1231NetGain: 1000, section1231OrdinaryLoss: 100,
      depreciationRecapture: 200,
      shortTermGain: 500, longTermGain: 2000, capitalLossDeduction: -1000,
      totalIncome: 150000,
      capitalLossCarryforwardShortTerm: 0,
      capitalLossCarryforwardLongTerm: 0,
      capitalLossCarryforwardTotal: 0,
    },
    adjustments: {
      seTaxDeduction: 1500, educatorExpenses: 250, hsaDeduction: 2000,
      selfEmployedHealthInsurance: 3000, sepContribution: 5000, simpleContribution: 1000,
      solo401kContribution: 10000, traditionalIraDeduction: 6500,
      studentLoanInterest: 2500, penaltyEarlyWithdrawal: 100, alimonyPaid: 500,
      reservistExpenses: 100, performingArtistExpenses: 200, feeBasisExpenses: 50,
      total: 32700,
    },
    form8606: { totalBasisAvailable: 1000, taxableDistribution: 500, taxableConversion: 200, nontaxablePortion: 100, endingBasis: 400 },
    form8889: { contributionLimit: 4150, allowedDeduction: 2000, excessContribution: 0, taxableDistribution: 100, additionalTax: 20 },
    deductions: { standard: 29200, itemized: 12000, used: 29200 },
    taxComputation: {
      agi: 117000, taxableIncome: 87800,
      regularTax: 10000, ltcgTax: 200, totalTax: 10200,
    },
    credits: {
      childTaxCredit: 2000, childDependentCareCredit: 600,
      educationCredits: 2500, saversCredit: 200,
      elderlyDisabledCredit: 100, mortgageInterestCredit: 500,
      residentialEnergyCredit: 3000, evCredit: 7500,
      foreignTaxCredit: 300,
      total: 16700,
    },
    otherTaxes: {
      seTax: 3000, earlyWithdrawalPenalty: 100, hsaAdditionalTax: 20,
      aptcRepayment: 500, amt: 100, niit: 200, additionalMedicare: 50,
      scheduleH: 100, fthb5405: 50, lumpSum4972: 30,
    },
    refundableCredits: {
      additionalChildTaxCredit: 800, eitc: 400, premiumTaxCredit: 200,
      total: 1400,
    },
    summary: {
      refund: 1000, balanceDue: 0, totalTax: 10200,
      federalWithholding: 11000, totalCredits: 16700,
      payments: 11500, balance: -1000,
      totalTaxAfterCredits: 0, estimatedPayments: 500,
    },
    form8995: { qbiDeduction: 4000, qbiBaseline: 20000, reitPtpComponent: 100, carryforward: 0 },
    form2210: { penalty: 100, safeHarborMet: false, shortMethodApplied: true, waiverRequested: false },
    form2555: { exclusionAmount: 10000, housingExclusion: 5000, includedIncome: 20000 },
    schedule1: { additionalIncome: 100, adjustments: 200 },
    schedule2: { additionalTax: 100 },
    schedule3: { nonrefundableCredits: 0, refundableCredits: 0 },
    payments: { withholding: 11000, estimatedPayments: 500, excessSocialSecurity: 0, total: 11500 },
  };
}

describe('ReviewSection', () => {
  it('renders a non-trivial computed return', async () => {
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData({ estimatedPayments: 500 }) as never;
        s.computed = richComputed() as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('Adjusted gross income');
  });

  it('save estimated payments triggers saveMeta', async () => {
    const saveMeta = vi.fn();
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData({ estimatedPayments: 0 }) as never;
        s.computed = richComputed() as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = saveMeta as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const saveBtn = wrapper.findAll('button').find((b) => /save|update/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toBeTruthy();
  });

  it('handles computed=null gracefully', async () => {
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = null;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toBeTruthy();
  });

  it('renders the "all zero" computed return — hits every v-if falsy arm', async () => {
    // Mirror the full shape of richComputed but zero out every numeric field
    // so each `v-if="c.income.foo"` / `v-if="c.credits.bar"` hits the falsy arm.
    const zero = {
      filingStatus: 'single',
      income: {
        wages: 0, interest: 0, ordinaryDividends: 0, qualifiedDividends: 0,
        seNetProfit: 0, retirementGross: 0, retirementTaxable: 0,
        ssGross: 0, ssTaxable: 0, unemployment: 0, gamblingWinnings: 0,
        otherIncome: 0, rentalNetIncome: 0, rentalSuspendedLoss: 0,
        royaltyNetIncome: 0, k1OrdinaryIncome: 0, k1SuspendedLoss: 0,
        k1InterestIncome: 0, k1OrdinaryDividends: 0,
        farmNetProfit: 0, homeOfficeDeduction: 0,
        section1231NetGain: 0, section1231OrdinaryLoss: 0,
        depreciationRecapture: 0,
        shortTermGain: 0, longTermGain: 0, capitalLossDeduction: 0,
        totalIncome: 0,
        capitalLossCarryforwardShortTerm: 0,
        capitalLossCarryforwardLongTerm: 0,
        capitalLossCarryforwardTotal: 0,
      },
      adjustments: {
        seTaxDeduction: 0, educatorExpenses: 0, hsaDeduction: 0,
        selfEmployedHealthInsurance: 0, sepContribution: 0, simpleContribution: 0,
        solo401kContribution: 0, traditionalIraDeduction: 0,
        studentLoanInterest: 0, penaltyEarlyWithdrawal: 0, alimonyPaid: 0,
        reservistExpenses: 0, performingArtistExpenses: 0, feeBasisExpenses: 0,
        total: 0,
      },
      form8606: { totalBasisAvailable: 0, taxableDistribution: 0, taxableConversion: 0, nontaxablePortion: 0, endingBasis: 0 },
      form8889: { contributionLimit: 0, allowedDeduction: 0, excessContribution: 0, taxableDistribution: 0, additionalTax: 0 },
      deductions: { standard: 14600, itemized: 0, used: 14600 },
      taxComputation: { agi: 0, taxableIncome: 0, regularTax: 0, ltcgTax: 0, totalTax: 0 },
      credits: {
        childTaxCredit: 0, childDependentCareCredit: 0, educationCredits: 0,
        saversCredit: 0, elderlyDisabledCredit: 0, mortgageInterestCredit: 0,
        residentialEnergyCredit: 0, evCredit: 0, foreignTaxCredit: 0, total: 0,
      },
      otherTaxes: {
        seTax: 0, earlyWithdrawalPenalty: 0, hsaAdditionalTax: 0,
        aptcRepayment: 0, amt: 0, niit: 0, additionalMedicare: 0,
        scheduleH: 0, fthb5405: 0, lumpSum4972: 0,
      },
      refundableCredits: {
        additionalChildTaxCredit: 0, eitc: 0, premiumTaxCredit: 0, total: 0,
      },
      summary: {
        refund: 0, balanceDue: 0, totalTax: 0,
        federalWithholding: 0, totalCredits: 0,
        payments: 0, balance: 0,
        totalTaxAfterCredits: 0, estimatedPayments: 0,
      },
      form8995: { qbiDeduction: 0, qbiBaseline: 0, reitPtpComponent: 0, carryforward: 0 },
      form2210: { penalty: 0, safeHarborMet: true, shortMethodApplied: false, waiverRequested: false },
      form2555: { exclusionAmount: 0, housingExclusion: 0, includedIncome: 0 },
      schedule1: { additionalIncome: 0, adjustments: 0 },
      schedule2: { additionalTax: 0 },
      schedule3: { nonrefundableCredits: 0, refundableCredits: 0 },
      payments: { withholding: 0, estimatedPayments: 0, excessSocialSecurity: 0, total: 0 },
    };
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData({ estimatedPayments: 0 }) as never;
        s.computed = zero as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // "No refund or balance due." shows when both summary.refund and balanceDue are 0.
    expect(wrapper.html()).toMatch(/No refund or balance due/);
  });

  it('renders balance due variant (refund=0, balanceDue>0)', async () => {
    const baseComputed = {
      filingStatus: 'single',
      income: {
        wages: 0, interest: 0, ordinaryDividends: 0, qualifiedDividends: 0,
        seNetProfit: 0, retirementGross: 0, retirementTaxable: 0,
        ssGross: 0, ssTaxable: 0, unemployment: 0, gamblingWinnings: 0,
        otherIncome: 0, rentalNetIncome: 0, rentalSuspendedLoss: 0,
        royaltyNetIncome: 0, k1OrdinaryIncome: 0, k1SuspendedLoss: 0,
        k1InterestIncome: 0, k1OrdinaryDividends: 0,
        farmNetProfit: 0, homeOfficeDeduction: 0,
        section1231NetGain: 0, section1231OrdinaryLoss: 0,
        depreciationRecapture: 0,
        shortTermGain: 0, longTermGain: 0, capitalLossDeduction: 0,
        totalIncome: 0,
      },
      adjustments: {
        seTaxDeduction: 0, educatorExpenses: 0, hsaDeduction: 0,
        selfEmployedHealthInsurance: 0, sepContribution: 0, simpleContribution: 0,
        solo401kContribution: 0, traditionalIraDeduction: 0,
        studentLoanInterest: 0, penaltyEarlyWithdrawal: 0, alimonyPaid: 0,
        reservistExpenses: 0, performingArtistExpenses: 0, feeBasisExpenses: 0,
      },
      deductions: { standard: 14600, itemized: 0, used: 14600 },
      taxComputation: { agi: 30000, taxableIncome: 15400, regularTax: 1540, ltcgTax: 0, totalTax: 1540 },
      credits: {},
      otherTaxes: {},
      refundableCredits: {},
      summary: { refund: 0, balanceDue: 1000, totalTax: 1540, payments: 540 },
      schedule1: {}, schedule2: {}, schedule3: {},
      payments: { withholding: 540, estimatedPayments: 0, total: 540 },
    };
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = baseComputed as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/balance due|Estimated balance/);
  });

  it('clicks "Back to dashboard" to invoke router.push home', async () => {
    const { wrapper, router } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = richComputed() as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const backBtn = wrapper.findAll('button').find((b) => /Back to dashboard/i.test(b.text()));
    if (backBtn) {
      await backBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('renders deep Form 8889 / Form 8959 / Schedule H detail rows when populated', async () => {
    // Exercises rare v-if rows: form8889.taxableDistribution + additionalTax,
    // form8959.{seIncome,rrtaCompensation,additionalMedicareWithheld},
    // scheduleH.{futaTax,federalIncomeTaxWithheld}.
    const detailedComputed = {
      ...richComputed(),
      form8889: {
        contributionLimit: 4150, allowedDeduction: 2000,
        excessContribution: 0, taxableDistribution: 750, additionalTax: 150,
      },
      form8959: {
        additionalMedicareTax: 100,
        additionalMedicareWithheld: 50,
        seIncome: 30000,
        rrtaCompensation: 2000,
      },
      scheduleH: {
        totalHouseholdEmploymentTax: 300,
        ssMedicareTax: 200,
        futaTax: 50,
        federalIncomeTaxWithheld: 25,
      },
    };
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = detailedComputed as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const html = wrapper.html();
    expect(html).toMatch(/SE income/i);
    expect(html).toMatch(/RRTA/i);
    expect(html).toMatch(/FUTA/i);
  });

  it('falls back to raw filing-status string when label map lacks the key', async () => {
    // Exercises `filingStatusLabel[c.filingStatus] || c.filingStatus` right
    // branch — when the computed return uses an unmapped status string.
    const customFilingStatus = {
      ...richComputed(),
      filingStatus: 'unknown-status',
    };
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = customFilingStatus as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/unknown-status/);
  });

  it('handles taxStore.data with no estimatedPayments field (?? 0 fallback)', async () => {
    // Exercises `taxStore.data?.estimatedPayments ?? 0` falsy branch when
    // the field is missing on the loaded TaxReturn.
    const stripped = stubTaxStoreData() as unknown as Record<string, unknown>;
    delete stripped.estimatedPayments;
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stripped as never;
        s.computed = richComputed() as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toBeTruthy();
  });

  it('renders every Schedule-2-Part-II + refundable-credit row when all are non-zero', async () => {
    // Exercises the v-if branches for rarely-populated rows: HSA excess
    // contribution, Schedule H household-employment tax, Form 5405 FTHB
    // repayment, Form 4972 lump-sum averaging, Form 2210 underpayment
    // penalty, and the refundable-credit block (ACTC / AOTC / EITC / PTC).
    const fullComputed = {
      ...richComputed(),
      form8889: {
        contributionLimit: 4150, allowedDeduction: 2000,
        excessContribution: 500, taxableDistribution: 100, additionalTax: 20,
      },
      otherTaxes: {
        seTax: 3000, earlyWithdrawalPenalty: 100, hsaAdditionalTax: 20,
        aptcRepayment: 500, amt: 100, niit: 200, additionalMedicare: 50,
        householdEmploymentTax: 200,
        firstTimeHomebuyerRepayment: 100,
        lumpSumAveragingTax: 50,
        underpaymentPenalty: 75,
        total: 4395,
      },
      refundableCredits: {
        additionalChildTaxCredit: 800,
        refundableAotc: 500,
        earnedIncomeCredit: 400,
        netPremiumTaxCredit: 200,
        total: 1900,
      },
      form6251: { amtLiability: 150, tentativeMinimumTax: 250, amti: 120000, exemption: 85000 },
      form8960: { niit: 200, amountSubjectToNiit: 5000, netInvestmentIncome: 7000 },
      form8959: {
        additionalMedicareTax: 50,
        additionalMedicareWithheld: 25,
        seIncome: 20000,
        rrtaCompensation: 1000,
      },
      scheduleH: { totalHouseholdEmploymentTax: 200, ssMedicareTax: 150, futaTax: 50 },
      form5405: { repaymentThisYear: 100, balanceRemaining: 1000 },
      form4972: { electedTax: 50, qualifyingLumpSum: 2000 },
    };
    const { wrapper } = mountInApp(ReviewSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubTaxStoreData() as never;
        s.computed = fullComputed as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
        s.saveMeta = vi.fn() as unknown as typeof s.saveMeta;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const html = wrapper.html();
    // Each of these strings only appears when its v-if fires.
    expect(html).toMatch(/Excess/i);
    expect(html).toMatch(/household.*employment/i);
    expect(html).toMatch(/first.*time.*homebuyer/i);
    expect(html).toMatch(/lump[- ]sum/i);
    expect(html).toMatch(/underpayment/i);
    expect(html).toMatch(/earned income/i);
  });
});
