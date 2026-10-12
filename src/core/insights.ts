// Plain-language alerts and observations shown on the home screen.

import type { BudgetStatus, MonthSummary } from './analytics';
import { isMinimumTrap, monthlyInterest } from './debt';
import type { Debt } from './types';

export type Insight =
  | { kind: 'interest_cost'; severity: 'danger' | 'warning'; monthly: number; yearly: number }
  | { kind: 'minimum_trap'; severity: 'danger'; debtName: string; interest: number; minPayment: number }
  | { kind: 'overspending'; severity: 'danger'; deficit: number }
  | { kind: 'high_utilization'; severity: 'warning'; debtName: string; utilization: number }
  | { kind: 'budget_over'; severity: 'warning'; categoryId: string; over: number }
  | { kind: 'category_spike'; severity: 'info'; categoryId: string | null; amount: number; average: number }
  | { kind: 'uncategorized'; severity: 'info'; count: number }
  | { kind: 'fees_paid'; severity: 'warning'; amount: number }
  | { kind: 'positive_month'; severity: 'success'; net: number; savingsRate: number };

export interface InsightInput {
  summary: MonthSummary;
  debts: Debt[];
  budgets: BudgetStatus[];
  spikes: { categoryId: string | null; amount: number; average: number }[];
  uncategorizedCount: number;
}

export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const open = input.debts.filter((d) => !d.closedAt && d.balance > 0);

  const interest = open.reduce((s, d) => s + monthlyInterest(d.balance, d.apr), 0);
  if (interest > 0) {
    out.push({
      kind: 'interest_cost',
      severity: interest >= 10_000 ? 'danger' : 'warning',
      monthly: interest,
      yearly: interest * 12,
    });
  }
  for (const d of open) {
    if (isMinimumTrap(d)) {
      out.push({
        kind: 'minimum_trap',
        severity: 'danger',
        debtName: d.name,
        interest: monthlyInterest(d.balance, d.apr),
        minPayment: d.minPayment,
      });
    }
    if (d.kind === 'credit_card' && d.creditLimit && d.creditLimit > 0) {
      const utilization = d.balance / d.creditLimit;
      if (utilization > 0.3) out.push({ kind: 'high_utilization', severity: 'warning', debtName: d.name, utilization });
    }
  }
  if (input.summary.income > 0 && input.summary.net < 0) {
    out.push({ kind: 'overspending', severity: 'danger', deficit: -input.summary.net });
  }
  if (input.summary.interestAndFees > 0) {
    out.push({ kind: 'fees_paid', severity: 'warning', amount: input.summary.interestAndFees });
  }
  for (const b of input.budgets) {
    if (b.status === 'over') out.push({ kind: 'budget_over', severity: 'warning', categoryId: b.categoryId, over: -b.remaining });
  }
  for (const s of input.spikes.slice(0, 2)) {
    out.push({ kind: 'category_spike', severity: 'info', ...s });
  }
  if (input.uncategorizedCount > 0) {
    out.push({ kind: 'uncategorized', severity: 'info', count: input.uncategorizedCount });
  }
  if (input.summary.income > 0 && input.summary.net > 0 && input.summary.savingsRate !== null) {
    out.push({ kind: 'positive_month', severity: 'success', net: input.summary.net, savingsRate: input.summary.savingsRate });
  }

  const rank = { danger: 0, warning: 1, info: 2, success: 3 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
