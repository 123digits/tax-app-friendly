# Plan: 2025 Tax Prep Web App (Vue + Vuetify + vite-express + pglite)

## Context

Starting from a fresh repo (only `README.md` + `.git`). Goal: a TurboTax/H&R-Block–style web application that:

- Guides the user through preparing their **2025 federal return**, covering 1040 plus common schedules (A, B, C, D).
- Uses **Vue 3 + Vuetify** on the frontend.
- Uses **vite-express** (https://github.com/szymmis/vite-express) so a single Node process serves the Vite dev server + Express API.
- Persists data to a **Postgres-compatible** store — the app itself spins it up via **pglite** (`@electric-sql/pglite`), an embedded Postgres that runs in the Node process. No Docker required.
- Supports **multi-user auth**: username + password login with **email-based two-factor**, codes expire after 5 minutes.
- Is written in **TypeScript** (client and server).
- Uses a **hybrid UX**: top-level sections (Personal, Income, Deductions, Self-Employment, Capital Gains, Review) with guided wizard steps inside each section.

2025 tax values (brackets, standard deduction, credit amounts) are the official IRS-published figures (Rev. Proc. 2024-40 and related Notices). They are seeded into the admin-editable `tax_year_configs` table directly from `server/db/schema.sql` via an `INSERT ... ON CONFLICT (tax_year) DO NOTHING` block, which makes the database the single source of truth at runtime. Admins can edit the seeded values via the admin UI and can clone this config forward to 2026 once the IRS publishes Rev. Proc. 2026.

## High-Level Architecture

```
tax-app-friendly/
├── package.json              # single package — both client and server
├── tsconfig.json             # base
├── tsconfig.server.json      # server-specific (Node)
├── vite.config.ts            # Vue plugin + Vuetify plugin
├── index.html                # Vite entry
├── .env.example              # JWT_SECRET, SMTP_*, APP_ORIGIN, DATA_ENCRYPTION_KEY
│
├── shared/                   # Types shared by client + server
│   └── types.ts              # TaxReturn, FilingStatus, W2, etc.
│
├── src/                      # Vue 3 client (TypeScript)
│   ├── main.ts
│   ├── App.vue
│   ├── plugins/
│   │   ├── vuetify.ts
│   │   └── pinia.ts
│   ├── router/index.ts       # routes + auth guard
│   ├── api/client.ts         # fetch wrapper; sends cookie credentials
│   ├── stores/
│   │   ├── auth.ts           # Pinia — current user, login/logout
│   │   └── taxReturn.ts      # current return, autosave
│   ├── components/
│   │   ├── AppShell.vue      # nav drawer + toolbar
│   │   ├── WizardStep.vue    # Back / Next / progress
│   │   ├── CurrencyInput.vue
│   │   ├── SsnInput.vue
│   │   └── SectionCard.vue
│   └── views/
│       ├── auth/
│       │   ├── LoginView.vue
│       │   ├── RegisterView.vue
│       │   └── TwoFactorView.vue
│       ├── DashboardView.vue
│       └── sections/
│           ├── PersonalInfoSection.vue
│           ├── IncomeSection.vue                # W-2s
│           ├── InterestDividendsSection.vue     # Schedule B
│           ├── SelfEmploymentSection.vue        # Schedule C
│           ├── CapitalGainsSection.vue          # Schedule D
│           ├── DeductionsSection.vue            # Std vs Schedule A
│           └── ReviewSection.vue
│
└── server/                   # Express app served by vite-express
    ├── index.ts              # bootstraps Express + ViteExpress + DB
    ├── db/
    │   ├── pglite.ts         # singleton PGlite instance, persisted to ./data
    │   ├── schema.sql        # CREATE TABLE statements
    │   └── migrate.ts        # runs schema.sql idempotently at startup
    ├── middleware/
    │   ├── requireAuth.ts    # checks session cookie
    │   └── errorHandler.ts
    ├── routes/
    │   ├── auth.ts           # register, login, 2fa/verify, logout, me
    │   ├── taxReturn.ts      # GET/PUT current return, section upserts
    │   └── dev.ts            # dev-only: last 2FA code (gated by NODE_ENV)
    ├── services/
    │   ├── password.ts       # argon2 hash/verify
    │   ├── session.ts        # httpOnly cookie sessions
    │   ├── twoFactor.ts      # 6-digit code, 5-min expiry, single-use
    │   ├── email.ts          # nodemailer; dev transport logs to console
    │   ├── crypto.ts         # AES-256-GCM for SSNs
    │   ├── taxStatutory.ts   # non-year-indexed statutory constants (SE rates)
    │   └── taxCalculator.ts  # pure functions
    └── types/index.ts
```

### Why a single `package.json`

vite-express runs one Node process that hosts both the Vite dev server and Express routes. A single package keeps dev simple (`npm run dev`) and lets us import `shared/types.ts` from both sides without monorepo tooling.

## Database Schema (pglite, Postgres syntax)

All tables use UUID PKs generated with Node's `crypto.randomUUID()`.

```sql
-- Users & auth
users(id uuid pk, username text unique, email text unique, password_hash text,
      email_verified bool, created_at timestamptz)
sessions(id uuid pk, user_id uuid fk, expires_at timestamptz, created_at timestamptz)
two_factor_codes(id uuid pk, user_id uuid fk, code_hash text,
                 purpose text,             -- 'login' | 'email_verify'
                 expires_at timestamptz,   -- now + 5 minutes
                 consumed_at timestamptz null,
                 attempts int default 0,
                 created_at timestamptz)

-- Tax returns
tax_returns(id uuid pk, user_id uuid fk, tax_year int default 2025,
            filing_status text,           -- single|mfj|mfs|hoh|qw
            status text,                  -- in_progress|complete
            created_at, updated_at)

personal_info(return_id uuid pk fk, first_name, last_name, ssn_encrypted,
              dob date, address_line1, address_line2, city, state, zip,
              spouse_first_name, spouse_last_name, spouse_ssn_encrypted, spouse_dob)

dependents(id uuid pk, return_id uuid fk, name, ssn_encrypted,
           relationship, dob date, is_qualifying_child bool)

w2_income(id uuid pk, return_id uuid fk, employer, ein,
          box1_wages numeric, box2_fed_withheld numeric,
          box3_ss_wages numeric, box4_ss_withheld numeric,
          box5_medicare_wages numeric, box6_medicare_withheld numeric,
          state_wages numeric, state_withheld numeric)

interest_income(id, return_id, payer, amount numeric)              -- Sched B
dividend_income(id, return_id, payer, ordinary numeric,
                qualified numeric)                                  -- Sched B

self_employment(id, return_id, business_name, ein, principal_activity,
                gross_receipts numeric, returns_allowances numeric,
                cost_of_goods numeric,
                expenses jsonb)                                     -- Sched C line items

capital_gains(id, return_id, description, date_acquired date,
              date_sold date, proceeds numeric, cost_basis numeric,
              term text)                                            -- 'short' | 'long'

itemized_deductions(return_id uuid pk fk,
                    medical numeric, state_local_tax numeric,
                    real_estate_tax numeric, mortgage_interest numeric,
                    charitable_cash numeric, charitable_noncash numeric)

-- Generic catchall for interview answers not yet promoted to structured columns
interview_answers(return_id uuid, key text, value jsonb, primary key(return_id, key))
```

SSN fields are encrypted at rest with AES-256-GCM using a key from env (`DATA_ENCRYPTION_KEY`). Decrypted only server-side on explicit read; never shipped to the client except last-4.

## Key Flows

### Registration + Email Verification
1. `POST /api/auth/register` → create user (`email_verified=false`), insert `two_factor_codes` row with `purpose='email_verify'`, email the 6-digit code (in dev: log to console + expose via `/api/dev/last-code` when `NODE_ENV !== 'production'`).
2. `POST /api/auth/verify-email` with `{code}` → mark `email_verified=true`, consume code.

### Login + 2FA
1. `POST /api/auth/login` with `{username, password}` → verify with argon2 → issue a short-lived **pending** cookie (`pending_session`), create `two_factor_codes` row (`purpose='login'`, `expires_at=now()+5m`), email code.
2. `POST /api/auth/two-factor/verify` with `{code}` → validate cookie + code + expiry + not consumed + attempts < 5 → consume → create real `sessions` row → set httpOnly `session` cookie → clear `pending_session`.
3. `POST /api/auth/logout` → delete session row + clear cookie.
4. `GET /api/auth/me` → returns current user or 401.

### Tax Return Flow
- On first login, auto-create a `tax_returns` row for 2025 if none exists.
- `GET /api/return` returns the whole return (all child sections) in one payload.
- `PUT /api/return/personal-info`, `PUT /api/return/w2`, etc. — section-scoped upserts.
- Frontend debounces autosave on blur / 1s idle.
- `GET /api/return/compute` returns calculated results (AGI, taxable income, tax, credits, refund/balance due) using pure functions in `taxCalculator.ts`. No persistence — recomputed on demand.

### Interview UX (Hybrid)
- **Dashboard** shows section cards with per-section progress chips (e.g. "3 of 5 steps"), driven by a static `sections.ts` config.
- Clicking a section opens a **wizard** (`WizardStep.vue` layout) with linear Back/Next. Steps are Vue components in an array — easy to add questions.
- A right-rail running total (estimated refund/owed) updates after each step via `/api/return/compute`.

## Tax Calculation (2025)

The 2025 tax-year constants (brackets, standard deduction, CTC per child, CTC phase-out starts, SS wage base, LTCG brackets, etc.) are seeded into `tax_year_configs` from the `INSERT ... ON CONFLICT (tax_year) DO NOTHING` block at the bottom of `server/db/schema.sql`. The admin-editable row is loaded at runtime via `getConfig(2025)` in `server/services/taxYearConfig.ts` and passed into the calculator as a `TaxYearConstants` value (shape defined in `shared/types.ts`). Non-year-indexed statutory rates (SE tax rates) live in `server/services/taxStatutory.ts`.

All values are the official IRS-published 2025 figures (Rev. Proc. 2024-40). `taxCalculator.ts` / the `tax/` calculator modules are pure TypeScript (no I/O), trivially unit-testable — tests load the seeded 2025 row from the DB at `beforeAll` time.

Computation order:
1. Total income = W-2 wages + interest + ordinary dividends + Sched C net profit + capital gains (net of losses, capped at $3k ordinary loss).
2. Adjustments: 1/2 SE tax deduction.
3. AGI → larger of standard deduction vs Schedule A total → taxable income.
4. Regular tax using brackets; LTCG/qualified dividends taxed separately via LTCG brackets.
5. Credits: CTC (with phaseout), EITC placeholder.
6. Other taxes: SE tax.
7. Payments: W-2 withholding + estimated payments.
8. Refund or balance due.

## Security Notes

- `argon2` for passwords.
- Sessions: random 32-byte token, stored hashed; cookie `HttpOnly; SameSite=Lax; Secure` (Secure only in prod).
- Rate-limit login + 2FA verify endpoints (`express-rate-limit`).
- 2FA codes: 6 digits, SHA-256 hashed at rest, single-use, 5-minute expiry, max 5 attempts per code.
- CSRF: double-submit cookie on state-changing requests (or rely on SameSite=Lax + custom header `X-Requested-With`).
- SSN encrypted (AES-256-GCM) with env-supplied key.
- `helmet` for security headers.

## Dependencies (single `package.json`)

**Client**: `vue@^3`, `vue-router@^4`, `pinia`, `vuetify@^3`, `@mdi/font`
**Server**: `express`, `vite-express`, `@electric-sql/pglite`, `argon2`, `nodemailer`, `zod` (validation), `cookie-parser`, `express-rate-limit`, `helmet`
**Dev**: `typescript`, `vite`, `@vitejs/plugin-vue`, `vite-plugin-vuetify`, `tsx` (run TS server in dev), `@types/express`, `@types/node`, `@types/nodemailer`, `vitest` (optional tests)

Scripts:
- `dev` → `tsx watch server/index.ts` (ViteExpress detects dev and wires Vite)
- `build` → `vite build` then `tsc -p tsconfig.server.json`
- `start` → `NODE_ENV=production node dist/server/index.js`

## Verification Plan

1. `npm install` — clean install.
2. `npm run dev` — opens on http://localhost:3000. Server log shows "pglite initialized; schema migrated".
3. Register a user; verification code is logged to the server console; verify email; log in; login 2FA code is logged; enter it → reach dashboard.
4. Walk through each section with sample data (W-2 $75k/$8k withheld, MFJ, 1 dependent, $200 interest, $1k qualified dividends, small Sched C).
5. Visit Review — confirm computed AGI, taxable income, tax, CTC, refund/balance match hand calc against the 2025 seed values in `server/db/schema.sql`.
6. Reload — data persisted (pglite writes to `./data`). Log out / log back in — same data.
7. (Optional) `vitest run` against `taxCalculator.ts` — golden-number tests per filing status.

---

## Out of Scope — Candidate Next Steps

These are explicitly **not** included in the initial build but are natural follow-ups. Grouped by theme so they can be picked up independently.

### Filing & Output
- **PDF generation of Form 1040** and schedules (A/B/C/D) using `pdf-lib` or filling the IRS fillable PDFs.
- **E-file submission** integration (IRS MeF is gated; third-party providers like TaxAct/Drake APIs). Probably too heavy for a personal tool — more realistic: generate print-and-mail PDFs.
- **Export / download** of raw return data as JSON for backup.
- **Print-friendly summary view** — pretty-printed one-page summary of the return.

### Import & OCR
- **W-2 PDF/image import** via OCR (Tesseract or cloud OCR) auto-populating `w2_income` rows.
- **1099 import** (INT, DIV, B, NEC, MISC) — especially **1099-B CSV import** from brokerages (Fidelity, Schwab, Vanguard). Big UX win for Schedule D.
- **Prior-year return import**: parse last year's PDF to carry over name/address/dependents/SSNs/basis for wash-sale tracking.
- **IRS transcript import** via IRS API (requires user's IRS.gov credentials).

### Tax Scope Expansion
- **State returns** — start with one state (e.g. your home state), then expand. Schema extension: `state_returns(return_id, state_code, ...)`.
- **Additional schedules**:
    - Schedule E (rental / royalty / partnership / S-corp income)
    - Schedule SE (separated from Schedule C, with proper calc)
    - Schedule 1/2/3 (additional income, taxes, credits)
    - Form 8606 (nondeductible IRA / Roth conversions)
    - Form 8889 (HSA)
    - Form 2441 (dependent care credit)
    - Form 8863 (education credits)
    - Form 4562 (depreciation)
- **AMT calculation** (Form 6251).
- **NIIT** (Form 8960) — 3.8% net investment income tax.
- **Additional Medicare Tax** (Form 8959).
- **Foreign income** (Form 2555, Form 1116).

### UX / Features
- **What-if scenarios** — clone the current return, tweak values, compare side-by-side.
- **Deduction optimizer** — auto-pick std vs itemized, recommend HSA/401(k) contributions to reduce tax.
- **Interview branching logic** — skip sections based on earlier answers (e.g. hide Sched C if "no self-employment income").
- **Progress persistence + resume** — precise "you left off at step 3 of Income" resume point.
- **Dark mode** (Vuetify theme toggle — small lift).
- **Accessibility audit** (WCAG AA), keyboard nav, screen reader pass.
- **i18n** — especially Spanish; IRS publishes forms in Spanish.
- **Mobile responsive review** — Vuetify is mobile-friendly by default but needs pass-through testing.
- **Inline help tooltips** citing the relevant IRS instruction text.

### Multi-User / Collaboration
- **Preparer mode** — one user (the preparer) managing returns for multiple clients with per-client permissions.
- **Spouse co-editing** for MFJ — both spouses can log in and fill their own sections.
- **Audit log** — every field change recorded with timestamp + user.
- **Role-based access** — admin / preparer / client.

### Security Hardening
- **TOTP authenticator app** as a 2FA option (in addition to email codes).
- **Passkeys / WebAuthn** for login.
- **Backup codes** when 2FA is enabled.
- **KMS-backed encryption keys** (AWS KMS / GCP KMS) instead of env-supplied key.
- **Full at-rest encryption** of the pglite database file.
- **Session device management** — list active sessions, revoke individually.
- **Email SPF/DKIM/DMARC** hardening for 2FA emails in production.
- **Rate limiting by IP + account** with exponential backoff.
- **Account lockout** after N failed logins, with email notification.

### Data / Infra
- **Migrate pglite → real Postgres** when deploying (same SQL schema should just work).
- **Scheduled backups** of the pglite data dir (simple cron-style job copying `./data`).
- **Migration tooling** (`drizzle-kit` or `node-pg-migrate`) for schema evolution.
- **Seed / demo mode** — button to populate a sample return for screenshots/demos.

### Testing & Quality
- **Unit tests** for `taxCalculator.ts` — golden-number tests per filing status × scenario.
- **Integration tests** for auth + 2FA flow using `supertest`.
- **E2E tests** with Playwright walking a full return end-to-end.
- **CI** — GitHub Actions running `tsc`, `vitest`, `eslint`, `playwright`.
- **Coverage target** on `taxCalculator.ts` at 100%.

### DevEx
- **Docker Compose** for one-command prod-like run (Postgres + built app).
- **Storybook** for Vuetify component catalog.
- **ESLint + Prettier + lint-staged + Husky** pre-commit hooks.
- **OpenAPI spec** for the API surface (or tRPC for end-to-end types).
