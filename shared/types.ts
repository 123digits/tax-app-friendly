// Types shared between server and client.
// Keep this file dependency-free (no runtime imports).

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw';

export type ReturnStatus = 'in_progress' | 'complete';

export type CapitalGainTerm = 'short' | 'long';

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface TaxBracket {
  upTo: number | null;
  rate: number;
}

export interface LtcgBracket {
  zeroUpTo: number;
  fifteenUpTo: number;
}

// ----- Tax year config: grouped constants -----
//
// Groups added in Phase 0 are all optional so that configs persisted before the
// expansion (and the admin editor) keep loading cleanly. Individual phases
// tighten the shapes as they start consuming each group.

export interface RetirementConstants {
  iraLimit: number;
  iraCatchUp: number;
  sepPercent: number;       // decimal, e.g. 0.25
  solo401kLimit: number;
  catchUpAge: number;       // e.g. 50
}

export interface HsaConstants {
  selfLimit: number;
  familyLimit: number;
  catchUp: number;          // age 55+
}

export interface PhaseoutRange {
  start: number;
  end: number;
}

export interface EducationConstants {
  aotcMax: number;
  aotcRefundablePct: number; // 0.40
  aotcPhaseout: Record<FilingStatus, PhaseoutRange>;
  llcRate: number;           // 0.20
  llcMaxExpenses: number;    // $10,000
  llcPhaseout: Record<FilingStatus, PhaseoutRange>;
  studentLoanInterestLimit: number;
  studentLoanInterestPhaseout: Record<FilingStatus, PhaseoutRange>;
  educatorExpenseLimit: number;
  // Wave 1: AOTC tier splits (§25A). Optional so existing persisted configs
  // keep loading; calculators will start reading these in a later wave.
  aotcFirstTierExpense?: number;  // 2000
  aotcFirstTierRate?: number;     // 1.00
  aotcSecondTierRate?: number;    // 0.25
}

export interface SsTaxabilityRow {
  tier1: number;      // provisional income threshold, 50% inclusion begins
  tier2: number;      // 85% inclusion begins
  tier1Rate: number;  // 0.5
  tier2Rate: number;  // 0.85
}

export interface AdditionalMedicareRow {
  rate: number;       // 0.009
  threshold: number;
}

export interface NiitRow {
  rate: number;       // 0.038
  threshold: number;
}

export interface AmtRow {
  exemption: number;
  phaseoutStart: number;
  phaseoutRate: number;       // 0.25
  rate26: number;             // 0.26
  rate28: number;             // 0.28
  rate28Threshold: number;    // AMTI above this taxed at 28%
  nolLimitPct?: number;       // §56(d)(1)(A) — AMT NOL limited to 90% of AMTI before NOL
}

export interface SaversCreditRow {
  agiTiers: number[];   // ascending AGI cutoffs
  rates: number[];      // same length as agiTiers (rate applied when AGI <= tier)
  perPersonCap?: number; // $2,000 per person (statutory; admin-editable)
}

export interface DepreciationConstants {
  section179Limit: number;
  section179Phaseout: number;   // total investment at which §179 begins to phase out
  bonusPct: number;             // bonus depreciation percentage, e.g. 0.40 for 2025
  // First-year MACRS rates keyed by MacrsClass value (e.g. '3', '5', '7',
  // '10', '15', '20', '27.5', '39', 'straight_line'). Keyed as string so
  // shared/types.ts stays free of calculator-side type coupling. Required:
  // the 2025 seed in schema.sql populates this, and form4562.ts throws
  // loudly if the DB config is missing it (rather than silently falling
  // back to duplicated module-level values).
  firstYearMacrs: Record<string, number>;
}

export interface EitcRow {
  maxAgi: number;
  maxCredit: number;
  phaseInRate: number;
  phaseOutRate: number;
  phaseOutStart: number;
}

export interface FeieConstants {
  exclusionLimit: number;
  housingBasePct: number;   // 0.16 of exclusion = housing base
  housingCapPct: number;    // 0.30 of exclusion = default housing cap
}

export interface ChildCareTier {
  agi: number;        // AGI at or below
  rate: number;       // decimal, e.g. 0.35
}

export interface ChildCareConstants {
  maxExpenseOne: number;    // $3,000
  maxExpenseTwo: number;    // $6,000
  rates: ChildCareTier[];   // descending AGI tiers
}

// ----- Wave 1: additional grouped statutory constants -----
//
// Added as optional on TaxYearConfig so configs saved before Wave 1 keep
// loading. Calculator modules continue to read their existing module-level
// constants until a later wave migrates each one to read from config.

export interface SeTaxConstants {
  ssRate: number;          // 0.124
  medicareRate: number;    // 0.029
  incomeFactor: number;    // 0.9235
}

export interface PenaltyConstants {
  earlyWithdrawalRate: number;  // 0.10 — IRC §72(t)
  hsaAdditionalTaxRate: number; // 0.20 — §223(f)(4)
}

export interface ScheduleRCreditConstants {
  rate: number;            // 0.15
  baseSingle: number;      // 5000
  baseMfjBoth: number;     // 7500
  baseMfjOne: number;      // 5000
  baseMfs: number;         // 3750
  agiThresholdSingle: number; // 7500
  agiThresholdMfj: number;    // 10000
  agiThresholdMfs: number;    // 5000
}

export interface ResidentialEnergyConstants {
  cleanEnergyRate: number;             // 0.30
  fuelCellCapPerHalfKw: number;        // 500
  energyEfficientRate: number;         // 0.30
  generalImprovementAnnualCap: number; // 1200
  windowsCap: number;                  // 600
  doorsCap: number;                    // 500
  auditCap: number;                    // 150
  centralAcCap: number;                // 600 — §25C(b)(4)(A)(i)
  furnaceBoilerCap: number;            // 600 — §25C(b)(4)(A)(ii)
  heatPumpsBiomassCap: number;         // 2000
}

export interface MortgageCreditConstants {
  capHighRate: number;        // 2000
  highRateThreshold: number;  // 0.20
}

export interface EvCreditConstants {
  newVehicleMax: number;           // 7500
  usedVehicleMax: number;          // 4000
  usedVehicleSalePriceCap: number; // 25000
  usedVehiclePctCap: number;       // 0.30
}

export interface HomeOfficeConstants {
  simplifiedRatePerSqft: number; // 5
  simplifiedMaxSqft: number;     // 300
}

export interface PassiveLossConstants {
  allowanceMaxDefault: number;   // 25000
  allowanceMaxMfsApart: number;  // 12500
  agiStartDefault: number;       // 100000
  agiEndDefault: number;         // 150000
  agiStartMfs: number;           // 50000
  agiEndMfs: number;             // 75000
  phaseoutRate: number;          // 0.5
}

export interface UnderpaymentPenaltyConstants {
  highIncomeSafeHarborMultiplier: number; // 1.10
  regularSafeHarborMultiplier: number;    // 1.00
  currentYearPct: number;                 // 0.90
  deMinimis: number;                      // 1000
  estimatedRate: number;                  // 0.08 — §6621 (reviewed annually)
  highIncomeThreshold: number;            // 150000
  highIncomeThresholdMfs: number;         // 75000
}

export interface HouseholdEmploymentConstants {
  ssMedicareRate: number;  // 0.153
  futaNetRate: number;     // 0.006
}

export interface ActcConstants {
  refundablePerChild: number;    // 1700 (2025)
  earnedIncomeThreshold: number; // 2500
  phaseInRate: number;           // 0.15
  phaseoutPer1000: number;       // 50 (CTC phaseout: $50 per $1,000 over threshold)
  odcPerDependent: number;       // 500 — §24(h)(4) Credit for Other Dependents (nonrefundable)
}

// Task #38: Qualified Business Income deduction thresholds. Below the
// per-status threshold, Form 8995 simplified is used (no SSTB or W-2/UBIA
// limits). Above, Form 8995-A is required and the simplified deduction
// is disallowed. 2025 projected values: $241,950 single/HoH/MFS/QW,
// $483,900 MFJ — adjust via admin as IRS publishes final numbers.
export interface QbiConstants {
  thresholds: Record<FilingStatus, number>;
  /** §199A(a)(1)(A) deduction percentage. 0.20 statutory. */
  deductionRate: number;
}

export interface PtcContributionBand {
  fpl: number;   // upper FPL % of this band (e.g. 150, 200, 250, 300, 400)
  pct: number;   // applicable contribution pct
}

export interface PtcConstants {
  contributionBands: PtcContributionBand[];
  repaymentCapSingle: { fpl: number; cap: number }[]; // ascending
  repaymentCapFamily: { fpl: number; cap: number }[]; // ascending
}
// NB: all fields above are required. The 2025 seed in schema.sql populates
// the full shape; form8962.ts throws loudly if the DB config is missing
// any of them (rather than silently falling back to duplicated module
// literals).

// ----- Year-config constants used by the calculator -----
//
// `Bracket` / `LtcgBracketRow` mirror `TaxBracket` / `LtcgBracket` above;
// they're kept separately because the calculator (and the admin-editable
// `TaxYearConstants` shape that flows from the DB) grew around them before
// the generic names existed. `TaxYearConstants` is the runtime-loaded shape
// populated from the `tax_year_configs` row. Admins seed 2025 via the
// `INSERT ... ON CONFLICT DO NOTHING` block at the bottom of schema.sql.

export interface Bracket {
  /** Upper edge of this bracket's taxable income (inclusive). Use null for the top bracket (unbounded). */
  upTo: number | null;
  /** Marginal rate applied within this bracket, e.g. 0.22 for 22%. */
  rate: number;
}

export interface LtcgBracketRow {
  zeroUpTo: number;
  fifteenUpTo: number;
}

export interface TaxYearConstants {
  taxYear: number;
  brackets: Record<FilingStatus, Bracket[]>;
  standardDeduction: Record<FilingStatus, number>;
  ctcPerChild: number;
  ctcPhaseoutStart: Record<FilingStatus, number>;
  ssWageBase: number;
  ltcgBrackets: Record<FilingStatus, LtcgBracketRow>;
  saltCap: number;
  medicalAgiThreshold: number; // 0.075 = 7.5%
  capitalLossLimit: number;    // $3000, or $1500 for MFS handled in calculator
  notes?: string | null;

