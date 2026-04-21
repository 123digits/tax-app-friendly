import type {
  TaxReturn,
  ComputedReturn,
  FilingStatus,
  TaxYearConstants,
  OwnerSpouse,
  ComputedSchedule1PartI,
  ComputedSchedule1PartII,
  ComputedSchedule2PartI,
  ComputedSchedule2PartII,
  ComputedSchedule3PartI,
  ComputedSchedule3PartII,
  Carryforward,
  CarryforwardInput,
} from '../../../shared/types.js';
import {
  getPriorYearCarryforwards,
  writeCarryforwards,
  sumKind,
} from '../carryforwards.js';

import {
  sumW2Wages,
  sumW2SsWages,
  sumInterest,
  sumTaxExemptInterest,
  sumPrivateActivityBondInterest,
  sumDividends,
  totalSeNetProfit,
  schedCNetProfit,
  splitCapitalGains,
  sumRetirementIncome,
  sumUnemployment,
  sumGambling,
  isScheduleBRequired,
  applyCapitalLossCap,
  computeCapitalLossCarryforward,
} from './income.js';
import { sumItemized } from './deductions.js';
import { computeSeTax, computeEarlyWithdrawalPenalty, type PerOwnerSeInput } from './otherTaxes.js';
import { farmNetProfit } from './scheduleF.js';
import { computeCtc } from './credits.js';
import {
  sumW2Withholding,
  sumRetirementWithholding,
  computeExcessSocialSecurity,
} from './payments.js';
import { computeTaxableSocialSecurity, sumSsFederalWithheld } from './ssBenefits.js';
import { sumOtherIncome } from './otherIncome.js';
import { classifyRentals, sumRoyaltyNet } from './scheduleE.js';
import { aggregateK1s } from './k1.js';
import { applyPassiveLossLimits, type OtherPassiveEntry } from './passiveLoss.js';
import { totalFarmNetProfit } from './scheduleF.js';
import { summarizeForm4797 } from './form4797.js';
import { summarizeDepreciation } from './form4562.js';
import { totalHomeOfficeDeduction } from './form8829.js';
import {
  computeSchedule1Adjustments,
  totalSchedule1Adjustments,
} from './adjustments.js';
import { computeForm8606 } from './form8606.js';
import { computeForm8889 } from './form8889.js';
import { computeForm2441 } from './form2441.js';
import { computeForm8863 } from './form8863.js';
import { computeForm8880 } from './form8880.js';
import { computeScheduleR } from './scheduleR.js';
import { computeForm8396 } from './form8396.js';
import { computeForm5695 } from './form5695.js';
import { computeForm8936 } from './form8936.js';
import { computeForm1116 } from './form1116.js';
import { computeSchedule8812 } from './schedule8812.js';
import { computeEitc } from './eitc.js';
import { computeForm8962 } from './form8962.js';
import { computeForm6251 } from './form6251.js';
import { computeForm8960 } from './form8960.js';
import { computeForm8959 } from './form8959.js';
import { computeForm2555 } from './form2555.js';
import { computeScheduleH } from './scheduleH.js';
import { computeForm2210 } from './form2210.js';
import { computeForm5405 } from './form5405.js';
import { computeForm4972 } from './form4972.js';
import { computeForm8995 } from './form8995.js';
import { computeIncomeTax, round } from './taxComputation.js';
import { applyCreditsInOrder } from './creditCascade.js';

export { applyBrackets, computeIncomeTax, round } from './taxComputation.js';
export {
  sumW2Wages,
  sumW2SsWages,
  sumInterest,
  sumDividends,
  schedCNetProfit,
  totalSeNetProfit,
  splitCapitalGains,
  sumRetirementIncome,
} from './income.js';
export { sumItemized } from './deductions.js';
export { computeSeTax, computeEarlyWithdrawalPenalty } from './otherTaxes.js';
export { computeCtc } from './credits.js';
export { sumW2Withholding, sumRetirementWithholding } from './payments.js';
export { computeTaxableSocialSecurity, sumSsFederalWithheld } from './ssBenefits.js';
export {
  sumUnemployment,
  sumGambling,
  isScheduleBRequired,
  applyCapitalLossCap,
  computeCapitalLossCarryforward,
} from './income.js';
export { sumOtherIncome, otherIncomeBySource } from './otherIncome.js';
export { rentalNetBeforeLimits, sumRoyaltyNet, classifyRentals } from './scheduleE.js';
export { aggregateK1s } from './k1.js';
export { applyPassiveLossLimits } from './passiveLoss.js';

// ----- Top-level orchestrator -----

