// Financial health score (0-100) built from four standard planning ratios.
// Each one is worth up to 25 points.

import { monthlyInterest } from './debt';
import type { Debt } from './types';

export const HIGH_INTEREST_APR = 8;

export interface HealthInput {
  /** Average monthly income. */
  income: number;
  /** Average monthly spending (excludes money sent to savings). */
  spending: number;
  /** Average monthly essential spending (needs bucket). */
  essentials: number;
  debts: Pick<Debt, 'balance' | 'apr' | 'minPayment' | 'closedAt'>[];
  emergencyFund: number;
}

export interface HealthComponent {
  key: 'savings_rate' | 'debt_to_income' | 'emergency_fund' | 'high_interest';
  score: number;
  value: number | null;
}

export interface HealthResult {
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'weak' | 'critical';
  components: HealthComponent[];
  hasData: boolean;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function healthScore(input: HealthInput): HealthResult {
  const open = input.debts.filter((d) => !d.closedAt && d.balance > 0);
  const minPayments = open.reduce((s, d) => s + d.minPayment, 0);
  const highInterest = open.filter((d) => d.apr >= HIGH_INTEREST_APR).reduce((s, d) => s + d.balance, 0);

  const savingsRate = input.income > 0 ? (input.income - input.spending) / input.income : null;
  const dti = input.income > 0 ? minPayments / input.income : null;
  const fundMonths = input.essentials > 0 ? input.emergencyFund / input.essentials : null;
  const highRatio = input.income > 0 ? highInterest / (input.income * 12) : null;

  const components: HealthComponent[] = [
    // 20%+ saved → full points.
    { key: 'savings_rate', value: savingsRate, score: savingsRate === null ? 0 : Math.round(25 * clamp(savingsRate / 0.2)) },
    // Debt payments ≤10% of income → full points, ≥50% → zero.
    { key: 'debt_to_income', value: dti, score: dti === null ? 0 : Math.round(25 * clamp((0.5 - dti) / 0.4)) },
    // 6 months of essentials saved → full points.
    { key: 'emergency_fund', value: fundMonths, score: fundMonths === null ? 0 : Math.round(25 * clamp(fundMonths / 6)) },
    // No high-interest debt → full points; ≥50% of annual income → zero.
    { key: 'high_interest', value: highRatio, score: highRatio === null ? 0 : Math.round(25 * clamp(1 - highRatio / 0.5)) },
  ];
  const score = components.reduce((s, c) => s + c.score, 0);
  const grade: HealthResult['grade'] =
    score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : score >= 30 ? 'weak' : 'critical';
  return { score, grade, components, hasData: input.income > 0 };
}

export function debtTotals(debts: Pick<Debt, 'balance' | 'apr' | 'minPayment' | 'originalBalance' | 'closedAt'>[]) {
  const open = debts.filter((d) => !d.closedAt);
  const balance = open.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const original = debts.reduce((s, d) => s + Math.max(d.originalBalance, d.balance), 0);
  return {
    balance,
    original,
    paid: Math.max(0, original - balance),
    progress: original > 0 ? clamp((original - balance) / original) : 0,
    minPayments: open.reduce((s, d) => s + (d.balance > 0 ? d.minPayment : 0), 0),
    monthlyInterest: open.reduce((s, d) => s + monthlyInterest(d.balance, d.apr), 0),
  };
}
