import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/pglite.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { encryptField, newId, last4 } from '../services/crypto.js';
import { getConfig, listConfigs } from '../services/taxYearConfig.js';
import type {
  TaxReturn,
  FilingStatus,
  PersonalInfo,
  Dependent,
  W2Income,
  InterestIncome,
  DividendIncome,
  SelfEmployment,
  CapitalGain,
  ItemizedDeductions,
  RetirementIncome,
  SocialSecurityBenefits,
  UnemploymentIncome,
  GamblingWinnings,
  OtherIncome,
  ScheduleERental,
  ScheduleERoyalty,
  K1Income,
  ScheduleFFarm,
  Form4797Sale,
  DepreciationAsset,
  HomeOfficeExpense,
  MacrsClass,
  Schedule1Adjustments,
  Form8606,
  Form8889,
  HsaCoverage,
  Form2441,
  Form8863Student,
  Form8880,
  ScheduleR,
  Form8396,
  Form5695,
  Form8936Vehicle,
  Form1116Basket,
  EducationCreditType,
  Form1116Category,
  Schedule8812Input,
  EitcEligibility,
  Form8962,
  Form6251,
  Form8960,
  Form8959,
  Form2555,
  ScheduleH,
  Form2210,
  Form5405,
  Form4972,
  Form8995,
  QbiActivity,
} from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

// ----- Helpers: load the full return -----

interface ReturnRow {
  id: string;
  user_id: string;
  tax_year: number;
  filing_status: FilingStatus | null;
  status: 'in_progress' | 'complete';
  use_standard_deduction: boolean;
  estimated_payments: string | number;
  gambling_losses: string | number;
  prior_year_st_loss_carryforward: string | number | null;
  prior_year_lt_loss_carryforward: string | number | null;
  updated_at: string;
}

/**
 * Resolve the active tax year for a request:
 *   1. explicit ?year=NNNN query param (must have a config)
 *   2. the user's most-recent existing return
 *   3. the most-recent configured year
 * Throws if no year config exists (admin hasn't set any up).
 */
async function resolveYear(userId: string, explicit?: number): Promise<number> {
  const db = await getDb();
  if (explicit) {
    const cfg = await getConfig(explicit);
    if (!cfg) throw Object.assign(new Error('year_not_configured'), { status: 400 });
    return explicit;
  }
  const existing = await db.query<{ tax_year: number }>(
    'SELECT tax_year FROM tax_returns WHERE user_id = $1 ORDER BY tax_year DESC LIMIT 1',
    [userId]
  );
  if (existing.rows[0]) return Number(existing.rows[0].tax_year);
  const configs = await listConfigs();
  if (configs.length === 0) {
    throw Object.assign(new Error('no_tax_years_configured'), { status: 503 });
  }
  return configs[0].taxYear;
}

async function getOrCreateReturn(userId: string, taxYear: number): Promise<ReturnRow> {
  const db = await getDb();
  const res = await db.query<ReturnRow>(
    `SELECT id, user_id, tax_year, filing_status, status,
            use_standard_deduction, estimated_payments, gambling_losses,
            prior_year_st_loss_carryforward, prior_year_lt_loss_carryforward, updated_at
       FROM tax_returns WHERE user_id = $1 AND tax_year = $2
       LIMIT 1`,
    [userId, taxYear]
  );
  if (res.rows[0]) return res.rows[0];
  const id = newId();
  await db.query(
    `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1, $2, $3)`,
    [id, userId, taxYear]
  );
  await db.query(`INSERT INTO personal_info (return_id) VALUES ($1)`, [id]);
  await db.query(`INSERT INTO itemized_deductions (return_id) VALUES ($1)`, [id]);
  return (
    await db.query<ReturnRow>(
      `SELECT id, user_id, tax_year, filing_status, status,
              use_standard_deduction, estimated_payments, gambling_losses,
            prior_year_st_loss_carryforward, prior_year_lt_loss_carryforward, updated_at
         FROM tax_returns WHERE id = $1`,
      [id]
    )
  ).rows[0];
}

function parseYear(q: unknown): number | undefined {
  if (q == null || q === '') return undefined;
  const n = Number(q);
  return Number.isInteger(n) && n >= 1900 && n < 3000 ? n : undefined;
}

async function touchReturn(returnId: string): Promise<void> {
  const db = await getDb();
  await db.query('UPDATE tax_returns SET updated_at = now() WHERE id = $1', [returnId]);
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format a DATE column value to an ISO 'YYYY-MM-DD' string, returning null
 * for missing dates. PGlite returns date-typed columns sometimes as ISO
 * strings and sometimes as Date objects (depending on type-parser state);
 * a naive `String(d).slice(0, 10)` yields 'Sat Mar 15' for Date objects.
 */
function isoDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  // Already in ISO form (pglite string path) — strip any time/tz suffix.
  return s.slice(0, 10);
}