export function computeReturn(ret: TaxReturn, constants: TaxYearConstants): ComputedReturn {
  const fs: FilingStatus = ret.filingStatus ?? 'single';

  // --- income ---
  const wages = sumW2Wages(ret.w2s);
  const w2SsWages = sumW2SsWages(ret.w2s);
  const withholding = sumW2Withholding(ret.w2s);
  const interest = sumInterest(ret.interest);
  const taxExemptInterest = sumTaxExemptInterest(ret.interest);
  const pabInterestFromInt = sumPrivateActivityBondInterest(ret.interest);
  const divs = sumDividends(ret.dividends);
  const schedCNet = totalSeNetProfit(ret.selfEmployment);
  const farmNet = totalFarmNetProfit(ret.farms ?? []);
  // summarizeDepreciation requires constants.depreciation (specifically its
  // firstYearMacrs map, seeded from schema.sql for 2025). It throws if the
  // group is missing — surfacing seed bugs loudly rather than silently
  // producing zero depreciation.
  const depSummary = summarizeDepreciation(
    ret.depreciationAssets ?? [],
    constants.depreciation,
  );
  const homeOfficeDed = totalHomeOfficeDeduction(ret.homeOffices ?? [], constants.homeOffice);
  // SE-tax base combines Schedule C + Schedule F farm profit, reduced by
  // depreciation (Form 4562) and home-office use-of-home (Form 8829). Both
  // flow to 1040 as business profit and are subject to SE tax.
  const seNetProfit = schedCNet + farmNet - depSummary.total - homeOfficeDed;

  // IRC §1402(b): on MFJ, each spouse has their own SS wage-base ceiling.
  // Group Schedule C + Schedule F profit by `ownerSpouse`, and allocate the
  // aggregate Form 4562 depreciation and Form 8829 home-office deductions
  // proportionally to each spouse's gross Schedule C+F net (this preserves
  // overall totals while producing sensible per-spouse SE bases when
  // depreciation/home-office rows don't themselves carry an owner tag).
  // Similarly split W-2 box-3 SS wages by owner so Schedule SE Part I
  // line 8a reduces the correct spouse's remaining ceiling.
  const seByOwner: Record<OwnerSpouse, number> = { taxpayer: 0, spouse: 0 };
  for (const se of ret.selfEmployment ?? []) {
    const o: OwnerSpouse = se.ownerSpouse ?? 'taxpayer';
    seByOwner[o] += schedCNetProfit(se);
  }
  for (const f of ret.farms ?? []) {
    const o: OwnerSpouse = f.ownerSpouse ?? 'taxpayer';
    seByOwner[o] += farmNetProfit(f);
  }
  const grossOwnerTotal = seByOwner.taxpayer + seByOwner.spouse;
  // Guard division: if both spouses have zero SE, the grossOwnerTotal is
  // zero and we fall through to an all-taxpayer attribution (which will
  // produce zero SE tax anyway because seNetProfit ≤ 0).
  const tpShare = grossOwnerTotal !== 0 ? seByOwner.taxpayer / grossOwnerTotal : 1;
  const spShare = 1 - tpShare;
  const offset = depSummary.total + homeOfficeDed;
  const seByOwnerNet: Record<OwnerSpouse, number> = {
    taxpayer: seByOwner.taxpayer - offset * tpShare,
    spouse: seByOwner.spouse - offset * spShare,
  };

  const w2SsByOwner: Record<OwnerSpouse, number> = { taxpayer: 0, spouse: 0 };
  for (const w of ret.w2s ?? []) {
    const o: OwnerSpouse = w.ownerSpouse ?? 'taxpayer';
    w2SsByOwner[o] += Math.max(0, Number(w.box3SsWages) || 0);
  }

  const perOwnerSe: PerOwnerSeInput[] = [
    { owner: 'taxpayer', seEarnings: seByOwnerNet.taxpayer, w2SsWages: w2SsByOwner.taxpayer },
    { owner: 'spouse', seEarnings: seByOwnerNet.spouse, w2SsWages: w2SsByOwner.spouse },
  ];
  const { seTax, seTaxDeduction } = computeSeTax(
    perOwnerSe,
    fs,
    constants.ssWageBase,
    constants.seTax,
  );
  // Sanity: `seNetProfit`, `w2SsWages` still used downstream for AGI / passive
  // rollups and §31(b) excess SS withholding; reference them here so no
  // unused-variable lint fires when the per-owner path is taken.
  void seNetProfit;
  void w2SsWages;
  // Form 4797 business-property sales: §1231 pool net-gain → LTCG, net-loss →
  // ordinary; depreciation recapture (§1245/1250) is always ordinary; Part II
  // short-term rows are ordinary.
  // §1231(c) 5-year lookback: if current-year §1231 pool is a net gain, a
  // portion (up to the taxpayer's nonrecaptured prior-5-year §1231 losses)
  // is recharacterized as ordinary income rather than LTCG.
  const form4797 = summarizeForm4797(
    ret.form4797Sales ?? [],
    Math.max(0, Number(ret.priorYearNonrecaptured1231Losses) || 0),
  );
  const caps = splitCapitalGains(ret.capitalGains);
  // 1099-DIV Box 2a total capital gain distributions aggregate across all
  // dividend rows. Per Schedule D instructions, these land on Schedule D
  // line 13 as additional long-term capital gain (or, if no Schedule D is
  // required, directly on Form 1040 line 7). They are always long-term and
  // qualify for LTCG preferential rates. Box 2a alone can produce LTCG
  // treatment even when Schedule D is not otherwise required.
  const capGainDistributions = Math.max(0, divs.totalCapGainDistributions || 0);

  // IRC §1212(b): fold in prior-year capital-loss carryforwards by character
  // per Pub 550 Capital Loss Carryover Worksheet. Stored on the TaxReturn as
  // positive magnitudes; added here as losses (ST preserves ST, LT preserves
  // LT). These are ONLY used in the §1211(b)/§1212(b) netting below — the
  // raw `caps` values passed to preferential-rate computation elsewhere are
  // unchanged.
  const priorStLoss = Math.max(0, Number(ret.priorYearShortTermLossCarryforward) || 0);
  const priorLtLoss = Math.max(0, Number(ret.priorYearLongTermLossCarryforward) || 0);
  const stForCapLoss = caps.short - priorStLoss;
  const ltForCapLoss = caps.long + capGainDistributions - priorLtLoss;
  const netCapital = stForCapLoss + ltForCapLoss;

  // IRC §1211(b): $3,000 cap for most filers, $1,500 for MFS.
  let capitalLossDeduction = 0;
  let netCapitalForIncome = netCapital;
  if (netCapital < 0) {
    capitalLossDeduction = applyCapitalLossCap(netCapital, fs, constants.capitalLossLimit);
    netCapitalForIncome = capitalLossDeduction;
  }

  // IRC §1212(b) / Pub 550 Capital Loss Carryover Worksheet: compute the
  // disallowed portion that carries forward to next year, split by character.
  const capLossCarry = computeCapitalLossCarryforward(
    stForCapLoss,
    ltForCapLoss,
    fs,
    constants.capitalLossLimit,
  );

  const retire = sumRetirementIncome(ret.retirementIncome ?? []);
  const retirementWithheld = sumRetirementWithholding(ret.retirementIncome ?? []);
  const earlyWithdrawalPenalty = computeEarlyWithdrawalPenalty(
    ret.retirementIncome ?? [],
    constants.penalties,
  );

  const unemp = sumUnemployment(ret.unemployment ?? []);
  const gamb = sumGambling(ret.gambling ?? []);
  const otherInc = sumOtherIncome(ret.otherIncome ?? []);

  // --- Schedule E (rental + royalty) and K-1s (Phase 4) ---
  const rentalSplit = classifyRentals(ret.scheduleERentals ?? []);
  const royaltyNet = sumRoyaltyNet(ret.scheduleERoyalties ?? []);
  const k1Agg = aggregateK1s(ret.k1s ?? []);

  // Apply Form 8582 passive-loss limits using provisional AGI (before the
  // passive-loss deduction itself). §469 uses "modified AGI", which for most
  // filers is AGI without the passive-loss allowance.
  const provisionalAgiForPassive =
    wages + interest + divs.ordinary + seNetProfit + netCapitalForIncome +
    retire.taxable + unemp.amount + gamb.winnings + otherInc +
    rentalSplit.nonPassiveNet + royaltyNet +
    k1Agg.nonPassiveOrdinary + k1Agg.interest + k1Agg.ordinaryDividends +
    k1Agg.royalties + k1Agg.shortTermGain + k1Agg.longTermGain + k1Agg.section1231Gain +
    form4797.recapture + form4797.shortOrdinaryGain + form4797.ordinaryLoss + form4797.longTermCapitalGain
    + form4797.recaptured1231AsOrdinary
    - seTaxDeduction;
  const otherPassive: OtherPassiveEntry[] = [
    ...rentalSplit.otherPassiveEntries.map((e) => ({ ...e, kind: 'rental' as const })),
    ...k1Agg.passiveEntries.map((e) => ({ ...e, kind: 'k1' as const })),
  ];
  const passive = applyPassiveLossLimits(
    rentalSplit.activeParticipationEntries,
    otherPassive,
    provisionalAgiForPassive,
    fs,
    false,
    constants.passiveLoss,
  );

  // Partition effective (net - priorYearLoss) totals by family so we can
  // attribute the allowed passive amount back to rental vs K-1. Suspended
  // amounts are positive magnitudes of loss not allowed this year.
  const effSum = (arr: Array<{ net: number; priorYearUnallowedLoss: number }>): number =>
    arr.reduce(
      (a, e) =>
        a + (Number(e.net) || 0) - Math.max(0, Number(e.priorYearUnallowedLoss) || 0),
      0,
    );
  const rentalPassiveEff =
    effSum(rentalSplit.activeParticipationEntries) +
    effSum(rentalSplit.otherPassiveEntries);
  const k1PassiveEff = effSum(k1Agg.passiveEntries);

  // Allowed passive net per family = effective + suspended-back-to-this-family.
  const rentalPassiveAllowedNet = rentalPassiveEff + passive.totalSuspendedRental;
  const k1PassiveAllowedNet = k1PassiveEff + passive.totalSuspendedK1;

  const rentalNetForAgi = rentalSplit.nonPassiveNet + rentalPassiveAllowedNet;
  const k1OrdinaryForAgi = k1Agg.nonPassiveOrdinary + k1PassiveAllowedNet;

  // Social Security taxability depends on provisional income = other AGI
  // components + tax-exempt interest + ½ gross benefits. `otherAgi` here
  // excludes the SS taxable line itself.
  const otherAgi =
    wages + interest + divs.ordinary + seNetProfit + netCapitalForIncome +
    retire.taxable + unemp.amount + gamb.winnings + otherInc +
    rentalNetForAgi + royaltyNet +
    k1OrdinaryForAgi + k1Agg.interest + k1Agg.ordinaryDividends +
    k1Agg.royalties + k1Agg.shortTermGain + k1Agg.longTermGain + k1Agg.section1231Gain +
    form4797.recapture + form4797.shortOrdinaryGain + form4797.ordinaryLoss + form4797.longTermCapitalGain
    + form4797.recaptured1231AsOrdinary;
  const ssTier = constants.ssTaxability?.[fs];
  const ssResult = ret.socialSecurity && ssTier
    ? computeTaxableSocialSecurity(ret.socialSecurity, otherAgi, taxExemptInterest, fs, ssTier)
    : { gross: 0, taxable: 0 };
  const ssWithheld = ret.socialSecurity ? sumSsFederalWithheld(ret.socialSecurity) : 0;

  const totalIncome = round(otherAgi + ssResult.taxable);

  // --- Phase 6: Form 8889 (HSA) and Form 8606 (IRA basis pro-rata) ---
  const form8889Computed = computeForm8889(ret.form8889, constants.hsa, constants.penalties);
  const form8606Computed = computeForm8606(ret.form8606);

  // --- adjustments / AGI ---
  // Age (for IRA catch-up) derived from personal info DOB. Null if unknown.
  const dob = ret.personalInfo?.dob;
  const age: number | null = dob
    ? (() => {
        const y = Number(String(dob).slice(0, 4));
        return Number.isFinite(y) && y > 1900 ? ret.taxYear - y : null;
      })()
    : null;

  // Schedule 1 Part II lines (excludes HSA — computed separately from 8889).
  const schedule1Raw =
    ret.schedule1Adjustments ?? ({} as typeof ret.schedule1Adjustments);

  // Phase 10: Form 2555 foreign earned income exclusion — reduces AGI.
  // Computed before Schedule 1 so the SLI MAGI per IRC §221(b)(2)(C) can
  // add the FEIE (+ housing exclusion) back in the phase-out test.
  const form2555Computed = computeForm2555(ret.form2555, constants.feie);
  const feieExclusion = form2555Computed.totalExclusion;

  // Provisional AGI for student-loan phase-out: AGI before the SLI deduction
  // itself, but after other adjustments already subtracted (½ SE tax and
  // FEIE). The SLI helper then adds FEIE back per §221(b)(2)(C), producing a
  // MAGI ≥ AGI-before-SLI — required when the taxpayer excludes foreign
  // earned income. Critically, SLI itself is NOT subtracted from this base.
  const provisionalAgiForSli = totalIncome - seTaxDeduction - feieExclusion;
  const schedule1Lines = computeSchedule1Adjustments(
    schedule1Raw,
    provisionalAgiForSli,
    fs,
    age,
    constants.retirement,
    constants.education,
    feieExclusion,
  );
  const schedule1Total = totalSchedule1Adjustments(schedule1Lines);
  const hsaDeductionAllowed = form8889Computed.allowedDeduction;

  const adjustmentsTotal = round(
    seTaxDeduction + schedule1Total + hsaDeductionAllowed + feieExclusion,
  );
  const agi = round(totalIncome - adjustmentsTotal);

  // --- deductions ---
  const standardDeduction = constants.standardDeduction[fs];
  const itemizedDeduction = sumItemized(
    ret.itemized,
    agi,
    constants.saltCap,
    constants.medicalAgiThreshold
  );
  const useItemized = !ret.useStandardDeduction && itemizedDeduction > 0;
  const deductionUsed = useItemized ? itemizedDeduction : standardDeduction;

  // --- tax computation ---
  // 1040 line 11 (AGI) − line 12 (std/itemized) = "taxable income before QBI"
  // (working value, not a printed line). Line 13 is the QBI deduction.
  // Line 15 = line 11 − line 12 − line 13 = final taxable income.
  const taxableIncomeBeforeQbi = Math.max(0, round(agi - deductionUsed));

  // Include K-1 long-term capital gain alongside Schedule D long-term.
  // 1099-DIV Box 2a cap-gain distributions are always long-term and flow
  // into the LTCG preferential-rate pool (Schedule D line 13 / 1040 line 7).
  const effectiveLong =
    caps.long + capGainDistributions +
    (k1Agg.longTermGain || 0) + (form4797.longTermCapitalGain || 0);
  const effectiveShort = caps.short + (k1Agg.shortTermGain || 0);
  const netLongTerm = Math.max(0, effectiveLong + Math.min(0, effectiveShort));
  const totalQualifiedDivs = (divs.qualified || 0) + (k1Agg.qualifiedDividends || 0);
  const preferential = Math.max(0, netLongTerm) + totalQualifiedDivs;

  // Task #38: §199A QBI deduction on 1040 line 13. Deemed QBI from pass-
  // through activities (Schedule C + F net profit + K-1 qualified ordinary +
  // active rental net) when the taxpayer has not explicitly supplied Form
  // 8995 activity detail. 1099-DIV Box 5 section 199A dividends aggregate
  // into deemedReitPtpDividends.
  const deemedQbi = Math.max(
    0,
    schedCNet + farmNet - depSummary.total - homeOfficeDed,
  ) + Math.max(0, k1Agg.nonPassiveOrdinary || 0);
  const deemedReitPtpDividends = (ret.dividends ?? []).reduce(
    (a, d) => a + Math.max(0, Number(d.section199ADividends) || 0),
    0,
  );
  const form8995Computed = computeForm8995(
    ret.form8995,
    fs,
    taxableIncomeBeforeQbi,
    preferential,                     // net capital gain + qualified divs
    constants.qbi,
    deemedQbi,
    deemedReitPtpDividends,
  );
  const qbiDeduction = form8995Computed.qbiDeduction;

  // Final taxable income (1040 line 15) = line 11 − line 12 − line 13.
  const taxableIncome = Math.max(0, round(taxableIncomeBeforeQbi - qbiDeduction));
  const { regularTax, ltcgTax } = computeIncomeTax(taxableIncome, preferential, fs, constants);
  const totalTax = round(regularTax + ltcgTax);

  // --- credits ---
  // §§21(a)(2), 36B, 25B, etc. phase-outs are based on "the amount by which
  // [MAGI] exceeds" a threshold, which implies a non-negative base. A signed
  // AGI is correct for 1040 line 11 (used below), but downstream phase-out
  // modules should see a clamped value so a negative AGI cannot silently
  // place a return in the most-generous credit band.
  const agiForPhaseouts = Math.max(0, agi);
  // Phase 7 nonrefundable credits (CTC is now computed via Schedule 8812 below).
  const form2441Computed = computeForm2441(ret.form2441, agiForPhaseouts, fs, constants.childCare);
  const form8863Computed = computeForm8863(
    ret.form8863Students,
    agiForPhaseouts,
    fs,
    constants.education,
  );
  const form8880Computed = computeForm8880(
    ret.form8880,
    agiForPhaseouts,
    fs,
    constants.saversCredit?.[fs],
  );
  const scheduleRComputed = computeScheduleR(ret.scheduleR, agiForPhaseouts, fs, constants.scheduleRCredit);
  const form8396Computed = computeForm8396(ret.form8396, constants.mortgageCredit);
  const form5695Computed = computeForm5695(ret.form5695, constants.residentialEnergy);
  const form8936Computed = computeForm8936(ret.form8936Vehicles, constants.evCredit);
  // Compute Form 8962 early so its APTC repayment can feed the Form 1116
  // limitation denominator below. Per Form 1116 (2024) line 20, the US-tax
  // anchor = Form 1040 line 16 + Schedule 2 Part I (AMT + excess APTC
  // repayment). Part II items (SE tax, NIIT, Add'l Medicare, etc.) do NOT
  // anchor the FTC limitation.
  const form8962Computed = computeForm8962(ret.form8962, agiForPhaseouts, fs, constants.ptc);
  // Form 6251 AMT is Part I line 1; compute early so it can feed the Form
  // 1116 US-tax anchor alongside excess APTC repayment.
  // SALT actually taken on Schedule A (capped). Only an add-back when itemizing.
  const saltTakenForAmt = !ret.useStandardDeduction && itemizedDeduction > 0
    ? Math.min(
        constants.saltCap,
        (Number(ret.itemized?.stateLocalTax) || 0) +
          (Number(ret.itemized?.realEstateTax) || 0),
      )
    : 0;
  // Aggregate 1099-INT Box 9 PAB interest into Form 6251 input (line 2g).
  // User-entered form6251.privateActivityBondInterest (manual override from
  // K-1 / other non-1099 sources) is additive.
  const form6251WithPab = {
    ...(ret.form6251 ?? {}),
    privateActivityBondInterest:
      (Number(ret.form6251?.privateActivityBondInterest) || 0) + pabInterestFromInt,
  };
  const form6251Early = computeForm6251(
    form6251WithPab,
    fs,
    taxableIncome,
    round(regularTax + ltcgTax),
    saltTakenForAmt,
    0,
    constants.amt?.[fs],
    preferential,
    constants.ltcgBrackets[fs],
  );
  // Form 1116 limitation anchor = regular tax + LTCG tax + Schedule 2 Part I
  // (AMT + excess APTC repayment). Per §904(a)/(b) and Form 1116 (2024)
  // line 20.
  //
  // §904(d)(2)(F) HTKO threshold: highest US individual rate comes from the
  // top marginal bracket for the filing status (may be a single-filer-style
  // 37% today, but honors admin-configurable overrides for future years).
  const topBracket = constants.brackets[fs];
  const highestUsRate =
    topBracket && topBracket.length > 0
      ? (topBracket[topBracket.length - 1].rate ?? 0.37)
      : 0.37;
  const form1116Computed = computeForm1116(
    ret.form1116Baskets,
    round(regularTax + ltcgTax + form6251Early.amtLiability + form8962Computed.aptcRepayment),
    taxableIncome,
    highestUsRate,
  );

  // Pre-cascade (form-computed) credits — each is already capped at its own
  // phase-out and statutory cap. The ordered cascade below trims them further
  // against the aggregate §26(a) ceiling.
  const preForeignTaxCredit = form1116Computed.total;
  const preChildDependentCareCredit = form2441Computed.credit;
  // Phase 8: split Form 8863 into refundable AOTC (40%) and nonrefundable
  // (LLC + 60% of AOTC). Previously treated the whole thing as nonrefundable.
  const preEducationCredits = form8863Computed.nonrefundablePortion;
  const refundableAotc = form8863Computed.refundablePortion;
  const preSaversCredit = form8880Computed.credit;
  const preElderlyDisabledCredit = scheduleRComputed.credit;
  const preMortgageInterestCredit = form8396Computed.totalCredit;
  const preCleanEnergyCredit = form5695Computed.cleanEnergyCredit;            // §25D — Schedule 3 line 5a
  const preEnergyEfficientCredit = form5695Computed.energyEfficientCredit;    // §25C — Schedule 3 line 5b
  const preEvCredit = form8936Computed.personalUseCredit;

  // §26(a) — the nonrefundable-credit limitation anchor is tax liability =
  // regular tax (1040 line 16) + Schedule 2 Part I (line 17). Part II
  // (SE tax, NIIT, Add'l Medicare, etc.) is NOT absorbable by nonrefundable
  // credits.
  const schedule2PartITotalEarly = round(
    form6251Early.amtLiability + form8962Computed.aptcRepayment,
  );

  // Task #37: §26(a) ordered cascade in IRS Schedule 3 Part I order. CTC/ODC
  // is applied LAST via Schedule 8812 (it receives the post-cascade remaining
  // liability as its nonrefundable ceiling; whatever CTC is disallowed spills
  // to refundable ACTC per §24(h)(5) / §24(k)).
  const cascadeCeiling = Math.max(0, round(regularTax + ltcgTax + schedule2PartITotalEarly));
  const cascade = applyCreditsInOrder(cascadeCeiling, [
    { name: 'foreignTaxCredit',             amount: preForeignTaxCredit },            // line 1
    { name: 'childDependentCareCredit',     amount: preChildDependentCareCredit },    // line 2
    { name: 'educationCredits',             amount: preEducationCredits },            // line 3
    { name: 'saversCredit',                 amount: preSaversCredit },                // line 4
    { name: 'residentialCleanEnergy',       amount: preCleanEnergyCredit },           // line 5a
    { name: 'energyEfficientHomeImprovement', amount: preEnergyEfficientCredit },     // line 5b
    { name: 'mortgageInterestCredit',       amount: preMortgageInterestCredit },      // line 6c
    { name: 'elderlyDisabledCredit',        amount: preElderlyDisabledCredit },       // line 6d
    { name: 'cleanVehicleCredit',           amount: preEvCredit },                    // line 6f
  ]);
  const foreignTaxCredit            = round(cascade.allowedByCredit.foreignTaxCredit             || 0);
  const childDependentCareCredit    = round(cascade.allowedByCredit.childDependentCareCredit     || 0);
  const educationCredits            = round(cascade.allowedByCredit.educationCredits             || 0);
  const saversCredit                = round(cascade.allowedByCredit.saversCredit                 || 0);
  const cleanEnergyCreditAllowed    = round(cascade.allowedByCredit.residentialCleanEnergy       || 0);
  const energyEfficientCreditAllowed= round(cascade.allowedByCredit.energyEfficientHomeImprovement|| 0);
  const mortgageInterestCredit      = round(cascade.allowedByCredit.mortgageInterestCredit       || 0);
  const elderlyDisabledCredit       = round(cascade.allowedByCredit.elderlyDisabledCredit        || 0);
  const evCredit                    = round(cascade.allowedByCredit.cleanVehicleCredit           || 0);
  const residentialEnergyCredit     = round(cleanEnergyCreditAllowed + energyEfficientCreditAllowed);
  const otherNonrefundableCredits = round(
    foreignTaxCredit +
      childDependentCareCredit +
      educationCredits +
      saversCredit +
      residentialEnergyCredit +
      mortgageInterestCredit +
      elderlyDisabledCredit +
      evCredit,
  );
  // Remaining §26(a) liability after "other" credits — feeds Schedule 8812.
  const taxAfterOtherCredits = Math.max(0, round(cascade.remainingLiability));
  const schedule8812Computed = computeSchedule8812(
    ret.schedule8812,
    ret.dependents,
    fs,
    agiForPhaseouts,
    taxAfterOtherCredits,
    wages,
    seNetProfit,
    {
      ctcPerChild: constants.ctcPerChild,
      ctcPhaseoutStart: constants.ctcPhaseoutStart,
    },
    constants.actc,
  );
  const childTaxCredit = schedule8812Computed.nonrefundablePortion;
  const additionalChildTaxCredit = schedule8812Computed.refundablePortion;

  // Keep legacy computeCtc available for callers that still import it;
  // intentionally unused by the orchestrator now.
  void computeCtc;

  // Phase 8: EITC.
  // Investment-income test sums interest, ordinary dividends, net capital
  // gain, royalties, and net passive rental income.
  const netCapitalGainForEitc = Math.max(0, netCapital);
  const royaltiesForEitc = royaltyNet + (k1Agg.royalties || 0);
  const rentalPassiveForEitc = Math.max(0, rentalPassiveAllowedNet);
  const eitcComputed = computeEitc(
    ret.eitcEligibility,
    ret.dependents,
    fs,
    agiForPhaseouts,
    wages,
    seNetProfit,
    interest,
    divs.ordinary,
    netCapitalGainForEitc,
    royaltiesForEitc,
    rentalPassiveForEitc,
    constants.eitc,
    constants.eitcInvestmentIncomeLimit,
  );

  // form8962Computed was moved above (feeds Form 1116 limitation denominator).

  const nonrefundableCreditsSum = round(
    childTaxCredit + otherNonrefundableCredits,
  );
  // §26(a): nonrefundable credits cannot reduce tax liability below zero.
  // The ceiling is regular tax (1040 line 16) + Schedule 2 Part I (line 17),
  // NOT Part II (SE tax, NIIT, etc.). Part I here = AMT + excess APTC
  // repayment (form6251Early.amtLiability + form8962.aptcRepayment).
  const creditCeiling = round(regularTax + ltcgTax + schedule2PartITotalEarly);
  const totalCredits = Math.min(creditCeiling, nonrefundableCreditsSum);

  // Phase 8 refundable credits aggregate.
  const earnedIncomeCredit = eitcComputed.credit;
  const netPremiumTaxCredit = form8962Computed.refundablePtc;
  const aptcRepayment = form8962Computed.aptcRepayment;
  // §31(b) excess SS withholding when the filer has ≥2 W-2s and combined
  // box-4 exceeds the annual statutory maximum (6.2% × ssWageBase).
  const excessSocialSecurity = round(
    computeExcessSocialSecurity(ret.w2s, constants.ssWageBase),
  );
  const refundableCreditsTotal = round(
    additionalChildTaxCredit +
      refundableAotc +
      earnedIncomeCredit +
      netPremiumTaxCredit +
      excessSocialSecurity,
  );

  // --- Phase 9: AMT (Form 6251), NIIT (Form 8960), Add'l Medicare (Form 8959) ---
  // Form 6251 was computed earlier (feeds Form 1116 US-tax anchor); reuse it.
  const form6251Computed = form6251Early;
  // `saltTaken` retained for audit parity with previous order (unused here
  // now that form6251Early receives the value directly).
  void saltTakenForAmt;

  // Gross investment income for §1411 NIIT: interest, ordinary dividends,
  // net capital gain (positive only), royalties, K-1 investment items, and
  // net passive rental income.
  const grossInvestmentIncome =
    interest +
    divs.ordinary +
    Math.max(0, netCapital) +
    royaltyNet +
    (k1Agg.interest || 0) +
    (k1Agg.ordinaryDividends || 0) +
    (k1Agg.royalties || 0) +
    Math.max(0, k1Agg.shortTermGain || 0) +
    Math.max(0, k1Agg.longTermGain || 0) +
    Math.max(0, rentalPassiveAllowedNet);
  const form8960Computed = computeForm8960(
    ret.form8960,
    fs,
    agiForPhaseouts,
    grossInvestmentIncome,
    0,
    constants.niit?.[fs],
  );

  // Medicare wages = sum of W-2 box 5 across all W-2s.
  const medicareWages = (ret.w2s ?? []).reduce(
    (a, w) => a + (Number(w.box5MedicareWages) || 0),
    0,
  );
  const form8959Computed = computeForm8959(
    ret.form8959,
    fs,
    medicareWages,
    seNetProfit,
    constants.additionalMedicare?.[fs],
    constants.seTax,
  );

  // --- Phase 10: Schedule H, Form 5405, Form 4972 (2210 deferred below) ---
  const scheduleHComputed = computeScheduleH(ret.scheduleH, constants.householdEmployment);
  const form5405Computed = computeForm5405(ret.form5405);
  const form4972Computed = computeForm4972(ret.form4972);

  // --- other taxes (Schedule 2 territory) ---
  const hsaAdditionalTax = form8889Computed.additionalTax;
  const amt = form6251Computed.amtLiability;
  const niit = form8960Computed.niit;
  // Form 8959 Part IV line 18 — GROSS additional Medicare tax flows to
  // Schedule 2 line 11 → 1040 line 23. Part V line 24 withholding flows to
  // 1040 line 25c as a payment (below). Previously `netAdditionalMedicare`
  // conflated the two and double-counted withholding (Box 6 of W-2 is not
  // already in Box 2 federal-withholding payments).
  const additionalMedicare = form8959Computed.additionalMedicareTax;
  const additionalMedicareWithholding = form8959Computed.additionalMedicareWithheld;
  const householdEmploymentTax = scheduleHComputed.totalHouseholdEmploymentTax;
  const firstTimeHomebuyerRepayment = form5405Computed.repaymentThisYear;
  const lumpSumAveragingTax = form4972Computed.electedTax;

  // ----- Schedule 2 partitioned into Part I / Part II -----
  // Part I (1040 line 17) — "Additional Taxes" treated as regular tax for
  // §§26(a) / 904 (FTC limitation). Nonrefundable credits CAN reduce this.
  const schedule2PartI: ComputedSchedule2PartI = {
    amt: round(amt),
    excessAptcRepayment: round(aptcRepayment),
    total: round(amt + aptcRepayment),
  };
  // Part II (1040 line 23) — "Other Taxes" added AFTER nonrefundable credits.
  // Nonrefundable credits CANNOT reduce these (§26(a)). Includes SE tax,
  // NIIT, Add'l Medicare, household-employment tax (Schedule H), FTHB
  // credit repayment (Form 5405), lump-sum averaging (Form 4972), HSA
  // additional tax, early-withdrawal penalty (Form 5329). `otherTaxes` is a
  // catch-all reserved for future 17a–z items (e.g. §965 liability, §453A
  // interest, Form 8611 recapture) that aren't modeled yet.
  const schedule2PartII: ComputedSchedule2PartII = {
    seTax: round(seTax),
    unreportedSsMedicare: 0,
    earlyWithdrawalPenalty: round(earlyWithdrawalPenalty + hsaAdditionalTax),
    additionalMedicareTax: round(additionalMedicare),
    niit: round(niit),
    householdEmploymentTax: round(householdEmploymentTax),
    firstTimeHomebuyerRepayment: round(firstTimeHomebuyerRepayment),
    lumpSumAveraging: round(lumpSumAveragingTax),
    otherTaxes: 0,
    total: round(
      seTax +
        earlyWithdrawalPenalty +
        hsaAdditionalTax +
        additionalMedicare +
        niit +
        householdEmploymentTax +
        firstTimeHomebuyerRepayment +
        lumpSumAveragingTax,
    ),
  };

  // §26(a) anchors — surface for downstream audit / display. These do NOT
  // yet include Part II.
  const taxBeforeNonrefundableCredits = round(regularTax + ltcgTax + schedule2PartI.total);
  const taxAfterNonrefundableCredits = Math.max(
    0,
    round(taxBeforeNonrefundableCredits - totalCredits),
  );

  // Combined "other taxes" for backward compatibility with ComputedOtherTaxes
  // (Part I APTC + all Part II items). Form 2210 penalty appended below.
  const otherTaxesBeforePenalty = round(
    schedule2PartI.excessAptcRepayment + schedule2PartII.total,
  );

  // Current-year tax for the §6654 safe-harbor ("tax shown on the return"
  // per §6654(f) and Form 2210 Part I lines 2-3) is income tax + other
  // taxes − nonrefundable credits − refundable credits (EITC, ACTC,
  // refundable AOTC, net PTC, excess SS withholding / fuels credit).
  // Under the new Part I/II split: (regular tax + Part I) − nonrefundable
  // credits + Part II − refundable credits. Part I's AMT is INCLUDED in
  // taxBeforeNonrefundableCredits (so it isn't double-counted here).
  const currentYearTaxForPenalty = round(
    Math.max(
      0,
      taxAfterNonrefundableCredits +
        schedule2PartII.total -
        refundableCreditsTotal,
    ),
  );
  const form2210Computed = computeForm2210(
    ret.form2210,
    fs,
    currentYearTaxForPenalty,
    constants.underpaymentPenalty,
  );
  const underpaymentPenalty = form2210Computed.penalty;
  const otherTaxesTotal = round(otherTaxesBeforePenalty + underpaymentPenalty);

  // --- summary ---
  // Final tax after credits under the new flow:
  //   line 22 = (regular tax + Part I) − nonrefundable credits
  //   line 24 = line 22 + Part II (+ underpayment penalty)
  //   line 37 balance = line 24 − refundable credits − payments
  const totalTaxAfterCredits = round(
    taxAfterNonrefundableCredits +
      schedule2PartII.total +
      underpaymentPenalty -
      refundableCreditsTotal,
  );
  const estimatedPayments = Number(ret.estimatedPayments) || 0;
  // Form 1040 line 25c includes the Form 8959 Part V additional-Medicare
  // withholding as a payment (separate from Box 2 federal income-tax
  // withholding, and not netted against the Part IV gross tax).
  const totalPayments = round(
    withholding + retirementWithheld + ssWithheld + unemp.withheld + gamb.withheld +
    additionalMedicareWithholding + estimatedPayments
  );
  const diff = round(totalPayments - totalTaxAfterCredits);
  const refund = diff > 0 ? diff : 0;
  const balanceDue = diff < 0 ? -diff : 0;

  // ----- Task #48: Schedule 1 (line-by-line) -----
  // Schedule C on line 3 is net of Form 4562 depreciation and Form 8829
  // home-office (which are reported on the Schedule C itself). Ordinary
  // §1231 items from Form 4797 go on line 4; LTCG flows on Schedule D.
  // FEIE (Form 2555) appears as a NEGATIVE on line 8d because the exclusion
  // reduces AGI.
  const sched1_businessIncomeC = round(schedCNet - depSummary.total - homeOfficeDed);
  const sched1_otherGains4797 = round(
    form4797.recapture + form4797.shortOrdinaryGain + form4797.ordinaryLoss
    + form4797.recaptured1231AsOrdinary,
  );
  const sched1_rentalRoyaltyE = round(
    rentalNetForAgi + royaltyNet + k1OrdinaryForAgi + (k1Agg.royalties || 0),
  );
  const sched1_farmF = round(farmNet);
  const sched1_unemployment = round(unemp.amount);
  const sched1_feieExclusion = round(-feieExclusion);      // negative on line 8d
  const sched1_gambling = round(gamb.winnings);
  const sched1_otherItemized = round(otherInc);            // jury duty, prizes, hobby, etc.
  const sched1_totalOtherIncome = round(
    sched1_feieExclusion + sched1_gambling + sched1_otherItemized,
  );
  const sched1_totalAdditionalIncome = round(
    sched1_businessIncomeC +
      sched1_otherGains4797 +
      sched1_rentalRoyaltyE +
      sched1_farmF +
      sched1_unemployment +
      sched1_totalOtherIncome,
  );
  const schedule1PartI: ComputedSchedule1PartI = {
    taxableRefundsStateLocal: 0,      // not modeled in TaxReturn
    alimonyReceived: 0,                // not modeled (pre-2019 only)
    businessIncomeScheduleC: sched1_businessIncomeC,
    otherGainsForm4797: sched1_otherGains4797,
    rentalRoyaltyScheduleE: sched1_rentalRoyaltyE,
    farmIncomeScheduleF: sched1_farmF,
    unemploymentCompensation: sched1_unemployment,
    foreignEarnedIncomeExclusion: sched1_feieExclusion,
    gamblingWinnings: sched1_gambling,
    otherIncomeItemized: sched1_otherItemized,
    totalOtherIncome: sched1_totalOtherIncome,
    totalAdditionalIncome: sched1_totalAdditionalIncome,
  };
  const schedule1PartII: ComputedSchedule1PartII = {
    educatorExpenses: round(schedule1Lines.educatorExpenses),
    certainBusinessExpenses: round(
      schedule1Lines.reservistExpenses +
        schedule1Lines.performingArtistExpenses +
        schedule1Lines.feeBasisExpenses,
    ),
    hsaDeduction: round(hsaDeductionAllowed),
    movingExpensesMilitary: 0,         // not modeled (§217(g) active-duty only)
    deductibleSeTax: round(seTaxDeduction),
    sepSimpleQualifiedPlans: round(
      schedule1Lines.sepContribution +
        schedule1Lines.simpleContribution +
        schedule1Lines.solo401kContribution,
    ),
    selfEmployedHealthInsurance: round(schedule1Lines.selfEmployedHealthInsurance),
    penaltyEarlyWithdrawalSavings: round(schedule1Lines.penaltyEarlyWithdrawal),
    alimonyPaid: round(schedule1Lines.alimonyPaid),
    iraDeduction: round(schedule1Lines.traditionalIraDeduction),
    studentLoanInterest: round(schedule1Lines.studentLoanInterest),
    archerMsaDeduction: 0,             // not modeled
    otherAdjustments: 0,
    totalAdjustments: round(adjustmentsTotal),
  };

  // ----- Task #48: Schedule 3 (line-by-line) -----
  // Part I uses the §26(a) post-cascade allowed amounts, so the Schedule 3
  // line 8 total equals ComputedCredits.total by construction.
  const schedule3PartI_totalOtherLine6 = round(
    mortgageInterestCredit + elderlyDisabledCredit + evCredit,
  );
  const schedule3PartI: ComputedSchedule3PartI = {
    foreignTaxCredit,
    childDependentCareCredit,
    educationCredits,
    saversCredit,
    residentialCleanEnergy: cleanEnergyCreditAllowed,
    energyEfficientHomeImprovement: energyEfficientCreditAllowed,
    mortgageInterestCredit,
    elderlyDisabledCredit,
    cleanVehicleCredit: evCredit,
    otherCreditsLine6: 0,
    totalOtherCredits: schedule3PartI_totalOtherLine6,
    totalNonrefundableCredits: round(
      foreignTaxCredit +
        childDependentCareCredit +
        educationCredits +
        saversCredit +
        cleanEnergyCreditAllowed +
        energyEfficientCreditAllowed +
        schedule3PartI_totalOtherLine6,
    ),
  };
  const schedule3PartII_totalOther = round(excessSocialSecurity);
  const schedule3PartII: ComputedSchedule3PartII = {
    netPremiumTaxCredit,
    amountPaidWithExtension: 0,
    excessSocialSecurity,
    federalTaxOnFuels: 0,
    otherPaymentsRefundable: 0,
    totalOtherPayments: schedule3PartII_totalOther,
    totalPaymentsAndRefundableCredits: round(netPremiumTaxCredit + schedule3PartII_totalOther),
  };

  return {
    filingStatus: fs,
    income: {
      wages: round(wages),
      interest: round(interest),
      taxExemptInterest: round(taxExemptInterest),
      ordinaryDividends: round(divs.ordinary),
      qualifiedDividends: round(divs.qualified),
      totalCapGainDistributions: round(capGainDistributions),
      seNetProfit: round(schedCNet),
      shortTermGain: round(caps.short),
      // 1099-DIV Box 2a cap-gain distributions are always long-term and are
      // included in the long-term line (Schedule D line 13 / 1040 line 7).
      longTermGain: round(caps.long + capGainDistributions),
      capitalLossDeduction: round(capitalLossDeduction),
      capitalLossCarryforwardShortTerm: round(capLossCarry.shortTermCarryforward),
      capitalLossCarryforwardLongTerm: round(capLossCarry.longTermCarryforward),
      capitalLossCarryforwardTotal: round(capLossCarry.totalCarryforward),
      retirementGross: round(retire.gross),
      retirementTaxable: round(retire.taxable),
      ssGross: round(ssResult.gross),
      ssTaxable: round(ssResult.taxable),
      unemployment: round(unemp.amount),
      gamblingWinnings: round(gamb.winnings),
      otherIncome: round(otherInc),
      rentalNetIncome: round(rentalNetForAgi),
      rentalSuspendedLoss: round(passive.totalSuspendedRental),
      royaltyNetIncome: round(royaltyNet),
      k1OrdinaryIncome: round(k1OrdinaryForAgi),
      k1SuspendedLoss: round(passive.totalSuspendedK1),
      k1InterestIncome: round(k1Agg.interest),
      k1OrdinaryDividends: round(k1Agg.ordinaryDividends),
      k1QualifiedDividends: round(k1Agg.qualifiedDividends),
      k1Royalties: round(k1Agg.royalties),
      k1ShortTermGain: round(k1Agg.shortTermGain),
      k1LongTermGain: round(k1Agg.longTermGain),
      k1Section1231Gain: round(k1Agg.section1231Gain),
      farmNetProfit: round(farmNet),
      section1231NetGain: round(form4797.longTermCapitalGain),
      section1231OrdinaryLoss: round(form4797.ordinaryLoss),
      depreciationRecapture: round(form4797.recapture),
      section1231RecapturedAsOrdinary: round(form4797.recaptured1231AsOrdinary),
      homeOfficeDeduction: round(homeOfficeDed),
      scheduleBRequired: isScheduleBRequired(
        interest + (k1Agg.interest || 0),
        divs.ordinary + (k1Agg.ordinaryDividends || 0),
      ),
      totalIncome,
    },
    adjustments: {
      seTaxDeduction,
      educatorExpenses: schedule1Lines.educatorExpenses,
      hsaDeduction: hsaDeductionAllowed,
      selfEmployedHealthInsurance: schedule1Lines.selfEmployedHealthInsurance,
      sepContribution: schedule1Lines.sepContribution,
      simpleContribution: schedule1Lines.simpleContribution,
      solo401kContribution: schedule1Lines.solo401kContribution,
      traditionalIraDeduction: schedule1Lines.traditionalIraDeduction,
      studentLoanInterest: schedule1Lines.studentLoanInterest,
      penaltyEarlyWithdrawal: schedule1Lines.penaltyEarlyWithdrawal,
      alimonyPaid: schedule1Lines.alimonyPaid,
      reservistExpenses: schedule1Lines.reservistExpenses,
      performingArtistExpenses: schedule1Lines.performingArtistExpenses,
      feeBasisExpenses: schedule1Lines.feeBasisExpenses,
      feieExclusion,
      total: adjustmentsTotal,
    },
    deductions: {
      standard: standardDeduction,
      itemized: itemizedDeduction,
      used: deductionUsed,
      qbiDeduction: round(qbiDeduction),
    },
    taxComputation: {
      agi,
      taxableIncome,
      regularTax,
      ltcgTax,
      totalTax,
      taxBeforeNonrefundableCredits,
      taxAfterNonrefundableCredits,
    },
    credits: {
      childTaxCredit,
      childDependentCareCredit,
      educationCredits,
      saversCredit,
      elderlyDisabledCredit,
      mortgageInterestCredit,
      residentialEnergyCredit,
      evCredit,
      foreignTaxCredit,
      total: totalCredits,
      // Task #37 audit trail: pre-cascade (form-computed) vs post-cascade
      // (allowed) for each credit in §26(a) order, plus CTC last.
      perCredit: {
        foreignTaxCredit:             { computed: round(preForeignTaxCredit),          allowed: foreignTaxCredit },
        childDependentCareCredit:     { computed: round(preChildDependentCareCredit),  allowed: childDependentCareCredit },
        educationCredits:             { computed: round(preEducationCredits),          allowed: educationCredits },
        saversCredit:                 { computed: round(preSaversCredit),              allowed: saversCredit },
        residentialCleanEnergy:       { computed: round(preCleanEnergyCredit),         allowed: cleanEnergyCreditAllowed },
        energyEfficientHomeImprovement:{ computed: round(preEnergyEfficientCredit),    allowed: energyEfficientCreditAllowed },
        mortgageInterestCredit:       { computed: round(preMortgageInterestCredit),    allowed: mortgageInterestCredit },
        elderlyDisabledCredit:        { computed: round(preElderlyDisabledCredit),     allowed: elderlyDisabledCredit },
        cleanVehicleCredit:           { computed: round(preEvCredit),                  allowed: evCredit },
        childTaxCredit:               { computed: round(schedule8812Computed.combinedAfterPhaseout), allowed: childTaxCredit },
      },
    },
    refundableCredits: {
      additionalChildTaxCredit,
      refundableAotc,
      earnedIncomeCredit,
      netPremiumTaxCredit,
      aptcRepayment,
      excessSocialSecurity,
      total: refundableCreditsTotal,
    },
    otherTaxes: {
      seTax,
      earlyWithdrawalPenalty,
      hsaAdditionalTax,
      aptcRepayment,
      amt,
      niit,
      additionalMedicare,
      householdEmploymentTax,
      firstTimeHomebuyerRepayment,
      lumpSumAveragingTax,
      underpaymentPenalty,
      total: otherTaxesTotal,
    },
    payments: {
      withholding: round(
        withholding + retirementWithheld + ssWithheld + unemp.withheld + gamb.withheld
      ),
      estimatedPayments: round(estimatedPayments),
      additionalMedicareWithholding: round(additionalMedicareWithholding),
      total: totalPayments,
    },
    summary: {
      totalTaxAfterCredits,
      refund,
      balanceDue,
    },
    schedule1: {
      partI: schedule1PartI,
      partII: schedule1PartII,
    },
    schedule2: {
      partI: schedule2PartI,
      partII: schedule2PartII,
    },
    schedule3: {
      partI: schedule3PartI,
      partII: schedule3PartII,
    },
    form8606: form8606Computed,
    form8889: form8889Computed,
    schedule8812: schedule8812Computed,
    eitc: eitcComputed,
    form8962: form8962Computed,
    form6251: form6251Computed,
    form8960: form8960Computed,
    form8959: form8959Computed,
    form2555: form2555Computed,
    scheduleH: scheduleHComputed,
    form2210: form2210Computed,
    form5405: form5405Computed,
    form4972: form4972Computed,
    form8995: form8995Computed,
  };
}

