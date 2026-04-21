import type { Dependent, FilingStatus, TaxYearConstants } from '../../../shared/types.js';

export function computeCtc(
  dependents: Dependent[],
  agi: number,
  filingStatus: FilingStatus,
  constants: TaxYearConstants
): number {
  const qualifying = dependents.filter((d) => d.isQualifyingChild).length;
  const base = qualifying * constants.ctcPerChild;
  const threshold = constants.ctcPhaseoutStart[filingStatus];
  const over = Math.max(0, agi - threshold);
  const reduction = Math.ceil(over / 1000) * 50;
  return Math.max(0, base - reduction);
}
