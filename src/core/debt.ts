// Debt payoff engine: simulates month by month how debts are paid under
// different strategies so the person can see the debt-free date and the
// interest each plan costs.
//
// Model: interest accrues monthly at APR / 12 on the current balance (a close
// approximation of the daily compounding most US card issuers use). Every
// month every debt receives its minimum payment; the remaining budget goes to
// the target debt chosen by the strategy. When a debt is paid off, its minimum
// "rolls over" to the next target (the snowball/avalanche effect).

import { addMonths } from './dates';

export type Strategy = 'avalanche' | 'snowball';
export type PlanKind = Strategy | 'minimum';

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
}

export interface DebtPayoffInfo {
  id: string;
  name: string;
  /** 1-based month in which the debt reaches zero, or null if never. */
  payoffMonth: number | null;
  interestPaid: number;
  totalPaid: number;
}

export interface PayoffMonth {
  month: number;
  totalBalance: number;
  interest: number;
  paid: number;
}

export interface PayoffResult {
  plan: PlanKind;
  /** Months until every debt is paid (or the simulation cap when infeasible). */
  months: number;
  feasible: boolean;
  totalInterest: number;
  totalPaid: number;
  monthlyBudget: number;
  /** Debt ids in the order they get paid off. */
  order: string[];
  debts: DebtPayoffInfo[];
  timeline: PayoffMonth[];
}

export const MAX_MONTHS = 600;

export function monthlyInterest(balance: number, apr: number): number {
  if (balance <= 0 || apr <= 0) return 0;
  return Math.round((balance * apr) / 100 / 12);
}

export function orderDebts(debts: DebtInput[], strategy: Strategy): DebtInput[] {
  const copy = [...debts];
  if (strategy === 'avalanche') {
    copy.sort((a, b) => b.apr - a.apr || a.balance - b.balance);
  } else {
    copy.sort((a, b) => a.balance - b.balance || b.apr - a.apr);
  }
  return copy;
}

export function simulatePayoff(
  input: DebtInput[],
  plan: PlanKind,
  extraMonthly = 0,
  maxMonths = MAX_MONTHS,
): PayoffResult {
  const debts = input.filter((d) => d.balance > 0);
  const ordered = plan === 'minimum' ? debts : orderDebts(debts, plan);
  const state = ordered.map((d) => ({
    ...d,
    remaining: d.balance,
    interestPaid: 0,
    totalPaid: 0,
    payoffMonth: null as number | null,
  }));
  const startTotal = state.reduce((s, d) => s + d.remaining, 0);
  const minimumsTotal = state.reduce((s, d) => s + d.minPayment, 0);
  const extra = plan === 'minimum' ? 0 : Math.max(0, Math.round(extraMonthly));
  const monthlyBudget = minimumsTotal + extra;

  const timeline: PayoffMonth[] = [];
  const order: string[] = [];
  let month = 0;
  let diverged = false;

  while (state.some((d) => d.remaining > 0) && month < maxMonths) {
    month++;
    let monthInterest = 0;
    let monthPaid = 0;

    for (const d of state) {
      if (d.remaining <= 0) continue;
      const interest = monthlyInterest(d.remaining, d.apr);
      d.remaining += interest;
      d.interestPaid += interest;
      monthInterest += interest;
    }

    let available = monthlyBudget;
    for (const d of state) {
      if (d.remaining <= 0) continue;
      const pay = Math.min(d.minPayment, d.remaining);
      d.remaining -= pay;
      d.totalPaid += pay;
      monthPaid += pay;
      available -= pay;
    }

    if (plan !== 'minimum') {
      for (const d of state) {
        if (available <= 0) break;
        if (d.remaining <= 0) continue;
        const pay = Math.min(available, d.remaining);
        d.remaining -= pay;
        d.totalPaid += pay;
        monthPaid += pay;
        available -= pay;
      }
    }

    for (const d of state) {
      if (d.remaining <= 0 && d.payoffMonth === null) {
        d.payoffMonth = month;
        order.push(d.id);
      }
    }

    const totalBalance = state.reduce((s, d) => s + Math.max(0, d.remaining), 0);
    timeline.push({ month, totalBalance, interest: monthInterest, paid: monthPaid });

    // Balances growing well beyond the start means payments never catch up.
    if (startTotal > 0 && totalBalance > startTotal * 20) {
      diverged = true;
      break;
    }
  }

  const feasible = !diverged && state.every((d) => d.remaining <= 0);
  const byId = new Map(state.map((d) => [d.id, d]));

  return {
    plan,
    months: month,
    feasible,
    totalInterest: state.reduce((s, d) => s + d.interestPaid, 0),
    totalPaid: state.reduce((s, d) => s + d.totalPaid, 0),
    monthlyBudget,
    order,
    // Keep the caller's original order for per-debt details.
    debts: debts.map((d) => {
      const s = byId.get(d.id)!;
      return {
        id: d.id,
        name: d.name,
        payoffMonth: s.payoffMonth,
        interestPaid: s.interestPaid,
        totalPaid: s.totalPaid,
      };
    }),
    timeline,
  };
}