  // Grouped constants (all optional on the type so pre-expansion consumers
  // still compile). Populated from JSONB columns on `tax_year_configs`.
  retirement?: RetirementConstants;
  hsa?: HsaConstants;
  education?: EducationConstants;
  ssTaxability?: Record<FilingStatus, SsTaxabilityRow>;
  additionalMedicare?: Record<FilingStatus, AdditionalMedicareRow>;
  niit?: Record<FilingStatus, NiitRow>;
  amt?: Record<FilingStatus, AmtRow>;
  saversCredit?: Record<FilingStatus, SaversCreditRow>;
  depreciation?: DepreciationConstants;
  eitc?: Record<FilingStatus, Record<string, EitcRow>>;
  feie?: FeieConstants;
  childCare?: ChildCareConstants;

  // Wave 1 grouped constants.
  seTax?: SeTaxConstants;
  penalties?: PenaltyConstants;
  scheduleRCredit?: ScheduleRCreditConstants;
  residentialEnergy?: ResidentialEnergyConstants;
  mortgageCredit?: MortgageCreditConstants;
  evCredit?: EvCreditConstants;
  homeOffice?: HomeOfficeConstants;
  passiveLoss?: PassiveLossConstants;
  underpaymentPenalty?: UnderpaymentPenaltyConstants;
  householdEmployment?: HouseholdEmploymentConstants;
  actc?: ActcConstants;
  ptc?: PtcConstants;
  eitcInvestmentIncomeLimit?: number;
  // Task #38: §199A QBI deduction — per-status taxable-income thresholds
  // above which Form 8995-A (with W-2/UBIA limits and SSTB exclusion) is
  // required. Below the threshold, Form 8995 simplified method is used.
  qbi?: QbiConstants;
}

export interface TaxYearConfig {
  taxYear: number;
  brackets: Record<FilingStatus, TaxBracket[]>;
  standardDeduction: Record<FilingStatus, number>;
  ctcPerChild: number;
  ctcPhaseoutStart: Record<FilingStatus, number>;
  ssWageBase: number;
  ltcgBrackets: Record<FilingStatus, LtcgBracket>;
  saltCap: number;
  medicalAgiThreshold: number;
  capitalLossLimit: number;
  notes?: string | null;

  // Grouped constants added in Phase 0 (all optional; populated by later phases).
  retirement?: RetirementConstants;
  hsa?: HsaConstants;
  education?: EducationConstants;
  ssTaxability?: Record<FilingStatus, SsTaxabilityRow>;
  additionalMedicare?: Record<FilingStatus, AdditionalMedicareRow>;
  niit?: Record<FilingStatus, NiitRow>;
  amt?: Record<FilingStatus, AmtRow>;
  saversCredit?: Record<FilingStatus, SaversCreditRow>;
  depreciation?: DepreciationConstants;
  // EITC: per-status, per number of qualifying children (0..3+).
  eitc?: Record<FilingStatus, Record<string, EitcRow>>;
  feie?: FeieConstants;
  childCare?: ChildCareConstants;

  // Wave 1: hoisted statutory constants. All optional so pre-Wave-1 configs
  // keep loading; calculators continue to read their own module-level
  // constants until a later wave migrates each consumer.
  seTax?: SeTaxConstants;
  penalties?: PenaltyConstants;
  scheduleRCredit?: ScheduleRCreditConstants;
  residentialEnergy?: ResidentialEnergyConstants;
  mortgageCredit?: MortgageCreditConstants;
  evCredit?: EvCreditConstants;
  homeOffice?: HomeOfficeConstants;
  passiveLoss?: PassiveLossConstants;
  underpaymentPenalty?: UnderpaymentPenaltyConstants;
  householdEmployment?: HouseholdEmploymentConstants;
  actc?: ActcConstants;
  ptc?: PtcConstants;
  eitcInvestmentIncomeLimit?: number; // 11950 (2025)
}

export interface PersonalInfo {
  firstName: string | null;
  lastName: string | null;
  ssnLast4: string | null; // client never sees full SSN
  dob: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  spouseFirstName: string | null;
  spouseLastName: string | null;
  spouseSsnLast4: string | null;
  spouseDob: string | null;
}

export interface PersonalInfoInput {
  firstName?: string | null;
  lastName?: string | null;
  ssn?: string | null; // full SSN accepted server-side; stripped on read
  dob?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  spouseFirstName?: string | null;
  spouseLastName?: string | null;
  spouseSsn?: string | null;
  spouseDob?: string | null;
}

export interface Dependent {
  id: string;
  name: string;
  ssnLast4: string | null;
  relationship: string | null;
  dob: string | null;
  isQualifyingChild: boolean;
}

export interface DependentInput {
  id?: string;
  name: string;
  ssn?: string | null;
  relationship?: string | null;
  dob?: string | null;
  isQualifyingChild?: boolean;
}

export interface W2Income {
  id: string;
  employer: string | null;
  ein: string | null;
  box1Wages: number;
  box2FedWithheld: number;
  box3SsWages: number;
  box4SsWithheld: number;
  box5MedicareWages: number;
  box6MedicareWithheld: number;
  stateWages: number;
  stateWithheld: number;
  // Optional for backwards compat: which spouse earned this W-2. Used on
  // MFJ to reduce each spouse's remaining SS wage base independently
  // (Schedule SE Part I line 8a) and to split §31(b) excess-SS-withholding
  // computations per spouse.
  ownerSpouse?: OwnerSpouse;
}

export interface InterestIncome {
  id: string;
  payer: string | null;
  amount: number;
  // §86(b)(2): tax-exempt interest is added to provisional income for the
  // Social Security benefits taxability calculation (but is not itself
  // included in AGI).
  taxExempt: boolean;
  // §57(a)(5): interest on specified private activity bonds issued after
  // 8/7/1986 is an AMT preference item on Form 6251 line 2g. Users enter
  // the PAB portion of their tax-exempt interest (subset of `amount` when
  // `taxExempt` is true, or reported from 1099-INT Box 9).
  privateActivityBondInterest?: number;
}

export interface DividendIncome {
  id: string;
  payer: string | null;
  ordinary: number;
  qualified: number;
  // 1099-DIV Box 2a: total capital gain distributions (from RICs/REITs).
  // Flows to Schedule D line 13 as LTCG, or directly to 1040 line 7 when no
  // Schedule D is required. Qualifies for LTCG preferential rates.
  totalCapGainDistributions?: number;
  // 1099-DIV Box 2b: unrecaptured §1250 gain (subset of Box 2a).
  // Informational — used by the 28%-rate / Unrecaptured §1250 Gain Worksheet.
  unrecapSection1250Gain?: number;
  // 1099-DIV Box 2c: §1202 gain (subset of Box 2a).
  // Informational — used by the §1202 exclusion workbook.
  section1202Gain?: number;
  // 1099-DIV Box 5: Section 199A dividends (REIT / qualified PTP). Eligible
  // for 20% QBI deduction on Form 8995 line 6. Optional for backwards compat.
  section199ADividends?: number;
}

// Owner of an earning activity, for per-spouse aggregation on MFJ (SE tax
// wage-base per IRC §1402(b), allocation of W-2 SS wages per Schedule SE
// Part I line 8a, etc.). Defaults to 'taxpayer' when omitted so single-
// filer and legacy data continue to work unchanged.
export type OwnerSpouse = 'taxpayer' | 'spouse';

export interface SelfEmployment {
  id: string;
  businessName: string | null;
  ein: string | null;
  principalActivity: string | null;
  grossReceipts: number;
  returnsAllowances: number;
  costOfGoods: number;
  expenses: Record<string, number>;
  // Optional for backwards compat: which spouse owns this Schedule C.
  // Required on MFJ for correct per-spouse SS wage-base application.
  ownerSpouse?: OwnerSpouse;
}

export interface CapitalGain {
  id: string;
  description: string | null;
  dateAcquired: string | null;
  dateSold: string | null;
  proceeds: number;
  costBasis: number;
  term: CapitalGainTerm;
  // Form 8949 column (g) wash-sale loss disallowed (code "W") per IRC §1091.
  // Optional (additive field); treated as 0 if omitted. Only reduces a loss,
  // never turns a loss into a gain.
  washSaleLossDisallowed?: number;
}

// ----- Phase 1: Retirement distributions (1099-R) -----
//
// One row per 1099-R. `distributionCode` holds IRS box 7 code (e.g. '1' = early
// without known exception, '7' = normal, 'G' = rollover). `exceptionCode` is
// the Form 5329 Part I exception number (01..12) if one applies.

export interface RetirementIncome {
  id: string;
  payer: string | null;
  grossDistribution: number;
  taxableAmount: number;
  federalWithheld: number;
  stateWithheld: number;
  distributionCode: string | null;
  isIra: boolean;
  isRoth: boolean;
  exceptionCode: string | null;
  // 1099-R Box 2b "Taxable amount not determined". Per IRS 1099-R instructions
  // the payer of an IRA distribution is generally required to check this box
  // and leave Box 2a blank. For non-rollover IRAs the gross distribution is
  // normally fully taxable unless the taxpayer has basis (Form 8606), so
  // sumRetirementIncome defaults taxable to gross when this flag is set.
  taxableAmountNotDetermined: boolean;
}

export interface RetirementIncomeInput {
  id?: string;
  payer?: string | null;
  grossDistribution?: number;
  taxableAmount?: number;
  federalWithheld?: number;
  stateWithheld?: number;
  distributionCode?: string | null;
  isIra?: boolean;
  isRoth?: boolean;
  exceptionCode?: string | null;
  taxableAmountNotDetermined?: boolean;
}

// ----- Phase 2: Social Security benefits (single row per return) -----
//
// Gross SSA-1099 benefits; the taxable portion is computed from the SS
// taxability tiers in TaxYearConfig.ssTaxability. `medicarePremiums` reduces
// net cash received but doesn't change taxability.