// ============================================================
// Task #49: cross-year carryforward read/write orchestrator
// ============================================================
//
// `computeReturn` above is pure: same `(TaxReturn, TaxYearConstants)` in →
// same `ComputedReturn` out, no I/O. The wrapper below layers cross-year
// carryforward persistence on top:
//
//   1. Reads prior-year rows (tax_year = currentYear − 1) from the
//      carryforwards table and uses them as a FALLBACK for TaxReturn-
//      level fields that the user might not have re-entered. Explicit
//      non-zero user-entered values on the TaxReturn always win (the
//      user override is preserved per the Task #49 spec).
//   2. Runs the pure `computeReturn`.
//   3. Writes end-of-year carryforwards for (userId, currentYear) to the
//      table via upsert.
//
// Kinds populated on write (Phase 4 + Task #49 baseline):
//   - capital_loss_short, capital_loss_long (§1212(b) / Pub 550)
//   - passive_loss_rental, passive_loss_k1 (Form 8582)
//
// Future phases will add FTC (§904(c)), AMT credit (Form 8801 §53),
// charitable (§170(b) 50/30/20 buckets), §179, NOL, and QBI loss.

/**
 * Apply prior-year carryforward rows as FALLBACKS to a TaxReturn draft.
 * Mutates and returns a shallow clone. User-entered non-zero values are
 * preserved; only zero / undefined fields are filled from the table.
 *
 * Exported so route handlers can apply the fallback before rendering the
 * draft return to the client (e.g. so the UI shows the inferred prior-year
 * cap-loss carryforward with a "from last year" affordance).
 */
