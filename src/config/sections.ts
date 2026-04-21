export interface SectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  stepCount: number;
  progress: (ret: import('../../shared/types').TaxReturn) => number; // 0..stepCount
}

export const SECTIONS: SectionConfig[] = [
  {
    id: 'personal',
    title: 'Personal Info',
    subtitle: 'Filing status, name, address, dependents',
    icon: 'mdi-account',
    route: '/section/personal',
    stepCount: 3,
    progress: (r) => {
      let n = 0;
      if (r.filingStatus) n++;
      if (r.personalInfo.firstName && r.personalInfo.lastName) n++;
      if (r.personalInfo.addressLine1) n++;
      return n;
    },
  },
  {
    id: 'income',
    title: 'Income (W-2)',
    subtitle: 'Wages, salary, and federal withholding',
    icon: 'mdi-cash',
    route: '/section/income',
    stepCount: 1,
    progress: (r) => (r.w2s.length > 0 ? 1 : 0),
  },
  {
    id: 'interest-dividends',
    title: 'Interest & Dividends',
    subtitle: 'Schedule B entries',
    icon: 'mdi-bank',
    route: '/section/interest-dividends',
    stepCount: 2,
    progress: (r) =>
      (r.interest.length > 0 ? 1 : 0) + (r.dividends.length > 0 ? 1 : 0),
  },
  {
    id: 'self-employment',
    title: 'Self-Employment',
    subtitle: 'Schedule C businesses',
    icon: 'mdi-briefcase',
    route: '/section/self-employment',
    stepCount: 1,
    progress: (r) => (r.selfEmployment.length > 0 ? 1 : 0),
  },
  {
    id: 'capital-gains',
    title: 'Capital Gains',
    subtitle: 'Schedule D stock & asset sales',
    icon: 'mdi-chart-line',
    route: '/section/capital-gains',
    stepCount: 1,
    progress: (r) => (r.capitalGains.length > 0 ? 1 : 0),
  },
  {
    id: 'retirement',
    title: 'Retirement Income',
    subtitle: '1099-R pensions, IRAs, 401(k) distributions',
    icon: 'mdi-piggy-bank',
    route: '/section/retirement',
    stepCount: 1,
    progress: (r) => (r.retirementIncome.length > 0 ? 1 : 0),
  },
  {
    id: 'ss-benefits',
    title: 'Social Security',
    subtitle: 'SSA-1099 benefits (taxable portion auto-computed)',
    icon: 'mdi-shield-account',
    route: '/section/ss-benefits',
    stepCount: 1,
    progress: (r) => ((r.socialSecurity?.grossBenefits ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'unemployment',
    title: 'Unemployment',
    subtitle: '1099-G unemployment compensation',
    icon: 'mdi-briefcase-off',
    route: '/section/unemployment',
    stepCount: 1,
    progress: (r) => ((r.unemployment?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'gambling',
    title: 'Gambling',
    subtitle: 'W-2G winnings and losses',
    icon: 'mdi-dice-multiple',
    route: '/section/gambling',
    stepCount: 1,
    progress: (r) => ((r.gambling?.length ?? 0) > 0 || (r.gamblingLosses ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'other-income',
    title: 'Other Income',
    subtitle: '1099-MISC box 3, jury duty, alimony received, etc.',
    icon: 'mdi-cash-plus',
    route: '/section/other-income',
    stepCount: 1,
    progress: (r) => ((r.otherIncome?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'schedule-e',
    title: 'Rentals & Royalties',
    subtitle: 'Schedule E rental real estate and royalties',
    icon: 'mdi-home-city',
    route: '/section/schedule-e',
    stepCount: 1,
    progress: (r) =>
      (r.scheduleERentals?.length ?? 0) > 0 ||
      (r.scheduleERoyalties?.length ?? 0) > 0
        ? 1
        : 0,
  },
  {
    id: 'k1',
    title: 'K-1 Flow-Through',
    subtitle: 'Partnership, S-corp, and trust K-1s',
    icon: 'mdi-file-tree',
    route: '/section/k1',
    stepCount: 1,
    progress: (r) => ((r.k1s?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'schedule-f',
    title: 'Farm Income',
    subtitle: 'Schedule F farm profit/loss',
    icon: 'mdi-tractor',
    route: '/section/schedule-f',
    stepCount: 1,
    progress: (r) => ((r.farms?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'form-4797',
    title: 'Business Property Sales',
    subtitle: 'Form 4797 §1231 sales and depreciation recapture',
    icon: 'mdi-office-building-cog',
    route: '/section/form-4797',
    stepCount: 1,
    progress: (r) => ((r.form4797Sales?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'form-4562',
    title: 'Depreciation',
    subtitle: 'Form 4562 §179, bonus, and MACRS assets',
    icon: 'mdi-package-variant-closed',
    route: '/section/form-4562',
    stepCount: 1,
    progress: (r) => ((r.depreciationAssets?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'form-8829',
    title: 'Home Office',
    subtitle: 'Form 8829 business use of home',
    icon: 'mdi-home-analytics',
    route: '/section/form-8829',
    stepCount: 1,
    progress: (r) => ((r.homeOffices?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'schedule-1-adjustments',
    title: 'Adjustments to Income',
    subtitle: 'Schedule 1 Part II — educator, SE health ins, IRA, student loan, etc.',
    icon: 'mdi-tune-variant',
    route: '/section/schedule-1-adjustments',
    stepCount: 1,
    progress: (r) => {
      const s = r.schedule1Adjustments;
      if (!s) return 0;
      const any =
        s.educatorExpenses || s.selfEmployedHealthInsurance ||
        s.sepContribution || s.simpleContribution || s.solo401kContribution ||
        s.traditionalIraDeduction || s.studentLoanInterest ||
        s.penaltyEarlyWithdrawal || s.alimonyPaid ||
        s.reservistExpenses || s.performingArtistExpenses || s.feeBasisExpenses;
      return any ? 1 : 0;
    },
  },
  {
    id: 'form-8606',
    title: 'IRA Basis (Form 8606)',
    subtitle: 'Nondeductible IRA contributions + pro-rata distributions',
    icon: 'mdi-finance',
    route: '/section/form-8606',
    stepCount: 1,
    progress: (r) => {
      const f = r.form8606;
      if (!f) return 0;
      return f.priorYearBasis || f.currentYearNondeductible ||
        f.traditionalIraBalance || f.distributions || f.conversions
        ? 1
        : 0;
    },
  },
  {
    id: 'form-8889',
    title: 'HSA (Form 8889)',
    subtitle: 'Health savings account contributions and distributions',
    icon: 'mdi-heart-pulse',
    route: '/section/form-8889',
    stepCount: 1,
    progress: (r) =>
      r.form8889 && (r.form8889.coverage !== 'none' || r.form8889.contributions > 0)
        ? 1
        : 0,
  },
  {
    id: 'form-2441',
    title: 'Dependent Care (Form 2441)',
    subtitle: 'Child and dependent care expenses credit',
    icon: 'mdi-baby-face-outline',
    route: '/section/form-2441',
    stepCount: 1,
    progress: (r) =>
      r.form2441 && (r.form2441.totalQualifiedExpenses > 0 || r.form2441.numQualifyingPersons > 0)
        ? 1
        : 0,
  },
  {
    id: 'form-8863',
    title: 'Education Credits (Form 8863)',
    subtitle: 'American Opportunity & Lifetime Learning credits',
    icon: 'mdi-school',
    route: '/section/form-8863',
    stepCount: 1,
    progress: (r) => ((r.form8863Students?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'form-8880',
    title: "Saver's Credit (Form 8880)",
    subtitle: 'Retirement Savings Contributions Credit',
    icon: 'mdi-safe-square',
    route: '/section/form-8880',
    stepCount: 1,
    progress: (r) => {
      const f = r.form8880;
      if (!f) return 0;
      return f.elective401kDeferrals || f.iraContributions ||
        f.spouseElective401kDeferrals || f.spouseIraContributions
        ? 1
        : 0;
    },
  },
  {
    id: 'schedule-r',
    title: 'Elderly/Disabled (Schedule R)',
    subtitle: 'Credit for the Elderly or the Disabled',
    icon: 'mdi-wheelchair-accessibility',
    route: '/section/schedule-r',
    stepCount: 1,
    progress: (r) =>
      r.scheduleR && (r.scheduleR.isTaxpayerEligible || r.scheduleR.isSpouseEligible) ? 1 : 0,
  },
  {
    id: 'form-8396',
    title: 'Mortgage Credit (Form 8396)',
    subtitle: 'Mortgage Interest Credit from an MCC',
    icon: 'mdi-home-percent',
    route: '/section/form-8396',
    stepCount: 1,
    progress: (r) =>
      r.form8396 && (r.form8396.certificateRate > 0 || r.form8396.mortgageInterestPaid > 0)
        ? 1
        : 0,
  },
  {
    id: 'form-5695',
    title: 'Residential Energy (Form 5695)',
    subtitle: 'Clean energy + energy efficient home credits',
    icon: 'mdi-solar-power',
    route: '/section/form-5695',
    stepCount: 1,
    progress: (r) => {
      const f = r.form5695;
      if (!f) return 0;
      const any = f.solarElectric || f.solarWaterHeating || f.windEnergy ||
        f.geothermalHeatPump || f.biomassFuel || f.batteryStorageTech ||
        f.fuelCellCost || f.insulationAirSealing || f.exteriorWindows ||
        f.exteriorDoors || f.homeEnergyAudit || f.heatPumps || f.biomassStoves ||
        f.centralAc || f.furnaceBoiler;
      return any ? 1 : 0;
    },
  },
  {
    id: 'form-8936',
    title: 'Clean Vehicle (Form 8936)',
    subtitle: 'New and used clean vehicle credit',
    icon: 'mdi-car-electric',
    route: '/section/form-8936',
    stepCount: 1,
    progress: (r) => ((r.form8936Vehicles?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'form-1116',
    title: 'Foreign Tax Credit (Form 1116)',
    subtitle: 'FTC by basket (passive/general)',
    icon: 'mdi-earth',
    route: '/section/form-1116',
    stepCount: 1,
    progress: (r) => ((r.form1116Baskets?.length ?? 0) > 0 ? 1 : 0),
  },
  {
    id: 'schedule-8812',
    title: 'Child Tax Credit (Schedule 8812)',
    subtitle: 'Refundable ACTC + nonrefundable CTC overrides',
    icon: 'mdi-human-child',
    route: '/section/schedule-8812',
    stepCount: 1,
    progress: (r) => {
      const s = r.schedule8812;
      if (!s) return 0;
      return s.qualifyingChildrenOverride != null ||
        s.earnedIncomeOverride != null ||
        s.includeCombatPay
        ? 1
        : 0;
    },
  },
  {
    id: 'eitc',
    title: 'Earned Income Credit (EITC)',
    subtitle: 'Refundable credit for low/moderate earners',
    icon: 'mdi-hand-coin',
    route: '/section/eitc',
    stepCount: 1,
    progress: (r) => {
      const e = r.eitcEligibility;
      if (!e) return 0;
      return e.qualifyingChildrenOverride != null ||
        e.investmentIncomeOverride != null ||
        e.includeCombatPay ||
        !e.isEligibleAge
        ? 1
        : 0;
    },
  },
  {
    id: 'form-8962',
    title: 'Premium Tax Credit (Form 8962)',
    subtitle: 'Reconcile Marketplace APTC against annual PTC',
    icon: 'mdi-hospital-box',
    route: '/section/form-8962',
    stepCount: 1,
    progress: (r) =>
      r.form8962 &&
      (r.form8962.annualEnrollmentPremium > 0 ||
        r.form8962.annualSlcsp > 0 ||
        r.form8962.advancePtcPaid > 0)
        ? 1
        : 0,
  },
  {
    id: 'form-6251',
    title: 'Alternative Minimum Tax (Form 6251)',
    subtitle: 'AMT preferences and adjustments',
    icon: 'mdi-scale-balance',
    route: '/section/form-6251',
    stepCount: 1,
    progress: (r) => {
      const f = r.form6251;
      if (!f) return 0;
      return f.privateActivityBondInterest || f.amtDepreciationAdjustment ||
        f.otherAdjustments || f.amtNolCarryforward
        ? 1
        : 0;
    },
  },
  {
    id: 'form-8960',
    title: 'Net Investment Income Tax (Form 8960)',
    subtitle: '3.8% NIIT allocable expenses and modifications',
    icon: 'mdi-chart-bell-curve',
    route: '/section/form-8960',
    stepCount: 1,
    progress: (r) => {
      const f = r.form8960;
      if (!f) return 0;
      return f.investmentInterestExpense || f.stateTaxAllocableToInvestment ||
        f.miscInvestmentExpenses || f.otherModifications
        ? 1
        : 0;
    },
  },
  {
    id: 'form-8959',
    title: 'Additional Medicare Tax (Form 8959)',
    subtitle: '0.9% tax on wages, SE, and RRTA above threshold',
    icon: 'mdi-medical-bag',
    route: '/section/form-8959',
    stepCount: 1,
    progress: (r) => {
      const f = r.form8959;
      if (!f) return 0;
      return f.rrtaCompensation || f.additionalMedicareWithheld ? 1 : 0;
    },
  },
  {
    id: 'form-2555',
    title: 'Foreign Earned Income (Form 2555)',
    subtitle: '§911 exclusion for bona fide residents / physical presence',
    icon: 'mdi-airplane',
    route: '/section/form-2555',
    stepCount: 1,
    progress: (r) => {
      const f = r.form2555;
      if (!f) return 0;
      return f.foreignEarnedIncome || f.qualifyingDays ||
        f.housingExpenses || f.isBonaFideResident || f.usesPhysicalPresence
        ? 1
        : 0;
    },
  },
  {
    id: 'schedule-h',
    title: 'Household Employment (Schedule H)',
    subtitle: 'Taxes for nannies, housekeepers, and other household employees',
    icon: 'mdi-account-supervisor',
    route: '/section/schedule-h',
    stepCount: 1,
    progress: (r) => {
      const s = r.scheduleH;
      if (!s) return 0;
      return s.cashWagesSsMedicare || s.cashWagesFuta ||
        s.federalIncomeTaxWithheld || s.stateUnemploymentPaid
        ? 1
        : 0;
    },
  },
  {
    id: 'form-2210',
    title: 'Underpayment Penalty (Form 2210)',
    subtitle: '§6654 estimated-tax safe-harbor and short-method penalty',
    icon: 'mdi-calendar-alert',
    route: '/section/form-2210',
    stepCount: 1,
    progress: (r) => {
      const f = r.form2210;
      if (!f) return 0;
      const anyPay =
        (f.withholdingByQuarter ?? []).some((v) => v > 0) ||
        (f.estimatedPaymentsByQuarter ?? []).some((v) => v > 0);
      return f.priorYearTax || f.priorYearAgi || anyPay || f.requestWaiver ? 1 : 0;
    },
  },
  {
    id: 'form-5405',
    title: 'First-Time Homebuyer Credit Repayment (Form 5405)',
    subtitle: '2008-era FTHB credit 15-year installment or accelerated repayment',
    icon: 'mdi-home-export-outline',
    route: '/section/form-5405',
    stepCount: 1,
    progress: (r) => {
      const f = r.form5405;
      if (!f) return 0;
      return f.annualInstallment || f.dispositionAccelerated ? 1 : 0;
    },
  },
  {
    id: 'form-4972',
    title: 'Lump-Sum Averaging (Form 4972)',
    subtitle: '§402(d) 10-year averaging for pre-1936 participants',
    icon: 'mdi-cash-clock',
    route: '/section/form-4972',
    stepCount: 1,
    progress: (r) => {
      const f = r.form4972;
      if (!f) return 0;
      return f.qualifyingLumpSum || f.computedTax ? 1 : 0;
    },
  },
  {
    id: 'deductions',
    title: 'Deductions',
    subtitle: 'Standard or itemized (Schedule A)',
    icon: 'mdi-receipt',
    route: '/section/deductions',
    stepCount: 1,
    progress: (r) => {
      if (r.useStandardDeduction) return 1;
      const it = r.itemized;
      const any =
        it.medical ||
        it.stateLocalTax ||
        it.realEstateTax ||
        it.mortgageInterest ||
        it.charitableCash ||
        it.charitableNoncash;
      return any ? 1 : 0;
    },
  },
  {
    id: 'review',
    title: 'Review',
    subtitle: 'Estimated refund or balance due',
    icon: 'mdi-check-circle',
    route: '/section/review',
    stepCount: 1,
    progress: () => 0,
  },
];