async function loadFullReturn(row: ReturnRow): Promise<TaxReturn> {
  const db = await getDb();
  const id = row.id;

  const piRes = await db.query<{
    first_name: string | null;
    last_name: string | null;
    ssn_last4: string | null;
    dob: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    spouse_first_name: string | null;
    spouse_last_name: string | null;
    spouse_ssn_last4: string | null;
    spouse_dob: string | null;
  }>('SELECT * FROM personal_info WHERE return_id = $1', [id]);
  const piRow = piRes.rows[0];
  const personalInfo: PersonalInfo = piRow
    ? {
        firstName: piRow.first_name,
        lastName: piRow.last_name,
        ssnLast4: piRow.ssn_last4,
        dob: isoDate(piRow.dob),
        addressLine1: piRow.address_line1,
        addressLine2: piRow.address_line2,
        city: piRow.city,
        state: piRow.state,
        zip: piRow.zip,
        spouseFirstName: piRow.spouse_first_name,
        spouseLastName: piRow.spouse_last_name,
        spouseSsnLast4: piRow.spouse_ssn_last4,
        spouseDob: isoDate(piRow.spouse_dob),
      }
    : {
        firstName: null, lastName: null, ssnLast4: null, dob: null,
        addressLine1: null, addressLine2: null, city: null, state: null, zip: null,
        spouseFirstName: null, spouseLastName: null, spouseSsnLast4: null, spouseDob: null,
      };

  const depRes = await db.query<{
    id: string; name: string; ssn_last4: string | null; relationship: string | null;
    dob: string | null; is_qualifying_child: boolean;
  }>('SELECT id, name, ssn_last4, relationship, dob, is_qualifying_child FROM dependents WHERE return_id = $1 ORDER BY name', [id]);
  const dependents: Dependent[] = depRes.rows.map((d) => ({
    id: d.id,
    name: d.name,
    ssnLast4: d.ssn_last4,
    relationship: d.relationship,
    dob: isoDate(d.dob),
    isQualifyingChild: !!d.is_qualifying_child,
  }));

  const w2Res = await db.query<any>('SELECT * FROM w2_income WHERE return_id = $1 ORDER BY employer', [id]);
  const w2s: W2Income[] = w2Res.rows.map((w) => ({
    id: w.id,
    employer: w.employer,
    ein: w.ein,
    box1Wages: num(w.box1_wages),
    box2FedWithheld: num(w.box2_fed_withheld),
    box3SsWages: num(w.box3_ss_wages),
    box4SsWithheld: num(w.box4_ss_withheld),
    box5MedicareWages: num(w.box5_medicare_wages),
    box6MedicareWithheld: num(w.box6_medicare_withheld),
    stateWages: num(w.state_wages),
    stateWithheld: num(w.state_withheld),
  }));

  const intRes = await db.query<any>('SELECT * FROM interest_income WHERE return_id = $1 ORDER BY payer', [id]);
  const interest: InterestIncome[] = intRes.rows.map((r) => ({
    id: r.id, payer: r.payer, amount: num(r.amount), taxExempt: !!r.tax_exempt,
    privateActivityBondInterest: num(r.private_activity_bond_interest),
  }));

  const divRes = await db.query<any>('SELECT * FROM dividend_income WHERE return_id = $1 ORDER BY payer', [id]);
  const dividends: DividendIncome[] = divRes.rows.map((r) => ({
    id: r.id,
    payer: r.payer,
    ordinary: num(r.ordinary),
    qualified: num(r.qualified),
    totalCapGainDistributions: num(r.total_cap_gain_distributions),
    unrecapSection1250Gain: num(r.unrecap_section_1250_gain),
    section1202Gain: num(r.section_1202_gain),
  }));

  const seRes = await db.query<any>('SELECT * FROM self_employment WHERE return_id = $1 ORDER BY business_name', [id]);
  const selfEmployment: SelfEmployment[] = seRes.rows.map((r) => ({
    id: r.id,
    businessName: r.business_name,
    ein: r.ein,
    principalActivity: r.principal_activity,
    grossReceipts: num(r.gross_receipts),
    returnsAllowances: num(r.returns_allowances),
    costOfGoods: num(r.cost_of_goods),
    expenses: r.expenses,
  }));

  const cgRes = await db.query<any>('SELECT * FROM capital_gains WHERE return_id = $1 ORDER BY date_sold NULLS LAST', [id]);
  const capitalGains: CapitalGain[] = cgRes.rows.map((r) => ({
    id: r.id,
    description: r.description,
    dateAcquired: isoDate(r.date_acquired),
    dateSold: isoDate(r.date_sold),
    proceeds: num(r.proceeds),
    costBasis: num(r.cost_basis),
    term: r.term === 'short' ? 'short' : 'long',
    washSaleLossDisallowed: num(r.wash_sale_loss_disallowed),
  }));

  const retRes = await db.query<any>(
    'SELECT * FROM retirement_income WHERE return_id = $1 ORDER BY payer',
    [id]
  );
  const retirementIncome: RetirementIncome[] = retRes.rows.map((r) => ({
    id: r.id,
    payer: r.payer,
    grossDistribution: num(r.gross_distribution),
    taxableAmount: num(r.taxable_amount),
    federalWithheld: num(r.federal_withheld),
    stateWithheld: num(r.state_withheld),
    distributionCode: r.distribution_code,
    isIra: !!r.is_ira,
    isRoth: !!r.is_roth,
    exceptionCode: r.exception_code,
    taxableAmountNotDetermined: !!r.taxable_amount_not_determined,
  }));

  const ssRes = await db.query<any>(
    'SELECT * FROM social_security_benefits WHERE return_id = $1',
    [id]
  );
  const ssRow = ssRes.rows[0];
  const socialSecurity: SocialSecurityBenefits = {
    grossBenefits: num(ssRow?.gross_benefits),
    medicarePremiums: num(ssRow?.medicare_premiums),
    federalWithheld: num(ssRow?.federal_withheld),
  };

  const unRes = await db.query<any>(
    'SELECT * FROM unemployment_income WHERE return_id = $1 ORDER BY payer',
    [id]
  );
  const unemployment: UnemploymentIncome[] = unRes.rows.map((r) => ({
    id: r.id,
    payer: r.payer,
    amount: num(r.amount),
    federalWithheld: num(r.federal_withheld),
  }));

  const gbRes = await db.query<any>(
    'SELECT * FROM gambling_winnings WHERE return_id = $1 ORDER BY payer',
    [id]
  );
  const gambling: GamblingWinnings[] = gbRes.rows.map((r) => ({
    id: r.id,
    payer: r.payer,
    winnings: num(r.winnings),
    federalWithheld: num(r.federal_withheld),
  }));

  const oiRes = await db.query<any>(
    'SELECT * FROM other_income WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const otherIncome: OtherIncome[] = oiRes.rows.map((r) => ({
    id: r.id,
    source: r.source,
    description: r.description,
    amount: num(r.amount),
  }));

  const rentalRes = await db.query<any>(
    'SELECT * FROM schedule_e_rental WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const scheduleERentals: ScheduleERental[] = rentalRes.rows.map((r) => ({
    id: r.id,
    propertyAddress: r.property_address,
    propertyType: r.property_type,
    fairRentalDays: num(r.fair_rental_days),
    personalUseDays: num(r.personal_use_days),
    rentsReceived: num(r.rents_received),
    expenses: r.expenses,
    activeParticipation: !!r.active_participation,
    isPassive: !!r.is_passive,
    priorYearUnallowedLoss: num(r.prior_year_unallowed_loss),
  }));

  const royaltyRes = await db.query<any>(
    'SELECT * FROM schedule_e_royalty WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const scheduleERoyalties: ScheduleERoyalty[] = royaltyRes.rows.map((r) => ({
    id: r.id,
    source: r.source,
    grossRoyalties: num(r.gross_royalties),
    expenses: num(r.expenses),
  }));

  const k1Res = await db.query<any>(
    'SELECT * FROM k1_income WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const k1s: K1Income[] = k1Res.rows.map((r) => ({
    id: r.id,
    entityKind:
      r.entity_kind === 's_corp' || r.entity_kind === 'trust' ? r.entity_kind : 'partnership',
    entityName: r.entity_name,
    ein: r.ein,
    isPassive: !!r.is_passive,
    ordinaryBusinessIncome: num(r.ordinary_business_income),
    netRentalRealEstate: num(r.net_rental_real_estate),
    otherRentalIncome: num(r.other_rental_income),
    interestIncome: num(r.interest_income),
    ordinaryDividends: num(r.ordinary_dividends),
    qualifiedDividends: num(r.qualified_dividends),
    royalties: num(r.royalties),
    shortTermCapitalGain: num(r.short_term_capital_gain),
    longTermCapitalGain: num(r.long_term_capital_gain),
    section1231Gain: num(r.section_1231_gain),
    priorYearUnallowedLoss: num(r.prior_year_unallowed_loss),
  }));

  const farmRes = await db.query<any>(
    'SELECT * FROM schedule_f_farm WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const farms: ScheduleFFarm[] = farmRes.rows.map((r) => ({
    id: r.id,
    farmName: r.farm_name,
    principalProduct: r.principal_product,
    accountingMethod: r.accounting_method === 'accrual' ? 'accrual' : 'cash',
    grossIncome: num(r.gross_income),
    expenses: r.expenses,
  }));

  const f4797Res = await db.query<any>(
    'SELECT * FROM form_4797_sales WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const form4797Sales: Form4797Sale[] = f4797Res.rows.map((r) => ({
    id: r.id,
    description: r.description,
    dateAcquired: isoDate(r.date_acquired),
    dateSold: isoDate(r.date_sold),
    proceeds: num(r.proceeds),
    costBasis: num(r.cost_basis),
    accumulatedDepreciation: num(r.accumulated_depreciation),
    depreciationRecapture: num(r.depreciation_recapture),
    term: r.term === 'short_ordinary' ? 'short_ordinary' : 'long_1231',
  }));

  const depAssetRes = await db.query<any>(
    'SELECT * FROM depreciation_assets WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const depreciationAssets: DepreciationAsset[] = depAssetRes.rows.map((r) => ({
    id: r.id,
    description: r.description,
    datePlacedInService: isoDate(r.date_placed_in_service),
    cost: num(r.cost),
    macrsClass: (r.macrs_class ?? '5') as MacrsClass,
    section179Election: num(r.section_179_election),
    claimBonus: !!r.claim_bonus,
    businessUsePercent: num(r.business_use_percent),
    businessId: r.business_id,
  }));

  const hoRes = await db.query<any>(
    'SELECT * FROM home_office_expenses WHERE return_id = $1 ORDER BY created_at',
    [id]
  );
  const homeOffices: HomeOfficeExpense[] = hoRes.rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    useSimplified: !!r.use_simplified,
    squareFeet: num(r.square_feet),
    totalHomeSquareFeet: num(r.total_home_square_feet),
    utilities: num(r.utilities),
    insurance: num(r.insurance),
    mortgageInterest: num(r.mortgage_interest),
    realEstateTax: num(r.real_estate_tax),
    repairs: num(r.repairs),
    depreciation: num(r.depreciation),
  }));

  const s1Res = await db.query<any>(
    'SELECT * FROM schedule_1_adjustments WHERE return_id = $1',
    [id]
  );
  const s1Row = s1Res.rows[0];
  const schedule1Adjustments: Schedule1Adjustments = {
    educatorExpenses: num(s1Row?.educator_expenses),
    hsaDeduction: num(s1Row?.hsa_deduction),
    selfEmployedHealthInsurance: num(s1Row?.self_employed_health_insurance),
    sepContribution: num(s1Row?.sep_contribution),
    simpleContribution: num(s1Row?.simple_contribution),
    solo401kContribution: num(s1Row?.solo401k_contribution),
    traditionalIraDeduction: num(s1Row?.traditional_ira_deduction),
    studentLoanInterest: num(s1Row?.student_loan_interest),
    penaltyEarlyWithdrawal: num(s1Row?.penalty_early_withdrawal),
    alimonyPaid: num(s1Row?.alimony_paid),
    alimonyRecipientSsn: s1Row?.alimony_recipient_ssn ?? null,
    alimonyDivorceDate: isoDate(s1Row?.alimony_divorce_date),
    reservistExpenses: num(s1Row?.reservist_expenses),
    performingArtistExpenses: num(s1Row?.performing_artist_expenses),
    feeBasisExpenses: num(s1Row?.fee_basis_expenses),
  };

  const f8606Res = await db.query<any>('SELECT * FROM form_8606 WHERE return_id = $1', [id]);
  const f8606Row = f8606Res.rows[0];
  const form8606: Form8606 = {
    priorYearBasis: num(f8606Row?.prior_year_basis),
    currentYearNondeductible: num(f8606Row?.current_year_nondeductible),
    traditionalIraBalance: num(f8606Row?.traditional_ira_balance),
    distributions: num(f8606Row?.distributions),
    conversions: num(f8606Row?.conversions),
  };

  const f8889Res = await db.query<any>('SELECT * FROM form_8889 WHERE return_id = $1', [id]);
  const f8889Row = f8889Res.rows[0];
  const form8889: Form8889 = {
    coverage: ((f8889Row?.coverage === 'self' || f8889Row?.coverage === 'family')
      ? f8889Row.coverage
      : 'none') as HsaCoverage,
    contributions: num(f8889Row?.contributions),
    isCatchUpEligible: !!f8889Row?.is_catch_up_eligible,
    distributions: num(f8889Row?.distributions),
    qualifiedMedicalExpenses: num(f8889Row?.qualified_medical_expenses),
    isDisabledOrOver65: !!f8889Row?.is_disabled_or_over65,
  };

  const f2441Res = await db.query<any>('SELECT * FROM form_2441 WHERE return_id = $1', [id]);
  const f2441Row = f2441Res.rows[0];
  const form2441: Form2441 = {
    totalQualifiedExpenses: num(f2441Row?.total_qualified_expenses),
    numQualifyingPersons: Number(f2441Row?.num_qualifying_persons ?? 0),
    taxpayerEarnedIncome: num(f2441Row?.taxpayer_earned_income),
    spouseEarnedIncome: num(f2441Row?.spouse_earned_income),
    employerProvidedBenefits: num(f2441Row?.employer_provided_benefits),
  };

  const f8863Res = await db.query<any>(
    'SELECT * FROM form_8863_students WHERE return_id = $1 ORDER BY id',
    [id]
  );
  const form8863Students: Form8863Student[] = f8863Res.rows.map((r) => ({
    id: r.id,
    studentName: r.student_name ?? '',
    studentSsnLast4: r.student_ssn_last4 ?? null,
    creditType: (r.credit_type === 'llc' ? 'llc' : 'aotc') as EducationCreditType,
    qualifiedExpenses: num(r.qualified_expenses),
    isEligibleForAotc: !!r.is_eligible_for_aotc,
    priorAotcYears: Number(r.prior_aotc_years ?? 0),
  }));

  const f8880Res = await db.query<any>('SELECT * FROM form_8880 WHERE return_id = $1', [id]);
  const f8880Row = f8880Res.rows[0];
  const form8880: Form8880 = {
    elective401kDeferrals: num(f8880Row?.elective_401k_deferrals),
    iraContributions: num(f8880Row?.ira_contributions),
    spouseElective401kDeferrals: num(f8880Row?.spouse_elective_401k_deferrals),
    spouseIraContributions: num(f8880Row?.spouse_ira_contributions),
    distributionsReceived: num(f8880Row?.distributions_received),
  };

  const sRRes = await db.query<any>('SELECT * FROM schedule_r WHERE return_id = $1', [id]);
  const sRRow = sRRes.rows[0];
  const scheduleR: ScheduleR = {
    isTaxpayerEligible: !!sRRow?.is_taxpayer_eligible,
    isSpouseEligible: !!sRRow?.is_spouse_eligible,
    taxpayerUnder65Disabled: !!sRRow?.taxpayer_under65_disabled,
    spouseUnder65Disabled: !!sRRow?.spouse_under65_disabled,
    disabilityIncome: num(sRRow?.disability_income),
    nontaxableSsAndPension: num(sRRow?.nontaxable_ss_and_pension),
  };

  const f8396Res = await db.query<any>('SELECT * FROM form_8396 WHERE return_id = $1', [id]);
  const f8396Row = f8396Res.rows[0];
  const form8396: Form8396 = {
    certificateRate: num(f8396Row?.certificate_rate),
    mortgageInterestPaid: num(f8396Row?.mortgage_interest_paid),
    priorYearUnusedCredit: num(f8396Row?.prior_year_unused_credit),
  };

  const f5695Res = await db.query<any>('SELECT * FROM form_5695 WHERE return_id = $1', [id]);
  const f5695Row = f5695Res.rows[0];
  const form5695: Form5695 = {
    solarElectric: num(f5695Row?.solar_electric),
    solarWaterHeating: num(f5695Row?.solar_water_heating),
    windEnergy: num(f5695Row?.wind_energy),
    geothermalHeatPump: num(f5695Row?.geothermal_heat_pump),
    biomassFuel: num(f5695Row?.biomass_fuel),
    batteryStorageTech: num(f5695Row?.battery_storage_tech),
    fuelCellCost: num(f5695Row?.fuel_cell_cost),
    fuelCellKw: num(f5695Row?.fuel_cell_kw),
    insulationAirSealing: num(f5695Row?.insulation_air_sealing),
    exteriorWindows: num(f5695Row?.exterior_windows),
    exteriorDoors: num(f5695Row?.exterior_doors),
    homeEnergyAudit: num(f5695Row?.home_energy_audit),
    heatPumps: num(f5695Row?.heat_pumps),
    biomassStoves: num(f5695Row?.biomass_stoves),
    centralAc: num(f5695Row?.central_ac),
    furnaceBoiler: num(f5695Row?.furnace_boiler),
  };

  const f8936Res = await db.query<any>(
    'SELECT * FROM form_8936_vehicles WHERE return_id = $1 ORDER BY id',
    [id]
  );
  const form8936Vehicles: Form8936Vehicle[] = f8936Res.rows.map((r) => ({
    id: r.id,
    make: r.make ?? '',
    model: r.model ?? '',
    year: Number(r.year ?? 0),
    vin: r.vin ?? null,
    placedInService: isoDate(r.placed_in_service),
    isNew: !!r.is_new,
    purchasePrice: num(r.purchase_price),
    businessUsePercent: num(r.business_use_percent),
    userEnteredCredit: num(r.user_entered_credit),
  }));

  const f1116Res = await db.query<any>(
    'SELECT * FROM form_1116_baskets WHERE return_id = $1 ORDER BY id',
    [id]
  );
  const form1116Baskets: Form1116Basket[] = f1116Res.rows.map((r) => ({
    id: r.id,
    category: (r.category === 'general' ? 'general' : 'passive') as Form1116Category,
    country: r.country ?? '',
    foreignGrossIncome: num(r.foreign_gross_income),
    definitelyRelatedDeductions: num(r.definitely_related_deductions),
    foreignTaxPaid: num(r.foreign_tax_paid),
  }));

  const s8812Res = await db.query<any>('SELECT * FROM schedule_8812 WHERE return_id = $1', [id]);
  const s8812Row = s8812Res.rows[0];
  const schedule8812: Schedule8812Input = {
    qualifyingChildrenOverride:
      s8812Row?.qualifying_children_override == null
        ? null
        : Number(s8812Row.qualifying_children_override),
    earnedIncomeOverride:
      s8812Row?.earned_income_override == null
        ? null
        : num(s8812Row.earned_income_override),
    includeCombatPay: !!s8812Row?.include_combat_pay,
    combatPayAmount: num(s8812Row?.combat_pay_amount),
  };

  const eitcRes = await db.query<any>('SELECT * FROM eitc_eligibility WHERE return_id = $1', [id]);
  const eitcRow = eitcRes.rows[0];
  const eitcEligibility: EitcEligibility = {
    qualifyingChildrenOverride:
      eitcRow?.qualifying_children_override == null
        ? null
        : Number(eitcRow.qualifying_children_override),
    investmentIncomeOverride:
      eitcRow?.investment_income_override == null
        ? null
        : num(eitcRow.investment_income_override),
    isEligibleAge: eitcRow ? !!eitcRow.is_eligible_age : true,
    includeCombatPay: !!eitcRow?.include_combat_pay,
    combatPayAmount: num(eitcRow?.combat_pay_amount),
  };

  const f8962Res = await db.query<any>('SELECT * FROM form_8962 WHERE return_id = $1', [id]);
  const f8962Row = f8962Res.rows[0];
  const form8962: Form8962 = {
    householdSize: Number(f8962Row?.household_size ?? 0),
    federalPovertyLine: num(f8962Row?.federal_poverty_line),
    annualEnrollmentPremium: num(f8962Row?.annual_enrollment_premium),
    annualSlcsp: num(f8962Row?.annual_slcsp),
    advancePtcPaid: num(f8962Row?.advance_ptc_paid),
    additionalMagi: num(f8962Row?.additional_magi),
  };

  const f6251Res = await db.query<any>('SELECT * FROM form_6251 WHERE return_id = $1', [id]);
  const f6251Row = f6251Res.rows[0];
  const form6251: Form6251 = {
    privateActivityBondInterest: num(f6251Row?.private_activity_bond_interest),
    amtDepreciationAdjustment: num(f6251Row?.amt_depreciation_adjustment),
    otherAdjustments: num(f6251Row?.other_adjustments),
    amtNolCarryforward: num(f6251Row?.amt_nol_carryforward),
  };

  const f8960Res = await db.query<any>('SELECT * FROM form_8960 WHERE return_id = $1', [id]);
  const f8960Row = f8960Res.rows[0];
  const form8960: Form8960 = {
    investmentInterestExpense: num(f8960Row?.investment_interest_expense),
    stateTaxAllocableToInvestment: num(f8960Row?.state_tax_allocable_to_investment),
    miscInvestmentExpenses: num(f8960Row?.misc_investment_expenses),
    otherModifications: num(f8960Row?.other_modifications),
  };

  const f8959Res = await db.query<any>('SELECT * FROM form_8959 WHERE return_id = $1', [id]);
  const f8959Row = f8959Res.rows[0];
  const form8959: Form8959 = {
    rrtaCompensation: num(f8959Row?.rrta_compensation),
    additionalMedicareWithheld: num(f8959Row?.additional_medicare_withheld),
  };

  // Phase 10 single-row forms
  const f2555Res = await db.query<any>('SELECT * FROM form_2555 WHERE return_id = $1', [id]);
  const f2555Row = f2555Res.rows[0];
  const form2555: Form2555 = {
    foreignEarnedIncome: num(f2555Row?.foreign_earned_income),
    qualifyingDays: Number(f2555Row?.qualifying_days ?? 0),
    totalDaysInPeriod: Number(f2555Row?.total_days_in_period ?? 365),
    housingExpenses: num(f2555Row?.housing_expenses),
    isBonaFideResident: !!f2555Row?.is_bona_fide_resident,
    usesPhysicalPresence: !!f2555Row?.uses_physical_presence,
  };

  const schHRes = await db.query<any>('SELECT * FROM schedule_h WHERE return_id = $1', [id]);
  const schHRow = schHRes.rows[0];
  const scheduleH: ScheduleH = {
    cashWagesSsMedicare: num(schHRow?.cash_wages_ss_medicare),
    cashWagesFuta: num(schHRow?.cash_wages_futa),
    anyQuarterOver1000: !!schHRow?.any_quarter_over_1000,
    federalIncomeTaxWithheld: num(schHRow?.federal_income_tax_withheld),
    stateUnemploymentPaid: num(schHRow?.state_unemployment_paid),
  };

  const f2210Res = await db.query<any>('SELECT * FROM form_2210 WHERE return_id = $1', [id]);
  const f2210Row = f2210Res.rows[0];
  const form2210: Form2210 = {
    priorYearTax: num(f2210Row?.prior_year_tax),
    priorYearAgi: num(f2210Row?.prior_year_agi),
    withholdingByQuarter: [
      num(f2210Row?.withholding_q1),
      num(f2210Row?.withholding_q2),
      num(f2210Row?.withholding_q3),
      num(f2210Row?.withholding_q4),
    ],
    estimatedPaymentsByQuarter: [
      num(f2210Row?.estimated_payments_q1),
      num(f2210Row?.estimated_payments_q2),
      num(f2210Row?.estimated_payments_q3),
      num(f2210Row?.estimated_payments_q4),
    ],
    requestWaiver: !!f2210Row?.request_waiver,
  };

  const f5405Res = await db.query<any>('SELECT * FROM form_5405 WHERE return_id = $1', [id]);
  const f5405Row = f5405Res.rows[0];
  const form5405: Form5405 = {
    annualInstallment: num(f5405Row?.annual_installment),
    dispositionAccelerated: num(f5405Row?.disposition_accelerated),
  };

  const f4972Res = await db.query<any>('SELECT * FROM form_4972 WHERE return_id = $1', [id]);
  const f4972Row = f4972Res.rows[0];
  const form4972: Form4972 = {
    qualifyingLumpSum: num(f4972Row?.qualifying_lump_sum),
    capitalGainPortion: num(f4972Row?.capital_gain_portion),
    ordinaryPortion: num(f4972Row?.ordinary_portion),
    computedTax: num(f4972Row?.computed_tax),
  };

  const f8995Res = await db.query<any>('SELECT * FROM form_8995 WHERE return_id = $1', [id]);
  const f8995Row = f8995Res.rows[0];
  const f8995ActRes = await db.query<any>(
    'SELECT * FROM form_8995_activities WHERE return_id = $1 ORDER BY id',
    [id]
  );
  const f8995Activities: QbiActivity[] = f8995ActRes.rows.map((r) => ({
    id: r.id,
    name: r.name ?? null,
    ein: r.ein ?? null,
    qbi: num(r.qbi),
    isSstb: !!r.is_sstb,
    w2Wages: num(r.w2_wages),
    ubia: num(r.ubia),
  }));
  const form8995: Form8995 | undefined =
    f8995Row || f8995Activities.length > 0
      ? {
          activities: f8995Activities,
          reitPtpDividends: num(f8995Row?.reit_ptp_dividends),
          priorYearQbiLossCarry: num(f8995Row?.prior_year_qbi_loss_carry),
          priorYearReitPtpLossCarry: num(f8995Row?.prior_year_reit_ptp_loss_carry),
        }
      : undefined;

  const itRes = await db.query<any>('SELECT * FROM itemized_deductions WHERE return_id = $1', [id]);
  const itRow = itRes.rows[0];
  const itemized: ItemizedDeductions = {
    medical: num(itRow?.medical),
    stateLocalTax: num(itRow?.state_local_tax),
    realEstateTax: num(itRow?.real_estate_tax),
    mortgageInterest: num(itRow?.mortgage_interest),
    charitableCash: num(itRow?.charitable_cash),
    charitableNoncash: num(itRow?.charitable_noncash),
  };

  return {
    id: row.id,
    taxYear: row.tax_year,
    filingStatus: row.filing_status,
    status: row.status,
    personalInfo,
    dependents,
    w2s,
    interest,
    dividends,
    selfEmployment,
    capitalGains,
    retirementIncome,
    socialSecurity,
    unemployment,
    gambling,
    gamblingLosses: num(row.gambling_losses),
    otherIncome,
    scheduleERentals,
    scheduleERoyalties,
    k1s,
    farms,
    form4797Sales,
    depreciationAssets,
    homeOffices,
    schedule1Adjustments,
    form8606,
    form8889,
    form2441,
    form8863Students,
    form8880,
    scheduleR,
    form8396,
    form5695,
    form8936Vehicles,
    form1116Baskets,
    schedule8812,
    eitcEligibility,
    form8962,
    form6251,
    form8960,
    form8959,
    form2555,
    scheduleH,
    form2210,
    form5405,
    form4972,
    form8995,
    itemized,
    useStandardDeduction: !!row.use_standard_deduction,
    estimatedPayments: num(row.estimated_payments),
    priorYearShortTermLossCarryforward: num(row.prior_year_st_loss_carryforward),
    priorYearLongTermLossCarryforward: num(row.prior_year_lt_loss_carryforward),
    // Phase 0: empty Schedule 1/2/3 scaffolding. Later phases load real
    // fields here as forms are added.
    schedule1: {},
    schedule2: {},
    schedule3: {},
    updatedAt: row.updated_at,
  };
}