export interface SocialSecurityBenefits {
  grossBenefits: number;        // SSA-1099 box 5
  medicarePremiums: number;     // SSA-1099 box 3 Part B/D premiums
  federalWithheld: number;      // box 6
}

// ----- Phase 2: Unemployment compensation (1099-G) -----

export interface UnemploymentIncome {
  id: string;
  payer: string | null;
  amount: number;               // 1099-G box 1
  federalWithheld: number;      // box 4
}

export interface UnemploymentIncomeInput {
  id?: string;
  payer?: string | null;
  amount?: number;
  federalWithheld?: number;
}

// ----- Phase 3: Other income (unified tagged list) -----
//
// Covers Sched 1 line 8 sub-items: 1099-MISC box 3 prizes/awards, jury duty,
// taxable scholarships, hobby income, alimony received (pre-2019 divorces),
// and a generic catch-all. Source drives labeling on Sched 1.

export type OtherIncomeSource =
  | '1099misc_box3'
  | 'jury_duty'
  | 'scholarship_taxable'
  | 'hobby'
  | 'alimony_received'
  | 'other';

export interface OtherIncome {
  id: string;
  source: OtherIncomeSource;
  description: string | null;
  amount: number;
}

export interface OtherIncomeInput {
  id?: string;
  source?: OtherIncomeSource;
  description?: string | null;
  amount?: number;
}

// ----- Phase 2: Gambling winnings (W-2G) and losses -----
//
// Gambling winnings flow to Schedule 1 other income. Losses are itemized (Sched
// A) up to the amount of winnings; tracked here so the itemized computation
// can pull them in without duplicating state.

export interface GamblingWinnings {
  id: string;
  payer: string | null;
  winnings: number;
  federalWithheld: number;
}

export interface GamblingWinningsInput {
  id?: string;
  payer?: string | null;
  winnings?: number;
  federalWithheld?: number;
}

// ----- Phase 4: Schedule E rental & royalty, K-1s, Form 8582 -----
//
// Rentals: one row per property. `netIncome` is the computed line E result
// (rents received minus expenses); negative means a loss. `activeParticipation`
// unlocks the $25k special allowance (phased out for AGI $100k-$150k MFJ).
// `isPassive` is normally true; set false for real-estate professionals.
//
// Royalties are portfolio income (not passive). K-1s carry both passive and
// non-passive components; the shape keeps each line item addressable.

export interface ScheduleERental {
  id: string;
  propertyAddress: string | null;
  propertyType: string | null;     // 'residential' | 'commercial' | 'vacation' | 'land' etc.
  fairRentalDays: number;
  personalUseDays: number;
  rentsReceived: number;
  expenses: Record<string, number>; // advertising, auto, cleaning, insurance, mortgage, repairs, utilities, depreciation, other
  activeParticipation: boolean;
  isPassive: boolean;
  priorYearUnallowedLoss: number;   // carryforward in (Form 8582 Worksheet 5)
}

export interface ScheduleERentalInput {
  id?: string;
  propertyAddress?: string | null;
  propertyType?: string | null;
  fairRentalDays?: number;
  personalUseDays?: number;
  rentsReceived?: number;
  expenses?: Record<string, number>;
  activeParticipation?: boolean;
  isPassive?: boolean;
  priorYearUnallowedLoss?: number;
}

export interface ScheduleERoyalty {
  id: string;
  source: string | null;
  grossRoyalties: number;
  expenses: number;
}

export interface ScheduleERoyaltyInput {
  id?: string;
  source?: string | null;
  grossRoyalties?: number;
  expenses?: number;
}

export type K1EntityKind = 'partnership' | 's_corp' | 'trust';

export interface K1Income {
  id: string;
  entityKind: K1EntityKind;
  entityName: string | null;
  ein: string | null;
  isPassive: boolean;
  ordinaryBusinessIncome: number;     // 1065 box 1 / 1120S box 1 / 1041 box 5/6
  netRentalRealEstate: number;        // 1065/1120S box 2
  otherRentalIncome: number;          // 1065/1120S box 3
  interestIncome: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  royalties: number;
  shortTermCapitalGain: number;
  longTermCapitalGain: number;
  section1231Gain: number;
  priorYearUnallowedLoss: number;     // passive carryforward from Form 8582
}

export interface K1IncomeInput {
  id?: string;
  entityKind?: K1EntityKind;
  entityName?: string | null;
  ein?: string | null;
  isPassive?: boolean;
  ordinaryBusinessIncome?: number;
  netRentalRealEstate?: number;
  otherRentalIncome?: number;
  interestIncome?: number;
  ordinaryDividends?: number;
  qualifiedDividends?: number;
  royalties?: number;
  shortTermCapitalGain?: number;
  longTermCapitalGain?: number;
  section1231Gain?: number;
  priorYearUnallowedLoss?: number;
}

// ----- Phase 4: cross-year carryforwards -----
//
// Keyed on (user, tax year, kind). Each phase that produces a carryforward
// writes a row for the NEXT year. Phase 4 seeds the table with passive-loss
// carryforwards; future phases extend `CarryforwardKind`.

export type CarryforwardKind =
  | 'passive_loss_rental'
  | 'passive_loss_k1'
  // Unified passive-loss bucket (Form 8582) when the originating family is
  // not recorded separately. Prefer the _rental / _k1 variants where the
  // family is known; the generic 'passive_loss' kind is a catch-all.
  | 'passive_loss'
  | 'capital_loss_short'
  | 'capital_loss_long'
  | 'charitable'
  | 'amt_credit'          // Form 8801 prior-year minimum tax credit (§53)
  | 'ftc'                 // Form 1116 foreign tax credit (§904(c)) — alias of foreign_tax_credit
  | 'foreign_tax_credit'
  | 'section_179'
  // §199A aggregate QBI loss carryforward (Form 8995 / 8995-A)
  | 'qbi_loss'
  // Phase 10 additions
  | 'amt_nol'
  | 'nol'
  | 'feie_housing';

export interface Carryforward {
  id: string;
  userId: string;
  taxYear: number;        // the year this carryforward APPLIES TO (i.e. incoming)
  kind: CarryforwardKind;
  refId: string | null;   // subkind bucket: FTC basket category, charitable
                          // limit class, or originating item id (property/K1)
                          // for passive losses. NULL for single-bucket kinds
                          // (e.g. capital_loss_short, amt_credit).
  amount: number;
  sourceReturnId: string | null;
  notes: string | null;
}

/**
 * Input shape for writing a carryforward row. `id` is generated by the
 * service when omitted. `userId` / `taxYear` typically come from the caller
 * context (the orchestrator) rather than the input row, but are accepted
 * here for bulk / admin callers.
 */
export interface CarryforwardInput {
  id?: string;
  userId?: string;
  taxYear?: number;
  kind: CarryforwardKind;
  refId?: string | null;
  amount: number;
  sourceReturnId?: string | null;
  notes?: string | null;
}

// ----- Phase 5: Schedule F, Form 4797, Form 4562, Form 8829 -----
//
// Schedule F is farm income, very similar shape to Schedule C. One row per
// farm. Net profit flows to 1040 line 3, and SE tax applies to the profit
// (same SE path as Schedule C).

export interface ScheduleFFarm {
  id: string;
  farmName: string | null;
  principalProduct: string | null;
  accountingMethod: 'cash' | 'accrual';
  grossIncome: number;          // Sched F Part I total
  expenses: Record<string, number>;
  // Optional for backwards compat: which spouse owns this farm. Required
  // on MFJ for correct per-spouse SS wage-base application (§1402(b)).
  ownerSpouse?: OwnerSpouse;
}

export interface ScheduleFFarmInput {
  id?: string;
  farmName?: string | null;
  principalProduct?: string | null;
  accountingMethod?: 'cash' | 'accrual';
  grossIncome?: number;
  expenses?: Record<string, number>;
  ownerSpouse?: OwnerSpouse;
}

// Form 4797: sale of business-use property. Part I = §1231 (long-term, held
// >1yr). Net §1231 gain → LTCG; net §1231 loss → ordinary loss. Depreciation
// recapture (§1245/1250) is always ordinary, subtracted from the §1231 gain
// here and reported separately.

export type Form4797Term = 'long_1231' | 'short_ordinary';

export interface Form4797Sale {
  id: string;
  description: string | null;
  dateAcquired: string | null;
  dateSold: string | null;
  proceeds: number;
  costBasis: number;
  accumulatedDepreciation: number; // depreciation taken prior (§1245/1250)
  depreciationRecapture: number;   // amount recaptured as ordinary
  term: Form4797Term;
}

export interface Form4797SaleInput {
  id?: string;
  description?: string | null;
  dateAcquired?: string | null;
  dateSold?: string | null;
  proceeds?: number;
  costBasis?: number;
  accumulatedDepreciation?: number;
  depreciationRecapture?: number;
  term?: Form4797Term;
}

// Form 4562 depreciation asset. Each row is one asset placed in service;
// current-year deduction = §179 election + bonus depreciation + MACRS.

export type MacrsClass =
  | '3'        // certain racehorses, tractors
  | '5'        // autos, computers, office equipment
  | '7'        // office furniture, appliances
  | '10'       // water transportation equipment
  | '15'       // land improvements
  | '20'       // farm buildings
  | '27.5'     // residential rental
  | '39'       // non-residential real property
  | 'straight_line';

export interface DepreciationAsset {
  id: string;
  description: string | null;
  datePlacedInService: string | null;
  cost: number;
  macrsClass: MacrsClass;
  section179Election: number;   // elected §179 amount
  claimBonus: boolean;          // claim bonus depreciation on remaining basis
  businessUsePercent: number;   // decimal, 0..1 (default 1)
  businessId: string | null;    // optional: associate with a Schedule C or F
}

export interface DepreciationAssetInput {
  id?: string;
  description?: string | null;
  datePlacedInService?: string | null;
  cost?: number;
  macrsClass?: MacrsClass;
  section179Election?: number;
  claimBonus?: boolean;
  businessUsePercent?: number;
  businessId?: string | null;
}

