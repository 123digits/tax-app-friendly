import type { DepreciationAsset } from '../../../shared/types.js';
import type { DepreciationConstants } from '../../../shared/types.js';

export interface AssetDepreciation {
  id: string;
  businessId: string | null;
  section179: number;
  bonus: number;
  macrs: number;
  total: number;
}

export interface DepreciationSummary {
  byAsset: AssetDepreciation[];
  totalSection179: number;
  totalBonus: number;
  totalMacrs: number;
  total: number;
}

function n(v: unknown): number {
  return Number(v) || 0;
}

/**
 * Compute first-year depreciation for each asset:
 *   1. Business-use-adjusted basis = cost × businessUsePercent.
 *   2. §179 election (capped at remaining basis, subject to overall limit).
 *   3. Bonus depreciation on remaining basis (constants.bonusPct).
 *   4. MACRS on the final remaining basis.
 *
 * The per-return overall §179 limit + phase-out is applied after summing
 * elections: if total §179 elected exceeds the limit (reduced by investment
 * above phaseout), the excess is disallowed pro-rata across assets.
 *
 * First-year MACRS rates come from constants.firstYearMacrs (seeded from
 * the 2025 DB config per schema.sql). Absence of that map means the DB
 * isn't seeded — we throw rather than silently using stale duplicated
 * values.
 */
export function summarizeDepreciation(
  assets: DepreciationAsset[],
  constants: DepreciationConstants | undefined,
): DepreciationSummary {
  const limit = constants?.section179Limit ?? 0;
  const phaseoutStart = constants?.section179Phaseout ?? 0;
  const bonusPct = constants?.bonusPct ?? 0;
  const macrsTable = constants?.firstYearMacrs;
  if (!macrsTable) {
    throw new Error(
      'tax config missing depreciation.firstYearMacrs — DB not seeded?',
    );
  }

  // Total asset investment for §179 phaseout. Per IRC §179(b)(2), the
  // phase-out threshold is measured against the *cost* of §179 property
  // placed in service during the year — not the business-use-adjusted
  // basis used to compute the deduction itself.
  const totalInvestment = assets.reduce((a, x) => a + n(x.cost), 0);
  const phaseoutReduction =
    limit > 0 && phaseoutStart > 0 && totalInvestment > phaseoutStart
      ? totalInvestment - phaseoutStart
      : 0;
  const effectiveLimit = Math.max(0, limit - phaseoutReduction);

  // First pass: per-asset requested §179, requested bonus, requested MACRS.
  const requested: AssetDepreciation[] = assets.map((a) => {
    const pct = n(a.businessUsePercent) || 1;
    const basis = n(a.cost) * pct;
    const elected = Math.min(basis, Math.max(0, n(a.section179Election)));
    const afterS179 = Math.max(0, basis - elected);
    const bonus = a.claimBonus ? afterS179 * bonusPct : 0;
    const afterBonus = afterS179 - bonus;
    const rate = macrsTable[a.macrsClass] ?? 0.1;
    const macrs = afterBonus * rate;
    return {
      id: a.id,
      businessId: a.businessId ?? null,
      section179: elected,
      bonus,
      macrs,
      total: elected + bonus + macrs,
    };
  });

  // Apply §179 cap pro-rata if total elected exceeds effective limit.
  const totalElected = requested.reduce((a, x) => a + x.section179, 0);
  let byAsset = requested;
  if (totalElected > effectiveLimit && totalElected > 0) {
    const keepRatio = effectiveLimit / totalElected;
    byAsset = requested.map((r, i) => {
      const a = assets[i];
      const basis = n(a.cost) * (n(a.businessUsePercent) || 1);
      const newS179 = r.section179 * keepRatio;
      // Disallowed §179 rolls back into the depreciable basis (bonus + MACRS).
      const remainingAfterS179 = basis - newS179;
      const bonus = a.claimBonus ? remainingAfterS179 * bonusPct : 0;
      const afterBonus = remainingAfterS179 - bonus;
      const rate = macrsTable[a.macrsClass] ?? 0.1;
      const macrs = afterBonus * rate;
      return {
        id: r.id,
        businessId: r.businessId,
        section179: newS179,
        bonus,
        macrs,
        total: newS179 + bonus + macrs,
      };
    });
  }

  const totalSection179 = byAsset.reduce((a, x) => a + x.section179, 0);
  const totalBonus = byAsset.reduce((a, x) => a + x.bonus, 0);
  const totalMacrs = byAsset.reduce((a, x) => a + x.macrs, 0);
  return {
    byAsset,
    totalSection179,
    totalBonus,
    totalMacrs,
    total: totalSection179 + totalBonus + totalMacrs,
  };
}
