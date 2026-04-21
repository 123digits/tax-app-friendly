import { getDb } from '../db/pglite.js';
import type { TaxYearConstants } from '../../shared/types.js';

interface ConfigRow {
  tax_year: number;
  brackets: any;
  standard_deduction: any;
  ctc_per_child: string | number;
  ctc_phaseout_start: any;
  ss_wage_base: string | number;
  ltcg_brackets: any;
  salt_cap: string | number;
  medical_agi_threshold: string | number;
  capital_loss_limit: string | number;
  notes: string | null;
  updated_at: string;

  // Phase 0 grouped JSONB columns.
  retirement: any;
  hsa: any;
  education: any;
  ss_taxability: any;
  additional_medicare: any;
  niit: any;
  amt: any;
  savers_credit: any;
  depreciation: any;
  eitc: any;
  feie: any;
  child_care: any;

  // Wave 1 grouped JSONB columns + scalar.
  se_tax: any;
  penalties: any;
  schedule_r_credit: any;
  residential_energy: any;
  mortgage_credit: any;
  ev_credit: any;
  home_office: any;
  passive_loss: any;
  underpayment_penalty: any;
  household_employment: any;
  actc: any;
  ptc: any;
  eitc_investment_income_limit: string | number | null;
  qbi: any;
}

function parseJsonb<T>(val: any): T | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return undefined; }
  }
  return val as T;
}

function fromRow(r: ConfigRow): TaxYearConstants {
  return {
    taxYear: Number(r.tax_year),
    brackets: parseJsonb(r.brackets) as TaxYearConstants['brackets'],
    standardDeduction: parseJsonb(r.standard_deduction) as TaxYearConstants['standardDeduction'],
    ctcPerChild: Number(r.ctc_per_child),
    ctcPhaseoutStart: parseJsonb(r.ctc_phaseout_start) as TaxYearConstants['ctcPhaseoutStart'],
    ssWageBase: Number(r.ss_wage_base),
    ltcgBrackets: parseJsonb(r.ltcg_brackets) as TaxYearConstants['ltcgBrackets'],
    saltCap: Number(r.salt_cap),
    medicalAgiThreshold: Number(r.medical_agi_threshold),
    capitalLossLimit: Number(r.capital_loss_limit),
    notes: r.notes,

    // Each group is returned as-is from the JSONB column (or undefined when
    // unset). Calculator modules already handle undefined via their own
    // `constants?.X ?? literal` pattern. The DB is the single source of truth
    // for 2025 values — seeded by schema.sql — so no TS fallback exists.
    retirement:         parseJsonb(r.retirement),
    hsa:                parseJsonb(r.hsa),
    education:          parseJsonb(r.education),
    ssTaxability:       parseJsonb(r.ss_taxability),
    additionalMedicare: parseJsonb(r.additional_medicare),
    niit:               parseJsonb(r.niit),
    amt:                parseJsonb(r.amt),
    saversCredit:       parseJsonb(r.savers_credit),
    depreciation:       parseJsonb(r.depreciation),
    eitc:               parseJsonb(r.eitc),
    feie:               parseJsonb(r.feie),
    childCare:          parseJsonb(r.child_care),

    seTax:               parseJsonb(r.se_tax),
    penalties:           parseJsonb(r.penalties),
    scheduleRCredit:     parseJsonb(r.schedule_r_credit),
    residentialEnergy:   parseJsonb(r.residential_energy),
    mortgageCredit:      parseJsonb(r.mortgage_credit),
    evCredit:            parseJsonb(r.ev_credit),
    homeOffice:          parseJsonb(r.home_office),
    passiveLoss:         parseJsonb(r.passive_loss),
    underpaymentPenalty: parseJsonb(r.underpayment_penalty),
    householdEmployment: parseJsonb(r.household_employment),
    actc:                parseJsonb(r.actc),
    ptc:                 parseJsonb(r.ptc),
    eitcInvestmentIncomeLimit: r.eitc_investment_income_limit == null
      ? undefined
      : Number(r.eitc_investment_income_limit),
    qbi:                 parseJsonb(r.qbi),
  };
}

export async function listConfigs(): Promise<TaxYearConstants[]> {
  const db = await getDb();
  const res = await db.query<ConfigRow>(
    'SELECT * FROM tax_year_configs ORDER BY tax_year DESC'
  );
  return res.rows.map(fromRow);
}

export async function getConfig(taxYear: number): Promise<TaxYearConstants | null> {
  const db = await getDb();
  const res = await db.query<ConfigRow>(
    'SELECT * FROM tax_year_configs WHERE tax_year = $1',
    [taxYear]
  );
  const row = res.rows[0];
  return row ? fromRow(row) : null;
}

function stringifyOrNull(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}

