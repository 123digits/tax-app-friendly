// Exercises loadFullReturn's num(r.field)/|| 0 fallback branches by raw-
// inserting rows whose numeric columns are NULL (or using default values),
// then fetching via GET /api/return.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { bootstrap, createUser, loginAs } from '../test-utils/fixtures.js';
import { getDb } from '../db/pglite.js';
import { newId } from '../services/crypto.js';

let app: Express;

beforeAll(async () => {
  app = await bootstrap();
});

async function authed() {
  const user = await createUser();
  const cookies = await loginAs(app, user);
  return { user, cookies };
}

describe('loadFullReturn — num() fallback for NULL columns', () => {
  it('returns a complete return object when child rows carry SQL defaults', async () => {
    const { user, cookies } = await authed();
    const db = await getDb();

    // Seed a return row + one minimally-populated child per list table with
    // mostly-default values (which show up as `null` or zero-numeric once
    // loaded).
    const rid = newId();
    await db.query(
      `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1,$2,$3)`,
      [rid, user.id, 2025],
    );
    await db.query(`INSERT INTO personal_info (return_id) VALUES ($1)`, [rid]);
    await db.query(`INSERT INTO itemized_deductions (return_id) VALUES ($1)`, [rid]);

    // A W-2 with just employer set — all box fields default to 0.
    await db.query(
      `INSERT INTO w2_income (id, return_id, employer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Minimal Co'],
    );
    // Interest + dividend with nulls
    await db.query(
      `INSERT INTO interest_income (id, return_id, payer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'X Bank'],
    );
    await db.query(
      `INSERT INTO dividend_income (id, return_id, payer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Y Broker'],
    );
    // Self-employment
    await db.query(
      `INSERT INTO self_employment (id, return_id, business_name) VALUES ($1,$2,$3)`,
      [newId(), rid, 'X'],
    );
    // Retirement
    await db.query(
      `INSERT INTO retirement_income (id, return_id, payer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Fidelity'],
    );
    // Social security (single row)
    await db.query(
      `INSERT INTO social_security_benefits (return_id) VALUES ($1)`,
      [rid],
    );
    // Unemployment
    await db.query(
      `INSERT INTO unemployment_income (id, return_id, payer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'State'],
    );
    // Gambling
    await db.query(
      `INSERT INTO gambling_winnings (id, return_id, payer) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Casino'],
    );
    // Other income
    await db.query(
      `INSERT INTO other_income (id, return_id, source) VALUES ($1,$2,$3)`,
      [newId(), rid, 'other'],
    );
    // Capital gain
    await db.query(
      `INSERT INTO capital_gains (id, return_id, description) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Mystery stock'],
    );
    // Schedule E rental
    await db.query(
      `INSERT INTO schedule_e_rental (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Schedule E royalty
    await db.query(
      `INSERT INTO schedule_e_royalty (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // K-1 (entity_kind is NOT NULL).
    await db.query(
      `INSERT INTO k1_income (id, return_id, entity_kind) VALUES ($1,$2,$3)`,
      [newId(), rid, 'partnership'],
    );
    // Schedule F
    await db.query(
      `INSERT INTO schedule_f_farm (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Form 4797
    await db.query(
      `INSERT INTO form_4797_sales (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Depreciation
    await db.query(
      `INSERT INTO depreciation_assets (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Home office
    await db.query(
      `INSERT INTO home_office_expenses (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Dependents
    await db.query(
      `INSERT INTO dependents (id, return_id, name) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Kid'],
    );
    // Form 8606 (single row per return)
    await db.query(
      `INSERT INTO form_8606 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8889
    await db.query(
      `INSERT INTO form_8889 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 2441
    await db.query(
      `INSERT INTO form_2441 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8880
    await db.query(
      `INSERT INTO form_8880 (return_id) VALUES ($1)`,
      [rid],
    );
    // Schedule R
    await db.query(
      `INSERT INTO schedule_r (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8396
    await db.query(
      `INSERT INTO form_8396 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 5695
    await db.query(
      `INSERT INTO form_5695 (return_id) VALUES ($1)`,
      [rid],
    );
    // Schedule 8812
    await db.query(
      `INSERT INTO schedule_8812 (return_id) VALUES ($1)`,
      [rid],
    );
    // EITC eligibility
    await db.query(
      `INSERT INTO eitc_eligibility (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8962
    await db.query(
      `INSERT INTO form_8962 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 6251
    await db.query(
      `INSERT INTO form_6251 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8960
    await db.query(
      `INSERT INTO form_8960 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8959
    await db.query(
      `INSERT INTO form_8959 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 2555
    await db.query(
      `INSERT INTO form_2555 (return_id) VALUES ($1)`,
      [rid],
    );
    // Schedule H
    await db.query(
      `INSERT INTO schedule_h (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 2210
    await db.query(
      `INSERT INTO form_2210 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 5405
    await db.query(
      `INSERT INTO form_5405 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 4972
    await db.query(
      `INSERT INTO form_4972 (return_id) VALUES ($1)`,
      [rid],
    );
    // Form 8995 + one activity
    await db.query(
      `INSERT INTO form_8995 (return_id) VALUES ($1)`,
      [rid],
    );
    await db.query(
      `INSERT INTO form_8995_activities (id, return_id, qbi) VALUES ($1,$2,$3)`,
      [newId(), rid, 0],
    );
    // Form 8863 student
    await db.query(
      `INSERT INTO form_8863_students (id, return_id, student_name) VALUES ($1,$2,$3)`,
      [newId(), rid, 'Student'],
    );
    // Form 8936 vehicle
    await db.query(
      `INSERT INTO form_8936_vehicles (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Form 1116 basket
    await db.query(
      `INSERT INTO form_1116_baskets (id, return_id) VALUES ($1,$2)`,
      [newId(), rid],
    );
    // Schedule 1 adjustments
    await db.query(
      `INSERT INTO schedule_1_adjustments (return_id) VALUES ($1)`,
      [rid],
    );

    const res = await request(app).get('/api/return').query({ year: 2025 }).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.w2s[0].employer).toBe('Minimal Co');
    expect(res.body.w2s[0].box1Wages).toBe(0);
    expect(res.body.interest).toHaveLength(1);
    expect(res.body.dividends).toHaveLength(1);
    expect(res.body.dependents).toHaveLength(1);
    expect(res.body.form8995.activities).toHaveLength(1);
    expect(res.body.form8863Students).toHaveLength(1);
    expect(res.body.form8936Vehicles).toHaveLength(1);
    expect(res.body.form1116Baskets).toHaveLength(1);
    expect(res.body.socialSecurity.grossBenefits).toBe(0);
    expect(res.body.form6251.privateActivityBondInterest).toBe(0);
  });

  it('compute runs without error on a sparse return', async () => {
    const { user, cookies } = await authed();
    const db = await getDb();
    const rid = newId();
    await db.query(
      `INSERT INTO tax_returns (id, user_id, tax_year) VALUES ($1,$2,$3)`,
      [rid, user.id, 2025],
    );
    await db.query(`INSERT INTO personal_info (return_id) VALUES ($1)`, [rid]);
    await db.query(`INSERT INTO itemized_deductions (return_id) VALUES ($1)`, [rid]);
    const res = await request(app).get('/api/return/compute').query({ year: 2025 }).set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});