// Form 8829: home office. One row per business. `useSimplified` picks method.
// Simplified: $5/sqft up to 300 sqft. Actual: business-use % of home
// expenses (utilities, insurance, mortgage interest, real estate tax,
// repairs, depreciation).

export interface HomeOfficeExpense {
  id: string;
  businessId: string | null;        // links to a Schedule C/F business
  useSimplified: boolean;
  squareFeet: number;
  totalHomeSquareFeet: number;
  utilities: number;
  insurance: number;
  mortgageInterest: number;
  realEstateTax: number;
  repairs: number;
  depreciation: number;
}

export interface HomeOfficeExpenseInput {
  id?: string;
  businessId?: string | null;
  useSimplified?: boolean;
  squareFeet?: number;
  totalHomeSquareFeet?: number;
  utilities?: number;
  insurance?: number;
  mortgageInterest?: number;
  realEstateTax?: number;
  repairs?: number;
  depreciation?: number;
}

// ----- Phase 6: Schedule 1 adjustments + Form 8606 + Form 8889 -----
//
// Schedule 1 Part II (adjustments to income). Stored as a single row per
// return; each field maps to a specific line. Totals flow to 1040 line 10.
// The ½-SE-tax deduction (already computed from Schedule SE) and the
// early-withdrawal-penalty-on-distributions (Form 5329, Phase 1) are NOT
// stored here — those are derived. `penaltyEarlyWithdrawal` here is the
// *savings* early-withdrawal penalty reported on a 1099-INT box 2.

export interface Schedule1Adjustments {
  educatorExpenses: number;           // line 11, capped (§62)
  hsaDeduction: number;               // line 13, derived from Form 8889
  selfEmployedHealthInsurance: number;// line 17
  sepContribution: number;            // line 16 component
  simpleContribution: number;         // line 16 component
  solo401kContribution: number;       // line 16 component
  traditionalIraDeduction: number;    // line 20 (deductible portion)
  studentLoanInterest: number;        // line 21, phased out
  penaltyEarlyWithdrawal: number;     // line 18 (1099-INT box 2 savings penalty)
  alimonyPaid: number;                // line 19a (pre-2019 divorces only)
  alimonyRecipientSsn: string | null; // line 19b
  alimonyDivorceDate: string | null;  // line 19c
  reservistExpenses: number;          // line 12 part
  performingArtistExpenses: number;   // line 12 part
  feeBasisExpenses: number;           // line 12 part
}

export interface Schedule1AdjustmentsInput {
  educatorExpenses?: number;
  hsaDeduction?: number;
  selfEmployedHealthInsurance?: number;
  sepContribution?: number;
  simpleContribution?: number;
  solo401kContribution?: number;
  traditionalIraDeduction?: number;
  studentLoanInterest?: number;
  penaltyEarlyWithdrawal?: number;
  alimonyPaid?: number;
  alimonyRecipientSsn?: string | null;
  alimonyDivorceDate?: string | null;
  reservistExpenses?: number;
  performingArtistExpenses?: number;
  feeBasisExpenses?: number;
}

// Form 8606 — traditional IRA basis & pro-rata rule for distributions and
// Roth conversions. Single row per return.

export interface Form8606 {
  priorYearBasis: number;             // line 2 (basis in traditional IRAs at 12/31 prior year)
  currentYearNondeductible: number;   // line 1 (nondeductible contributions this year)
  traditionalIraBalance: number;      // line 6 (total value of all trad IRAs at year-end)
  distributions: number;              // line 7 (taxable + nontaxable gross dist, excluding conversions/rollovers)
  conversions: number;                // line 8 (amount converted to Roth this year)
}

export interface Form8606Input {
  priorYearBasis?: number;
  currentYearNondeductible?: number;
  traditionalIraBalance?: number;
  distributions?: number;
  conversions?: number;
}

// Form 8889 — HSA contributions, distributions, and deduction limits.
// `contributions` excludes amounts made through an employer cafeteria plan
// (those are already excluded from W-2 box 1). `isCatchUpEligible` = age 55+.
// `distributions`/`qualifiedMedicalExpenses` drive taxable distribution +
// 20% additional tax (via Schedule 2).

export type HsaCoverage = 'none' | 'self' | 'family';

export interface Form8889 {
  coverage: HsaCoverage;
  contributions: number;              // line 2 (direct, out-of-paycheck)
  isCatchUpEligible: boolean;         // age 55+
  distributions: number;              // 1099-SA box 1
  qualifiedMedicalExpenses: number;   // spent on qualified medical
  isDisabledOrOver65: boolean;        // exempts from 20% additional tax
}

export interface Form8889Input {
  coverage?: HsaCoverage;
  contributions?: number;
  isCatchUpEligible?: boolean;
  distributions?: number;
  qualifiedMedicalExpenses?: number;
  isDisabledOrOver65?: boolean;
}

export interface ItemizedDeductions {
  medical: number;
  stateLocalTax: number;
  realEstateTax: number;
  mortgageInterest: number;
  charitableCash: number;
  charitableNoncash: number;
}

// ----- Phase 7: Nonrefundable credits -----
//
// Each of these is a small, self-contained piece of Form 1040 credit plumbing.
// For Phase 7 every credit is treated as nonrefundable (reduces tax liability,
// does not generate a refund below zero). AOTC's 40% refundable portion is
// deferred to Phase 8 alongside Schedule 8812 refundable ACTC and EITC.

// Form 2441 — Child and Dependent Care Expenses (single row per return).
// The credit % tier is AGI-based (TaxYearConfig.childCare.rates). The
// qualified expense cap depends on the number of qualifying persons:
// $3,000 for one, $6,000 for two-or-more. Both spouses must have earned
// income when filing MFJ; the lesser earned-income applies.
export interface Form2441 {
  totalQualifiedExpenses: number;
  numQualifyingPersons: number;         // 0, 1, 2+ (2+ uses the higher cap)
  taxpayerEarnedIncome: number;
  spouseEarnedIncome: number;           // MFJ only; 0 otherwise
  employerProvidedBenefits: number;     // W-2 box 10, reduces allowed expenses
  // §21(e)(2): MFS is generally ineligible unless the filer lived apart from
  // spouse for the last 6 months and the qualifying person lived with the
  // filer more than half the year (abandonment/separation exception).
  mfsAbandonmentException?: boolean;
  // §21(d)(2): student or disabled spouse/taxpayer is deemed to have earned
  // income ($250/mo one QP, $500/mo two or more).
  taxpayerIsStudentOrDisabled?: boolean;
  spouseIsStudentOrDisabled?: boolean;
}

export interface Form2441Input {
  totalQualifiedExpenses?: number;
  numQualifyingPersons?: number;
  taxpayerEarnedIncome?: number;
  spouseEarnedIncome?: number;
  employerProvidedBenefits?: number;
  mfsAbandonmentException?: boolean;
  taxpayerIsStudentOrDisabled?: boolean;
  spouseIsStudentOrDisabled?: boolean;
}

// Form 8863 — Education Credits (list of students, one row each). Each
// student elects AOTC or LLC. AOTC: 100% of first $2,000 + 25% of next
// $2,000 = $2,500 cap per student; 40% of AOTC is refundable (Phase 8).
// LLC: 20% of up to $10,000 total expenses across ALL LLC students.
// Both are phased out by AGI (TaxYearConfig.education).

export type EducationCreditType = 'aotc' | 'llc';

export interface Form8863Student {
  id: string;
  studentName: string | null;
  studentSsnLast4: string | null;
  creditType: EducationCreditType;
  qualifiedExpenses: number;
  isEligibleForAotc: boolean;           // first 4 years, half-time+, no felony drug
  priorAotcYears: number;               // must be < 4
}

export interface Form8863StudentInput {
  id?: string;
  studentName?: string | null;
  studentSsn?: string | null;           // full SSN server-side; stripped on read
  creditType?: EducationCreditType;
  qualifiedExpenses?: number;
  isEligibleForAotc?: boolean;
  priorAotcYears?: number;
}

// Form 8880 — Saver's Credit (Retirement Savings Contributions Credit).
// Eligible contributions (retirement plan deferrals + IRA contributions)
// are reduced by distributions received during the testing period, then
// multiplied by an AGI-tiered rate (50/20/10/0% — from TaxYearConfig
// .saversCredit). Cap: $2,000 base × rate per person.
export interface Form8880 {
  elective401kDeferrals: number;          // line 2
  iraContributions: number;               // line 1
  spouseElective401kDeferrals: number;
  spouseIraContributions: number;
  distributionsReceived: number;          // reduces contributions in testing period
}

export interface Form8880Input {
  elective401kDeferrals?: number;
  iraContributions?: number;
  spouseElective401kDeferrals?: number;
  spouseIraContributions?: number;
  distributionsReceived?: number;
}

// Schedule R — Credit for the Elderly or Disabled. Eligibility: age 65+,
// OR under 65 and permanently & totally disabled with taxable disability
// income. Base amount varies by filing status and who is eligible:
//   single/HOH age 65+:                 $5,000
//   MFJ both age 65+ (or both eligible): $7,500
//   MFJ one age 65+:                    $5,000
//   MFS (lived apart):                  $3,750
// Credit = 15% × (base − nontaxableSsAndPension − ½·(AGI − AGI-threshold)).
// AGI thresholds: single $7,500; MFJ $10,000; MFS $5,000.
export interface ScheduleR {
  isTaxpayerEligible: boolean;            // age 65+ OR disabled
  isSpouseEligible: boolean;
  taxpayerUnder65Disabled: boolean;       // disability path (under 65)
  spouseUnder65Disabled: boolean;
  disabilityIncome: number;               // taxable disability income (caps base)
  nontaxableSsAndPension: number;         // line 13, reduces base
}

export interface ScheduleRInput {
  isTaxpayerEligible?: boolean;
  isSpouseEligible?: boolean;
  taxpayerUnder65Disabled?: boolean;
  spouseUnder65Disabled?: boolean;
  disabilityIncome?: number;
  nontaxableSsAndPension?: number;
}