export function applyPriorYearCarryforwards(
  ret: TaxReturn,
  prior: Carryforward[],
): TaxReturn {
  const next: TaxReturn = { ...ret };
  const userSt = Number(ret.priorYearShortTermLossCarryforward) || 0;
  const userLt = Number(ret.priorYearLongTermLossCarryforward) || 0;
  if (userSt === 0) {
    const tableSt = sumKind(prior, 'capital_loss_short', null);
    if (tableSt > 0) next.priorYearShortTermLossCarryforward = tableSt;
  }
  if (userLt === 0) {
    const tableLt = sumKind(prior, 'capital_loss_long', null);
    if (tableLt > 0) next.priorYearLongTermLossCarryforward = tableLt;
  }
  return next;
}

/**
 * Build the list of end-of-year carryforward rows to persist from a
 * freshly-computed `ComputedReturn`. The rows are keyed on (kind, refId);
 * the caller stamps `userId` and `taxYear` at write time.
 *
 * Only non-zero rows are produced; the write-side service also deletes
 * stale zero-valued rows on upsert, so a kind that decays to zero this
 * year is cleared from the table.
 */
export function buildEndOfYearCarryforwards(
  computed: ComputedReturn,
): CarryforwardInput[] {
  const rows: CarryforwardInput[] = [];
  // §1212(b) capital-loss carryforward, character-preserved per Pub 550.
  const stCf = Number(computed.income.capitalLossCarryforwardShortTerm) || 0;
  const ltCf = Number(computed.income.capitalLossCarryforwardLongTerm) || 0;
  if (stCf > 0) {
    rows.push({ kind: 'capital_loss_short', refId: null, amount: stCf });
  }
  if (ltCf > 0) {
    rows.push({ kind: 'capital_loss_long', refId: null, amount: ltCf });
  }
  // §469 passive-loss suspended amounts (Form 8582). Stored per-family;
  // future work will emit per-originating-item rows when the orchestrator
  // threads the underlying property / K-1 ids through.
  const rentalSuspended = Number(computed.income.rentalSuspendedLoss) || 0;
  const k1Suspended = Number(computed.income.k1SuspendedLoss) || 0;
  if (rentalSuspended > 0) {
    rows.push({ kind: 'passive_loss_rental', refId: null, amount: rentalSuspended });
  }
  if (k1Suspended > 0) {
    rows.push({ kind: 'passive_loss_k1', refId: null, amount: k1Suspended });
  }
  return rows;
}

/**
 * End-to-end orchestrator: read prior-year carryforwards, run compute,
 * write end-of-year carryforwards. Safe to call without a userId — in
 * that case it degrades to the pure `computeReturn` with no I/O.
 */
export async function computeReturnWithCarryforwards(
  userId: string | null | undefined,
  ret: TaxReturn,
  constants: TaxYearConstants,
): Promise<ComputedReturn> {
  if (!userId) {
    return computeReturn(ret, constants);
  }
  const prior = await getPriorYearCarryforwards(userId, ret.taxYear);
  const effectiveReturn = applyPriorYearCarryforwards(ret, prior);
  const computed = computeReturn(effectiveReturn, constants);
  const endOfYear = buildEndOfYearCarryforwards(computed).map((r) => ({
    ...r,
    sourceReturnId: ret.id,
  }));
  await writeCarryforwards(userId, ret.taxYear, endOfYear);
  return computed;
}
