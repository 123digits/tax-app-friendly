import { describe, it, expect, beforeAll } from 'vitest';
import { computeTaxableSocialSecurity } from './ssBenefits.js';
import { runMigrations } from '../../db/migrate.js';
import { getConfig } from '../taxYearConfig.js';
import type {
  SocialSecurityBenefits,
  SsTaxabilityRow,
  TaxYearConstants,
} from '../../../shared/types.js';

let DEFAULT_2025: TaxYearConstants;
let singleTier: SsTaxabilityRow;
let mfjTier: SsTaxabilityRow;
beforeAll(async () => {
  await runMigrations();
  const c = await getConfig(2025);
  if (!c) throw new Error('2025 tax year config not seeded');
  DEFAULT_2025 = c;
  singleTier = DEFAULT_2025.ssTaxability!.single;
  mfjTier = DEFAULT_2025.ssTaxability!.mfj;
});

function makeSs(gross: number): SocialSecurityBenefits {
  return {
    grossBenefits: gross,
    medicarePremiums: 0,
    federalWithheld: 0,
  };
}

describe('computeTaxableSocialSecurity', () => {
  it('zero benefits → zero taxable', () => {
    const result = computeTaxableSocialSecurity(
      makeSs(0),
      50000,
      0,
      'single',
      singleTier,
    );
    expect(result.gross).toBeCloseTo(0, 0);
    expect(result.taxable).toBeCloseTo(0, 0);
  });

  it('below tier1 (single, $10k benefits, $15k other income) → 0% taxable', () => {
    // provisional = 15000 + 0 + 10000/2 = 20000, well below single tier1 ($25k)
    const result = computeTaxableSocialSecurity(
      makeSs(10000),
      15000,
      0,
      'single',
      singleTier,
    );
    expect(result.gross).toBeCloseTo(10000, 0);
    expect(result.taxable).toBeCloseTo(0, 0);
  });

  it('between tier1 and tier2 (single, $10k benefits, $28k other income) → 50% tier', () => {
    // provisional = 28000 + 0 + 5000 = 33000 (between single $25k and $34k)
    // taxable = min(10000 * 0.5, (33000 - 25000) * 0.5) = min(5000, 4000) = 4000
    const result = computeTaxableSocialSecurity(
      makeSs(10000),
      28000,
      0,
      'single',
      singleTier,
    );
    expect(result.gross).toBeCloseTo(10000, 0);
    expect(result.taxable).toBeCloseTo(4000, 0);
  });

  it('§86(b)(2): tax-exempt interest pushes provisional income across tier1', () => {
    // Other AGI $20k, gross $10k → provisional would be $25k (exactly at tier1).
    // Add $5k tax-exempt interest → provisional = $20k + $5k + $5k = $30k.
    // Between single tier1 ($25k) and tier2 ($34k) → 50% tier.
    // Taxable = min(10000 × 0.5, (30000 − 25000) × 0.5) = min($5,000, $2,500) = $2,500.
    const result = computeTaxableSocialSecurity(
      makeSs(10000),
      20000,
      5000, // tax-exempt interest
      'single',
      singleTier,
    );
    expect(result.taxable).toBeCloseTo(2500, 0);
  });

  it('above tier2 (MFJ, $20k benefits, $60k other income) → 85% tier', () => {
    // provisional = 60000 + 0 + 10000 = 70000 (above MFJ tier2 $44k)
    const result = computeTaxableSocialSecurity(
      makeSs(20000),
      60000,
      0,
      'mfj',
      mfjTier,
    );
    expect(result.gross).toBeCloseTo(20000, 0);
    expect(result.taxable).toBeGreaterThan(10000);
    expect(result.taxable).toBeLessThanOrEqual(17000);
  });
});