// Form 8396 — Mortgage Interest Credit (from an MCC). Credit =
// mortgageInterest × certificateRate. If certificateRate > 20%, the
// annual credit is capped at $2,000. Unused amount carries forward up to
// 3 years (carryforward handling deferred to Phase 10).
export interface Form8396 {
  certificateRate: number;                // decimal, e.g. 0.25
  mortgageInterestPaid: number;
  priorYearUnusedCredit: number;
}

export interface Form8396Input {
  certificateRate?: number;
  mortgageInterestPaid?: number;
  priorYearUnusedCredit?: number;
}

// Form 5695 — Residential Energy Credits.
// Part I: Residential Clean Energy Credit. 30% of qualified expenses for
// solar electric, solar water, wind, geothermal heat pump, biomass fuel,
// and battery storage tech. Fuel cell is 30% capped at $500 × half-kW.
// Part II: Energy Efficient Home Improvement Credit. 30% with caps:
//   - Insulation/air-sealing + windows/doors + central-AC/furnace: $1,200
//     aggregate cap, with sub-caps: windows $600, doors $250/door-$500
//     total, audit $150.
//   - Heat pumps + biomass stoves + heat-pump water heaters: $2,000 cap.
export interface Form5695 {
  // Part I
  solarElectric: number;
  solarWaterHeating: number;
  windEnergy: number;
  geothermalHeatPump: number;
  biomassFuel: number;
  batteryStorageTech: number;
  fuelCellCost: number;
  fuelCellKw: number;                     // capacity in kW (for cap calc)
  // Part II
  insulationAirSealing: number;
  exteriorWindows: number;
  exteriorDoors: number;
  homeEnergyAudit: number;
  heatPumps: number;                      // heat pumps + heat-pump water heaters
  biomassStoves: number;
  centralAc: number;
  furnaceBoiler: number;
}

export interface Form5695Input {
  solarElectric?: number;
  solarWaterHeating?: number;
  windEnergy?: number;
  geothermalHeatPump?: number;
  biomassFuel?: number;
  batteryStorageTech?: number;
  fuelCellCost?: number;
  fuelCellKw?: number;
  insulationAirSealing?: number;
  exteriorWindows?: number;
  exteriorDoors?: number;
  homeEnergyAudit?: number;
  heatPumps?: number;
  biomassStoves?: number;
  centralAc?: number;
  furnaceBoiler?: number;
}

// Form 8936 — Clean Vehicle Credit. For 2023+, new vehicles up to $7,500
// (credit amount depends on critical-minerals + battery-component sourcing
// — we let the user enter the IRS-certified amount). Used clean vehicles
// up to $4,000 and ≤ 30% of sale price (max sale price $25,000). One row
// per vehicle (VIN). Business-use portion flows through Form 3800 (not
// modeled here); personal-use portion is the nonrefundable credit.
// Vehicle class for §30D(f)(11) MSRP cap: $80k for SUV/van/pickup, $55k
// for other (sedan/hatchback/etc).
export type Form8936VehicleClass = 'suv' | 'van' | 'pickup' | 'other';

export interface Form8936Vehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number;
  vin: string | null;
  placedInService: string | null;
  isNew: boolean;                         // true = new, false = used
  purchasePrice: number;
  businessUsePercent: number;             // decimal 0..1
  userEnteredCredit: number;              // IRS-certified credit amount
  // §30D(d)(1)(G): new vehicle must have final assembly in North America.
  finalAssemblyInNorthAmerica?: boolean;
  // §30D(f)(11) MSRP cap: $80k SUV/van/pickup, $55k other. MSRP > cap → $0.
  vehicleClass?: Form8936VehicleClass;
  msrp?: number;
}

export interface Form8936VehicleInput {
  id?: string;
  make?: string | null;
  model?: string | null;
  year?: number;
  vin?: string | null;
  placedInService?: string | null;
  isNew?: boolean;
  purchasePrice?: number;
  businessUsePercent?: number;
  userEnteredCredit?: number;
  finalAssemblyInNorthAmerica?: boolean;
  vehicleClass?: Form8936VehicleClass;
  msrp?: number;
}

// Form 1116 — Foreign Tax Credit. Per category "basket" (passive vs
// general). Limitation = US tax × (foreignTaxableIncome / totalTaxableIncome).
// Credit = min(foreignTaxPaid, limitation). Carryback/carryforward
// (1 year back, 10 years forward) deferred to Phase 10.
export type Form1116Category = 'passive' | 'general';

export interface Form1116Basket {
  id: string;
  category: Form1116Category;
  country: string | null;
  foreignGrossIncome: number;
  definitelyRelatedDeductions: number;
  foreignTaxPaid: number;
}

export interface Form1116BasketInput {
  id?: string;
  category?: Form1116Category;
  country?: string | null;
  foreignGrossIncome?: number;
  definitelyRelatedDeductions?: number;
  foreignTaxPaid?: number;
}

// ----- Phase 8: Refundable credits -----
//
// Schedule 8812 — Additional Child Tax Credit (ACTC). The refundable portion
// of the CTC is the lesser of (a) the unused nonrefundable CTC after tax
// liability, (b) the statutory per-child refundable limit × qualifying
// children, or (c) 15% × (earned income − earned-income threshold).
//
// Schedule EIC + EITC worksheet. EITC phases in (rate × earned income up to
// maxCredit), plateaus, then phases out using the LARGER of AGI or earned
// income. Filing status MFS is ineligible. Investment income above a
// statutory cap disqualifies.
//
// Form 8962 — Premium Tax Credit reconciliation. Compares the annual PTC
// (computed from household income, family size, FPL, SLCSP, and the
// applicable-percentage table) against advance PTC (APTC) already paid to
// the exchange. Net = PTC − APTC; positive → refundable credit, negative →
// additional tax (repayment subject to a cap based on income tier).

export interface Schedule8812Input {
  // Number of qualifying children under the CTC age threshold (IRS Pub 972 /
  // Schedule 8812 Line 4a). Taken from the dependents list on Form 1040, but
  // we let the user override it for edge cases (shared-custody proration,
  // etc.). Null / undefined → auto-computed from dependents.
  qualifyingChildrenOverride: number | null;
  // Earned income used for the 15% phase-in calculation. When null, the
  // calculator derives it from W-2 wages + SE net earnings. Users can
  // override (e.g. to add combat pay, which is elective for EITC/ACTC).
  earnedIncomeOverride: number | null;
  // Elect to include nontaxable combat pay in earned income (raises both
  // EITC and ACTC in some cases).
  includeCombatPay: boolean;
  combatPayAmount: number;
}

export interface EitcEligibility {
  // EITC qualifying children (subset of dependents that meet residency +
  // relationship + age tests). Null → auto-computed from dependents.
  qualifyingChildrenOverride: number | null;
  // Investment income test: interest, dividends, net capital gain, royalties,
  // passive net income. When > statutory limit, EITC is $0. Derived by the
  // calculator but user may override.
  investmentIncomeOverride: number | null;
  // EITC also requires the taxpayer to have a valid SSN and (if no
  // qualifying children) to be age 25-64. Captured here as a boolean toggle;
  // detailed age checks (and the spouse age check on MFJ) are out-of-scope
  // for Phase 8 MVP and approximated.
  isEligibleAge: boolean;
  // Elect to include nontaxable combat pay in earned income (§32(c)(2)(B)(vi)).
  includeCombatPay: boolean;
  combatPayAmount: number;
}

// Form 8962 — Premium Tax Credit reconciliation. We accept one row per
// coverage-month family configuration; the simple-case MVP uses a single
// annual row, but the schema supports monthly entry for mid-year family
// changes in a future iteration.
export interface Form8962 {
  // Household size used for FPL lookup. Typically filer + spouse (if MFJ) +
  // dependents claimed.
  householdSize: number;
  // FPL base for the household (for the year). The IRS publishes poverty
  // guidelines for the prior year; the applicable year for 2025 returns is
  // the 2024 HHS poverty guidelines. We let the user enter the raw FPL $$
  // figure so state-tier (AK / HI) variations are correct without baking
  // poverty guidelines into our admin constants.
  federalPovertyLine: number;
  // Annual enrollment premium (sum across 1095-A line 33A columns).
  annualEnrollmentPremium: number;
  // Annual Second Lowest Cost Silver Plan premium (sum 1095-A 33B).
  annualSlcsp: number;
  // Advance PTC paid to the exchange (sum 1095-A 33C). Reconciled against
  // the computed annual PTC.
  advancePtcPaid: number;
  // Household MAGI beyond AGI. Most filers: 0. Adds back tax-exempt interest,
  // excluded FEIE, and excluded SS not already in AGI.
  additionalMagi: number;
  // §36B(c)(1)(C) + Reg. §1.36B-2(b)(2): MFS filers are generally ineligible
  // for PTC, unless a domestic-abuse or spousal-abandonment exception applies.
  mfsAbuseAbandonmentException?: boolean;
}

// ----- Phase 9: Alt-tax regimes -----
//
// Form 6251 — Alternative Minimum Tax. Re-computes tax liability on AMTI
// (alternative minimum taxable income) with different allowances, and adds
// the excess over regular tax if AMT is higher. Most inputs are derived
// from the rest of the return (taxable income, itemized deductions taken,
// depreciation adjustments, private-activity-bond interest). The fields
// below capture what isn't derivable.
export interface Form6251 {
  privateActivityBondInterest: number;         // AMT add-back for specified PAB interest
  amtDepreciationAdjustment: number;           // difference (signed) regular − AMT
  otherAdjustments: number;                    // catch-all for misc §56/§57 items
  amtNolCarryforward: number;                  // AMT NOL from prior years (limited to 90% of AMTI)
}

