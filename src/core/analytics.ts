// Monthly analysis. Definitions follow common financial-planning practice:
//  - income: money that came in (salary, side income, refunds...)
//  - outflows: every expense, including savings contributions and debt payments
//  - spending: outflows minus money moved to savings/investments
//  - net cash flow: income - outflows (what is left unassigned)
//  - savings rate: (income - spending) / income
// Transfers (e.g. paying a credit card from checking) are excluded from all of
// them, because the card purchases themselves are already counted.

import { SAVINGS_CATEGORY_KEY, DEBT_PAYMENT_CATEGORY_KEY, INTEREST_CATEGORY_KEY } from './categories';
import { monthKey, monthProgress } from './dates';
import type { Bucket, Budget, Category, Nature, PaymentMethod, Transaction } from './types';

export interface CategoryTotal {
  categoryId: string | null;
  amount: number;
  count: number;
  /** Share of the total (0..1). */
  share: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  outflows: number;
  savingsContributions: number;
  spending: number;
  net: number;
  savingsRate: number | null;
  fixed: number;
  variable: number;
  buckets: Record<Bucket, number>;
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  byMethod: Partial<Record<PaymentMethod, number>>;
  debtPayments: number;
  interestAndFees: number;
  uncategorized: number;
  transactionCount: number;
}

export interface CategoryIndex {
  byId: Map<string, Category>;
  savingsId: string | null;
  debtPaymentsId: string | null;
  interestId: string | null;
}

export function indexCategories(categories: Category[]): CategoryIndex {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const find = (key: string) => categories.find((c) => c.key === key)?.id ?? null;
  return {
    byId,
    savingsId: find(SAVINGS_CATEGORY_KEY),
    debtPaymentsId: find(DEBT_PAYMENT_CATEGORY_KEY),
    interestId: find(INTEREST_CATEGORY_KEY),
  };
}

