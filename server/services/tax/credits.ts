import type { Dependent, FilingStatus, TaxYearConstants } from '../../../shared/types.js';

export function computeCtc(
  dependents: Dependent[],
  agi: number,
  filingStatus: FilingStatus,
  constants: TaxYearConstants
): number {
  const qualifying = dependents.filter((d) => d.isQualifyingChild).length;
  if (qualifying === 0) return 0;
  const base = qualifying * constants.ctcPerChild;
  const threshold = constants.ctcPhaseoutStart[filingStatus];
  if (agi <= threshold) return base;
  const over = agi - threshold;
  const reduction = Math.ceil(over / 1000) * 50;
  return Math.max(0, base - reduction);
}