// Form 8960 — Net Investment Income Tax. 3.8% of the lesser of net
// investment income or MAGI over the threshold. Most inputs are derived;
// the fields here are allocable expenses the user may enter directly.
export interface Form8960 {
  investmentInterestExpense: number;           // line 9a — allocable investment interest
  stateTaxAllocableToInvestment: number;       // line 9b — SALT allocable to NII
  miscInvestmentExpenses: number;              // line 9c — other investment expenses
  otherModifications: number;                  // line 7 — catch-all §1411 adjustments
}

// Form 8959 — Additional Medicare Tax. 0.9% on Medicare wages / SE income /
// RRTA compensation above filing-status thresholds. Employer withholding
// of the 0.9% (from W-2 box 14 code "Additional Medicare Tax") offsets the
// liability and is reconciled here.
export interface Form8959 {
  rrtaCompensation: number;                    // Railroad Retirement Tier I compensation
  additionalMedicareWithheld: number;          // W-2 box 14 add'l Medicare withholding
}

// ----- Phase 10: Tail forms -----
//
// Form 2555 — Foreign Earned Income Exclusion (§911). Excludes up to
// `exclusionLimit` of foreign earned income from AGI if the taxpayer
// qualifies via bona fide residence OR physical presence (330 days in
// any 12 consecutive months).
export interface Form2555 {
  foreignEarnedIncome: number;       // gross foreign wages/SE income
  qualifyingDays: number;            // days in qualifying period (max 366)
  totalDaysInPeriod: number;         // denominator (365/366)
  housingExpenses: number;           // reasonable foreign housing expenses paid
  isBonaFideResident: boolean;       // qualifies under bona-fide residence test
  usesPhysicalPresence: boolean;     // qualifies under physical-presence test
}

// Schedule H — Household Employment Taxes. Employer-portion SS + Medicare
// (15.3% combined) on cash wages to household employees ≥ $2,700 threshold,
// plus FUTA (6% on first $7k) if any calendar quarter wages ≥ $1,000. Any
// federal income tax voluntarily withheld also flows to Schedule 2 line 9.
export interface ScheduleH {
  cashWagesSsMedicare: number;       // cash wages subject to SS/Medicare (over $2,700 per employee)
  cashWagesFuta: number;             // wages subject to FUTA (first $7k per employee)
  anyQuarterOver1000: boolean;       // FUTA triggered
  federalIncomeTaxWithheld: number;  // voluntary withholding on behalf of household employee
  stateUnemploymentPaid: number;     // state UI paid (FUTA credit basis)
}

// Form 2210 — Underpayment of Estimated Tax. Simplified short-method: safe
// harbor = lesser of 90% of current-year tax OR 100% of prior-year tax
// (110% if prior-year AGI > $150k / $75k MFS). Underpayment × §6621 rate.
export interface Form2210 {
  priorYearTax: number;              // prior year total tax (line 4 of prior 1040)
  priorYearAgi: number;              // prior year AGI (for high-income 110% rule)
  withholdingByQuarter: [number, number, number, number];
  estimatedPaymentsByQuarter: [number, number, number, number];
  requestWaiver: boolean;            // taxpayer requests penalty waiver (casualty/disability)
}

// Form 5405 — Repayment of First-Time Homebuyer Credit (2008 FTHB credit
// only). Recipients repay in 15 equal installments starting in 2010;
// full balance accelerates on sale/disposition. Simple: user enters the
// installment due this year (and optional acceleration balance).
export interface Form5405 {
  annualInstallment: number;         // scheduled installment for this tax year
  dispositionAccelerated: number;    // remaining balance due to sale/disposition
}

// Form 4972 — Lump-Sum Distributions. 10-year averaging election for
// qualifying plan distributions to taxpayers born before January 2, 1936
// (or their beneficiaries). Rarely applicable today. We accept the
// computed tax from the Form 4972 worksheet directly (most software
// provides this on request).
export interface Form4972 {
  qualifyingLumpSum: number;          // eligible lump-sum distribution amount
  capitalGainPortion: number;         // pre-1974 portion taxed at 20% cap-gain rate
  ordinaryPortion: number;            // balance subject to 10-year averaging
  computedTax: number;                // result from 10-year-averaging worksheet (user-entered)
  // §402(e)(4)(B): election limited to participants born before Jan 2, 1936
  // (or their beneficiaries). Optional for backwards compatibility — when
  // undefined, we assume eligibility; when explicitly false, the election
  // is disallowed and electedTax returns 0.
  participantEligible?: boolean;
}

// Task #38: Form 8995 (Simplified QBI deduction, §199A).
// Simplified method applies when taxable income before QBI is ≤ the §199A(e)
// threshold ($241,950 single / $483,900 MFJ for 2025, inflation-adjusted).
// Above threshold, Form 8995-A with W-2-wage and UBIA limits and SSTB
// exclusion is required — not modeled here. Enterprises above threshold
// should set `forceSimplified: false` to skip the simplified deduction (it
// will return 0 and flag `requiresForm8995A: true`).
export interface QbiActivity {
  id: string;
  name: string | null;
  ein: string | null;
  qbi: number;                        // qualified business income (can be negative)
  isSstb?: boolean;                   // specified service trade/business (§199A(d)(2))
  w2Wages?: number;                   // only used by 8995-A
  ubia?: number;                      // unadjusted basis immediately after acquisition
}

export interface Form8995 {
  activities: QbiActivity[];
  reitPtpDividends: number;           // 1099-DIV Box 5 aggregated + qualified PTP
  priorYearQbiLossCarry: number;      // negative carryforward (stored as positive magnitude)
  priorYearReitPtpLossCarry: number;  // negative REIT/PTP carryforward
}

export interface ComputedForm8995 {
  qualifiedBusinessIncome: number;    // line 1c + prior-year loss
  reitPtpIncome: number;              // line 6 + prior-year loss
  qbiComponent: number;               // line 5 — 20% × max(0, qualifiedBusinessIncome)
  reitPtpComponent: number;           // line 9 — 20% × max(0, reitPtpIncome)
  combinedComponent: number;          // line 10
  taxableIncomeBeforeQbi: number;     // line 11
  netCapitalGain: number;             // line 12 (qualified divs + LTCG)
  incomeLimit: number;                // line 14 — 20% × (line 11 − line 12)
  qbiDeduction: number;                // line 15 — min(combinedComponent, incomeLimit)
  qbiLossCarryforward: number;         // end-of-year QBI loss magnitude (positive)
  reitPtpLossCarryforward: number;     // end-of-year REIT/PTP loss magnitude (positive)
  aboveThreshold: boolean;             // taxable income > §199A(e) threshold
  requiresForm8995A: boolean;          // true when aboveThreshold and taxpayer has SSTB / limits
}

// Phase 10 computed outputs ----------------------------------------------

export interface ComputedForm2555 {
  foreignEarnedIncome: number;
  exclusionAllowed: number;           // min(exclusionLimit × qualifyingFraction, FEI)
  housingBase: number;                 // 16% of exclusion
  housingCap: number;                  // 30% of exclusion (simplified)
  housingExclusion: number;            // max(0, min(housingCap, expenses) − housingBase)
  totalExclusion: number;              // exclusionAllowed + housingExclusion
}

export interface ComputedScheduleH {
  ssMedicareTax: number;               // 15.3% × cashWagesSsMedicare
  futaTax: number;                     // 0.6% net × wages (after 5.4% state credit) or 6% gross
  federalIncomeTaxWithheld: number;    // pass-through
  totalHouseholdEmploymentTax: number; // sum of the above
}

export interface ComputedForm2210 {
  currentYearTax: number;              // passed in from totalTaxAfterCredits
  requiredAnnualPayment: number;       // lesser of 90% current / 100% (or 110%) prior year
  totalPaid: number;                    // withholding + estimates
  underpayment: number;                 // max(0, required − paid)
  penalty: number;                       // simplified: underpayment × estimated rate, 0 if waived
}

export interface ComputedForm5405 {
  repaymentThisYear: number;            // annualInstallment + dispositionAccelerated
}

export interface ComputedForm4972 {
  electedTax: number;                    // computedTax pass-through (0 if not elected)
}

// ----- Schedule 1 / 2 / 3 scaffolding -----
//
// Empty in Phase 0; later phases fill these in with specific fields. Keeping
// the shape present now so callers (server compute, client review page) can
// render them as collapsible rows without further structural changes.

export type Schedule1Data = Record<string, never>;
export type Schedule2Data = Record<string, never>;
export type Schedule3Data = Record<string, never>;

export interface TaxReturn {
  id: string;
  taxYear: number;
  filingStatus: FilingStatus | null;
  status: ReturnStatus;
  personalInfo: PersonalInfo;
  dependents: Dependent[];
  w2s: W2Income[];
  interest: InterestIncome[];
  dividends: DividendIncome[];
  selfEmployment: SelfEmployment[];
  capitalGains: CapitalGain[];
  retirementIncome: RetirementIncome[];
  socialSecurity: SocialSecurityBenefits;
  unemployment: UnemploymentIncome[];
  gambling: GamblingWinnings[];
  gamblingLosses: number;           // reported on Sched A, capped to winnings
  otherIncome: OtherIncome[];
  scheduleERentals: ScheduleERental[];
  scheduleERoyalties: ScheduleERoyalty[];
  k1s: K1Income[];
  farms: ScheduleFFarm[];
  form4797Sales: Form4797Sale[];
  depreciationAssets: DepreciationAsset[];
  homeOffices: HomeOfficeExpense[];
  schedule1Adjustments: Schedule1Adjustments;
  form8606: Form8606;
  form8889: Form8889;
  // Phase 7: nonrefundable credits
  form2441: Form2441;
  form8863Students: Form8863Student[];
  form8880: Form8880;
  scheduleR: ScheduleR;
  form8396: Form8396;
  form5695: Form5695;
  form8936Vehicles: Form8936Vehicle[];
  form1116Baskets: Form1116Basket[];
  // Phase 8: refundable credits
  schedule8812: Schedule8812Input;
  eitcEligibility: EitcEligibility;
  form8962: Form8962;
  form6251: Form6251;
  form8960: Form8960;
  form8959: Form8959;
  // Phase 10: tail forms
  form2555: Form2555;
  scheduleH: ScheduleH;
  form2210: Form2210;
  form5405: Form5405;
  form4972: Form4972;
  // Task #38: §199A QBI deduction (Form 8995 simplified method).
  form8995?: Form8995;
  itemized: ItemizedDeductions;
  useStandardDeduction: boolean;
  estimatedPayments: number;
  // IRC §1212(b) capital-loss carryforward INPUTS from the user's prior-year
  // Schedule D (Capital Loss Carryover Worksheet, Pub 550). These feed into
  // the current-year capital-loss computation (short-term carries to
  // short-term, long-term to long-term, per Pub 550 worksheet).
  priorYearShortTermLossCarryforward?: number;
  priorYearLongTermLossCarryforward?: number;
  schedule1: Schedule1Data;
  schedule2: Schedule2Data;
  schedule3: Schedule3Data;
  updatedAt: string;
}

