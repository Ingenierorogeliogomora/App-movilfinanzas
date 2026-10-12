// Memoized views over the store used by several screens.

import { useMemo } from 'react';

import { averageOf, indexCategories, summarize, summarizeMonths, type MonthSummary } from '@/core/analytics';
import { lastNMonths } from '@/core/dates';
import { compareStrategies, type DebtInput } from '@/core/debt';
import type { Category, Debt } from '@/core/types';

import { useStore } from './store';

export function useCategoryIndex() {
  const categories = useStore((s) => s.categories);
  return useMemo(() => indexCategories(categories), [categories]);
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useStore((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useMonthSummary(month: string): MonthSummary {
  const txs = useStore((s) => s.transactions);
  const idx = useCategoryIndex();
  return useMemo(() => summarize(txs, idx, month), [txs, idx, month]);
}

export function useTrend(endMonth: string, months = 6): MonthSummary[] {
  const txs = useStore((s) => s.transactions);
  const idx = useCategoryIndex();
  return useMemo(() => summarizeMonths(txs, idx, lastNMonths(endMonth, months)), [txs, idx, endMonth, months]);
}

/** Averages over the last 3 complete-or-current months that have data. */
export function useAverages(endMonth: string) {
  const trend = useTrend(endMonth, 3);
  return useMemo(
    () => ({
      income: averageOf(trend, (s) => s.income),
      spending: averageOf(trend, (s) => s.spending),
      essentials: averageOf(trend, (s) => s.buckets.needs),
      months: trend,
    }),
    [trend],
  );
}

export function openDebts(debts: Debt[]): Debt[] {
  return debts.filter((d) => !d.closedAt && d.balance > 0);
}

export function toDebtInputs(debts: Debt[]): DebtInput[] {
  return openDebts(debts).map((d) => ({ id: d.id, name: d.name, balance: d.balance, apr: d.apr, minPayment: d.minPayment }));
}

export function useDebtPlan() {
  const debts = useStore((s) => s.debts);
  const strategy = useStore((s) => s.settings.strategy);
  const extra = useStore((s) => s.settings.extraPayment);
  return useMemo(() => {
    const inputs = toDebtInputs(debts);
    if (!inputs.length) return null;
    return { inputs, strategy, extra, ...compareStrategies(inputs, extra, strategy) };
  }, [debts, strategy, extra]);
}