// ----- Routes -----

// List all returns for the current user (so the client can build a year switcher).
router.get('/list', async (req, res, next) => {
  try {
    const db = await getDb();
    const r = await db.query<{ tax_year: number; status: string; updated_at: string }>(
      'SELECT tax_year, status, updated_at FROM tax_returns WHERE user_id = $1 ORDER BY tax_year DESC',
      [req.userId!]
    );
    res.json(r.rows.map((row) => ({
      taxYear: Number(row.tax_year),
      status: row.status,
      updatedAt: row.updated_at,
    })));
  } catch (err) {
    next(err);
  }
});

// Also expose the list of configured years so the client can offer new-return options.
router.get('/available-years', async (_req, res, next) => {
  try {
    const configs = await listConfigs();
    res.json(configs.map((c) => c.taxYear));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const full = await loadFullReturn(row);
    res.json(full);
  } catch (err) {
    next(err);
  }
});

router.get('/compute', async (req, res, next) => {
  try {
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const full = await loadFullReturn(row);
    const constants = await getConfig(year);
    if (!constants) {
      res.status(503).json({ error: 'year_not_configured', taxYear: year });
      return;
    }
    // Task #49: read prior-year carryforwards as fallback for any
    // TaxReturn-level fields the user hasn't explicitly populated, run
    // compute, then persist the new end-of-year carryforwards.
    const { computeReturnWithCarryforwards } = await import('../services/tax/index.js');
    const computed = await computeReturnWithCarryforwards(req.userId!, full, constants);
    res.json(computed);
  } catch (err) {
    next(err);
  }
});