// ----- Computed return (grouped) -----

export interface ComputedIncome {
  wages: number;
  interest: number;
  taxExemptInterest: number;        // §86(b)(2) component of SS provisional income (excluded from AGI)
  ordinaryDividends: number;
  qualifiedDividends: number;
  // 1099-DIV Box 2a total capital gain distributions (aggregated across all
  // dividend rows). Flows to Schedule D line 13 / 1040 line 7 and gets LTCG
  // preferential-rate treatment.
  totalCapGainDistributions: number;
  seNetProfit: number;
  shortTermGain: number;
  longTermGain: number;
  capitalLossDeduction: number;
  // IRC §1212(b) carryforward to next year, split by character per Pub 550
  // Capital Loss Carryover Worksheet. Positive numbers (magnitude of the
  // loss) by convention; zero if there is no disallowed loss.
  capitalLossCarryforwardShortTerm: number;
  capitalLossCarryforwardLongTerm: number;
  capitalLossCarryforwardTotal: number;
  retirementGross: number;
  retirementTaxable: number;
  ssGross: number;
  ssTaxable: number;
  unemployment: number;
  gamblingWinnings: number;
  otherIncome: number;
  // Phase 4: Schedule E / K-1 aggregates
  rentalNetIncome: number;          // after §469 limits
  rentalSuspendedLoss: number;      // carryforward to next year
  royaltyNetIncome: number;
  k1OrdinaryIncome: number;         // after §469 limits on passive K-1s
  k1SuspendedLoss: number;          // carryforward to next year
  k1InterestIncome: number;
  k1OrdinaryDividends: number;
  k1QualifiedDividends: number;
  k1Royalties: number;
  k1ShortTermGain: number;
  k1LongTermGain: number;
  k1Section1231Gain: number;
  // Phase 5: Schedule F / 4797 / 8829
  farmNetProfit: number;
  section1231NetGain: number;       // if positive → flows to LTCG
  section1231OrdinaryLoss: number;  // if negative → flows to ordinary income
  depreciationRecapture: number;    // §1245/1250 ordinary
  homeOfficeDeduction: number;      // reduces SE net profit
  // Schedule B (Form 1040) is required when taxable interest > $1,500 OR
  // ordinary dividends > $1,500 (also triggered by several other conditions
  // like foreign accounts and seller-financed mortgages, not evaluated here).
  // Per §6012 / Schedule B instructions.
  scheduleBRequired: boolean;
  totalIncome: number;
}

export interface ComputedAdjustments {
  seTaxDeduction: number;
  // Phase 6: Schedule 1 Part II individual lines.
  educatorExpenses: number;
  hsaDeduction: number;               // allowed HSA deduction after limits
  selfEmployedHealthInsurance: number;
  sepContribution: number;
  simpleContribution: number;
  solo401kContribution: number;
  traditionalIraDeduction: number;
  studentLoanInterest: number;        // after phase-out
  penaltyEarlyWithdrawal: number;
  alimonyPaid: number;
  reservistExpenses: number;
  performingArtistExpenses: number;
  feeBasisExpenses: number;
  feieExclusion: number;              // Phase 10: Form 2555 total exclusion
  total: number;
}

// Phase 6: Form 8606 IRA basis output
export interface ComputedForm8606 {
  totalBasisAvailable: number;        // priorYearBasis + currentYearNondeductible
  taxableDistribution: number;        // distributions portion taxable
  taxableConversion: number;          // conversions portion taxable
  nontaxablePortion: number;          // nontaxable pro-rata portion of (dist + conversions)
  endingBasis: number;                // basis carried forward to next year
}

// Phase 6: Form 8889 HSA output
export interface ComputedForm8889 {
  contributionLimit: number;
  allowedDeduction: number;
  excessContribution: number;         // contributions above limit (6% excise — not computed here)
  taxableDistribution: number;        // non-qualified portion
  additionalTax: number;              // 20% additional tax if under 65 / not disabled
}

export interface ComputedDeductions {
  standard: number;
  itemized: number;
  used: number;
  // Task #38: §199A QBI deduction (1040 line 13). Additive to the standard
  // or itemized deduction on 1040 line 12 but reported on its own line.
  qbiDeduction: number;
}

export interface ComputedTaxComputation {
  agi: number;
  taxableIncome: number;
  regularTax: number;
  ltcgTax: number;
  totalTax: number;
  // §26(a) nonrefundable-credit limitation base: regular tax + LTCG tax +
  // Schedule 2 Part I (AMT + excess APTC repayment). This is the "tax
  // liability" nonrefundable credits may reduce (1040 line 22 anchor).
  taxBeforeNonrefundableCredits: number;
  // Above minus total nonrefundable credits (floored at zero).
  taxAfterNonrefundableCredits: number;
}

export interface ComputedCredits {
  childTaxCredit: number;                  // nonrefundable portion of CTC
  // Phase 7 nonrefundable credits
  childDependentCareCredit: number;       // Form 2441
  educationCredits: number;                // Form 8863 (AOTC + LLC; nonrefundable portion)
  saversCredit: number;                    // Form 8880
  elderlyDisabledCredit: number;           // Schedule R
  mortgageInterestCredit: number;          // Form 8396
  residentialEnergyCredit: number;         // Form 5695
  evCredit: number;                        // Form 8936
  foreignTaxCredit: number;                // Form 1116
  total: number;
  // Task #37: §26(a) ordered cascade trace. Shows the pre-cascade
  // (form-computed) amount vs the post-cascade (allowed) amount for each
  // credit, in IRS Schedule 3 Part I order. Summing `allowed` gives `total`.
  // When liability runs out mid-cascade, later credits' `allowed` will be 0
  // even if their `computed` is positive (that excess is lost, except for
  // CTC whose residual spills to the refundable ACTC via Schedule 8812).
  perCredit?: Record<string, { computed: number; allowed: number }>;
}

// Phase 8: Refundable credits (flow separately; reduce balance due and can
// produce a refund below zero tax).
export interface ComputedRefundableCredits {
  additionalChildTaxCredit: number;        // Schedule 8812 refundable ACTC
  refundableAotc: number;                   // 40% refundable portion of AOTC (Form 8863)
  earnedIncomeCredit: number;               // EITC
  netPremiumTaxCredit: number;              // Form 8962 net (PTC − APTC) when positive
  aptcRepayment: number;                    // Form 8962 net when negative (repayment, goes to other taxes/Schedule 2)
  excessSocialSecurity: number;             // §31(b) / Schedule 3 line 11 — two-or-more W-2s SS tax withheld over 6.2% × ssWageBase
  total: number;                            // sum of positives (excludes aptcRepayment which adds to taxes)
}

// Phase 8: Form 8962 detail for audit trail.
export interface ComputedForm8962 {
  householdIncome: number;                  // AGI + additional MAGI adjustments
  fplPercent: number;                        // householdIncome / FPL × 100
  applicablePercentage: number;              // decimal contribution %
  expectedContribution: number;              // applicablePercentage × householdIncome
  annualPtc: number;                         // min(SLCSP − expectedContribution, enrollmentPremium), floored at 0
  advancePtc: number;                        // pass-through of user input
  netPtc: number;                            // annualPtc − advancePtc (signed)
  repaymentCap: number;                      // cap applied to excess APTC when filer repays
  refundablePtc: number;                     // max(netPtc, 0)
  aptcRepayment: number;                     // min(|netPtc|, repaymentCap) when netPtc < 0
}

// Phase 8: Schedule 8812 detail for audit trail.
export interface ComputedSchedule8812 {
  qualifyingChildren: number;
  otherDependents: number;                   // §24(h)(4) count — non-QC dependents eligible for $500 ODC
  ctcBeforeLimits: number;                  // $2,000 × kids (pre-phase-out)
  odcBeforeLimits: number;                   // $500 × other dependents (pre-phase-out)
  combinedBeforeLimits: number;              // ctcBeforeLimits + odcBeforeLimits
  phaseoutReduction: number;                 // per §24(b) phase-out, applied to combined credit
  ctcAfterPhaseout: number;                  // statutory CTC after §24 phase-out (share of combined)
  odcAfterPhaseout: number;                  // statutory ODC after §24 phase-out (share of combined)
  combinedAfterPhaseout: number;             // combined credit after phase-out
  nonrefundablePortion: number;              // amount absorbed by tax liability (CTC + ODC, nonrefundable)
  refundablePortion: number;                 // lesser of earnedIncome×15%, statutory per-child ref limit × kids, or unused combined credit
  earnedIncomeForPhaseIn: number;
}

// Phase 8: EITC detail.
export interface ComputedEitc {
  qualifyingChildren: number;
  earnedIncome: number;
  investmentIncome: number;
  disqualifiedByInvestment: boolean;
  phaseInAmount: number;                     // rate × min(earnedIncome, plateauStart)
  phaseOutAmount: number;                    // rate × max(0, measure − phaseOutStart)
  credit: number;                            // max(0, phaseInAmount − phaseOutAmount), capped at maxCredit
}

// Phase 9: Form 6251 AMT audit detail.
export interface ComputedForm6251 {
  amti: number;                              // alternative minimum taxable income
  exemptionAllowed: number;                  // §55(d) exemption after phase-out
  tentativeMinimumTax: number;               // AMT tax on AMTI − exemption
  regularTaxForAmt: number;                  // regular tax used in the AMT comparison
  amtLiability: number;                      // max(0, TMT − regularTaxForAmt)
}

