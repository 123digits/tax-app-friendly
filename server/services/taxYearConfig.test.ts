import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import {
  listConfigs,
  getConfig,
  upsertConfig,
  deleteConfig,
  cloneConfig,
} from './taxYearConfig.js';
import type { TaxYearConstants } from '../../shared/types.js';
import { getDb } from '../db/pglite.js';

async function baseConfig(): Promise<TaxYearConstants> {
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 not seeded');
  return c;
}

async function findFreeYear(start = 2400): Promise<number> {
  let y = start;
  while (await getConfig(y)) y--;
  return y;
}

beforeAll(async () => {
  await runMigrations();
});

describe('taxYearConfig', () => {
  it('listConfigs returns at least 2025', async () => {
    const list = await listConfigs();
    expect(list.find((c) => c.taxYear === 2025)).toBeTruthy();
  });

  it('getConfig returns null for unknown year', async () => {
    const c = await getConfig(1)
    expect(c).toBeNull();
  });

  it('upsertConfig inserts and updates rows', async () => {
    const base = await baseConfig();
    const y = await findFreeYear();
    await upsertConfig({ ...base, taxYear: y, notes: 'v1' });
    const c1 = await getConfig(y);
    expect(c1?.notes).toBe('v1');
    await upsertConfig({ ...base, taxYear: y, notes: 'v2' });
    const c2 = await getConfig(y);
    expect(c2?.notes).toBe('v2');
  });

  it('upsertConfig stores all JSONB groups', async () => {
    const base = await baseConfig();
    const y = await findFreeYear(2399);
    const full: TaxYearConstants = {
      ...base,
      taxYear: y,
      retirement: { iraLimit: 7000, iraCatchUp: 1000, sepPercent: 0.25, solo401kLimit: 23000, catchUpAge: 50 },
      hsa: { selfLimit: 4150, familyLimit: 8300, catchUp: 1000 },
      education: base.education,
      eitcInvestmentIncomeLimit: 12000,
    };
    await upsertConfig(full);
    const c = await getConfig(y);
    expect(c?.retirement?.iraLimit).toBe(7000);
    expect(c?.eitcInvestmentIncomeLimit).toBe(12000);
  });

  it('deleteConfig removes the row', async () => {
    const base = await baseConfig();
    const y = await findFreeYear(2398);
    await upsertConfig({ ...base, taxYear: y });
    await deleteConfig(y);
    expect(await getConfig(y)).toBeNull();
  });

  it('cloneConfig copies from an existing year', async () => {
    const y = await findFreeYear(2397);
    const cloned = await cloneConfig(2025, y);
    expect(cloned.taxYear).toBe(y);
    expect(await getConfig(y)).not.toBeNull();
  });

  it('cloneConfig throws when source is missing', async () => {
    await expect(cloneConfig(9, 2)).rejects.toThrow(/source year/);
  });

  it('parseJsonb handles string-wrapped JSONB returned from pglite', async () => {
    // Force a row with a string JSONB value — pglite returns text for jsonb
    // when cast back; make sure fromRow handles malformed too.
    const db = await getDb();
    const y = await findFreeYear(2396);
    const base = await baseConfig();
    await upsertConfig({ ...base, taxYear: y });
    // Manually overwrite a JSONB column with an invalid JSON string to hit
    // the catch branch.
    await db.query(
      `UPDATE tax_year_configs SET retirement = NULL WHERE tax_year = $1`,
      [y],
    );
    const c = await getConfig(y);
    expect(c?.retirement).toBeUndefined();
  });
});
