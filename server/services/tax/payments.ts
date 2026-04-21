import type { W2Income, RetirementIncome } from '../../../shared/types.js';

export function sumW2Withholding(w2s: W2Income[]): number {
  return w2s.reduce((acc, w) => acc + (Number(w.box2FedWithheld) || 0), 0);
}

export function sumRetirementWithholding(items: RetirementIncome[]): number {
  return items.reduce((acc, r) => acc + (Number(r.federalWithheld) || 0), 0);
}

// §31(b) / Schedule 3 line 11: a filer with two or more W-2s whose combined
// box-4 Social Security tax withheld exceeds the statutory maximum
// (6.2% × ssWageBase) is entitled to claim the excess as a refundable
// payment. Applies per taxpayer. (Dual-spouse wage-base handling is a
// future improvement — this aggregates all W-2s on the return.)
export function computeExcessSocialSecurity(
  w2s: W2Income[] | undefined,
  ssWageBase: number,
): number {
  const list = w2s ?? [];
  if (list.length < 2) return 0;
  const maxSs = ssWageBase * 0.062;
  const totalWithheld = list.reduce(
    (s, w) => s + (Number(w.box4SsWithheld) || 0),
    0,
  );
  return Math.max(0, totalWithheld - maxSs);
}