function totals(map: Map<string | null, { amount: number; count: number }>, total: number): CategoryTotal[] {
  return [...map.entries()]
    .map(([categoryId, v]) => ({ categoryId, amount: v.amount, count: v.count, share: total ? v.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function summarize(txs: Transaction[], idx: CategoryIndex, month: string): MonthSummary {
  let income = 0;
  let outflows = 0;
  let savingsContributions = 0;
  let fixed = 0;
  let variable = 0;
  let debtPayments = 0;
  let interestAndFees = 0;
  let uncategorized = 0;
  let count = 0;
  const buckets: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 };
  const byCat = new Map<string | null, { amount: number; count: number }>();
  const incomeByCat = new Map<string | null, { amount: number; count: number }>();
  const byMethod: Partial<Record<PaymentMethod, number>> = {};

  for (const t of txs) {
    if (monthKey(t.date) !== month || t.type === 'transfer') continue;
    count++;
    if (t.type === 'income') {
      income += t.amount;
      const e = incomeByCat.get(t.categoryId) ?? { amount: 0, count: 0 };
      e.amount += t.amount;
      e.count++;
      incomeByCat.set(t.categoryId, e);
      continue;
    }
    outflows += t.amount;
    byMethod[t.method] = (byMethod[t.method] ?? 0) + t.amount;
    const cat = t.categoryId ? idx.byId.get(t.categoryId) : undefined;
    const isSavings = !!t.categoryId && t.categoryId === idx.savingsId;
    if (isSavings) savingsContributions += t.amount;
    if (t.debtId || (t.categoryId && t.categoryId === idx.debtPaymentsId)) debtPayments += t.amount;
    if (t.categoryId && t.categoryId === idx.interestId) interestAndFees += t.amount;
    if (!cat) uncategorized += t.amount;

    const nature: Nature = cat?.nature ?? 'variable';
    const bucket: Bucket = cat?.bucket ?? 'wants';
    buckets[bucket] += t.amount;
    if (!isSavings) {
      if (nature === 'fixed') fixed += t.amount;
      else variable += t.amount;
    }
    const e = byCat.get(t.categoryId) ?? { amount: 0, count: 0 };
    e.amount += t.amount;
    e.count++;
    byCat.set(t.categoryId, e);
  }

  const spending = outflows - savingsContributions;
  return {
    month,
    income,
    outflows,
    savingsContributions,
    spending,
    net: income - outflows,
    savingsRate: income > 0 ? (income - spending) / income : null,
    fixed,
    variable,
    buckets,
    byCategory: totals(byCat, outflows),
    incomeByCategory: totals(incomeByCat, income),
    byMethod,
    debtPayments,
    interestAndFees,
    uncategorized,
    transactionCount: count,
  };
}

export function summarizeMonths(txs: Transaction[], idx: CategoryIndex, months: string[]): MonthSummary[] {
  return months.map((m) => summarize(txs, idx, m));
}

/** Average of the months that actually have data, so a new user is not penalized. */
export function averageOf(summaries: MonthSummary[], pick: (s: MonthSummary) => number): number {
  const withData = summaries.filter((s) => s.transactionCount > 0);
  if (!withData.length) return 0;
  return Math.round(withData.reduce((acc, s) => acc + pick(s), 0) / withData.length);
}

// ----------------------------------------------------------- 50 / 30 / 20 --

export interface BucketCheck {
  bucket: Bucket;
  actual: number;
  target: number;
  /** Actual as a share of income. */
  share: number | null;
  targetShare: number;
  status: 'good' | 'over' | 'under';
}

export const BUCKET_TARGETS: Record<Bucket, number> = { needs: 0.5, wants: 0.3, savings: 0.2 };

export function fiftyThirtyTwenty(summary: MonthSummary): BucketCheck[] {
  const income = summary.income;
  // Money left over at the end of the month also counts as saved.
  const leftover = Math.max(0, summary.net);
  return (['needs', 'wants', 'savings'] as Bucket[]).map((bucket) => {
    const actual = bucket === 'savings' ? summary.buckets.savings + leftover : summary.buckets[bucket];
    const targetShare = BUCKET_TARGETS[bucket];
    const target = Math.round(income * targetShare);
    const share = income > 0 ? actual / income : null;
    let status: BucketCheck['status'] = 'good';
    if (bucket === 'savings') status = share !== null && share >= targetShare ? 'good' : 'under';
    else status = share === null || share > targetShare + 0.02 ? 'over' : 'good';
    return { bucket, actual, target, share, targetShare, status };
  });
}

// ---------------------------------------------------------------- budgets --

export interface BudgetStatus {
  categoryId: string;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
  status: 'ok' | 'warning' | 'over';
  /** Spending pace is ahead of how much of the month has passed. */
  aheadOfPace: boolean;
}

export function budgetStatuses(budgets: Budget[], summary: MonthSummary, todayIso?: string): BudgetStatus[] {
  const spentBy = new Map(summary.byCategory.map((c) => [c.categoryId, c.amount]));
  const progress = todayIso && monthKey(todayIso) === summary.month ? monthProgress(todayIso) : 1;
  return budgets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const spent = spentBy.get(b.categoryId) ?? 0;
      const pct = spent / b.amount;
      return {
        categoryId: b.categoryId,
        budget: b.amount,
        spent,
        remaining: b.amount - spent,
        pct,
        status: pct > 1 ? 'over' : pct >= 0.8 ? 'warning' : 'ok',
        aheadOfPace: pct > progress + 0.1,
      } as BudgetStatus;
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Suggested monthly budget per category: average of recent months, rounded up to $5. */
export function suggestBudgets(summaries: MonthSummary[], idx: CategoryIndex): Budget[] {
  const withData = summaries.filter((s) => s.transactionCount > 0);
  if (!withData.length) return [];
  const totalsById = new Map<string, number>();
  for (const s of withData) {
    for (const c of s.byCategory) {
      if (!c.categoryId) continue;
      if (c.categoryId === idx.savingsId) continue;
      totalsById.set(c.categoryId, (totalsById.get(c.categoryId) ?? 0) + c.amount);
    }
  }
  return [...totalsById.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      amount: Math.ceil(total / withData.length / 500) * 500,
    }))
    .filter((b) => b.amount > 0);
}

// ---------------------------------------------------------------- merchants --

export interface MerchantTotal {
  name: string;
  amount: number;
  count: number;
}

export function topMerchants(
  txs: Transaction[],
  month: string,
  keyOf: (description: string) => string,
  limit = 5,
): MerchantTotal[] {
  const map = new Map<string, MerchantTotal>();
  for (const t of txs) {
    if (t.type !== 'expense' || monthKey(t.date) !== month) continue;
    const key = keyOf(t.description) || t.description.toLowerCase();
    if (!key) continue;
    const e = map.get(key) ?? { name: t.description, amount: 0, count: 0 };
    e.amount += t.amount;
    e.count++;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** Categories whose spending this month is well above their recent average. */
export function categorySpikes(
  current: MonthSummary,
  previous: MonthSummary[],
  minDelta = 5000,
): { categoryId: string | null; amount: number; average: number }[] {
  const prev = previous.filter((s) => s.transactionCount > 0);
  if (!prev.length) return [];
  const avg = new Map<string | null, number>();
  for (const s of prev) {
    for (const c of s.byCategory) avg.set(c.categoryId, (avg.get(c.categoryId) ?? 0) + c.amount / prev.length);
  }
  return current.byCategory
    .map((c) => ({ categoryId: c.categoryId, amount: c.amount, average: Math.round(avg.get(c.categoryId) ?? 0) }))
    .filter((c) => c.average > 0 && c.amount > c.average * 1.3 && c.amount - c.average >= minDelta)
    .sort((a, b) => b.amount - b.average - (a.amount - a.average));
}
