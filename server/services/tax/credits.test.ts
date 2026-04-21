import { describe, it, expect } from 'vitest';
import { computeCtc } from './credits.js';
import type { TaxYearConstants } from '../../../shared/types.js';

const constants = {
  ctcPerChild: 2000,
  ctcPhaseoutStart: { single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qw: 200000 },
} as unknown as TaxYearConstants;

describe('computeCtc', () => {
  it('returns 0 when no qualifying children', () => {
    expect(computeCtc([], 0, 'single', constants)).toBe(0);
  });

  it('returns base amount for two qualifying children below phaseout', () => {
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
      { id: '2', name: 'B', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
    ];
    expect(computeCtc(deps, 100000, 'single', constants)).toBe(4000);
  });

  it('phases out $50 per $1,000 over threshold', () => {
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
    ];
    // single phaseout 200000; AGI 210000 → 10 x 50 = 500 reduction → 1500
    expect(computeCtc(deps, 210000, 'single', constants)).toBe(1500);
  });

  it('floors at zero when phaseout exceeds base', () => {
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
    ];
    expect(computeCtc(deps, 1_000_000, 'single', constants)).toBe(0);
  });

  it('ignores non-qualifying dependents', () => {
    // Mix two qualifying kids with one non-qualifying dependent — should
    // only count the two qualifying ones.
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
      { id: '2', name: 'B', ssnLast4: null, relationship: 'daughter', dob: null, isQualifyingChild: true },
      { id: '3', name: 'C', ssnLast4: null, relationship: 'parent', dob: null, isQualifyingChild: false },
    ];
    expect(computeCtc(deps, 100000, 'single', constants)).toBe(4000);
  });

  it('only non-qualifying dependents → 0', () => {
    const deps = [
      { id: '1', name: 'P', ssnLast4: null, relationship: 'parent', dob: null, isQualifyingChild: false },
      { id: '2', name: 'S', ssnLast4: null, relationship: 'sibling', dob: null, isQualifyingChild: false },
    ];
    expect(computeCtc(deps, 100000, 'single', constants)).toBe(0);
  });

  it('AGI exactly at phaseout threshold is not phased out', () => {
    // Boundary test for `agi <= threshold`. At threshold, full credit applies.
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
    ];
    expect(computeCtc(deps, 200000, 'single', constants)).toBe(2000);
  });

  it('AGI one dollar above threshold triggers the first $50 phaseout', () => {
    const deps = [
      { id: '1', name: 'A', ssnLast4: null, relationship: 'son', dob: null, isQualifyingChild: true },
    ];
    // ceil(1/1000) = 1 → 50 reduction → 2000 - 50 = 1950
    expect(computeCtc(deps, 200001, 'single', constants)).toBe(1950);
  });
});