export interface StrategyComparison {
  minimum: PayoffResult;
  avalanche: PayoffResult;
  snowball: PayoffResult;
  /** Interest saved by the chosen strategy compared to paying only minimums. */
  interestSaved: number;
  monthsSaved: number;
}

export function compareStrategies(
  debts: DebtInput[],
  extraMonthly: number,
  chosen: Strategy,
): StrategyComparison {
  const minimum = simulatePayoff(debts, 'minimum');
  const avalanche = simulatePayoff(debts, 'avalanche', extraMonthly);
  const snowball = simulatePayoff(debts, 'snowball', extraMonthly);
  const pick = chosen === 'avalanche' ? avalanche : snowball;
  return {
    minimum,
    avalanche,
    snowball,
    interestSaved: minimum.feasible ? Math.max(0, minimum.totalInterest - pick.totalInterest) : 0,
    monthsSaved: minimum.feasible ? Math.max(0, minimum.months - pick.months) : 0,
  };
}

/**
 * Smallest extra monthly payment (in cents, rounded up to whole units) that
 * makes every debt disappear within `targetMonths`. Null if the target is
 * impossible even paying everything in one month.
 */
export function extraNeededForTarget(
  debts: DebtInput[],
  strategy: Strategy,
  targetMonths: number,
): number | null {
  const active = debts.filter((d) => d.balance > 0);
  if (active.length === 0) return 0;
  const fits = (extra: number) => {
    const r = simulatePayoff(active, strategy, extra, targetMonths);
    return r.feasible && r.months <= targetMonths;
  };
  if (fits(0)) return 0;
  const total = active.reduce((s, d) => s + d.balance, 0);
  let hi = Math.max(100, total * 2);
  if (!fits(hi)) return null;
  let lo = 0;
  while (hi - lo > 100) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 100) * 100;
}

export function totalMonthlyInterest(debts: DebtInput[]): number {
  return debts.reduce((s, d) => s + monthlyInterest(d.balance, d.apr), 0);
}

export function weightedApr(debts: DebtInput[]): number {
  const total = debts.reduce((s, d) => s + Math.max(0, d.balance), 0);
  if (!total) return 0;
  return debts.reduce((s, d) => s + d.apr * Math.max(0, d.balance), 0) / total;
}

/** True when the minimum payment does not even cover one month of interest. */
export function isMinimumTrap(debt: DebtInput): boolean {
  return debt.balance > 0 && debt.minPayment <= monthlyInterest(debt.balance, debt.apr);
}

export function payoffDate(startIso: string, months: number): string {
  return addMonths(startIso, months);
}

/** Typical US credit card minimum: 1% of balance + interest, at least $25. */
export function suggestedCardMinimum(balance: number, apr: number): number {
  if (balance <= 0) return 0;
  const min = Math.round(balance * 0.01) + monthlyInterest(balance, apr);
  return Math.min(balance, Math.max(2500, Math.ceil(min / 100) * 100));
}