// Phase 9: Form 8960 NIIT audit detail.
export interface ComputedForm8960 {
  netInvestmentIncome: number;               // NII before threshold comparison
  magi: number;                              // modified AGI
  excessOverThreshold: number;               // max(0, magi − threshold)
  amountSubjectToNiit: number;               // min(netInvestmentIncome, excessOverThreshold)
  niit: number;                              // 3.8% × amountSubjectToNiit
}

// Phase 9: Form 8959 Additional Medicare Tax audit detail.
export interface ComputedForm8959 {
  medicareWages: number;                     // Part I: W-2 box 5 total
  seIncome: number;                          // Part II: SE earnings × 0.9235
  rrtaCompensation: number;                  // Part III
  threshold: number;                          // filing-status threshold
  additionalMedicareTax: number;              // 0.9% × amount over threshold (aggregated)
  additionalMedicareWithheld: number;         // from W-2 box 14 input
  netAdditionalMedicare: number;              // additionalMedicareTax − additionalMedicareWithheld (≥ 0 goes to Schedule 2)
}

export interface ComputedOtherTaxes {
  seTax: number;
  earlyWithdrawalPenalty: number;
  hsaAdditionalTax: number;           // Phase 6: 20% additional tax on non-qualified HSA distributions
  aptcRepayment: number;              // Phase 8: excess advance PTC repayment (Form 8962 → Schedule 2)
  amt: number;                        // Phase 9: Alternative Minimum Tax (Form 6251)
  niit: number;                       // Phase 9: Net Investment Income Tax (Form 8960)
  additionalMedicare: number;         // Phase 9: Additional Medicare Tax (Form 8959)
  householdEmploymentTax: number;     // Phase 10: Schedule H total
  firstTimeHomebuyerRepayment: number;// Phase 10: Form 5405
  lumpSumAveragingTax: number;        // Phase 10: Form 4972 elected tax
  underpaymentPenalty: number;        // Phase 10: Form 2210 penalty
  total: number;
}

export interface ComputedPayments {
  withholding: number;
  estimatedPayments: number;
  // Form 8959 Part V line 24 — additional Medicare tax withholding (0.9%
  // employer withholding on wages above $200k). Flows to 1040 line 25c.
  additionalMedicareWithholding: number;
  total: number;
}

export interface ComputedSummary {
  totalTaxAfterCredits: number;
  refund: number;
  balanceDue: number;
}

// Task #48: Schedule 1 (Form 1040) partitioned by IRS line numbers.
//   Part I — Additional Income (lines 1–10). Flows to 1040 line 8.
//   Part II — Adjustments to Income (lines 11–26). Flows to 1040 line 10.
export interface ComputedSchedule1PartI {
  taxableRefundsStateLocal: number;          // line 1
  alimonyReceived: number;                   // line 2a (pre-2019 agreements)
  businessIncomeScheduleC: number;           // line 3 — net of Sched C + farm depreciation/home-office
  otherGainsForm4797: number;                // line 4 — §1231 ordinary / recapture
  rentalRoyaltyScheduleE: number;            // line 5 — net Schedule E + K-1 ordinary
  farmIncomeScheduleF: number;               // line 6 — Schedule F net
  unemploymentCompensation: number;          // line 7
  // Line 8a–z — "other income" itemized
  foreignEarnedIncomeExclusion: number;      // line 8d — NEGATIVE (Form 2555 exclusion reduces AGI)
  gamblingWinnings: number;                  // line 8b
  otherIncomeItemized: number;               // line 8a + 8c + 8e-z (jury duty, prizes, hobby, etc.)
  totalOtherIncome: number;                  // line 9 — sum of 8a–z
  totalAdditionalIncome: number;             // line 10 — sum of 1–9 (flows to 1040 line 8)
}
export interface ComputedSchedule1PartII {
  educatorExpenses: number;                  // line 11 (§62(a)(2)(D))
  certainBusinessExpenses: number;           // line 12 — reservists + performing artists + fee-basis
  hsaDeduction: number;                      // line 13 (§223)
  movingExpensesMilitary: number;            // line 14 (§217(g))
  deductibleSeTax: number;                   // line 15 — 50% of SE tax
  sepSimpleQualifiedPlans: number;           // line 16 — SEP/SIMPLE/solo-401(k)
  selfEmployedHealthInsurance: number;       // line 17 (§162(l))
  penaltyEarlyWithdrawalSavings: number;     // line 18 — 1099-INT box 2
  alimonyPaid: number;                       // line 19a (pre-2019 agreements)
  iraDeduction: number;                      // line 20 — traditional IRA
  studentLoanInterest: number;               // line 21 (§221, capped $2,500, phase-out)
  archerMsaDeduction: number;                // line 23
  otherAdjustments: number;                  // line 24a-z catch-all
  totalAdjustments: number;                  // line 26 (flows to 1040 line 10)
}
export interface ComputedSchedule1 {
  partI: ComputedSchedule1PartI;
  partII: ComputedSchedule1PartII;
}

// Schedule 2 (Form 1040) is partitioned into two parts with different
// downstream effects:
//   Part I — Additional Taxes. Flows to 1040 line 17. Treated as regular
//     tax for purposes of §§26(a) / 904 (FTC limitation). Nonrefundable
//     credits CAN reduce Part I.
//   Part II — Other Taxes. Flows to 1040 line 23. Added AFTER nonrefundable
//     credits. Nonrefundable credits CANNOT reduce Part II (§26(a)).
export interface ComputedSchedule2PartI {
  amt: number;                         // line 1 — Form 6251 AMT
  excessAptcRepayment: number;         // line 2 — Form 8962 excess APTC
  total: number;                       // line 3 — Part I total
}
export interface ComputedSchedule2PartII {
  seTax: number;                              // line 4 — Schedule SE
  unreportedSsMedicare: number;               // line 7 — Forms 4137/8919
  earlyWithdrawalPenalty: number;             // line 8 — Form 5329 §72(t)
  additionalMedicareTax: number;              // line 11 — Form 8959
  niit: number;                                // line 12 — Form 8960
  householdEmploymentTax: number;             // line 17a/9 — Schedule H
  firstTimeHomebuyerRepayment: number;        // line 10 — Form 5405
  lumpSumAveraging: number;                    // line 17 — Form 4972
  otherTaxes: number;                          // line 17z — catch-all
  total: number;                               // line 21 — Part II total
}
export interface ComputedSchedule2 {
  partI: ComputedSchedule2PartI;
  partII: ComputedSchedule2PartII;
}
// Task #48: Schedule 3 (Form 1040) partitioned by IRS line numbers.
//   Part I — Nonrefundable Credits (lines 1–8). Flows to 1040 line 20.
//   Part II — Other Payments and Refundable Credits (lines 9–15). Flows to
//   1040 line 31.
//
// Amounts in Part I reflect the §26(a)-ordered cascade (post-allowed), so
// `totalNonrefundableCredits` equals `ComputedCredits.total` by construction.
export interface ComputedSchedule3PartI {
  foreignTaxCredit: number;                  // line 1 — Form 1116
  childDependentCareCredit: number;          // line 2 — Form 2441
  educationCredits: number;                   // line 3 — Form 8863 (nonrefundable portion)
  saversCredit: number;                       // line 4 — Form 8880
  residentialCleanEnergy: number;             // line 5a — Form 5695 Part I (§25D)
  energyEfficientHomeImprovement: number;     // line 5b — Form 5695 Part II (§25C)
  mortgageInterestCredit: number;             // line 6c — Form 8396
  elderlyDisabledCredit: number;              // line 6d — Schedule R
  cleanVehicleCredit: number;                 // line 6f — Form 8936 (personal use)
  otherCreditsLine6: number;                  // line 6a+b+e+g-z catch-all
  totalOtherCredits: number;                  // line 7 — sum of 6a-z
  totalNonrefundableCredits: number;          // line 8 — flows to 1040 line 20
}
export interface ComputedSchedule3PartII {
  netPremiumTaxCredit: number;                // line 9 — Form 8962
  amountPaidWithExtension: number;            // line 10
  excessSocialSecurity: number;               // line 11 — §31(b) two-or-more W-2s
  federalTaxOnFuels: number;                  // line 12 — Form 4136
  otherPaymentsRefundable: number;            // line 13a-z — misc
  totalOtherPayments: number;                 // line 14
  totalPaymentsAndRefundableCredits: number;  // line 15 — flows to 1040 line 31
}
export interface ComputedSchedule3 {
  partI: ComputedSchedule3PartI;
  partII: ComputedSchedule3PartII;
}

export interface ComputedReturn {
  filingStatus: FilingStatus;
  income: ComputedIncome;
  adjustments: ComputedAdjustments;
  deductions: ComputedDeductions;
  taxComputation: ComputedTaxComputation;
  credits: ComputedCredits;
  refundableCredits: ComputedRefundableCredits;
  otherTaxes: ComputedOtherTaxes;
  payments: ComputedPayments;
  summary: ComputedSummary;
  schedule1: ComputedSchedule1;
  schedule2: ComputedSchedule2;
  schedule3: ComputedSchedule3;
  form8606: ComputedForm8606;
  form8889: ComputedForm8889;
  schedule8812: ComputedSchedule8812;
  eitc: ComputedEitc;
  form8962: ComputedForm8962;
  form6251: ComputedForm6251;
  form8960: ComputedForm8960;
  form8959: ComputedForm8959;
  form2555: ComputedForm2555;
  scheduleH: ComputedScheduleH;
  form2210: ComputedForm2210;
  form5405: ComputedForm5405;
  form4972: ComputedForm4972;
  // Task #38: §199A Qualified Business Income deduction — populated when
  // Form 8995 inputs (or deemed QBI from Schedule C/F/E + REIT dividends)
  // are present; deducted from AGI on 1040 line 13.
  form8995?: ComputedForm8995;
}
