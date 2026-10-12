import { describe, expect, it } from 'vitest';

import {
  compareStrategies,
  extraNeededForTarget,
  isMinimumTrap,
  monthlyInterest,
  orderDebts,
  simulatePayoff,
  suggestedCardMinimum,
  totalMonthlyInterest,
  weightedApr,
  type DebtInput,
} from '../debt';

const debts: DebtInput[] = [
  { id: 'visa', name: 'Visa', balance: 500_000, apr: 24.99, minPayment: 15_000 },
  { id: 'store', name: 'Store card', balance: 80_000, apr: 29.99, minPayment: 4_000 },
  { id: 'car', name: 'Car loan', balance: 1_200_000, apr: 6.5, minPayment: 35_000 },
  { id: 'personal', name: 'Personal loan', balance: 300_000, apr: 14, minPayment: 10_000 },
];

describe('monthlyInterest', () => {
  it('uses APR / 12 on the balance, rounded to cents', () => {
    expect(monthlyInterest(100_000, 12)).toBe(1_000);
    expect(monthlyInterest(500_000, 24.99)).toBe(10_413);
  });
  it('is zero for zero APR or empty balance', () => {
    expect(monthlyInterest(100_000, 0)).toBe(0);
    expect(monthlyInterest(0, 20)).toBe(0);
  });
});

describe('orderDebts', () => {
  it('avalanche goes by highest APR first', () => {
    expect(orderDebts(debts, 'avalanche').map((d) => d.id)).toEqual(['store', 'visa', 'personal', 'car']);
  });
  it('snowball goes by smallest balance first', () => {
    expect(orderDebts(debts, 'snowball').map((d) => d.id)).toEqual(['store', 'personal', 'visa', 'car']);
  });
});

describe('simulatePayoff', () => {
  it('pays a single zero-interest debt in exact months', () => {
    const r = simulatePayoff([{ id: 'a', name: 'A', balance: 100_000, apr: 0, minPayment: 25_000 }], 'avalanche');
    expect(r.feasible).toBe(true);
    expect(r.months).toBe(4);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(100_000);
    expect(r.order).toEqual(['a']);
  });

  it('matches a standard amortization for one card', () => {
    // $5,000 at 18% paying $200/month ≈ 32 months and ~$1,300 of interest.
    const r = simulatePayoff([{ id: 'a', name: 'A', balance: 500_000, apr: 18, minPayment: 20_000 }], 'minimum');
    expect(r.feasible).toBe(true);
    expect(r.months).toBe(32);
    expect(r.totalInterest).toBeGreaterThan(125_000);
    expect(r.totalInterest).toBeLessThan(135_000);
    expect(r.totalPaid).toBe(500_000 + r.totalInterest);
  });

  it('rolls freed minimums into the next debt and beats paying minimums', () => {
    const cmp = compareStrategies(debts, 20_000, 'avalanche');
    expect(cmp.avalanche.feasible).toBe(true);
    expect(cmp.minimum.feasible).toBe(true);
    expect(cmp.avalanche.months).toBeLessThan(cmp.minimum.months);
    expect(cmp.avalanche.totalInterest).toBeLessThan(cmp.minimum.totalInterest);
    expect(cmp.interestSaved).toBe(cmp.minimum.totalInterest - cmp.avalanche.totalInterest);
    expect(cmp.monthsSaved).toBe(cmp.minimum.months - cmp.avalanche.months);
  });

  it('avalanche never costs more interest than snowball', () => {
    const cmp = compareStrategies(debts, 30_000, 'snowball');
    expect(cmp.avalanche.totalInterest).toBeLessThanOrEqual(cmp.snowball.totalInterest);
    // Snowball closes the smallest balance first.
    expect(cmp.snowball.order[0]).toBe('store');
  });

  it('keeps the monthly budget constant (minimums + extra)', () => {
    const r = simulatePayoff(debts, 'avalanche', 10_000);
    expect(r.monthlyBudget).toBe(15_000 + 4_000 + 35_000 + 10_000 + 10_000);
    for (const m of r.timeline.slice(0, -1)) expect(m.paid).toBe(r.monthlyBudget);
  });

  it('flags debts that never get paid when the minimum does not cover interest', () => {
    const trap = { id: 't', name: 'Trap', balance: 1_000_000, apr: 30, minPayment: 20_000 };
    expect(isMinimumTrap(trap)).toBe(true);
    const r = simulatePayoff([trap], 'minimum');
    expect(r.feasible).toBe(false);
    expect(r.debts[0].payoffMonth).toBeNull();
  });

  it('ignores debts that are already paid', () => {
    const r = simulatePayoff([{ id: 'z', name: 'Z', balance: 0, apr: 20, minPayment: 5_000 }], 'snowball');
    expect(r.months).toBe(0);
    expect(r.feasible).toBe(true);
  });
});

describe('extraNeededForTarget', () => {
  it('finds the extra payment that hits the target date', () => {
    const extra = extraNeededForTarget(debts, 'avalanche', 24)!;
    expect(extra).toBeGreaterThan(0);
    expect(simulatePayoff(debts, 'avalanche', extra).months).toBeLessThanOrEqual(24);
    expect(simulatePayoff(debts, 'avalanche', extra - 2_000).months).toBeGreaterThan(24);
  });
  it('returns 0 when minimums already reach the target', () => {
    expect(extraNeededForTarget([{ id: 'a', name: 'A', balance: 10_000, apr: 10, minPayment: 10_000 }], 'avalanche', 12)).toBe(0);
  });
});

describe('helpers', () => {
  it('sums monthly interest and weights APR by balance', () => {
    expect(totalMonthlyInterest(debts)).toBe(debts.reduce((s, d) => s + monthlyInterest(d.balance, d.apr), 0));
    const w = weightedApr([
      { id: 'a', name: 'A', balance: 100, apr: 10, minPayment: 1 },
      { id: 'b', name: 'B', balance: 300, apr: 20, minPayment: 1 },
    ]);
    expect(w).toBeCloseTo(17.5);
  });
  it('suggests a realistic card minimum (1% + interest, at least $25)', () => {
    expect(suggestedCardMinimum(100_000, 24)).toBe(3_000);
    expect(suggestedCardMinimum(50_000, 0)).toBe(2_500);
    expect(suggestedCardMinimum(1_000, 20)).toBe(1_000);
  });
});
