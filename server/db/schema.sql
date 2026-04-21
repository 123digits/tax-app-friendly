-- Schema for tax-app-friendly.
-- All DDL is idempotent so this file runs on every startup.

CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY,
  username        text UNIQUE NOT NULL,
  email           text UNIQUE NOT NULL,
  password_hash   text NOT NULL,
  email_verified  boolean NOT NULL DEFAULT false,
  is_admin        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotent add of is_admin for databases created before this column existed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Tax-year configs: one row per year. All constants live here so an admin
-- can edit brackets, standard deduction, credits, etc. without a code change.
CREATE TABLE IF NOT EXISTS tax_year_configs (
  tax_year               int PRIMARY KEY,
  brackets               jsonb NOT NULL,  -- Record<FilingStatus, Bracket[]>
  standard_deduction     jsonb NOT NULL,  -- Record<FilingStatus, number>
  ctc_per_child          numeric NOT NULL,
  ctc_phaseout_start     jsonb NOT NULL,  -- Record<FilingStatus, number>
  ss_wage_base           numeric NOT NULL,
  ltcg_brackets          jsonb NOT NULL,  -- Record<FilingStatus, {zeroUpTo, fifteenUpTo}>
  salt_cap               numeric NOT NULL DEFAULT 10000,
  medical_agi_threshold  numeric NOT NULL DEFAULT 0.075,
  capital_loss_limit     numeric NOT NULL DEFAULT 3000,
  notes                  text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,          -- sha256 of random token
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'session', -- 'session' | 'pending'
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS two_factor_codes (
  id           text PRIMARY KEY,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    text NOT NULL,
  purpose      text NOT NULL,             -- 'login' | 'email_verify'
  attempts     int NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tfc_user_idx ON two_factor_codes(user_id, purpose);

CREATE TABLE IF NOT EXISTS tax_returns (
  id             text PRIMARY KEY,
  user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_year       int NOT NULL,
  filing_status  text,
  status         text NOT NULL DEFAULT 'in_progress',
  use_standard_deduction boolean NOT NULL DEFAULT true,
  estimated_payments numeric NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_returns_user_idx ON tax_returns(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS tax_returns_user_year_idx ON tax_returns(user_id, tax_year);

CREATE TABLE IF NOT EXISTS personal_info (
  return_id            text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  first_name           text,
  last_name            text,
  ssn_encrypted        text,
  ssn_last4            text,
  dob                  date,
  address_line1        text,
  address_line2        text,
  city                 text,
  state                text,
  zip                  text,
  spouse_first_name    text,
  spouse_last_name     text,
  spouse_ssn_encrypted text,
  spouse_ssn_last4     text,
  spouse_dob           date
);

CREATE TABLE IF NOT EXISTS dependents (
  id                  text PRIMARY KEY,
  return_id           text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  name                text NOT NULL,
  ssn_encrypted       text,
  ssn_last4           text,
  relationship        text,
  dob                 date,
  is_qualifying_child boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS dependents_return_idx ON dependents(return_id);

CREATE TABLE IF NOT EXISTS w2_income (
  id                    text PRIMARY KEY,
  return_id             text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  employer              text,
  ein                   text,
  box1_wages            numeric NOT NULL DEFAULT 0,
  box2_fed_withheld     numeric NOT NULL DEFAULT 0,
  box3_ss_wages         numeric NOT NULL DEFAULT 0,
  box4_ss_withheld      numeric NOT NULL DEFAULT 0,
  box5_medicare_wages   numeric NOT NULL DEFAULT 0,
  box6_medicare_withheld numeric NOT NULL DEFAULT 0,
  state_wages           numeric NOT NULL DEFAULT 0,
  state_withheld        numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS w2_return_idx ON w2_income(return_id);

CREATE TABLE IF NOT EXISTS interest_income (
  id         text PRIMARY KEY,
  return_id  text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  payer      text,
  amount     numeric NOT NULL DEFAULT 0,
  tax_exempt boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS interest_return_idx ON interest_income(return_id);

-- Idempotent: add tax_exempt flag to pre-existing DBs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interest_income' AND column_name = 'tax_exempt'
  ) THEN
    ALTER TABLE interest_income ADD COLUMN tax_exempt boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Idempotent: add PAB interest column (§57(a)(5) AMT preference — Form 6251 line 2g).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interest_income' AND column_name = 'private_activity_bond_interest'
  ) THEN
    ALTER TABLE interest_income ADD COLUMN private_activity_bond_interest numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS dividend_income (
  id         text PRIMARY KEY,
  return_id  text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  payer      text,
  ordinary   numeric NOT NULL DEFAULT 0,
  qualified  numeric NOT NULL DEFAULT 0,
  total_cap_gain_distributions numeric NOT NULL DEFAULT 0,
  unrecap_section_1250_gain    numeric NOT NULL DEFAULT 0,
  section_1202_gain            numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS dividend_return_idx ON dividend_income(return_id);

-- Idempotent: add 1099-DIV boxes 2a / 2b / 2c to pre-existing DBs.
-- 2a  total capital gain distributions (Sched D line 13 / 1040 line 7)
-- 2b  unrecaptured §1250 gain (subset of 2a; 28%-rate worksheet)
-- 2c  §1202 gain (subset of 2a; §1202 exclusion worksheet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividend_income' AND column_name = 'total_cap_gain_distributions'
  ) THEN
    ALTER TABLE dividend_income
      ADD COLUMN total_cap_gain_distributions numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividend_income' AND column_name = 'unrecap_section_1250_gain'
  ) THEN
    ALTER TABLE dividend_income
      ADD COLUMN unrecap_section_1250_gain numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dividend_income' AND column_name = 'section_1202_gain'
  ) THEN
    ALTER TABLE dividend_income
      ADD COLUMN section_1202_gain numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS self_employment (
  id                  text PRIMARY KEY,
  return_id           text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  business_name       text,
  ein                 text,
  principal_activity  text,
  gross_receipts      numeric NOT NULL DEFAULT 0,
  returns_allowances  numeric NOT NULL DEFAULT 0,
  cost_of_goods       numeric NOT NULL DEFAULT 0,
  expenses            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS se_return_idx ON self_employment(return_id);

CREATE TABLE IF NOT EXISTS capital_gains (
  id             text PRIMARY KEY,
  return_id      text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  description    text,
  date_acquired  date,
  date_sold      date,
  proceeds       numeric NOT NULL DEFAULT 0,
  cost_basis     numeric NOT NULL DEFAULT 0,
  term           text NOT NULL DEFAULT 'long'
);

CREATE INDEX IF NOT EXISTS cg_return_idx ON capital_gains(return_id);

-- Idempotent add of Form 8949 column (g) wash-sale loss disallowed (IRC §1091)
-- for databases created before this column existed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'capital_gains' AND column_name = 'wash_sale_loss_disallowed'
  ) THEN
    ALTER TABLE capital_gains
      ADD COLUMN wash_sale_loss_disallowed numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS itemized_deductions (
  return_id           text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  medical             numeric NOT NULL DEFAULT 0,
  state_local_tax     numeric NOT NULL DEFAULT 0,
  real_estate_tax     numeric NOT NULL DEFAULT 0,
  mortgage_interest   numeric NOT NULL DEFAULT 0,
  charitable_cash     numeric NOT NULL DEFAULT 0,
  charitable_noncash  numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS interview_answers (
  return_id  text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  PRIMARY KEY (return_id, key)
);

-- ----- Phase 0: grouped year-config columns -----
-- Added as nullable JSONB so pre-Phase-0 rows keep loading. The admin UI fills
-- them in; the loader merges with defaults when any are missing.
DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'retirement', 'hsa', 'education', 'ss_taxability', 'additional_medicare',
    'niit', 'amt', 'savers_credit', 'depreciation', 'eitc', 'feie', 'child_care',
    -- Wave 1: additional grouped JSONB columns.
    'se_tax', 'penalties', 'schedule_r_credit', 'residential_energy',
    'mortgage_credit', 'ev_credit', 'home_office', 'passive_loss',
    'underpayment_penalty', 'household_employment', 'actc', 'ptc'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'tax_year_configs' AND column_name = col
    ) THEN
      EXECUTE format('ALTER TABLE tax_year_configs ADD COLUMN %I jsonb', col);
    END IF;
  END LOOP;
END $$;

-- Wave 1: EITC investment-income disqualifier (§32(i)) as a scalar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_year_configs' AND column_name = 'eitc_investment_income_limit'
  ) THEN
    ALTER TABLE tax_year_configs ADD COLUMN eitc_investment_income_limit numeric;
  END IF;
END $$;

-- Task #38: §199A QBI deduction thresholds (Form 8995 simplified vs 8995-A).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_year_configs' AND column_name = 'qbi'
  ) THEN
    ALTER TABLE tax_year_configs ADD COLUMN qbi jsonb;
  END IF;
END $$;

-- ----- Phase 0: Schedule 1 / 2 / 3 scaffolding -----
-- Empty placeholders keyed on return_id. Subsequent phases add columns as each
-- line item is implemented; the single-row-per-return shape stays stable.
CREATE TABLE IF NOT EXISTS schedule_1 (
  return_id text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_2 (
  return_id text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_3 (
  return_id text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE
);

-- ----- Phase 1: Retirement distributions (1099-R) -----
CREATE TABLE IF NOT EXISTS retirement_income (
  id                 text PRIMARY KEY,
  return_id          text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  payer              text,
  gross_distribution numeric NOT NULL DEFAULT 0,
  taxable_amount     numeric NOT NULL DEFAULT 0,
  federal_withheld   numeric NOT NULL DEFAULT 0,
  state_withheld     numeric NOT NULL DEFAULT 0,
  distribution_code  text,
  is_ira             boolean NOT NULL DEFAULT false,
  is_roth            boolean NOT NULL DEFAULT false,
  exception_code     text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retirement_income_return_idx ON retirement_income(return_id);

-- Idempotent: add 1099-R Box 2b ("Taxable amount not determined") to pre-existing DBs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retirement_income' AND column_name = 'taxable_amount_not_determined'
  ) THEN
    ALTER TABLE retirement_income
      ADD COLUMN taxable_amount_not_determined boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ----- Phase 2: Social Security benefits (single row per return) -----
CREATE TABLE IF NOT EXISTS social_security_benefits (
  return_id          text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  gross_benefits     numeric NOT NULL DEFAULT 0,
  medicare_premiums  numeric NOT NULL DEFAULT 0,
  federal_withheld   numeric NOT NULL DEFAULT 0
);

-- ----- Phase 2: Unemployment (1099-G) -----
CREATE TABLE IF NOT EXISTS unemployment_income (
  id               text PRIMARY KEY,
  return_id        text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  payer            text,
  amount           numeric NOT NULL DEFAULT 0,
  federal_withheld numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS unemployment_return_idx ON unemployment_income(return_id);

-- ----- Phase 2: Gambling (W-2G) -----
CREATE TABLE IF NOT EXISTS gambling_winnings (
  id               text PRIMARY KEY,
  return_id        text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  payer            text,
  winnings         numeric NOT NULL DEFAULT 0,
  federal_withheld numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS gambling_return_idx ON gambling_winnings(return_id);

-- ----- Phase 3: Other income (unified tagged list) -----
CREATE TABLE IF NOT EXISTS other_income (
  id          text PRIMARY KEY,
  return_id   text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  source      text NOT NULL,
  description text,
  amount      numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS other_income_return_idx ON other_income(return_id);

-- ----- Phase 4: Schedule E rental properties -----
CREATE TABLE IF NOT EXISTS schedule_e_rental (
  id                         text PRIMARY KEY,
  return_id                  text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  property_address           text,
  property_type              text,
  fair_rental_days           numeric NOT NULL DEFAULT 0,
  personal_use_days          numeric NOT NULL DEFAULT 0,
  rents_received             numeric NOT NULL DEFAULT 0,
  expenses                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_participation       boolean NOT NULL DEFAULT true,
  is_passive                 boolean NOT NULL DEFAULT true,
  prior_year_unallowed_loss  numeric NOT NULL DEFAULT 0,
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_e_rental_return_idx ON schedule_e_rental(return_id);

-- ----- Phase 4: Schedule E royalties -----
CREATE TABLE IF NOT EXISTS schedule_e_royalty (
  id              text PRIMARY KEY,
  return_id       text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  source          text,
  gross_royalties numeric NOT NULL DEFAULT 0,
  expenses        numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_e_royalty_return_idx ON schedule_e_royalty(return_id);

-- ----- Phase 4: K-1 flow-through (partnership / S-corp / trust) -----
CREATE TABLE IF NOT EXISTS k1_income (
  id                        text PRIMARY KEY,
  return_id                 text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  entity_kind               text NOT NULL,       -- 'partnership' | 's_corp' | 'trust'
  entity_name               text,
  ein                       text,
  is_passive                boolean NOT NULL DEFAULT true,
  ordinary_business_income  numeric NOT NULL DEFAULT 0,
  net_rental_real_estate    numeric NOT NULL DEFAULT 0,
  other_rental_income       numeric NOT NULL DEFAULT 0,
  interest_income           numeric NOT NULL DEFAULT 0,
  ordinary_dividends        numeric NOT NULL DEFAULT 0,
  qualified_dividends       numeric NOT NULL DEFAULT 0,
  royalties                 numeric NOT NULL DEFAULT 0,
  short_term_capital_gain   numeric NOT NULL DEFAULT 0,
  long_term_capital_gain    numeric NOT NULL DEFAULT 0,
  section_1231_gain         numeric NOT NULL DEFAULT 0,
  prior_year_unallowed_loss numeric NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS k1_income_return_idx ON k1_income(return_id);

-- ----- Phase 4: Cross-year carryforwards -----
-- One row per (user, year, kind, ref_id). Rows describe an amount available
-- to apply AGAINST the specified tax_year (the incoming carryforward).
--
-- Phase 4 addendum (Task #49): the `ref_id` column serves as the generic
-- "subkind" slot: FTC basket category ('passive', 'general'), charitable
-- limit class ('50', '30', '20'), §469 originating item id (rental
-- property / K-1), etc. The composite UNIQUE (user_id, tax_year, kind,
-- ref_id) supports idempotent upserts from the compute orchestrator.
CREATE TABLE IF NOT EXISTS carryforwards (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_year   int NOT NULL,
  kind       text NOT NULL,
  ref_id     text,
  amount     numeric NOT NULL DEFAULT 0,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carryforwards_user_year_idx ON carryforwards(user_id, tax_year);
CREATE INDEX IF NOT EXISTS carryforwards_kind_idx ON carryforwards(kind);
CREATE INDEX IF NOT EXISTS carryforwards_user_year_kind_idx
  ON carryforwards(user_id, tax_year, kind);

-- Idempotent add of source_return_id (originating tax_returns.id when
-- known) so carryforward rows can be traced back to the year that wrote
-- them. NULL is allowed for rows seeded from legacy user-entered fields.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carryforwards' AND column_name = 'source_return_id'
  ) THEN
    ALTER TABLE carryforwards
      ADD COLUMN source_return_id text REFERENCES tax_returns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Idempotent UNIQUE on (user_id, tax_year, kind, ref_id). Implemented as
-- an expression-indexed unique that COALESCEs NULL ref_id to ''. This
-- lets kinds with a single bucket (e.g. capital_loss_short) upsert just
-- like kinds with per-bucket ref_ids (e.g. foreign_tax_credit per basket
-- category). Postgres only treats two NULLs as equal in the COALESCE
-- form — without it, NULL != NULL would permit duplicate NULL-ref rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'carryforwards_user_year_kind_ref_uniq'
  ) THEN
    CREATE UNIQUE INDEX carryforwards_user_year_kind_ref_uniq
      ON carryforwards(user_id, tax_year, kind, COALESCE(ref_id, ''));
  END IF;
END $$;

-- ----- Phase 5: Schedule F farm -----
CREATE TABLE IF NOT EXISTS schedule_f_farm (
  id                 text PRIMARY KEY,
  return_id          text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  farm_name          text,
  principal_product  text,
  accounting_method  text NOT NULL DEFAULT 'cash',
  gross_income       numeric NOT NULL DEFAULT 0,
  expenses           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_f_farm_return_idx ON schedule_f_farm(return_id);

-- ----- Phase 5: Form 4797 sales -----
CREATE TABLE IF NOT EXISTS form_4797_sales (
  id                       text PRIMARY KEY,
  return_id                text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  description              text,
  date_acquired            date,
  date_sold                date,
  proceeds                 numeric NOT NULL DEFAULT 0,
  cost_basis               numeric NOT NULL DEFAULT 0,
  accumulated_depreciation numeric NOT NULL DEFAULT 0,
  depreciation_recapture   numeric NOT NULL DEFAULT 0,
  term                     text NOT NULL DEFAULT 'long_1231',
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_4797_sales_return_idx ON form_4797_sales(return_id);

-- ----- Phase 5: Form 4562 depreciation assets -----
CREATE TABLE IF NOT EXISTS depreciation_assets (
  id                       text PRIMARY KEY,
  return_id                text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  description              text,
  date_placed_in_service   date,
  cost                     numeric NOT NULL DEFAULT 0,
  macrs_class              text NOT NULL DEFAULT '5',
  section_179_election     numeric NOT NULL DEFAULT 0,
  claim_bonus              boolean NOT NULL DEFAULT false,
  business_use_percent     numeric NOT NULL DEFAULT 1,
  business_id              text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS depreciation_assets_return_idx ON depreciation_assets(return_id);

-- ----- Phase 5: Form 8829 home office (one row per business) -----
CREATE TABLE IF NOT EXISTS home_office_expenses (
  id                      text PRIMARY KEY,
  return_id               text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  business_id             text,
  use_simplified          boolean NOT NULL DEFAULT true,
  square_feet             numeric NOT NULL DEFAULT 0,
  total_home_square_feet  numeric NOT NULL DEFAULT 0,
  utilities               numeric NOT NULL DEFAULT 0,
  insurance               numeric NOT NULL DEFAULT 0,
  mortgage_interest       numeric NOT NULL DEFAULT 0,
  real_estate_tax         numeric NOT NULL DEFAULT 0,
  repairs                 numeric NOT NULL DEFAULT 0,
  depreciation            numeric NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS home_office_expenses_return_idx ON home_office_expenses(return_id);

-- ----- Phase 6: Schedule 1 adjustments (single row per return) -----
CREATE TABLE IF NOT EXISTS schedule_1_adjustments (
  return_id                        text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  educator_expenses                numeric NOT NULL DEFAULT 0,
  hsa_deduction                    numeric NOT NULL DEFAULT 0,
  self_employed_health_insurance   numeric NOT NULL DEFAULT 0,
  sep_contribution                 numeric NOT NULL DEFAULT 0,
  simple_contribution              numeric NOT NULL DEFAULT 0,
  solo401k_contribution            numeric NOT NULL DEFAULT 0,
  traditional_ira_deduction        numeric NOT NULL DEFAULT 0,
  student_loan_interest            numeric NOT NULL DEFAULT 0,
  penalty_early_withdrawal         numeric NOT NULL DEFAULT 0,
  alimony_paid                     numeric NOT NULL DEFAULT 0,
  alimony_recipient_ssn            text,
  alimony_divorce_date             date,
  reservist_expenses               numeric NOT NULL DEFAULT 0,
  performing_artist_expenses       numeric NOT NULL DEFAULT 0,
  fee_basis_expenses               numeric NOT NULL DEFAULT 0,
  updated_at                       timestamptz NOT NULL DEFAULT now()
);

-- ----- Phase 6: Form 8606 IRA basis (single row per return) -----
CREATE TABLE IF NOT EXISTS form_8606 (
  return_id                  text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  prior_year_basis           numeric NOT NULL DEFAULT 0,
  current_year_nondeductible numeric NOT NULL DEFAULT 0,
  traditional_ira_balance    numeric NOT NULL DEFAULT 0,
  distributions              numeric NOT NULL DEFAULT 0,
  conversions                numeric NOT NULL DEFAULT 0,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- ----- Phase 6: Form 8889 HSA (single row per return) -----
CREATE TABLE IF NOT EXISTS form_8889 (
  return_id                   text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  coverage                    text NOT NULL DEFAULT 'none',
  contributions               numeric NOT NULL DEFAULT 0,
  is_catch_up_eligible        boolean NOT NULL DEFAULT false,
  distributions               numeric NOT NULL DEFAULT 0,
  qualified_medical_expenses  numeric NOT NULL DEFAULT 0,
  is_disabled_or_over65       boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ----- Phase 7: Nonrefundable credits -----

-- Form 2441 — Child and Dependent Care Expenses (single row per return)
CREATE TABLE IF NOT EXISTS form_2441 (
  return_id                   text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  total_qualified_expenses    numeric NOT NULL DEFAULT 0,
  num_qualifying_persons      numeric NOT NULL DEFAULT 0,
  taxpayer_earned_income      numeric NOT NULL DEFAULT 0,
  spouse_earned_income        numeric NOT NULL DEFAULT 0,
  employer_provided_benefits  numeric NOT NULL DEFAULT 0,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: §21(e)(2) MFS abandonment exception and §21(d)(2) student/
-- disabled imputation flags on Form 2441.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_2441' AND column_name = 'mfs_abandonment_exception'
  ) THEN
    ALTER TABLE form_2441 ADD COLUMN mfs_abandonment_exception boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_2441' AND column_name = 'taxpayer_is_student_or_disabled'
  ) THEN
    ALTER TABLE form_2441 ADD COLUMN taxpayer_is_student_or_disabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_2441' AND column_name = 'spouse_is_student_or_disabled'
  ) THEN
    ALTER TABLE form_2441 ADD COLUMN spouse_is_student_or_disabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Form 8863 — Education Credits students (list)
CREATE TABLE IF NOT EXISTS form_8863_students (
  id                   text PRIMARY KEY,
  return_id            text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  student_name         text,
  student_ssn_encrypted text,
  student_ssn_last4    text,
  credit_type          text NOT NULL DEFAULT 'aotc',
  qualified_expenses   numeric NOT NULL DEFAULT 0,
  is_eligible_for_aotc boolean NOT NULL DEFAULT false,
  prior_aotc_years     numeric NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_8863_students_return_idx ON form_8863_students(return_id);

-- Form 8880 — Saver's Credit (single row per return)
CREATE TABLE IF NOT EXISTS form_8880 (
  return_id                      text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  elective_401k_deferrals        numeric NOT NULL DEFAULT 0,
  ira_contributions              numeric NOT NULL DEFAULT 0,
  spouse_elective_401k_deferrals numeric NOT NULL DEFAULT 0,
  spouse_ira_contributions       numeric NOT NULL DEFAULT 0,
  distributions_received         numeric NOT NULL DEFAULT 0,
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

-- Schedule R — Credit for the Elderly or Disabled (single row per return)
CREATE TABLE IF NOT EXISTS schedule_r (
  return_id                    text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  is_taxpayer_eligible         boolean NOT NULL DEFAULT false,
  is_spouse_eligible           boolean NOT NULL DEFAULT false,
  taxpayer_under65_disabled    boolean NOT NULL DEFAULT false,
  spouse_under65_disabled      boolean NOT NULL DEFAULT false,
  disability_income            numeric NOT NULL DEFAULT 0,
  nontaxable_ss_and_pension    numeric NOT NULL DEFAULT 0,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- Form 8396 — Mortgage Interest Credit (single row per return)
CREATE TABLE IF NOT EXISTS form_8396 (
  return_id                text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  certificate_rate         numeric NOT NULL DEFAULT 0,
  mortgage_interest_paid   numeric NOT NULL DEFAULT 0,
  prior_year_unused_credit numeric NOT NULL DEFAULT 0,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Form 5695 — Residential Energy Credits (single row per return)
CREATE TABLE IF NOT EXISTS form_5695 (
  return_id              text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  solar_electric         numeric NOT NULL DEFAULT 0,
  solar_water_heating    numeric NOT NULL DEFAULT 0,
  wind_energy            numeric NOT NULL DEFAULT 0,
  geothermal_heat_pump   numeric NOT NULL DEFAULT 0,
  biomass_fuel           numeric NOT NULL DEFAULT 0,
  battery_storage_tech   numeric NOT NULL DEFAULT 0,
  fuel_cell_cost         numeric NOT NULL DEFAULT 0,
  fuel_cell_kw           numeric NOT NULL DEFAULT 0,
  insulation_air_sealing numeric NOT NULL DEFAULT 0,
  exterior_windows       numeric NOT NULL DEFAULT 0,
  exterior_doors         numeric NOT NULL DEFAULT 0,
  home_energy_audit      numeric NOT NULL DEFAULT 0,
  heat_pumps             numeric NOT NULL DEFAULT 0,
  biomass_stoves         numeric NOT NULL DEFAULT 0,
  central_ac             numeric NOT NULL DEFAULT 0,
  furnace_boiler         numeric NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Form 8936 — Clean Vehicle Credit vehicles (list)
CREATE TABLE IF NOT EXISTS form_8936_vehicles (
  id                     text PRIMARY KEY,
  return_id              text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  make                   text,
  model                  text,
  year                   numeric NOT NULL DEFAULT 0,
  vin                    text,
  placed_in_service      date,
  is_new                 boolean NOT NULL DEFAULT true,
  purchase_price         numeric NOT NULL DEFAULT 0,
  business_use_percent   numeric NOT NULL DEFAULT 0,
  user_entered_credit    numeric NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_8936_vehicles_return_idx ON form_8936_vehicles(return_id);

-- Idempotent: §30D(d)(1)(G) final-assembly-in-North-America flag, §30D(f)(11)
-- MSRP cap (vehicle class + MSRP) for pre-existing DBs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_8936_vehicles' AND column_name = 'final_assembly_in_north_america'
  ) THEN
    ALTER TABLE form_8936_vehicles ADD COLUMN final_assembly_in_north_america boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_8936_vehicles' AND column_name = 'vehicle_class'
  ) THEN
    ALTER TABLE form_8936_vehicles ADD COLUMN vehicle_class text NOT NULL DEFAULT 'other';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_8936_vehicles' AND column_name = 'msrp'
  ) THEN
    ALTER TABLE form_8936_vehicles ADD COLUMN msrp numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Form 1116 — Foreign Tax Credit baskets (list)
CREATE TABLE IF NOT EXISTS form_1116_baskets (
  id                             text PRIMARY KEY,
  return_id                      text NOT NULL REFERENCES tax_returns(id) ON DELETE CASCADE,
  category                       text NOT NULL DEFAULT 'passive',
  country                        text,
  foreign_gross_income           numeric NOT NULL DEFAULT 0,
  definitely_related_deductions  numeric NOT NULL DEFAULT 0,
  foreign_tax_paid               numeric NOT NULL DEFAULT 0,
  created_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_1116_baskets_return_idx ON form_1116_baskets(return_id);

-- ===== Phase 8: refundable credits =====

-- Schedule 8812 — Additional Child Tax Credit inputs (single row per return)
CREATE TABLE IF NOT EXISTS schedule_8812 (
  return_id                       text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  qualifying_children_override    integer,
  earned_income_override          numeric,
  include_combat_pay              boolean NOT NULL DEFAULT false,
  combat_pay_amount               numeric NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- EITC eligibility toggles (single row per return)
CREATE TABLE IF NOT EXISTS eitc_eligibility (
  return_id                       text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  qualifying_children_override    integer,
  investment_income_override      numeric,
  is_eligible_age                 boolean NOT NULL DEFAULT true,
  include_combat_pay              boolean NOT NULL DEFAULT false,
  combat_pay_amount               numeric NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Form 8962 — Premium Tax Credit reconciliation (single row per return)
CREATE TABLE IF NOT EXISTS form_8962 (
  return_id                       text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  household_size                  integer NOT NULL DEFAULT 0,
  federal_poverty_line            numeric NOT NULL DEFAULT 0,
  annual_enrollment_premium       numeric NOT NULL DEFAULT 0,
  annual_slcsp                    numeric NOT NULL DEFAULT 0,
  advance_ptc_paid                numeric NOT NULL DEFAULT 0,
  additional_magi                 numeric NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: §36B(c)(1)(C) MFS abuse/abandonment exception flag for Form
-- 8962 on pre-existing DBs (see Reg. §1.36B-2(b)(2)).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_8962' AND column_name = 'mfs_abuse_abandonment_exception'
  ) THEN
    ALTER TABLE form_8962 ADD COLUMN mfs_abuse_abandonment_exception boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Phase 9: Form 6251 Alternative Minimum Tax (single row per return)
CREATE TABLE IF NOT EXISTS form_6251 (
  return_id                       text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  private_activity_bond_interest  numeric NOT NULL DEFAULT 0,
  amt_depreciation_adjustment     numeric NOT NULL DEFAULT 0,
  other_adjustments               numeric NOT NULL DEFAULT 0,
  amt_nol_carryforward            numeric NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Phase 9: Form 8960 Net Investment Income Tax (single row per return)
CREATE TABLE IF NOT EXISTS form_8960 (
  return_id                          text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  investment_interest_expense        numeric NOT NULL DEFAULT 0,
  state_tax_allocable_to_investment  numeric NOT NULL DEFAULT 0,
  misc_investment_expenses           numeric NOT NULL DEFAULT 0,
  other_modifications                numeric NOT NULL DEFAULT 0,
  updated_at                         timestamptz NOT NULL DEFAULT now()
);

-- Phase 9: Form 8959 Additional Medicare Tax (single row per return)
CREATE TABLE IF NOT EXISTS form_8959 (
  return_id                       text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  rrta_compensation               numeric NOT NULL DEFAULT 0,
  additional_medicare_withheld    numeric NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Phase 10: Form 2555 Foreign Earned Income Exclusion (single row per return)
CREATE TABLE IF NOT EXISTS form_2555 (
  return_id                text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  foreign_earned_income    numeric NOT NULL DEFAULT 0,
  qualifying_days          integer NOT NULL DEFAULT 0,
  total_days_in_period     integer NOT NULL DEFAULT 365,
  housing_expenses         numeric NOT NULL DEFAULT 0,
  is_bona_fide_resident    boolean NOT NULL DEFAULT false,
  uses_physical_presence   boolean NOT NULL DEFAULT false,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Phase 10: Schedule H Household Employment Taxes (single row per return)
CREATE TABLE IF NOT EXISTS schedule_h (
  return_id                   text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  cash_wages_ss_medicare      numeric NOT NULL DEFAULT 0,
  cash_wages_futa             numeric NOT NULL DEFAULT 0,
  any_quarter_over_1000       boolean NOT NULL DEFAULT false,
  federal_income_tax_withheld numeric NOT NULL DEFAULT 0,
  state_unemployment_paid     numeric NOT NULL DEFAULT 0,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Phase 10: Form 2210 Underpayment of Estimated Tax (single row per return)
CREATE TABLE IF NOT EXISTS form_2210 (
  return_id                   text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  prior_year_tax              numeric NOT NULL DEFAULT 0,
  prior_year_agi              numeric NOT NULL DEFAULT 0,
  withholding_q1              numeric NOT NULL DEFAULT 0,
  withholding_q2              numeric NOT NULL DEFAULT 0,
  withholding_q3              numeric NOT NULL DEFAULT 0,
  withholding_q4              numeric NOT NULL DEFAULT 0,
  estimated_payments_q1       numeric NOT NULL DEFAULT 0,
  estimated_payments_q2       numeric NOT NULL DEFAULT 0,
  estimated_payments_q3       numeric NOT NULL DEFAULT 0,
  estimated_payments_q4       numeric NOT NULL DEFAULT 0,
  request_waiver              boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Phase 10: Form 5405 First-Time Homebuyer Credit Repayment (single row)
CREATE TABLE IF NOT EXISTS form_5405 (
  return_id                 text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  annual_installment        numeric NOT NULL DEFAULT 0,
  disposition_accelerated   numeric NOT NULL DEFAULT 0,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Phase 10: Form 4972 Lump-Sum Distribution 10-year Averaging (single row)
CREATE TABLE IF NOT EXISTS form_4972 (
  return_id             text PRIMARY KEY REFERENCES tax_returns(id) ON DELETE CASCADE,
  qualifying_lump_sum   numeric NOT NULL DEFAULT 0,
  capital_gain_portion  numeric NOT NULL DEFAULT 0,
  ordinary_portion      numeric NOT NULL DEFAULT 0,
  computed_tax          numeric NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Gambling losses are a single scalar (capped to winnings on Sched A).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns' AND column_name = 'gambling_losses'
  ) THEN
    ALTER TABLE tax_returns ADD COLUMN gambling_losses numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- IRC §1212(b) prior-year capital-loss carryforwards (inputs from the user's
-- prior-year Schedule D / Pub 550 Capital Loss Carryover Worksheet). Stored
-- as positive magnitudes of the loss; the compute layer treats them as
-- losses (negative) when folding into the current-year net.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns' AND column_name = 'prior_year_st_loss_carryforward'
  ) THEN
    ALTER TABLE tax_returns
      ADD COLUMN prior_year_st_loss_carryforward numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns' AND column_name = 'prior_year_lt_loss_carryforward'
  ) THEN
    ALTER TABLE tax_returns
      ADD COLUMN prior_year_lt_loss_carryforward numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 2025 tax-year default config seed
-- ============================================================
-- Seeds the tax_year_configs table with IRS-published 2025 values
-- (Rev. Proc. 2024-40 and related Notices). This is the ONLY place
-- the 2025 defaults live. Admins can edit the seeded values via the
-- admin UI, and can clone this row forward to 2026 once the IRS
-- publishes Rev. Proc. 2026.
--
-- ON CONFLICT DO NOTHING keeps this idempotent: re-running schema.sql
-- on an existing DB never overwrites admin edits.
INSERT INTO tax_year_configs (
  tax_year,
  brackets,
  standard_deduction,
  ctc_per_child,
  ctc_phaseout_start,
  ss_wage_base,
  ltcg_brackets,
  salt_cap,
  medical_agi_threshold,
  capital_loss_limit,
  notes,
  retirement,
  hsa,
  education,
  ss_taxability,
  additional_medicare,
  niit,
  amt,
  savers_credit,
  depreciation,
  eitc,
  feie,
  child_care,
  se_tax,
  penalties,
  schedule_r_credit,
  residential_energy,
  mortgage_credit,
  ev_credit,
  home_office,
  passive_loss,
  underpayment_penalty,
  household_employment,
  actc,
  ptc,
  eitc_investment_income_limit,
  qbi,
  updated_at
) VALUES (
  2025,
  '{"single":[{"upTo":11925,"rate":0.1},{"upTo":48475,"rate":0.12},{"upTo":103350,"rate":0.22},{"upTo":197300,"rate":0.24},{"upTo":250525,"rate":0.32},{"upTo":626350,"rate":0.35},{"upTo":null,"rate":0.37}],"mfj":[{"upTo":23850,"rate":0.1},{"upTo":96950,"rate":0.12},{"upTo":206700,"rate":0.22},{"upTo":394600,"rate":0.24},{"upTo":501050,"rate":0.32},{"upTo":751600,"rate":0.35},{"upTo":null,"rate":0.37}],"mfs":[{"upTo":11925,"rate":0.1},{"upTo":48475,"rate":0.12},{"upTo":103350,"rate":0.22},{"upTo":197300,"rate":0.24},{"upTo":250525,"rate":0.32},{"upTo":375800,"rate":0.35},{"upTo":null,"rate":0.37}],"hoh":[{"upTo":17000,"rate":0.1},{"upTo":64850,"rate":0.12},{"upTo":103350,"rate":0.22},{"upTo":197300,"rate":0.24},{"upTo":250500,"rate":0.32},{"upTo":626350,"rate":0.35},{"upTo":null,"rate":0.37}],"qw":[{"upTo":23850,"rate":0.1},{"upTo":96950,"rate":0.12},{"upTo":206700,"rate":0.22},{"upTo":394600,"rate":0.24},{"upTo":501050,"rate":0.32},{"upTo":751600,"rate":0.35},{"upTo":null,"rate":0.37}]}'::jsonb,
  '{"single":15000,"mfj":30000,"mfs":15000,"hoh":22500,"qw":30000}'::jsonb,
  2000,
  '{"single":200000,"mfj":400000,"mfs":200000,"hoh":200000,"qw":400000}'::jsonb,
  176100,
  '{"single":{"zeroUpTo":48350,"fifteenUpTo":533400},"mfj":{"zeroUpTo":96700,"fifteenUpTo":600050},"mfs":{"zeroUpTo":48350,"fifteenUpTo":300000},"hoh":{"zeroUpTo":64750,"fifteenUpTo":566700},"qw":{"zeroUpTo":96700,"fifteenUpTo":600050}}'::jsonb,
  10000,
  0.075,
  3000,
  'IRS-published 2025 defaults (Rev. Proc. 2024-40). Clone forward to future years via the admin UI once the IRS publishes new Rev. Proc. figures.',
  '{"iraLimit":7000,"iraCatchUp":1000,"sepPercent":0.25,"solo401kLimit":70000,"catchUpAge":50}'::jsonb,
  '{"selfLimit":4300,"familyLimit":8550,"catchUp":1000}'::jsonb,
  '{"aotcMax":2500,"aotcRefundablePct":0.4,"aotcPhaseout":{"single":{"start":80000,"end":90000},"mfj":{"start":160000,"end":180000},"mfs":{"start":0,"end":0},"hoh":{"start":80000,"end":90000},"qw":{"start":160000,"end":180000}},"llcRate":0.2,"llcMaxExpenses":10000,"llcPhaseout":{"single":{"start":80000,"end":90000},"mfj":{"start":160000,"end":180000},"mfs":{"start":0,"end":0},"hoh":{"start":80000,"end":90000},"qw":{"start":160000,"end":180000}},"studentLoanInterestLimit":2500,"studentLoanInterestPhaseout":{"single":{"start":80000,"end":95000},"mfj":{"start":165000,"end":195000},"mfs":{"start":0,"end":0},"hoh":{"start":80000,"end":95000},"qw":{"start":165000,"end":195000}},"educatorExpenseLimit":300,"aotcFirstTierExpense":2000,"aotcFirstTierRate":1,"aotcSecondTierRate":0.25}'::jsonb,
  '{"single":{"tier1":25000,"tier2":34000,"tier1Rate":0.5,"tier2Rate":0.85},"mfj":{"tier1":32000,"tier2":44000,"tier1Rate":0.5,"tier2Rate":0.85},"mfs":{"tier1":0,"tier2":0,"tier1Rate":0.85,"tier2Rate":0.85},"hoh":{"tier1":25000,"tier2":34000,"tier1Rate":0.5,"tier2Rate":0.85},"qw":{"tier1":25000,"tier2":34000,"tier1Rate":0.5,"tier2Rate":0.85}}'::jsonb,
  '{"single":{"rate":0.009,"threshold":200000},"mfj":{"rate":0.009,"threshold":250000},"mfs":{"rate":0.009,"threshold":125000},"hoh":{"rate":0.009,"threshold":200000},"qw":{"rate":0.009,"threshold":250000}}'::jsonb,
  '{"single":{"rate":0.038,"threshold":200000},"mfj":{"rate":0.038,"threshold":250000},"mfs":{"rate":0.038,"threshold":125000},"hoh":{"rate":0.038,"threshold":200000},"qw":{"rate":0.038,"threshold":250000}}'::jsonb,
  '{"single":{"exemption":88100,"phaseoutStart":626350,"phaseoutRate":0.25,"rate26":0.26,"rate28":0.28,"rate28Threshold":239100},"mfj":{"exemption":137000,"phaseoutStart":1252700,"phaseoutRate":0.25,"rate26":0.26,"rate28":0.28,"rate28Threshold":239100},"mfs":{"exemption":68500,"phaseoutStart":626350,"phaseoutRate":0.25,"rate26":0.26,"rate28":0.28,"rate28Threshold":119550},"hoh":{"exemption":88100,"phaseoutStart":626350,"phaseoutRate":0.25,"rate26":0.26,"rate28":0.28,"rate28Threshold":239100},"qw":{"exemption":137000,"phaseoutStart":1252700,"phaseoutRate":0.25,"rate26":0.26,"rate28":0.28,"rate28Threshold":239100}}'::jsonb,
  '{"single":{"agiTiers":[23750,25750,39500],"rates":[0.5,0.2,0.1]},"mfj":{"agiTiers":[47500,51500,79000],"rates":[0.5,0.2,0.1]},"mfs":{"agiTiers":[23750,25750,39500],"rates":[0.5,0.2,0.1]},"hoh":{"agiTiers":[35625,38625,59250],"rates":[0.5,0.2,0.1]},"qw":{"agiTiers":[47500,51500,79000],"rates":[0.5,0.2,0.1]}}'::jsonb,
  '{"section179Limit":1250000,"section179Phaseout":3130000,"bonusPct":0.4,"firstYearMacrs":{"3":0.3333,"5":0.2,"7":0.1429,"10":0.1,"15":0.05,"20":0.0375,"27.5":0.03636363636363636,"39":0.02564102564102564,"straight_line":0.1}}'::jsonb,
  '{"single":{"0":{"maxAgi":19104,"maxCredit":649,"phaseInRate":0.0765,"phaseOutRate":0.0765,"phaseOutStart":10620},"1":{"maxAgi":50434,"maxCredit":4328,"phaseInRate":0.34,"phaseOutRate":0.1598,"phaseOutStart":23350},"2":{"maxAgi":57310,"maxCredit":7152,"phaseInRate":0.4,"phaseOutRate":0.2106,"phaseOutStart":23350},"3":{"maxAgi":61555,"maxCredit":8046,"phaseInRate":0.45,"phaseOutRate":0.2106,"phaseOutStart":23350}},"hoh":{"0":{"maxAgi":19104,"maxCredit":649,"phaseInRate":0.0765,"phaseOutRate":0.0765,"phaseOutStart":10620},"1":{"maxAgi":50434,"maxCredit":4328,"phaseInRate":0.34,"phaseOutRate":0.1598,"phaseOutStart":23350},"2":{"maxAgi":57310,"maxCredit":7152,"phaseInRate":0.4,"phaseOutRate":0.2106,"phaseOutStart":23350},"3":{"maxAgi":61555,"maxCredit":8046,"phaseInRate":0.45,"phaseOutRate":0.2106,"phaseOutStart":23350}},"mfj":{"0":{"maxAgi":26214,"maxCredit":649,"phaseInRate":0.0765,"phaseOutRate":0.0765,"phaseOutStart":17730},"1":{"maxAgi":57554,"maxCredit":4328,"phaseInRate":0.34,"phaseOutRate":0.1598,"phaseOutStart":30470},"2":{"maxAgi":64430,"maxCredit":7152,"phaseInRate":0.4,"phaseOutRate":0.2106,"phaseOutStart":30470},"3":{"maxAgi":68675,"maxCredit":8046,"phaseInRate":0.45,"phaseOutRate":0.2106,"phaseOutStart":30470}},"qw":{"0":{"maxAgi":26214,"maxCredit":649,"phaseInRate":0.0765,"phaseOutRate":0.0765,"phaseOutStart":17730},"1":{"maxAgi":57554,"maxCredit":4328,"phaseInRate":0.34,"phaseOutRate":0.1598,"phaseOutStart":30470},"2":{"maxAgi":64430,"maxCredit":7152,"phaseInRate":0.4,"phaseOutRate":0.2106,"phaseOutStart":30470},"3":{"maxAgi":68675,"maxCredit":8046,"phaseInRate":0.45,"phaseOutRate":0.2106,"phaseOutStart":30470}},"mfs":{"0":{"maxAgi":0,"maxCredit":0,"phaseInRate":0,"phaseOutRate":0,"phaseOutStart":0}}}'::jsonb,
  '{"exclusionLimit":130000,"housingBasePct":0.16,"housingCapPct":0.3}'::jsonb,
  '{"maxExpenseOne":3000,"maxExpenseTwo":6000,"rates":[{"agi":15000,"rate":0.35},{"agi":17000,"rate":0.34},{"agi":19000,"rate":0.33},{"agi":21000,"rate":0.32},{"agi":23000,"rate":0.31},{"agi":25000,"rate":0.3},{"agi":27000,"rate":0.29},{"agi":29000,"rate":0.28},{"agi":31000,"rate":0.27},{"agi":33000,"rate":0.26},{"agi":35000,"rate":0.25},{"agi":37000,"rate":0.24},{"agi":39000,"rate":0.23},{"agi":41000,"rate":0.22},{"agi":43000,"rate":0.21},{"agi":9007199254740991,"rate":0.2}]}'::jsonb,
  '{"ssRate":0.124,"medicareRate":0.029,"incomeFactor":0.9235}'::jsonb,
  '{"earlyWithdrawalRate":0.1,"hsaAdditionalTaxRate":0.2}'::jsonb,
  '{"rate":0.15,"baseSingle":5000,"baseMfjBoth":7500,"baseMfjOne":5000,"baseMfs":3750,"agiThresholdSingle":7500,"agiThresholdMfj":10000,"agiThresholdMfs":5000}'::jsonb,
  '{"cleanEnergyRate":0.3,"fuelCellCapPerHalfKw":500,"energyEfficientRate":0.3,"generalImprovementAnnualCap":1200,"windowsCap":600,"doorsCap":500,"auditCap":150,"centralAcCap":600,"furnaceBoilerCap":600,"heatPumpsBiomassCap":2000}'::jsonb,
  '{"capHighRate":2000,"highRateThreshold":0.2}'::jsonb,
  '{"newVehicleMax":7500,"usedVehicleMax":4000,"usedVehicleSalePriceCap":25000,"usedVehiclePctCap":0.3}'::jsonb,
  '{"simplifiedRatePerSqft":5,"simplifiedMaxSqft":300}'::jsonb,
  '{"allowanceMaxDefault":25000,"allowanceMaxMfsApart":12500,"agiStartDefault":100000,"agiEndDefault":150000,"agiStartMfs":50000,"agiEndMfs":75000,"phaseoutRate":0.5}'::jsonb,
  '{"highIncomeSafeHarborMultiplier":1.1,"regularSafeHarborMultiplier":1,"currentYearPct":0.9,"deMinimis":1000,"estimatedRate":0.08,"highIncomeThreshold":150000,"highIncomeThresholdMfs":75000}'::jsonb,
  '{"ssMedicareRate":0.153,"futaNetRate":0.006}'::jsonb,
  '{"refundablePerChild":1700,"earnedIncomeThreshold":2500,"phaseInRate":0.15,"phaseoutPer1000":50,"odcPerDependent":500}'::jsonb,
  '{"contributionBands":[{"fpl":150,"pct":0},{"fpl":200,"pct":0.02},{"fpl":250,"pct":0.04},{"fpl":300,"pct":0.06},{"fpl":400,"pct":0.085}],"repaymentCapSingle":[{"fpl":200,"cap":400},{"fpl":300,"cap":975},{"fpl":400,"cap":1625}],"repaymentCapFamily":[{"fpl":200,"cap":800},{"fpl":300,"cap":1950},{"fpl":400,"cap":3250}]}'::jsonb,
  11950,
  -- Task #38: §199A QBI thresholds — 2025 values (Rev. Proc. 2024-40).
  '{"thresholds":{"single":241950,"mfj":483900,"mfs":241950,"hoh":241950,"qw":483900},"deductionRate":0.2}'::jsonb,
  now()
)
ON CONFLICT (tax_year) DO NOTHING;