// --- Meta: filing status, deduction choice, estimated payments ---

const metaSchema = z.object({
  filingStatus: z.enum(['single', 'mfj', 'mfs', 'hoh', 'qw']).nullable().optional(),
  useStandardDeduction: z.boolean().optional(),
  estimatedPayments: z.number().nonnegative().optional(),
  gamblingLosses: z.number().nonnegative().optional(),
  // IRC §1212(b) prior-year capital-loss carryforwards (Pub 550 worksheet).
  // Stored as positive magnitudes.
  priorYearShortTermLossCarryforward: z.number().nonnegative().optional(),
  priorYearLongTermLossCarryforward: z.number().nonnegative().optional(),
});

router.put('/meta', async (req, res, next) => {
  try {
    const body = metaSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (body.filingStatus !== undefined) {
      sets.push(`filing_status = $${i++}`);
      vals.push(body.filingStatus);
    }
    if (body.useStandardDeduction !== undefined) {
      sets.push(`use_standard_deduction = $${i++}`);
      vals.push(body.useStandardDeduction);
    }
    if (body.estimatedPayments !== undefined) {
      sets.push(`estimated_payments = $${i++}`);
      vals.push(body.estimatedPayments);
    }
    if (body.gamblingLosses !== undefined) {
      sets.push(`gambling_losses = $${i++}`);
      vals.push(body.gamblingLosses);
    }
    if (body.priorYearShortTermLossCarryforward !== undefined) {
      sets.push(`prior_year_st_loss_carryforward = $${i++}`);
      vals.push(body.priorYearShortTermLossCarryforward);
    }
    if (body.priorYearLongTermLossCarryforward !== undefined) {
      sets.push(`prior_year_lt_loss_carryforward = $${i++}`);
      vals.push(body.priorYearLongTermLossCarryforward);
    }
    sets.push(`updated_at = now()`);
    if (sets.length > 1) {
      vals.push(row.id);
      await db.query(`UPDATE tax_returns SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Personal info ---

const personalInfoSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  ssn: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  spouseFirstName: z.string().nullable().optional(),
  spouseLastName: z.string().nullable().optional(),
  spouseSsn: z.string().nullable().optional(),
  spouseDob: z.string().nullable().optional(),
});

router.put('/personal-info', async (req, res, next) => {
  try {
    const body = personalInfoSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();

    // Fetch existing to preserve encrypted SSNs unless a new one is supplied.
    const existing = await db.query<any>(
      'SELECT ssn_encrypted, spouse_ssn_encrypted FROM personal_info WHERE return_id = $1',
      [row.id]
    );
    const prev = existing.rows[0] || {};

    const ssnEnc = body.ssn ? encryptField(body.ssn.replace(/\D/g, '')) : prev.ssn_encrypted ?? null;
    const ssnL4 = body.ssn ? last4(body.ssn) : undefined;
    const spouseEnc = body.spouseSsn
      ? encryptField(body.spouseSsn.replace(/\D/g, ''))
      : prev.spouse_ssn_encrypted ?? null;
    const spouseL4 = body.spouseSsn ? last4(body.spouseSsn) : undefined;

    await db.query(
      `INSERT INTO personal_info (
         return_id, first_name, last_name, ssn_encrypted, ssn_last4, dob,
         address_line1, address_line2, city, state, zip,
         spouse_first_name, spouse_last_name, spouse_ssn_encrypted, spouse_ssn_last4, spouse_dob
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (return_id) DO UPDATE SET
         first_name = COALESCE(EXCLUDED.first_name, personal_info.first_name),
         last_name = COALESCE(EXCLUDED.last_name, personal_info.last_name),
         ssn_encrypted = EXCLUDED.ssn_encrypted,
         ssn_last4 = COALESCE(EXCLUDED.ssn_last4, personal_info.ssn_last4),
         dob = COALESCE(EXCLUDED.dob, personal_info.dob),
         address_line1 = COALESCE(EXCLUDED.address_line1, personal_info.address_line1),
         address_line2 = COALESCE(EXCLUDED.address_line2, personal_info.address_line2),
         city = COALESCE(EXCLUDED.city, personal_info.city),
         state = COALESCE(EXCLUDED.state, personal_info.state),
         zip = COALESCE(EXCLUDED.zip, personal_info.zip),
         spouse_first_name = COALESCE(EXCLUDED.spouse_first_name, personal_info.spouse_first_name),
         spouse_last_name = COALESCE(EXCLUDED.spouse_last_name, personal_info.spouse_last_name),
         spouse_ssn_encrypted = EXCLUDED.spouse_ssn_encrypted,
         spouse_ssn_last4 = COALESCE(EXCLUDED.spouse_ssn_last4, personal_info.spouse_ssn_last4),
         spouse_dob = COALESCE(EXCLUDED.spouse_dob, personal_info.spouse_dob)`,
      [
        row.id,
        body.firstName ?? null,
        body.lastName ?? null,
        ssnEnc,
        ssnL4 ?? null,
        body.dob || null,
        body.addressLine1 ?? null,
        body.addressLine2 ?? null,
        body.city ?? null,
        body.state ?? null,
        body.zip ?? null,
        body.spouseFirstName ?? null,
        body.spouseLastName ?? null,
        spouseEnc,
        spouseL4 ?? null,
        body.spouseDob || null,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Dependents (full list replace) ---

const dependentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ssn: z.string().nullable().optional(),
  relationship: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  isQualifyingChild: z.boolean().optional(),
});

router.put('/dependents', async (req, res, next) => {
  try {
    const list = z.array(dependentSchema).parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query('DELETE FROM dependents WHERE return_id = $1', [row.id]);
    for (const d of list) {
      await db.query(
        `INSERT INTO dependents (id, return_id, name, ssn_encrypted, ssn_last4, relationship, dob, is_qualifying_child)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          d.id || newId(),
          row.id,
          d.name,
          d.ssn ? encryptField(d.ssn.replace(/\D/g, '')) : null,
          last4(d.ssn ?? null),
          d.relationship ?? null,
          d.dob || null,
          d.isQualifyingChild ?? true,
        ]
      );
    }
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Helper for list-replace endpoints (w2, interest, dividends, se, capgains)
async function replaceList<T>(
  req: Request,
  res: Response,
  table: string,
  schema: z.ZodType<T>,
  insertSql: string,
  toParams: (item: T, id: string, returnId: string) => any[]
) {
  const list = z.array(schema).parse(req.body);
  const year = await resolveYear(req.userId!, parseYear(req.query.year));
  const row = await getOrCreateReturn(req.userId!, year);
  const db = await getDb();
  await db.query(`DELETE FROM ${table} WHERE return_id = $1`, [row.id]);
  for (const item of list) {
    const id = (item as any).id || newId();
    await db.query(insertSql, toParams(item, id, row.id));
  }
  await touchReturn(row.id);
  res.json({ ok: true });
}

// --- W-2 ---

const w2Schema = z.object({
  id: z.string().optional(),
  employer: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  box1Wages: z.number().default(0),
  box2FedWithheld: z.number().default(0),
  box3SsWages: z.number().default(0),
  box4SsWithheld: z.number().default(0),
  box5MedicareWages: z.number().default(0),
  box6MedicareWithheld: z.number().default(0),
  stateWages: z.number().default(0),
  stateWithheld: z.number().default(0),
});

router.put('/w2', async (req, res, next) => {
  try {
    await replaceList(
      req,
      res,
      'w2_income',
      w2Schema,
      `INSERT INTO w2_income (id, return_id, employer, ein, box1_wages, box2_fed_withheld,
         box3_ss_wages, box4_ss_withheld, box5_medicare_wages, box6_medicare_withheld,
         state_wages, state_withheld)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      (w, id, rid) => [
        id, rid, w.employer ?? null, w.ein ?? null,
        w.box1Wages, w.box2FedWithheld, w.box3SsWages, w.box4SsWithheld,
        w.box5MedicareWages, w.box6MedicareWithheld, w.stateWages, w.stateWithheld,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Interest (Sched B) ---

const interestSchema = z.object({
  id: z.string().optional(),
  payer: z.string().nullable().optional(),
  amount: z.number().default(0),
  taxExempt: z.boolean().default(false),
  privateActivityBondInterest: z.number().nonnegative().optional().default(0),
});

router.put('/interest', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'interest_income', interestSchema,
      'INSERT INTO interest_income (id, return_id, payer, amount, tax_exempt, private_activity_bond_interest) VALUES ($1,$2,$3,$4,$5,$6)',
      (i, id, rid) => [id, rid, i.payer ?? null, i.amount, i.taxExempt, i.privateActivityBondInterest]
    );
  } catch (err) {
    next(err);
  }
});

// --- Dividends (Sched B) ---

const dividendSchema = z.object({
  id: z.string().optional(),
  payer: z.string().nullable().optional(),
  ordinary: z.number().default(0),
  qualified: z.number().default(0),
  // 1099-DIV boxes 2a / 2b / 2c (see DividendIncome doc comments).
  totalCapGainDistributions: z.number().default(0),
  unrecapSection1250Gain: z.number().default(0),
  section1202Gain: z.number().default(0),
});

router.put('/dividends', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'dividend_income', dividendSchema,
      `INSERT INTO dividend_income
         (id, return_id, payer, ordinary, qualified,
          total_cap_gain_distributions, unrecap_section_1250_gain, section_1202_gain)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      (d, id, rid) => [
        id,
        rid,
        d.payer ?? null,
        d.ordinary,
        d.qualified,
        d.totalCapGainDistributions,
        d.unrecapSection1250Gain,
        d.section1202Gain,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Self-employment (Sched C) ---

const seSchema = z.object({
  id: z.string().optional(),
  businessName: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  principalActivity: z.string().nullable().optional(),
  grossReceipts: z.number().default(0),
  returnsAllowances: z.number().default(0),
  costOfGoods: z.number().default(0),
  expenses: z.record(z.string(), z.number()).default({}),
});

router.put('/self-employment', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'self_employment', seSchema,
      `INSERT INTO self_employment
         (id, return_id, business_name, ein, principal_activity, gross_receipts,
          returns_allowances, cost_of_goods, expenses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      (s, id, rid) => [
        id, rid,
        s.businessName ?? null,
        s.ein ?? null,
        s.principalActivity ?? null,
        s.grossReceipts,
        s.returnsAllowances,
        s.costOfGoods,
        JSON.stringify(s.expenses),
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Capital gains (Sched D) ---

const cgSchema = z.object({
  id: z.string().optional(),
  description: z.string().nullable().optional(),
  dateAcquired: z.string().nullable().optional(),
  dateSold: z.string().nullable().optional(),
  proceeds: z.number().default(0),
  costBasis: z.number().default(0),
  term: z.enum(['short', 'long']).default('long'),
  // Form 8949 column (g) wash-sale loss disallowed (IRC §1091). Non-negative.
  washSaleLossDisallowed: z.number().nonnegative().default(0),
});

router.put('/capital-gains', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'capital_gains', cgSchema,
      `INSERT INTO capital_gains
         (id, return_id, description, date_acquired, date_sold, proceeds, cost_basis, term, wash_sale_loss_disallowed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      (c, id, rid) => [
        id, rid,
        c.description ?? null,
        c.dateAcquired || null,
        c.dateSold || null,
        c.proceeds,
        c.costBasis,
        c.term,
        c.washSaleLossDisallowed,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Retirement distributions (1099-R) ---

const retirementSchema = z.object({
  id: z.string().optional(),
  payer: z.string().nullable().optional(),
  grossDistribution: z.number().default(0),
  taxableAmount: z.number().default(0),
  federalWithheld: z.number().default(0),
  stateWithheld: z.number().default(0),
  distributionCode: z.string().nullable().optional(),
  isIra: z.boolean().default(false),
  isRoth: z.boolean().default(false),
  exceptionCode: z.string().nullable().optional(),
  taxableAmountNotDetermined: z.boolean().default(false),
});

router.put('/retirement-income', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'retirement_income', retirementSchema,
      `INSERT INTO retirement_income
         (id, return_id, payer, gross_distribution, taxable_amount,
          federal_withheld, state_withheld, distribution_code,
          is_ira, is_roth, exception_code, taxable_amount_not_determined)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      (r, id, rid) => [
        id, rid,
        r.payer ?? null,
        r.grossDistribution,
        r.taxableAmount,
        r.federalWithheld,
        r.stateWithheld,
        r.distributionCode ?? null,
        r.isIra,
        r.isRoth,
        r.exceptionCode ?? null,
        r.taxableAmountNotDetermined,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Social Security benefits (single row) ---

const ssSchema = z.object({
  grossBenefits: z.number().default(0),
  medicarePremiums: z.number().default(0),
  federalWithheld: z.number().default(0),
});

router.put('/social-security', async (req, res, next) => {
  try {
    const body = ssSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO social_security_benefits
         (return_id, gross_benefits, medicare_premiums, federal_withheld)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (return_id) DO UPDATE SET
           gross_benefits = EXCLUDED.gross_benefits,
           medicare_premiums = EXCLUDED.medicare_premiums,
           federal_withheld = EXCLUDED.federal_withheld`,
      [row.id, body.grossBenefits, body.medicarePremiums, body.federalWithheld]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Unemployment (1099-G) ---

const unemploymentSchema = z.object({
  id: z.string().optional(),
  payer: z.string().nullable().optional(),
  amount: z.number().default(0),
  federalWithheld: z.number().default(0),
});

router.put('/unemployment', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'unemployment_income', unemploymentSchema,
      `INSERT INTO unemployment_income (id, return_id, payer, amount, federal_withheld)
         VALUES ($1,$2,$3,$4,$5)`,
      (u, id, rid) => [id, rid, u.payer ?? null, u.amount, u.federalWithheld]
    );
  } catch (err) {
    next(err);
  }
});

// --- Gambling winnings (W-2G) ---

const gamblingSchema = z.object({
  id: z.string().optional(),
  payer: z.string().nullable().optional(),
  winnings: z.number().default(0),
  federalWithheld: z.number().default(0),
});

router.put('/gambling', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'gambling_winnings', gamblingSchema,
      `INSERT INTO gambling_winnings (id, return_id, payer, winnings, federal_withheld)
         VALUES ($1,$2,$3,$4,$5)`,
      (g, id, rid) => [id, rid, g.payer ?? null, g.winnings, g.federalWithheld]
    );
  } catch (err) {
    next(err);
  }
});

// --- Other income (Sched 1 line 8) ---

const otherIncomeSchema = z.object({
  id: z.string().optional(),
  source: z.enum([
    '1099misc_box3', 'jury_duty', 'scholarship_taxable',
    'hobby', 'alimony_received', 'other',
  ]).default('other'),
  description: z.string().nullable().optional(),
  amount: z.number().default(0),
});

router.put('/other-income', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'other_income', otherIncomeSchema,
      `INSERT INTO other_income (id, return_id, source, description, amount)
         VALUES ($1,$2,$3,$4,$5)`,
      (o, id, rid) => [id, rid, o.source, o.description ?? null, o.amount]
    );
  } catch (err) {
    next(err);
  }
});

// --- Schedule E: rental real estate ---

const rentalSchema = z.object({
  id: z.string().optional(),
  propertyAddress: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  fairRentalDays: z.number().default(0),
  personalUseDays: z.number().default(0),
  rentsReceived: z.number().default(0),
  expenses: z.record(z.string(), z.number()).default({}),
  activeParticipation: z.boolean().optional(),
  isPassive: z.boolean().optional(),
  priorYearUnallowedLoss: z.number().default(0),
});

router.put('/schedule-e-rental', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'schedule_e_rental', rentalSchema,
      `INSERT INTO schedule_e_rental
         (id, return_id, property_address, property_type, fair_rental_days,
          personal_use_days, rents_received, expenses,
          active_participation, is_passive, prior_year_unallowed_loss)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      (r, id, rid) => [
        id, rid,
        r.propertyAddress ?? null,
        r.propertyType ?? null,
        r.fairRentalDays,
        r.personalUseDays,
        r.rentsReceived,
        JSON.stringify(r.expenses),
        r.activeParticipation ?? true,
        r.isPassive ?? true,
        r.priorYearUnallowedLoss,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Schedule E: royalties ---

const royaltySchema = z.object({
  id: z.string().optional(),
  source: z.string().nullable().optional(),
  grossRoyalties: z.number().default(0),
  expenses: z.number().default(0),
});

router.put('/schedule-e-royalty', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'schedule_e_royalty', royaltySchema,
      `INSERT INTO schedule_e_royalty (id, return_id, source, gross_royalties, expenses)
         VALUES ($1,$2,$3,$4,$5)`,
      (r, id, rid) => [id, rid, r.source ?? null, r.grossRoyalties, r.expenses]
    );
  } catch (err) {
    next(err);
  }
});

// --- K-1 (partnership / S-corp / trust) ---

const k1Schema = z.object({
  id: z.string().optional(),
  entityKind: z.enum(['partnership', 's_corp', 'trust']).default('partnership'),
  entityName: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  isPassive: z.boolean().optional(),
  ordinaryBusinessIncome: z.number().default(0),
  netRentalRealEstate: z.number().default(0),
  otherRentalIncome: z.number().default(0),
  interestIncome: z.number().default(0),
  ordinaryDividends: z.number().default(0),
  qualifiedDividends: z.number().default(0),
  royalties: z.number().default(0),
  shortTermCapitalGain: z.number().default(0),
  longTermCapitalGain: z.number().default(0),
  section1231Gain: z.number().default(0),
  priorYearUnallowedLoss: z.number().default(0),
});

router.put('/k1-income', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'k1_income', k1Schema,
      `INSERT INTO k1_income
         (id, return_id, entity_kind, entity_name, ein, is_passive,
          ordinary_business_income, net_rental_real_estate, other_rental_income,
          interest_income, ordinary_dividends, qualified_dividends, royalties,
          short_term_capital_gain, long_term_capital_gain, section_1231_gain,
          prior_year_unallowed_loss)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      (k, id, rid) => [
        id, rid,
        k.entityKind,
        k.entityName ?? null,
        k.ein ?? null,
        k.isPassive ?? true,
        k.ordinaryBusinessIncome,
        k.netRentalRealEstate,
        k.otherRentalIncome,
        k.interestIncome,
        k.ordinaryDividends,
        k.qualifiedDividends,
        k.royalties,
        k.shortTermCapitalGain,
        k.longTermCapitalGain,
        k.section1231Gain,
        k.priorYearUnallowedLoss,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Schedule F (farms) ---

const farmSchema = z.object({
  id: z.string().optional(),
  farmName: z.string().nullable().optional(),
  principalProduct: z.string().nullable().optional(),
  accountingMethod: z.enum(['cash', 'accrual']).default('cash'),
  grossIncome: z.number().default(0),
  expenses: z.record(z.string(), z.number()).default({}),
});

router.put('/schedule-f-farm', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'schedule_f_farm', farmSchema,
      `INSERT INTO schedule_f_farm
         (id, return_id, farm_name, principal_product, accounting_method,
          gross_income, expenses)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      (f, id, rid) => [
        id, rid,
        f.farmName ?? null,
        f.principalProduct ?? null,
        f.accountingMethod,
        f.grossIncome,
        JSON.stringify(f.expenses),
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Form 4797 business property sales ---

const form4797Schema = z.object({
  id: z.string().optional(),
  description: z.string().nullable().optional(),
  dateAcquired: z.string().nullable().optional(),
  dateSold: z.string().nullable().optional(),
  proceeds: z.number().default(0),
  costBasis: z.number().default(0),
  accumulatedDepreciation: z.number().default(0),
  depreciationRecapture: z.number().default(0),
  term: z.enum(['long_1231', 'short_ordinary']).default('long_1231'),
});

router.put('/form-4797', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'form_4797_sales', form4797Schema,
      `INSERT INTO form_4797_sales
         (id, return_id, description, date_acquired, date_sold,
          proceeds, cost_basis, accumulated_depreciation,
          depreciation_recapture, term)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      (s, id, rid) => [
        id, rid,
        s.description ?? null,
        s.dateAcquired || null,
        s.dateSold || null,
        s.proceeds,
        s.costBasis,
        s.accumulatedDepreciation,
        s.depreciationRecapture,
        s.term,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Form 4562 depreciation assets ---

const depAssetSchema = z.object({
  id: z.string().optional(),
  description: z.string().nullable().optional(),
  datePlacedInService: z.string().nullable().optional(),
  cost: z.number().default(0),
  macrsClass: z.enum([
    '3', '5', '7', '10', '15', '20', '27.5', '39', 'straight_line',
  ]).default('5'),
  section179Election: z.number().default(0),
  claimBonus: z.boolean().default(false),
  businessUsePercent: z.number().default(1),
  businessId: z.string().nullable().optional(),
});

router.put('/depreciation-assets', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'depreciation_assets', depAssetSchema,
      `INSERT INTO depreciation_assets
         (id, return_id, description, date_placed_in_service, cost, macrs_class,
          section_179_election, claim_bonus, business_use_percent, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      (a, id, rid) => [
        id, rid,
        a.description ?? null,
        a.datePlacedInService || null,
        a.cost,
        a.macrsClass,
        a.section179Election,
        a.claimBonus,
        a.businessUsePercent,
        a.businessId ?? null,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Form 8829 home office expenses ---

const homeOfficeSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().nullable().optional(),
  useSimplified: z.boolean().optional(),
  squareFeet: z.number().default(0),
  totalHomeSquareFeet: z.number().default(0),
  utilities: z.number().default(0),
  insurance: z.number().default(0),
  mortgageInterest: z.number().default(0),
  realEstateTax: z.number().default(0),
  repairs: z.number().default(0),
  depreciation: z.number().default(0),
});

router.put('/home-offices', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'home_office_expenses', homeOfficeSchema,
      `INSERT INTO home_office_expenses
         (id, return_id, business_id, use_simplified, square_feet,
          total_home_square_feet, utilities, insurance, mortgage_interest,
          real_estate_tax, repairs, depreciation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      (h, id, rid) => [
        id, rid,
        h.businessId ?? null,
        h.useSimplified ?? true,
        h.squareFeet,
        h.totalHomeSquareFeet,
        h.utilities,
        h.insurance,
        h.mortgageInterest,
        h.realEstateTax,
        h.repairs,
        h.depreciation,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Itemized deductions (single row) ---

const itemizedSchema = z.object({
  medical: z.number().default(0),
  stateLocalTax: z.number().default(0),
  realEstateTax: z.number().default(0),
  mortgageInterest: z.number().default(0),
  charitableCash: z.number().default(0),
  charitableNoncash: z.number().default(0),
});

router.put('/itemized', async (req, res, next) => {
  try {
    const body = itemizedSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO itemized_deductions
         (return_id, medical, state_local_tax, real_estate_tax, mortgage_interest,
          charitable_cash, charitable_noncash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (return_id) DO UPDATE SET
           medical = EXCLUDED.medical,
           state_local_tax = EXCLUDED.state_local_tax,
           real_estate_tax = EXCLUDED.real_estate_tax,
           mortgage_interest = EXCLUDED.mortgage_interest,
           charitable_cash = EXCLUDED.charitable_cash,
           charitable_noncash = EXCLUDED.charitable_noncash`,
      [
        row.id, body.medical, body.stateLocalTax, body.realEstateTax,
        body.mortgageInterest, body.charitableCash, body.charitableNoncash,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 6: Schedule 1 adjustments (single row) ---

const schedule1AdjustmentsSchema = z.object({
  educatorExpenses: z.number().default(0),
  hsaDeduction: z.number().default(0),
  selfEmployedHealthInsurance: z.number().default(0),
  sepContribution: z.number().default(0),
  simpleContribution: z.number().default(0),
  solo401kContribution: z.number().default(0),
  traditionalIraDeduction: z.number().default(0),
  studentLoanInterest: z.number().default(0),
  penaltyEarlyWithdrawal: z.number().default(0),
  alimonyPaid: z.number().default(0),
  alimonyRecipientSsn: z.string().nullable().optional(),
  alimonyDivorceDate: z.string().nullable().optional(),
  reservistExpenses: z.number().default(0),
  performingArtistExpenses: z.number().default(0),
  feeBasisExpenses: z.number().default(0),
});

router.put('/schedule-1-adjustments', async (req, res, next) => {
  try {
    const body = schedule1AdjustmentsSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO schedule_1_adjustments
         (return_id, educator_expenses, hsa_deduction, self_employed_health_insurance,
          sep_contribution, simple_contribution, solo401k_contribution,
          traditional_ira_deduction, student_loan_interest, penalty_early_withdrawal,
          alimony_paid, alimony_recipient_ssn, alimony_divorce_date,
          reservist_expenses, performing_artist_expenses, fee_basis_expenses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (return_id) DO UPDATE SET
           educator_expenses = EXCLUDED.educator_expenses,
           hsa_deduction = EXCLUDED.hsa_deduction,
           self_employed_health_insurance = EXCLUDED.self_employed_health_insurance,
           sep_contribution = EXCLUDED.sep_contribution,
           simple_contribution = EXCLUDED.simple_contribution,
           solo401k_contribution = EXCLUDED.solo401k_contribution,
           traditional_ira_deduction = EXCLUDED.traditional_ira_deduction,
           student_loan_interest = EXCLUDED.student_loan_interest,
           penalty_early_withdrawal = EXCLUDED.penalty_early_withdrawal,
           alimony_paid = EXCLUDED.alimony_paid,
           alimony_recipient_ssn = EXCLUDED.alimony_recipient_ssn,
           alimony_divorce_date = EXCLUDED.alimony_divorce_date,
           reservist_expenses = EXCLUDED.reservist_expenses,
           performing_artist_expenses = EXCLUDED.performing_artist_expenses,
           fee_basis_expenses = EXCLUDED.fee_basis_expenses,
           updated_at = now()`,
      [
        row.id,
        body.educatorExpenses,
        body.hsaDeduction,
        body.selfEmployedHealthInsurance,
        body.sepContribution,
        body.simpleContribution,
        body.solo401kContribution,
        body.traditionalIraDeduction,
        body.studentLoanInterest,
        body.penaltyEarlyWithdrawal,
        body.alimonyPaid,
        body.alimonyRecipientSsn ?? null,
        body.alimonyDivorceDate || null,
        body.reservistExpenses,
        body.performingArtistExpenses,
        body.feeBasisExpenses,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 6: Form 8606 (single row) ---

const form8606Schema = z.object({
  priorYearBasis: z.number().default(0),
  currentYearNondeductible: z.number().default(0),
  traditionalIraBalance: z.number().default(0),
  distributions: z.number().default(0),
  conversions: z.number().default(0),
});

router.put('/form-8606', async (req, res, next) => {
  try {
    const body = form8606Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8606
         (return_id, prior_year_basis, current_year_nondeductible,
          traditional_ira_balance, distributions, conversions)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (return_id) DO UPDATE SET
           prior_year_basis = EXCLUDED.prior_year_basis,
           current_year_nondeductible = EXCLUDED.current_year_nondeductible,
           traditional_ira_balance = EXCLUDED.traditional_ira_balance,
           distributions = EXCLUDED.distributions,
           conversions = EXCLUDED.conversions,
           updated_at = now()`,
      [
        row.id,
        body.priorYearBasis,
        body.currentYearNondeductible,
        body.traditionalIraBalance,
        body.distributions,
        body.conversions,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 6: Form 8889 HSA (single row) ---

const form8889Schema = z.object({
  coverage: z.enum(['none', 'self', 'family']).default('none'),
  contributions: z.number().default(0),
  isCatchUpEligible: z.boolean().default(false),
  distributions: z.number().default(0),
  qualifiedMedicalExpenses: z.number().default(0),
  isDisabledOrOver65: z.boolean().default(false),
});

router.put('/form-8889', async (req, res, next) => {
  try {
    const body = form8889Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8889
         (return_id, coverage, contributions, is_catch_up_eligible,
          distributions, qualified_medical_expenses, is_disabled_or_over65)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (return_id) DO UPDATE SET
           coverage = EXCLUDED.coverage,
           contributions = EXCLUDED.contributions,
           is_catch_up_eligible = EXCLUDED.is_catch_up_eligible,
           distributions = EXCLUDED.distributions,
           qualified_medical_expenses = EXCLUDED.qualified_medical_expenses,
           is_disabled_or_over65 = EXCLUDED.is_disabled_or_over65,
           updated_at = now()`,
      [
        row.id,
        body.coverage,
        body.contributions,
        body.isCatchUpEligible,
        body.distributions,
        body.qualifiedMedicalExpenses,
        body.isDisabledOrOver65,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 2441 Child & Dependent Care (single row) ---

const form2441Schema = z.object({
  totalQualifiedExpenses: z.number().default(0),
  numQualifyingPersons: z.number().int().nonnegative().default(0),
  taxpayerEarnedIncome: z.number().default(0),
  spouseEarnedIncome: z.number().default(0),
  employerProvidedBenefits: z.number().default(0),
});

router.put('/form-2441', async (req, res, next) => {
  try {
    const body = form2441Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_2441
         (return_id, total_qualified_expenses, num_qualifying_persons,
          taxpayer_earned_income, spouse_earned_income, employer_provided_benefits)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (return_id) DO UPDATE SET
           total_qualified_expenses = EXCLUDED.total_qualified_expenses,
           num_qualifying_persons = EXCLUDED.num_qualifying_persons,
           taxpayer_earned_income = EXCLUDED.taxpayer_earned_income,
           spouse_earned_income = EXCLUDED.spouse_earned_income,
           employer_provided_benefits = EXCLUDED.employer_provided_benefits,
           updated_at = now()`,
      [
        row.id,
        body.totalQualifiedExpenses,
        body.numQualifyingPersons,
        body.taxpayerEarnedIncome,
        body.spouseEarnedIncome,
        body.employerProvidedBenefits,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 8863 Education Credits (list of students) ---

const form8863StudentSchema = z.object({
  id: z.string().optional(),
  studentName: z.string().default(''),
  studentSsnLast4: z.string().nullable().optional(),
  creditType: z.enum(['aotc', 'llc']).default('aotc'),
  qualifiedExpenses: z.number().default(0),
  isEligibleForAotc: z.boolean().default(false),
  priorAotcYears: z.number().int().nonnegative().default(0),
});

router.put('/form-8863-students', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'form_8863_students', form8863StudentSchema,
      `INSERT INTO form_8863_students
         (id, return_id, student_name, student_ssn_last4, credit_type,
          qualified_expenses, is_eligible_for_aotc, prior_aotc_years)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      (s, id, rid) => [
        id, rid,
        s.studentName,
        s.studentSsnLast4 ?? null,
        s.creditType,
        s.qualifiedExpenses,
        s.isEligibleForAotc,
        s.priorAotcYears,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 8880 Saver's Credit (single row) ---

const form8880Schema = z.object({
  elective401kDeferrals: z.number().default(0),
  iraContributions: z.number().default(0),
  spouseElective401kDeferrals: z.number().default(0),
  spouseIraContributions: z.number().default(0),
  distributionsReceived: z.number().default(0),
});

router.put('/form-8880', async (req, res, next) => {
  try {
    const body = form8880Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8880
         (return_id, elective_401k_deferrals, ira_contributions,
          spouse_elective_401k_deferrals, spouse_ira_contributions, distributions_received)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (return_id) DO UPDATE SET
           elective_401k_deferrals = EXCLUDED.elective_401k_deferrals,
           ira_contributions = EXCLUDED.ira_contributions,
           spouse_elective_401k_deferrals = EXCLUDED.spouse_elective_401k_deferrals,
           spouse_ira_contributions = EXCLUDED.spouse_ira_contributions,
           distributions_received = EXCLUDED.distributions_received,
           updated_at = now()`,
      [
        row.id,
        body.elective401kDeferrals,
        body.iraContributions,
        body.spouseElective401kDeferrals,
        body.spouseIraContributions,
        body.distributionsReceived,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Schedule R Elderly/Disabled Credit (single row) ---

const scheduleRSchema = z.object({
  isTaxpayerEligible: z.boolean().default(false),
  isSpouseEligible: z.boolean().default(false),
  taxpayerUnder65Disabled: z.boolean().default(false),
  spouseUnder65Disabled: z.boolean().default(false),
  disabilityIncome: z.number().default(0),
  nontaxableSsAndPension: z.number().default(0),
});

router.put('/schedule-r', async (req, res, next) => {
  try {
    const body = scheduleRSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO schedule_r
         (return_id, is_taxpayer_eligible, is_spouse_eligible,
          taxpayer_under65_disabled, spouse_under65_disabled,
          disability_income, nontaxable_ss_and_pension)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (return_id) DO UPDATE SET
           is_taxpayer_eligible = EXCLUDED.is_taxpayer_eligible,
           is_spouse_eligible = EXCLUDED.is_spouse_eligible,
           taxpayer_under65_disabled = EXCLUDED.taxpayer_under65_disabled,
           spouse_under65_disabled = EXCLUDED.spouse_under65_disabled,
           disability_income = EXCLUDED.disability_income,
           nontaxable_ss_and_pension = EXCLUDED.nontaxable_ss_and_pension,
           updated_at = now()`,
      [
        row.id,
        body.isTaxpayerEligible,
        body.isSpouseEligible,
        body.taxpayerUnder65Disabled,
        body.spouseUnder65Disabled,
        body.disabilityIncome,
        body.nontaxableSsAndPension,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 8396 Mortgage Interest Credit (single row) ---

const form8396Schema = z.object({
  certificateRate: z.number().default(0),
  mortgageInterestPaid: z.number().default(0),
  priorYearUnusedCredit: z.number().default(0),
});

router.put('/form-8396', async (req, res, next) => {
  try {
    const body = form8396Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8396
         (return_id, certificate_rate, mortgage_interest_paid, prior_year_unused_credit)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (return_id) DO UPDATE SET
           certificate_rate = EXCLUDED.certificate_rate,
           mortgage_interest_paid = EXCLUDED.mortgage_interest_paid,
           prior_year_unused_credit = EXCLUDED.prior_year_unused_credit,
           updated_at = now()`,
      [
        row.id,
        body.certificateRate,
        body.mortgageInterestPaid,
        body.priorYearUnusedCredit,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 5695 Residential Energy (single row) ---

const form5695Schema = z.object({
  solarElectric: z.number().default(0),
  solarWaterHeating: z.number().default(0),
  windEnergy: z.number().default(0),
  geothermalHeatPump: z.number().default(0),
  biomassFuel: z.number().default(0),
  batteryStorageTech: z.number().default(0),
  fuelCellCost: z.number().default(0),
  fuelCellKw: z.number().default(0),
  insulationAirSealing: z.number().default(0),
  exteriorWindows: z.number().default(0),
  exteriorDoors: z.number().default(0),
  homeEnergyAudit: z.number().default(0),
  heatPumps: z.number().default(0),
  biomassStoves: z.number().default(0),
  centralAc: z.number().default(0),
  furnaceBoiler: z.number().default(0),
});

router.put('/form-5695', async (req, res, next) => {
  try {
    const body = form5695Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_5695
         (return_id, solar_electric, solar_water_heating, wind_energy,
          geothermal_heat_pump, biomass_fuel, battery_storage_tech,
          fuel_cell_cost, fuel_cell_kw, insulation_air_sealing,
          exterior_windows, exterior_doors, home_energy_audit,
          heat_pumps, biomass_stoves, central_ac, furnace_boiler)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (return_id) DO UPDATE SET
           solar_electric = EXCLUDED.solar_electric,
           solar_water_heating = EXCLUDED.solar_water_heating,
           wind_energy = EXCLUDED.wind_energy,
           geothermal_heat_pump = EXCLUDED.geothermal_heat_pump,
           biomass_fuel = EXCLUDED.biomass_fuel,
           battery_storage_tech = EXCLUDED.battery_storage_tech,
           fuel_cell_cost = EXCLUDED.fuel_cell_cost,
           fuel_cell_kw = EXCLUDED.fuel_cell_kw,
           insulation_air_sealing = EXCLUDED.insulation_air_sealing,
           exterior_windows = EXCLUDED.exterior_windows,
           exterior_doors = EXCLUDED.exterior_doors,
           home_energy_audit = EXCLUDED.home_energy_audit,
           heat_pumps = EXCLUDED.heat_pumps,
           biomass_stoves = EXCLUDED.biomass_stoves,
           central_ac = EXCLUDED.central_ac,
           furnace_boiler = EXCLUDED.furnace_boiler,
           updated_at = now()`,
      [
        row.id,
        body.solarElectric,
        body.solarWaterHeating,
        body.windEnergy,
        body.geothermalHeatPump,
        body.biomassFuel,
        body.batteryStorageTech,
        body.fuelCellCost,
        body.fuelCellKw,
        body.insulationAirSealing,
        body.exteriorWindows,
        body.exteriorDoors,
        body.homeEnergyAudit,
        body.heatPumps,
        body.biomassStoves,
        body.centralAc,
        body.furnaceBoiler,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 8936 Clean Vehicle Credit (list of vehicles) ---

const form8936VehicleSchema = z.object({
  id: z.string().optional(),
  make: z.string().default(''),
  model: z.string().default(''),
  year: z.number().int().default(0),
  vin: z.string().nullable().optional(),
  placedInService: z.string().nullable().optional(),
  isNew: z.boolean().default(true),
  purchasePrice: z.number().default(0),
  businessUsePercent: z.number().default(0),
  userEnteredCredit: z.number().default(0),
});

router.put('/form-8936-vehicles', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'form_8936_vehicles', form8936VehicleSchema,
      `INSERT INTO form_8936_vehicles
         (id, return_id, make, model, year, vin, placed_in_service, is_new,
          purchase_price, business_use_percent, user_entered_credit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      (v, id, rid) => [
        id, rid,
        v.make,
        v.model,
        v.year,
        v.vin ?? null,
        v.placedInService || null,
        v.isNew,
        v.purchasePrice,
        v.businessUsePercent,
        v.userEnteredCredit,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Phase 7: Form 1116 Foreign Tax Credit (list of baskets) ---

const form1116BasketSchema = z.object({
  id: z.string().optional(),
  category: z.enum(['passive', 'general']).default('passive'),
  country: z.string().default(''),
  foreignGrossIncome: z.number().default(0),
  definitelyRelatedDeductions: z.number().default(0),
  foreignTaxPaid: z.number().default(0),
});

router.put('/form-1116-baskets', async (req, res, next) => {
  try {
    await replaceList(
      req, res, 'form_1116_baskets', form1116BasketSchema,
      `INSERT INTO form_1116_baskets
         (id, return_id, category, country, foreign_gross_income,
          definitely_related_deductions, foreign_tax_paid)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      (b, id, rid) => [
        id, rid,
        b.category,
        b.country,
        b.foreignGrossIncome,
        b.definitelyRelatedDeductions,
        b.foreignTaxPaid,
      ]
    );
  } catch (err) {
    next(err);
  }
});

// --- Phase 8: Schedule 8812 (refundable CTC / ACTC) single-row ---

const schedule8812Schema = z.object({
  qualifyingChildrenOverride: z.number().int().min(0).nullable().optional(),
  earnedIncomeOverride: z.number().min(0).nullable().optional(),
  includeCombatPay: z.boolean().default(false),
  combatPayAmount: z.number().min(0).default(0),
});

router.put('/schedule-8812', async (req, res, next) => {
  try {
    const body = schedule8812Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO schedule_8812
         (return_id, qualifying_children_override, earned_income_override,
          include_combat_pay, combat_pay_amount)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (return_id) DO UPDATE SET
           qualifying_children_override = EXCLUDED.qualifying_children_override,
           earned_income_override = EXCLUDED.earned_income_override,
           include_combat_pay = EXCLUDED.include_combat_pay,
           combat_pay_amount = EXCLUDED.combat_pay_amount,
           updated_at = now()`,
      [
        row.id,
        body.qualifyingChildrenOverride ?? null,
        body.earnedIncomeOverride ?? null,
        body.includeCombatPay,
        body.combatPayAmount,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 8: EITC eligibility single-row ---

const eitcEligibilitySchema = z.object({
  qualifyingChildrenOverride: z.number().int().min(0).nullable().optional(),
  investmentIncomeOverride: z.number().min(0).nullable().optional(),
  isEligibleAge: z.boolean().default(true),
  includeCombatPay: z.boolean().default(false),
  combatPayAmount: z.number().min(0).default(0),
});

router.put('/eitc-eligibility', async (req, res, next) => {
  try {
    const body = eitcEligibilitySchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO eitc_eligibility
         (return_id, qualifying_children_override, investment_income_override,
          is_eligible_age, include_combat_pay, combat_pay_amount)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (return_id) DO UPDATE SET
           qualifying_children_override = EXCLUDED.qualifying_children_override,
           investment_income_override = EXCLUDED.investment_income_override,
           is_eligible_age = EXCLUDED.is_eligible_age,
           include_combat_pay = EXCLUDED.include_combat_pay,
           combat_pay_amount = EXCLUDED.combat_pay_amount,
           updated_at = now()`,
      [
        row.id,
        body.qualifyingChildrenOverride ?? null,
        body.investmentIncomeOverride ?? null,
        body.isEligibleAge,
        body.includeCombatPay,
        body.combatPayAmount,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 8: Form 8962 Premium Tax Credit single-row ---

const form8962Schema = z.object({
  householdSize: z.number().int().min(0).default(0),
  federalPovertyLine: z.number().min(0).default(0),
  annualEnrollmentPremium: z.number().min(0).default(0),
  annualSlcsp: z.number().min(0).default(0),
  advancePtcPaid: z.number().min(0).default(0),
  additionalMagi: z.number().min(0).default(0),
});

router.put('/form-8962', async (req, res, next) => {
  try {
    const body = form8962Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8962
         (return_id, household_size, federal_poverty_line,
          annual_enrollment_premium, annual_slcsp, advance_ptc_paid,
          additional_magi)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (return_id) DO UPDATE SET
           household_size = EXCLUDED.household_size,
           federal_poverty_line = EXCLUDED.federal_poverty_line,
           annual_enrollment_premium = EXCLUDED.annual_enrollment_premium,
           annual_slcsp = EXCLUDED.annual_slcsp,
           advance_ptc_paid = EXCLUDED.advance_ptc_paid,
           additional_magi = EXCLUDED.additional_magi,
           updated_at = now()`,
      [
        row.id,
        body.householdSize,
        body.federalPovertyLine,
        body.annualEnrollmentPremium,
        body.annualSlcsp,
        body.advancePtcPaid,
        body.additionalMagi,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 9: Form 6251 AMT single-row ---

const form6251Schema = z.object({
  privateActivityBondInterest: z.number().default(0),
  amtDepreciationAdjustment: z.number().default(0),
  otherAdjustments: z.number().default(0),
  amtNolCarryforward: z.number().min(0).default(0),
});

router.put('/form-6251', async (req, res, next) => {
  try {
    const body = form6251Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_6251
         (return_id, private_activity_bond_interest, amt_depreciation_adjustment,
          other_adjustments, amt_nol_carryforward)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (return_id) DO UPDATE SET
           private_activity_bond_interest = EXCLUDED.private_activity_bond_interest,
           amt_depreciation_adjustment = EXCLUDED.amt_depreciation_adjustment,
           other_adjustments = EXCLUDED.other_adjustments,
           amt_nol_carryforward = EXCLUDED.amt_nol_carryforward,
           updated_at = now()`,
      [
        row.id,
        body.privateActivityBondInterest,
        body.amtDepreciationAdjustment,
        body.otherAdjustments,
        body.amtNolCarryforward,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 9: Form 8960 NIIT single-row ---

const form8960Schema = z.object({
  investmentInterestExpense: z.number().min(0).default(0),
  stateTaxAllocableToInvestment: z.number().min(0).default(0),
  miscInvestmentExpenses: z.number().min(0).default(0),
  otherModifications: z.number().default(0),
});

router.put('/form-8960', async (req, res, next) => {
  try {
    const body = form8960Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8960
         (return_id, investment_interest_expense, state_tax_allocable_to_investment,
          misc_investment_expenses, other_modifications)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (return_id) DO UPDATE SET
           investment_interest_expense = EXCLUDED.investment_interest_expense,
           state_tax_allocable_to_investment = EXCLUDED.state_tax_allocable_to_investment,
           misc_investment_expenses = EXCLUDED.misc_investment_expenses,
           other_modifications = EXCLUDED.other_modifications,
           updated_at = now()`,
      [
        row.id,
        body.investmentInterestExpense,
        body.stateTaxAllocableToInvestment,
        body.miscInvestmentExpenses,
        body.otherModifications,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 9: Form 8959 Additional Medicare Tax single-row ---

const form8959Schema = z.object({
  rrtaCompensation: z.number().min(0).default(0),
  additionalMedicareWithheld: z.number().min(0).default(0),
});

router.put('/form-8959', async (req, res, next) => {
  try {
    const body = form8959Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_8959
         (return_id, rrta_compensation, additional_medicare_withheld)
         VALUES ($1,$2,$3)
         ON CONFLICT (return_id) DO UPDATE SET
           rrta_compensation = EXCLUDED.rrta_compensation,
           additional_medicare_withheld = EXCLUDED.additional_medicare_withheld,
           updated_at = now()`,
      [
        row.id,
        body.rrtaCompensation,
        body.additionalMedicareWithheld,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 10: Form 2555 FEIE single-row ---

const form2555Schema = z.object({
  foreignEarnedIncome: z.number().min(0).default(0),
  qualifyingDays: z.number().int().min(0).max(366).default(0),
  totalDaysInPeriod: z.number().int().min(1).max(366).default(365),
  housingExpenses: z.number().min(0).default(0),
  isBonaFideResident: z.boolean().default(false),
  usesPhysicalPresence: z.boolean().default(false),
});

router.put('/form-2555', async (req, res, next) => {
  try {
    const body = form2555Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_2555
         (return_id, foreign_earned_income, qualifying_days, total_days_in_period,
          housing_expenses, is_bona_fide_resident, uses_physical_presence)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (return_id) DO UPDATE SET
           foreign_earned_income = EXCLUDED.foreign_earned_income,
           qualifying_days = EXCLUDED.qualifying_days,
           total_days_in_period = EXCLUDED.total_days_in_period,
           housing_expenses = EXCLUDED.housing_expenses,
           is_bona_fide_resident = EXCLUDED.is_bona_fide_resident,
           uses_physical_presence = EXCLUDED.uses_physical_presence,
           updated_at = now()`,
      [
        row.id,
        body.foreignEarnedIncome,
        body.qualifyingDays,
        body.totalDaysInPeriod,
        body.housingExpenses,
        body.isBonaFideResident,
        body.usesPhysicalPresence,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 10: Schedule H household employment single-row ---

const scheduleHSchema = z.object({
  cashWagesSsMedicare: z.number().min(0).default(0),
  cashWagesFuta: z.number().min(0).default(0),
  anyQuarterOver1000: z.boolean().default(false),
  federalIncomeTaxWithheld: z.number().min(0).default(0),
  stateUnemploymentPaid: z.number().min(0).default(0),
});

router.put('/schedule-h', async (req, res, next) => {
  try {
    const body = scheduleHSchema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO schedule_h
         (return_id, cash_wages_ss_medicare, cash_wages_futa, any_quarter_over_1000,
          federal_income_tax_withheld, state_unemployment_paid)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (return_id) DO UPDATE SET
           cash_wages_ss_medicare = EXCLUDED.cash_wages_ss_medicare,
           cash_wages_futa = EXCLUDED.cash_wages_futa,
           any_quarter_over_1000 = EXCLUDED.any_quarter_over_1000,
           federal_income_tax_withheld = EXCLUDED.federal_income_tax_withheld,
           state_unemployment_paid = EXCLUDED.state_unemployment_paid,
           updated_at = now()`,
      [
        row.id,
        body.cashWagesSsMedicare,
        body.cashWagesFuta,
        body.anyQuarterOver1000,
        body.federalIncomeTaxWithheld,
        body.stateUnemploymentPaid,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 10: Form 2210 underpayment single-row ---

const form2210Schema = z.object({
  priorYearTax: z.number().min(0).default(0),
  priorYearAgi: z.number().min(0).default(0),
  withholdingByQuarter: z.tuple([
    z.number().min(0),
    z.number().min(0),
    z.number().min(0),
    z.number().min(0),
  ]).default([0, 0, 0, 0]),
  estimatedPaymentsByQuarter: z.tuple([
    z.number().min(0),
    z.number().min(0),
    z.number().min(0),
    z.number().min(0),
  ]).default([0, 0, 0, 0]),
  requestWaiver: z.boolean().default(false),
});

router.put('/form-2210', async (req, res, next) => {
  try {
    const body = form2210Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_2210
         (return_id, prior_year_tax, prior_year_agi,
          withholding_q1, withholding_q2, withholding_q3, withholding_q4,
          estimated_payments_q1, estimated_payments_q2, estimated_payments_q3, estimated_payments_q4,
          request_waiver)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (return_id) DO UPDATE SET
           prior_year_tax = EXCLUDED.prior_year_tax,
           prior_year_agi = EXCLUDED.prior_year_agi,
           withholding_q1 = EXCLUDED.withholding_q1,
           withholding_q2 = EXCLUDED.withholding_q2,
           withholding_q3 = EXCLUDED.withholding_q3,
           withholding_q4 = EXCLUDED.withholding_q4,
           estimated_payments_q1 = EXCLUDED.estimated_payments_q1,
           estimated_payments_q2 = EXCLUDED.estimated_payments_q2,
           estimated_payments_q3 = EXCLUDED.estimated_payments_q3,
           estimated_payments_q4 = EXCLUDED.estimated_payments_q4,
           request_waiver = EXCLUDED.request_waiver,
           updated_at = now()`,
      [
        row.id,
        body.priorYearTax,
        body.priorYearAgi,
        body.withholdingByQuarter[0],
        body.withholdingByQuarter[1],
        body.withholdingByQuarter[2],
        body.withholdingByQuarter[3],
        body.estimatedPaymentsByQuarter[0],
        body.estimatedPaymentsByQuarter[1],
        body.estimatedPaymentsByQuarter[2],
        body.estimatedPaymentsByQuarter[3],
        body.requestWaiver,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 10: Form 5405 FTHB credit repayment single-row ---

const form5405Schema = z.object({
  annualInstallment: z.number().min(0).default(0),
  dispositionAccelerated: z.number().min(0).default(0),
});

router.put('/form-5405', async (req, res, next) => {
  try {
    const body = form5405Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_5405
         (return_id, annual_installment, disposition_accelerated)
         VALUES ($1,$2,$3)
         ON CONFLICT (return_id) DO UPDATE SET
           annual_installment = EXCLUDED.annual_installment,
           disposition_accelerated = EXCLUDED.disposition_accelerated,
           updated_at = now()`,
      [row.id, body.annualInstallment, body.dispositionAccelerated]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Phase 10: Form 4972 lump-sum averaging single-row ---

const form4972Schema = z.object({
  qualifyingLumpSum: z.number().min(0).default(0),
  capitalGainPortion: z.number().min(0).default(0),
  ordinaryPortion: z.number().min(0).default(0),
  computedTax: z.number().min(0).default(0),
});

router.put('/form-4972', async (req, res, next) => {
  try {
    const body = form4972Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();
    await db.query(
      `INSERT INTO form_4972
         (return_id, qualifying_lump_sum, capital_gain_portion, ordinary_portion, computed_tax)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (return_id) DO UPDATE SET
           qualifying_lump_sum = EXCLUDED.qualifying_lump_sum,
           capital_gain_portion = EXCLUDED.capital_gain_portion,
           ordinary_portion = EXCLUDED.ordinary_portion,
           computed_tax = EXCLUDED.computed_tax,
           updated_at = now()`,
      [
        row.id,
        body.qualifyingLumpSum,
        body.capitalGainPortion,
        body.ordinaryPortion,
        body.computedTax,
      ]
    );
    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Form 8995 (§199A QBI deduction — simplified) ---
//
// Scalars live on a single-row `form_8995` companion table; activities are
// a child list stored in `form_8995_activities`. The PUT endpoint accepts
// both in one payload and applies them atomically (delete + re-insert for
// activities, upsert for scalars).

const form8995ActivitySchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  qbi: z.number(),
  isSstb: z.boolean().default(false),
  w2Wages: z.number().min(0).default(0),
  ubia: z.number().min(0).default(0),
});

const form8995Schema = z.object({
  activities: z.array(form8995ActivitySchema).default([]),
  reitPtpDividends: z.number().default(0),
  priorYearQbiLossCarry: z.number().min(0).default(0),
  priorYearReitPtpLossCarry: z.number().min(0).default(0),
});

router.put('/form-8995', async (req, res, next) => {
  try {
    const body = form8995Schema.parse(req.body);
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const row = await getOrCreateReturn(req.userId!, year);
    const db = await getDb();

    await db.query(
      `INSERT INTO form_8995
         (return_id, reit_ptp_dividends, prior_year_qbi_loss_carry, prior_year_reit_ptp_loss_carry)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (return_id) DO UPDATE SET
           reit_ptp_dividends = EXCLUDED.reit_ptp_dividends,
           prior_year_qbi_loss_carry = EXCLUDED.prior_year_qbi_loss_carry,
           prior_year_reit_ptp_loss_carry = EXCLUDED.prior_year_reit_ptp_loss_carry,
           updated_at = now()`,
      [
        row.id,
        body.reitPtpDividends,
        body.priorYearQbiLossCarry,
        body.priorYearReitPtpLossCarry,
      ]
    );

    await db.query('DELETE FROM form_8995_activities WHERE return_id = $1', [row.id]);
    for (const a of body.activities) {
      await db.query(
        `INSERT INTO form_8995_activities
           (id, return_id, name, ein, qbi, is_sstb, w2_wages, ubia)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          a.id ?? newId(),
          row.id,
          a.name ?? null,
          a.ein ?? null,
          a.qbi,
          a.isSstb,
          a.w2Wages,
          a.ubia,
        ]
      );
    }

    await touchReturn(row.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ----- Cross-year carryforwards (Task #49) -----
//
// GET /api/return/carryforwards?year=YYYY
//   Returns every carryforward row APPLIED AGAINST year YYYY
//   (i.e. rows where tax_year = YYYY; these are amounts written at the
//   end of year YYYY-1). Dashboard uses this to show "you have $X of
//   carryforwards available this year" without recomputing the prior
//   year from scratch.
//
// The internal write path for end-of-year carryforwards happens inside
// the compute orchestrator (see server/services/tax/index.ts).

router.get('/carryforwards', async (req, res, next) => {
  try {
    const year = await resolveYear(req.userId!, parseYear(req.query.year));
    const { listCarryforwards } = await import('../services/carryforwards.js');
    const rows = await listCarryforwards(req.userId!, year);
    res.json({ taxYear: year, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
