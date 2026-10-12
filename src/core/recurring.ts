// Fixed bills, subscriptions and regular income.

import { merchantKey } from './categorize';
import { addDays, addMonths, daysBetween, monthKey } from './dates';
import type { Frequency, Recurring, Transaction } from './types';

const PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  return Math.round((amount * PER_YEAR[frequency]) / 12);
}

export function advanceDate(iso: string, frequency: Frequency): string {
  switch (frequency) {
    case 'weekly':
      return addDays(iso, 7);
    case 'biweekly':
      return addDays(iso, 14);
    case 'semimonthly': {
      // 1st & 15th style: alternate between the first half and second half.
      const day = Number(iso.slice(8, 10));
      return day < 15 ? `${iso.slice(0, 8)}${String(Math.min(day + 15, 28)).padStart(2, '0')}` : addMonths(iso, 1, Math.max(1, day - 15));
    }
    case 'monthly':
      return addMonths(iso, 1);
    case 'quarterly':
      return addMonths(iso, 3);
    case 'yearly':
      return addMonths(iso, 12);
  }
}

export interface Occurrence {
  recurring: Recurring;
  date: string;
  daysUntil: number;
}

/** Due dates between today and `days` ahead, including overdue unpaid ones. */
export function upcomingOccurrences(items: Recurring[], todayIso: string, days: number): Occurrence[] {
  const out: Occurrence[] = [];
  const limit = addDays(todayIso, days);
  for (const r of items) {
    if (!r.active) continue;
    let date = r.nextDate;
    let guard = 0;
    while (date <= limit && guard < 60) {
      out.push({ recurring: r, date, daysUntil: daysBetween(todayIso, date) });
      date = advanceDate(date, r.frequency);
      guard++;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function monthlyCommitments(items: Recurring[]): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;
  for (const r of items) {
    if (!r.active) continue;
    const m = monthlyEquivalent(r.amount, r.frequency);
    if (r.type === 'income') income += m;
    else expenses += m;
  }
  return { income, expenses };
}

export interface RecurringSuggestion {
  key: string;
  name: string;
  amount: number;
  months: number;
  lastDate: string;
  categoryId: string | null;
  method: Transaction['method'];
}

/**
 * Finds charges that repeat every month with a similar amount (subscriptions,
 * bills). A planner calls this a "subscription audit": many people pay for
 * services they forgot about.
 */
export function detectRecurring(txs: Transaction[], minMonths = 3, tolerance = 0.15): RecurringSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.type !== 'expense' || t.recurringId) continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const out: RecurringSuggestion[] = [];
  for (const [key, list] of groups) {
    const byMonth = new Map<string, Transaction>();
    for (const t of list) {
      const m = monthKey(t.date);
      const existing = byMonth.get(m);
      // One charge per month; keep the latest.
      if (!existing || existing.date < t.date) byMonth.set(m, t);
    }
    if (byMonth.size < minMonths) continue;
    // Too many charges per month looks like regular shopping, not a bill.
    if (list.length > byMonth.size * 1.5) continue;
    const amounts = [...byMonth.values()].map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = amounts.filter((a) => Math.abs(a - median) <= median * tolerance).length;
    if (similar < minMonths) continue;
    const latest = [...byMonth.values()].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      key,
      name: latest.description,
      amount: median,
      months: byMonth.size,
      lastDate: latest.date,
      categoryId: latest.categoryId,
      method: latest.method,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
