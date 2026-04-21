import type { FilingStatus, PassiveLossConstants } from '../../../shared/types.js';

// IRC §469 / Form 8582 statutory constants are supplied via the optional
// `constants` argument (falling back to documented defaults) so the tax-year
// config can drive them without code changes.

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

export interface PassiveEntry {
  id: string;
  net: number;
  priorYearUnallowedLoss: number;
}

export interface OtherPassiveEntry extends PassiveEntry {
  kind: 'rental' | 'k1';
}

export interface PassiveLossResult {
  passiveIncome: number;
  passiveLossesAllowed: number;
  netPassive: number;
  suspendedRental: Array<{ id: string; amount: number }>;
  suspendedK1: Array<{ id: string; amount: number }>;
  totalSuspendedRental: number;
  totalSuspendedK1: number;
  specialAllowanceApplied: number;
}

function specialAllowanceCap(
  agi: number,
  fs: FilingStatus,
  mfsLivedApart: boolean,
  constants?: PassiveLossConstants,
): number {
  if (fs === 'mfs' && !mfsLivedApart) return 0;
  const allowanceMaxDefault = constants?.allowanceMaxDefault ?? 25000;
  const allowanceMaxMfsApart = constants?.allowanceMaxMfsApart ?? 12500;
  const agiStartDefault = constants?.agiStartDefault ?? 100000;
  const agiEndDefault = constants?.agiEndDefault ?? 150000;
  const agiStartMfs = constants?.agiStartMfs ?? 50000;
  const agiEndMfs = constants?.agiEndMfs ?? 75000;
  const phaseoutRate = constants?.phaseoutRate ?? 0.5;
  const max =
    fs === 'mfs' && mfsLivedApart
      ? allowanceMaxMfsApart
      : allowanceMaxDefault;
  const start = fs === 'mfs' ? agiStartMfs : agiStartDefault;
  const end = fs === 'mfs' ? agiEndMfs : agiEndDefault;
  if (agi <= start) return max;
  if (agi >= end) return 0;
  const reduction = (agi - start) * phaseoutRate;
  return Math.max(0, max - reduction);
}

/**
 * Combine each entry's current-year `net` with its prior-year unallowed loss
 * (a negative addition). Returns the same array shape plus an `effective`
 * field.
 */
function effectiveEntries<T extends PassiveEntry>(entries: T[]): Array<T & { effective: number }> {
  return entries.map((e) => ({
    ...e,
    // `priorYearUnallowedLoss` may be stored as a positive magnitude
    // (conventional) or as a negative number in some data paths. Use
    // Math.abs so either sign convention is honored — the loss magnitude
    // is always subtracted from the current-year net.
    effective: (Number(e.net) || 0) - Math.abs(Number(e.priorYearUnallowedLoss) || 0),
  }));
}

/**
 * Pro-rata allocation of a loss amount across the loss entries (those with
 * effective < 0). Each entry's share is proportional to its |effective|.
 */
function allocatePro(entries: Array<{ id: string; effective: number }>, totalAllowed: number): {
  allowed: Map<string, number>;
  suspended: Map<string, number>;
} {
  const allowed = new Map<string, number>();
  const suspended = new Map<string, number>();
  const losses = entries.filter((e) => e.effective < 0);
  const totalLoss = losses.reduce((a, e) => a + -e.effective, 0);
  if (totalLoss <= 0) {
    return { allowed, suspended };
  }
  const use = Math.min(totalAllowed, totalLoss);
  for (const e of losses) {
    const share = (-e.effective / totalLoss) * use;
    allowed.set(e.id, round(share));
    suspended.set(e.id, round(-e.effective - share));
  }
  return { allowed, suspended };
}

/**
 * Apply Form 8582 passive-loss limits. See IRC §469 and Form 8582 instructions.
 */
export function applyPassiveLossLimits(
  activeRentals: PassiveEntry[],
  otherPassive: OtherPassiveEntry[],
  agi: number,
  filingStatus: FilingStatus,
  mfsLivedApart: boolean = false,
  constants?: PassiveLossConstants,
): PassiveLossResult {
  const poolA = effectiveEntries(activeRentals);
  const poolB = effectiveEntries(otherPassive);

  // Passive income (only positives) across both pools.
  const poolAIncome = poolA.filter((e) => e.effective > 0).reduce((a, e) => a + e.effective, 0);
  const poolBIncome = poolB.filter((e) => e.effective > 0).reduce((a, e) => a + e.effective, 0);
  const totalPassiveIncome = poolAIncome + poolBIncome;

  // Raw losses (magnitudes).
  const poolALoss = poolA.filter((e) => e.effective < 0).reduce((a, e) => a + -e.effective, 0);
  const poolBLoss = poolB.filter((e) => e.effective < 0).reduce((a, e) => a + -e.effective, 0);

  // Step 1: Pool A losses offset passive income first (all passive income
  // from both pools is available). Track how much passive income remains for
  // pool B after pool A uses it.
  const poolAAgainstIncome = Math.min(poolALoss, totalPassiveIncome);
  const passiveIncomeRemainingAfterA = totalPassiveIncome - poolAAgainstIncome;
  const poolALossRemaining = poolALoss - poolAAgainstIncome;

  // Step 2: Special allowance on pool A residual.
  const specialCap = specialAllowanceCap(agi, filingStatus, mfsLivedApart, constants);
  const poolAViaSpecial = Math.min(poolALossRemaining, specialCap);

  const poolAAllowed = poolAAgainstIncome + poolAViaSpecial;

  // Step 3: Pool B losses against whatever passive income remains.
  const poolBAllowed = Math.min(poolBLoss, passiveIncomeRemainingAfterA);

  const passiveLossesAllowed = poolAAllowed + poolBAllowed;
  const netPassive = round(totalPassiveIncome - passiveLossesAllowed);

  // Step 4: Allocate suspended losses pro-rata per entry.
  const allocA = allocatePro(poolA, poolAAllowed);
  const allocB = allocatePro(poolB, poolBAllowed);

  const suspendedRental: Array<{ id: string; amount: number }> = [];
  const suspendedK1: Array<{ id: string; amount: number }> = [];

  for (const e of poolA) {
    if (e.effective < 0) {
      const s = allocA.suspended.get(e.id) ?? 0;
      if (s > 0) suspendedRental.push({ id: e.id, amount: s });
    }
  }
  for (const e of poolB) {
    if (e.effective < 0) {
      const s = allocB.suspended.get(e.id) ?? 0;
      if (s > 0) {
        const origKind = otherPassive.find((o) => o.id === e.id)?.kind ?? 'rental';
        if (origKind === 'rental') suspendedRental.push({ id: e.id, amount: s });
        else suspendedK1.push({ id: e.id, amount: s });
      }
    }
  }

  const totalSuspendedRental = round(suspendedRental.reduce((a, s) => a + s.amount, 0));
  const totalSuspendedK1 = round(suspendedK1.reduce((a, s) => a + s.amount, 0));

  return {
    passiveIncome: round(totalPassiveIncome),
    passiveLossesAllowed: round(passiveLossesAllowed),
    netPassive,
    suspendedRental,
    suspendedK1,
    totalSuspendedRental,
    totalSuspendedK1,
    specialAllowanceApplied: round(poolAViaSpecial),
  };
}