export async function upsertConfig(c: TaxYearConstants): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO tax_year_configs
       (tax_year, brackets, standard_deduction, ctc_per_child, ctc_phaseout_start,
        ss_wage_base, ltcg_brackets, salt_cap, medical_agi_threshold,
        capital_loss_limit, notes,
        retirement, hsa, education, ss_taxability, additional_medicare,
        niit, amt, savers_credit, depreciation, eitc, feie, child_care,
        se_tax, penalties, schedule_r_credit, residential_energy,
        mortgage_credit, ev_credit, home_office, passive_loss,
        underpayment_penalty, household_employment, actc, ptc,
        eitc_investment_income_limit, qbi,
        updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10, $11,
             $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb,
             $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb,
             $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb,
             $28::jsonb, $29::jsonb, $30::jsonb, $31::jsonb,
             $32::jsonb, $33::jsonb, $34::jsonb, $35::jsonb,
             $36, $37::jsonb,
             now())
     ON CONFLICT (tax_year) DO UPDATE SET
       brackets = EXCLUDED.brackets,
       standard_deduction = EXCLUDED.standard_deduction,
       ctc_per_child = EXCLUDED.ctc_per_child,
       ctc_phaseout_start = EXCLUDED.ctc_phaseout_start,
       ss_wage_base = EXCLUDED.ss_wage_base,
       ltcg_brackets = EXCLUDED.ltcg_brackets,
       salt_cap = EXCLUDED.salt_cap,
       medical_agi_threshold = EXCLUDED.medical_agi_threshold,
       capital_loss_limit = EXCLUDED.capital_loss_limit,
       notes = EXCLUDED.notes,
       retirement = EXCLUDED.retirement,
       hsa = EXCLUDED.hsa,
       education = EXCLUDED.education,
       ss_taxability = EXCLUDED.ss_taxability,
       additional_medicare = EXCLUDED.additional_medicare,
       niit = EXCLUDED.niit,
       amt = EXCLUDED.amt,
       savers_credit = EXCLUDED.savers_credit,
       depreciation = EXCLUDED.depreciation,
       eitc = EXCLUDED.eitc,
       feie = EXCLUDED.feie,
       child_care = EXCLUDED.child_care,
       se_tax = EXCLUDED.se_tax,
       penalties = EXCLUDED.penalties,
       schedule_r_credit = EXCLUDED.schedule_r_credit,
       residential_energy = EXCLUDED.residential_energy,
       mortgage_credit = EXCLUDED.mortgage_credit,
       ev_credit = EXCLUDED.ev_credit,
       home_office = EXCLUDED.home_office,
       passive_loss = EXCLUDED.passive_loss,
       underpayment_penalty = EXCLUDED.underpayment_penalty,
       household_employment = EXCLUDED.household_employment,
       actc = EXCLUDED.actc,
       ptc = EXCLUDED.ptc,
       eitc_investment_income_limit = EXCLUDED.eitc_investment_income_limit,
       qbi = EXCLUDED.qbi,
       updated_at = now()`,
    [
      c.taxYear,
      JSON.stringify(c.brackets),
      JSON.stringify(c.standardDeduction),
      c.ctcPerChild,
      JSON.stringify(c.ctcPhaseoutStart),
      c.ssWageBase,
      JSON.stringify(c.ltcgBrackets),
      c.saltCap,
      c.medicalAgiThreshold,
      c.capitalLossLimit,
      c.notes ?? null,
      stringifyOrNull(c.retirement),
      stringifyOrNull(c.hsa),
      stringifyOrNull(c.education),
      stringifyOrNull(c.ssTaxability),
      stringifyOrNull(c.additionalMedicare),
      stringifyOrNull(c.niit),
      stringifyOrNull(c.amt),
      stringifyOrNull(c.saversCredit),
      stringifyOrNull(c.depreciation),
      stringifyOrNull(c.eitc),
      stringifyOrNull(c.feie),
      stringifyOrNull(c.childCare),
      stringifyOrNull(c.seTax),
      stringifyOrNull(c.penalties),
      stringifyOrNull(c.scheduleRCredit),
      stringifyOrNull(c.residentialEnergy),
      stringifyOrNull(c.mortgageCredit),
      stringifyOrNull(c.evCredit),
      stringifyOrNull(c.homeOffice),
      stringifyOrNull(c.passiveLoss),
      stringifyOrNull(c.underpaymentPenalty),
      stringifyOrNull(c.householdEmployment),
      stringifyOrNull(c.actc),
      stringifyOrNull(c.ptc),
      c.eitcInvestmentIncomeLimit ?? null,
      stringifyOrNull(c.qbi),
    ]
  );
}

export async function deleteConfig(taxYear: number): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM tax_year_configs WHERE tax_year = $1', [taxYear]);
}

/**
 * Copy an existing year's config into a new year. Useful for creating next year
 * from this year as a starting point.
 */
export async function cloneConfig(sourceYear: number, targetYear: number): Promise<TaxYearConstants> {
  const src = await getConfig(sourceYear);
  if (!src) throw new Error(`source year ${sourceYear} not found`);
  const next: TaxYearConstants = { ...src, taxYear: targetYear };
  await upsertConfig(next);
  return next;
}
