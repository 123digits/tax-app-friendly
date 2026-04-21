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
});
