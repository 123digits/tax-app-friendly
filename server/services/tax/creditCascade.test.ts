import { describe, it, expect } from 'vitest';
import { applyCreditsInOrder } from './creditCascade.js';

describe('applyCreditsInOrder (§26(a) cascade)', () => {
  it('all credits fit under ceiling → each fully allowed', () => {
    const r = applyCreditsInOrder(10_000, [
      { name: 'ftc',      amount: 2000 },
      { name: 'depCare',  amount: 1500 },
      { name: 'savers',   amount: 500 },
    ]);
    expect(r.allowedByCredit.ftc).toBe(2000);
    expect(r.allowedByCredit.depCare).toBe(1500);
    expect(r.allowedByCredit.savers).toBe(500);
    expect(r.totalAllowed).toBe(4000);
    expect(r.remainingLiability).toBe(6000);
  });

  it('credits exceed ceiling → earlier credits win, later fully disallowed', () => {
    // $5k liability, FTC $3k, DepCare $4k. FTC takes $3k; $2k remains; DepCare
    // takes $2k (capped) and loses $2k. Savers gets $0 (no liability left).
    const r = applyCreditsInOrder(5_000, [
      { name: 'ftc',      amount: 3000 },
      { name: 'depCare',  amount: 4000 },
      { name: 'savers',   amount: 1000 },
    ]);
    expect(r.allowedByCredit.ftc).toBe(3000);
    expect(r.allowedByCredit.depCare).toBe(2000);
    expect(r.allowedByCredit.savers).toBe(0);
    expect(r.totalAllowed).toBe(5000);
    expect(r.remainingLiability).toBe(0);
  });

  it('zero liability → every credit disallowed', () => {
    const r = applyCreditsInOrder(0, [
      { name: 'ftc', amount: 1000 },
      { name: 'ev',  amount: 7500 },
    ]);
    expect(r.allowedByCredit.ftc).toBe(0);
    expect(r.allowedByCredit.ev).toBe(0);
    expect(r.totalAllowed).toBe(0);
    expect(r.remainingLiability).toBe(0);
  });

  it('negative credit amounts treated as zero (no credit)', () => {
    const r = applyCreditsInOrder(1000, [
      { name: 'weird', amount: -500 },
      { name: 'ftc',   amount: 400 },
    ]);
    expect(r.allowedByCredit.weird).toBe(0);
    expect(r.allowedByCredit.ftc).toBe(400);
    expect(r.remainingLiability).toBe(600);
  });

  it('negative initial liability treated as zero', () => {
    const r = applyCreditsInOrder(-1000, [
      { name: 'ftc', amount: 500 },
    ]);
    expect(r.allowedByCredit.ftc).toBe(0);
    expect(r.remainingLiability).toBe(0);
  });

  it('cascade produces CTC-spills-to-ACTC pattern', () => {
    // $5k tax + $3k FTC + (CTC amount handled by caller). After FTC:
    // remaining = $2k. If caller then applies Schedule 8812 with $4k CTC
    // and $2k ceiling, nonrefundable CTC = $2k and $2k spills to refundable
    // ACTC — the caller is responsible for that second step; cascade just
    // surfaces `remainingLiability`.
    const r = applyCreditsInOrder(5_000, [
      { name: 'foreignTaxCredit', amount: 3000 },
      // Simulate all other pre-CTC credits at 0:
      { name: 'childDependentCareCredit', amount: 0 },
      { name: 'educationCredits', amount: 0 },
      { name: 'saversCredit', amount: 0 },
    ]);
    expect(r.allowedByCredit.foreignTaxCredit).toBe(3000);
    expect(r.remainingLiability).toBe(2000);
  });
});
