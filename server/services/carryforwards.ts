// Cross-year carryforward store (Task #49).
//
// Rows in the `carryforwards` table are keyed on (user_id, tax_year, kind,
// ref_id). They describe an amount AVAILABLE TO APPLY against the row's
// tax_year — i.e. an incoming carryforward. The calculator orchestrator:
//
//   - at the START of computeReturn: reads prior-year rows
//     (tax_year = currentYear - 1) and feeds them into form-specific
//     helpers. The legacy user-entered carryforward fields on TaxReturn
//     still win when non-zero (user override); the table is only
//     consulted as a fallback when those fields are zero.
//
//   - at the END of computeReturn: upserts the newly-computed end-of-year
//     carryforwards as rows keyed on (userId, currentYear, kind, ref_id).
//
// Kinds modeled:
//   - ftc (= foreign_tax_credit) — Form 1116 unused foreign tax credit, per
//     basket category (ref_id = 'passive' | 'general' | …).
//   - amt_credit — Form 8801 prior-year minimum tax credit (§53).
//   - passive_loss / passive_loss_rental / passive_loss_k1 — Form 8582
//     unallowed loss; ref_id = originating property or K-1 id when known.
//   - capital_loss_short / capital_loss_long — §1212(b) Pub 550 carryover.
//   - charitable — per 50% / 30% / 20% limit class (ref_id = '50'|'30'|'20').
//   - section_179 — §179(b)(3) disallowed-amount carryforward.
//   - nol — §172 net operating loss.
//   - qbi_loss — §199A aggregate QBI loss carryforward.
//
// student_loan_interest_suspended is intentionally NOT a kind: §221 allows
// no carryforward for disallowed student-loan interest deduction.

import type { PGlite } from '@electric-sql/pglite';
import type { Carryforward, CarryforwardInput, CarryforwardKind } from '../../shared/types.js';
import { getDb } from '../db/pglite.js';
import { newId } from './crypto.js';

interface CarryforwardRow {
  id: string;
  user_id: string;
  tax_year: number | string;
  kind: string;
  ref_id: string | null;
  amount: string | number;
  source_return_id: string | null;
  notes: string | null;
}

function fromRow(r: CarryforwardRow): Carryforward {
  return {
    id: r.id,
    userId: r.user_id,
    taxYear: Number(r.tax_year),
    kind: r.kind as CarryforwardKind,
    refId: r.ref_id,
    amount: Number(r.amount),
    sourceReturnId: r.source_return_id ?? null,
    notes: r.notes,
  };
}

/**
 * Read every carryforward row for (userId, taxYear). Rows with tax_year
 * equal to the argument are INCOMING — i.e. they apply against the return
 * for that year. Callers who want prior-year rows should pass
 * `currentYear - 1` (see `getPriorYearCarryforwards`).
 */
export async function listCarryforwards(
  userId: string,
  taxYear: number,
  db?: PGlite,
): Promise<Carryforward[]> {
  const d = db ?? (await getDb());
  const res = await d.query<CarryforwardRow>(
    `SELECT id, user_id, tax_year, kind, ref_id, amount, source_return_id, notes
       FROM carryforwards
      WHERE user_id = $1 AND tax_year = $2
      ORDER BY kind, ref_id NULLS FIRST`,
    [userId, taxYear],
  );
  return res.rows.map(fromRow);
}

/**
 * Read prior-year carryforwards: rows keyed on tax_year = taxYear − 1.
 * These are the amounts AVAILABLE AT THE START of `taxYear`. Callers
 * should feed these into form-specific helpers before compute runs.
 */
export async function getPriorYearCarryforwards(
  userId: string,
  taxYear: number,
  db?: PGlite,
): Promise<Carryforward[]> {
  return listCarryforwards(userId, taxYear - 1, db);
}

/**
 * Upsert end-of-year carryforwards for (userId, taxYear). Rows with
 * amount === 0 are deleted (so a kind that was non-zero last year but
 * is now zero doesn't linger).
 *
 * Idempotent on the UNIQUE(user_id, tax_year, kind, COALESCE(ref_id, ''))
 * index: re-running compute for the same year overwrites the prior row
 * with the newest amount.
 */
export async function writeCarryforwards(
  userId: string,
  taxYear: number,
  rows: CarryforwardInput[],
  db?: PGlite,
): Promise<void> {
  const d = db ?? (await getDb());
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    const refId = row.refId ?? null;
    const sourceReturnId = row.sourceReturnId ?? null;
    const notes = row.notes ?? null;
    if (amount === 0) {
      // Clear any stale row for this slot so a carryforward that dropped
      // to zero this year doesn't remain visible on next year's return.
      await d.query(
        `DELETE FROM carryforwards
           WHERE user_id = $1
             AND tax_year = $2
             AND kind = $3
             AND COALESCE(ref_id, '') = COALESCE($4, '')`,
        [userId, taxYear, row.kind, refId],
      );
      continue;
    }
    const id = row.id ?? newId();
    // Expression-indexed unique: COALESCE(ref_id, '') makes NULL collide
    // with NULL, matching the index definition in schema.sql. ON CONFLICT
    // targeting the same expression keeps upsert semantics.
    await d.query(
      `INSERT INTO carryforwards
         (id, user_id, tax_year, kind, ref_id, amount, source_return_id, notes,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       ON CONFLICT (user_id, tax_year, kind, COALESCE(ref_id, ''))
         DO UPDATE SET
           amount = EXCLUDED.amount,
           source_return_id = EXCLUDED.source_return_id,
           notes = EXCLUDED.notes,
           updated_at = now()`,
      [id, userId, taxYear, row.kind, refId, amount, sourceReturnId, notes],
    );
  }
}

/**
 * Convenience: find-and-sum all rows of a given kind for (userId, taxYear).
 * Useful when the orchestrator just wants the scalar incoming amount (e.g.
 * "total prior-year capital-loss carryforward, short-term").
 */
export function sumKind(
  rows: Carryforward[],
  kind: CarryforwardKind,
  refId?: string | null,
): number {
  return rows
    .filter((r) => r.kind === kind && (refId === undefined || r.refId === refId))
    .reduce((a, r) => a + (Number(r.amount) || 0), 0);
}
