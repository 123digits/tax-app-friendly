import { describe, it, expect } from 'vitest';
import { computeForm8959 } from './form8959.js';
import type { AdditionalMedicareRow, Form8959 } from '../../../shared/types.js';

function row(): AdditionalMedicareRow {
  return { rate: 0.009, threshold: 200000 };
}

function base(overrides: Partial<Form8959> = {}): Form8959 {
  return {
    rrtaCompensation: 0,
    additionalMedicareWithheld: 0,
    ...overrides,
  };
}

describe('computeForm8959', () => {
  it('returns zeros with no config row', () => {
    const r = computeForm8959(base(), 'single', 300000, 0, undefined);
    expect(r.additionalMedicareTax).toBe(0);
    expect(r.netAdditionalMedicare).toBe(0);
  });

  it('wages below threshold → no additional tax', () => {
    const r = computeForm8959(base(), 'single', 150000, 0, row());
    expect(r.additionalMedicareTax).toBe(0);
  });

  it('$250k wages, single → $450 additional tax, Part V statutory withholding fully offsets', () => {
    const r = computeForm8959(base(), 'single', 250000, 0, row());
    // Part IV: ($250k - $200k) × 0.9% = $450.
    expect(r.additionalMedicareTax).toBeCloseTo(450, 2);
    // Part V line 24 employer withholding per §3102(f): ($250k - $200k) × 0.9% = $450.
    expect(r.additionalMedicareWithheld).toBeCloseTo(450, 2);
    // netAdditionalMedicare = tax − withheld = 0 (employer withholding covers it).
    expect(r.netAdditionalMedicare).toBe(0);
  });

  it('$300k SE earnings, no wages → ~$693.45', () => {
    // SE income for Medicare = $300k × 0.9235 = $277,050.
    // Excess over $200k threshold = $77,050 × 0.9% = $693.45.
    const r = computeForm8959(base(), 'single', 0, 300000, row());
    expect(r.additionalMedicareTax).toBeCloseTo(693.45, 2);
  });

  it('combined $150k wages + $100k SE net → SE threshold reduced', () => {
    // Part I: $150k wages under $200k → $0.
    // Part II: SE income = $100k × 0.9235 = $92,350.
    //   SE threshold = max(0, $200k − $150k) = $50k.
    //   Excess = $42,350 × 0.9% = $381.15.
    const r = computeForm8959(base(), 'single', 150000, 100000, row());
    expect(r.additionalMedicareTax).toBeCloseTo(381.15, 2);
  });

  it('employer over-withholding honored over statutory amount', () => {
    // $250k wages → $450 statutory Part V; user-input $500 (over-withheld).
    // Code uses max(statutory, user) so withheld = $500; net = 0.
    const r = computeForm8959(
      base({ additionalMedicareWithheld: 500 }),
      'single',
      250000,
      0,
      row(),
    );
    expect(r.additionalMedicareTax).toBeCloseTo(450, 2);
    expect(r.additionalMedicareWithheld).toBe(500);
    expect(r.netAdditionalMedicare).toBe(0);
  });

  it('RRTA compensation adds to additional Medicare tax', () => {
    // No wages, no SE, RRTA $300k → ($300k − $200k) × 0.9% = $900.
    const r = computeForm8959(
      base({ rrtaCompensation: 300000 }),
      'single',
      0,
      0,
      row(),
    );
    expect(r.additionalMedicareTax).toBeCloseTo(900, 2);
  });

  it('Part V line 24: employer $200k threshold independent of filing status (single)', () => {
    // Single: filing-status threshold is $200k so Part IV and Part V coincide here,
    // but the test's point is that the statutory computation uses wages − $200k.
    const r = computeForm8959(base(), 'single', 300000, 0, row());
    expect(r.additionalMedicareWithheld).toBeCloseTo(900, 2); // (300k − 200k) × 0.009
  });

  it('Part V line 24: employer $200k threshold independent of filing status (MFJ)', () => {
    // MFJ filing-status threshold is $250k so Part IV on $260k wages = ($260k − $250k) × 0.009 = $90.
    // But Part V employer-withholding threshold is fixed at $200k regardless: ($260k − $200k) × 0.009 = $540.
    const mfjRow: AdditionalMedicareRow = { rate: 0.009, threshold: 250000 };
    const r = computeForm8959(base(), 'mfj', 260000, 0, mfjRow);
    expect(r.additionalMedicareTax).toBeCloseTo(90, 2);
    expect(r.additionalMedicareWithheld).toBeCloseTo(540, 2);
  });

  it('Part V line 24: zero when wages ≤ $200k (even if Part I triggered by lower MFS threshold)', () => {
    // MFS row threshold is $125k; wages = $180k → Part IV = ($180k − $125k) × 0.009 = $495.
    // Part V = max(0, 180k − 200k) × 0.009 = 0 (no employer withholding required).
    const mfsRow: AdditionalMedicareRow = { rate: 0.009, threshold: 125000 };
    const r = computeForm8959(base(), 'mfs', 180000, 0, mfsRow);
    expect(r.additionalMedicareTax).toBeCloseTo(495, 2);
    expect(r.additionalMedicareWithheld).toBe(0);
  });
});
