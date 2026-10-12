import { describe, expect, it } from 'vitest';

import {
  budgetStatuses,
  categorySpikes,
  fiftyThirtyTwenty,
  indexCategories,
  suggestBudgets,
  summarize,
  topMerchants,
} from '../analytics';
import { DEFAULT_CATEGORIES } from '../categories';
import { categorize, merchantKey, normalizeDescription, type CategorizeContext } from '../categorize';
import { addMonths, lastNMonths, monthBounds, monthKey } from '../dates';
import { healthScore, debtTotals } from '../health';
import { buildInsights } from '../insights';
import { buildPlan, currentStep } from '../plan';
import { advanceDate, detectRecurring, monthlyCommitments, monthlyEquivalent, upcomingOccurrences } from '../recurring';
import type { Category, Debt, Recurring, Transaction } from '../types';

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  ...c,
  id: `c_${c.key}`,
  name: null,
  archived: false,
  sort: i,
}));
const idx = indexCategories(categories);
const ctx: CategorizeContext = { rules: [], idByKey: new Map(categories.map((c) => [c.key!, c.id])) };

let n = 0;
function tx(partial: Partial<Transaction>): Transaction {
  n++;
  return {
    id: `t${n}`,
    type: 'expense',
    amount: 1000,
    date: '2026-03-10',
    categoryId: null,
    method: 'debit_card',
    description: '',
    note: null,
    debtId: null,
    recurringId: null,
    importHash: null,
    createdAt: '2026-03-10T00:00:00Z',
    ...partial,
  };
}

describe('categorize', () => {
  const cases: [string, 'in' | 'out', string | null, Transaction['type']][] = [
    ['STARBUCKS STORE 12345', 'out', 'dining', 'expense'],
    ['UBER *EATS PENDING', 'out', 'dining', 'expense'],
    ['UBER *TRIP HELP.UBER.COM', 'out', 'transportation', 'expense'],
    ['WM SUPERCENTER #1234', 'out', 'groceries', 'expense'],
    ['WALMART.COM 8009256278', 'out', 'shopping', 'expense'],
    ['AMAZON MKTPL*2K3AB', 'out', 'shopping', 'expense'],
    ['Amazon Prime*1A2B3', 'out', 'subscriptions', 'expense'],
    ['NETFLIX.COM', 'out', 'subscriptions', 'expense'],
    ['DUKE ENERGY ONLINE PAYMENT', 'out', 'utilities', 'expense'],
    ['METRO BY T-MOBILE', 'out', 'phone_internet', 'expense'],
    ['INTEREST CHARGE ON PURCHASES', 'out', 'interest_fees', 'expense'],
    ['LATE FEE', 'out', 'interest_fees', 'expense'],
    ['REMITLY* MEXICO', 'out', 'family_support', 'expense'],
    ['CHASE CREDIT CRD AUTOPAY', 'out', null, 'transfer'],
    ['Payment Thank You-Mobile', 'in', null, 'transfer'],
    ['ACME CORP DES:PAYROLL', 'in', 'salary', 'income'],
    ['AMAZON.COM REFUND', 'in', 'refunds', 'income'],
    ['ZELLE TO JUAN PEREZ', 'out', null, 'expense'],
    ['RENTAL CAR CENTER', 'out', null, 'expense'],
  ];
  it.each(cases)('%s', (desc, dir, key, type) => {
    const r = categorize(desc, dir, ctx);
    expect(r.type).toBe(type);
    expect(r.categoryId).toBe(key ? `c_${key}` : null);
  });

  it('person rules win over built-in ones, most specific first', () => {
    const r = categorize('ZELLE TO JUAN PEREZ', 'out', {
      ...ctx,
      rules: [
        { id: 'r1', pattern: 'zelle', categoryId: 'c_other_expense', txType: null, createdAt: '' },
        { id: 'r2', pattern: 'zelle to juan', categoryId: 'c_housing', txType: null, createdAt: '' },
      ],
    });
    expect(r).toEqual({ type: 'expense', categoryId: 'c_housing', source: 'rule' });
  });

  it('ignores rules for the opposite direction', () => {
    const rules = [{ id: 'r', pattern: 'amazon', categoryId: 'c_groceries', txType: 'expense' as const, createdAt: '' }];
    expect(categorize('AMAZON.COM', 'out', { ...ctx, rules }).categoryId).toBe('c_groceries');
    expect(categorize('AMAZON.COM REFUND', 'in', { ...ctx, rules }).categoryId).toBe('c_refunds');
  });

  it('normalizes bank noise', () => {
    expect(normalizeDescription('PURCHASE AUTHORIZED ON 03/13 TARGET T-1234 HOUSTON TX')).toBe('target t houston tx');
    expect(merchantKey('NETFLIX.COM 866-579-7172 CA')).toBe('netflix.com');
    expect(merchantKey('SQ *BLUE BOTTLE COFFEE')).toBe('blue bottle');
    // Person-to-person payments keep the recipient so one rule does not catch every transfer.
    expect(merchantKey('ZELLE TO JUAN PEREZ')).toBe('zelle to juan perez');
    expect(merchantKey('Zelle to Maria Lopez')).not.toBe(merchantKey('ZELLE TO JUAN PEREZ'));
  });
});

describe('summarize', () => {
  const txs = [
    tx({ type: 'income', amount: 400_000, categoryId: 'c_salary' }),
    tx({ amount: 150_000, categoryId: 'c_housing', method: 'cash' }),
    tx({ amount: 50_000, categoryId: 'c_groceries' }),
    tx({ amount: 30_000, categoryId: 'c_dining', method: 'credit_card' }),
    tx({ amount: 20_000, categoryId: 'c_debt_payments', method: 'transfer' }),
    tx({ amount: 40_000, categoryId: 'c_savings_investments', method: 'transfer' }),
    tx({ amount: 5_000, categoryId: 'c_interest_fees', method: 'credit_card' }),
    tx({ amount: 2_000, categoryId: null }),
    tx({ type: 'transfer', amount: 99_999 }),
    tx({ amount: 77_777, date: '2026-04-01', categoryId: 'c_dining' }),
  ];
  const s = summarize(txs, idx, '2026-03');

  it('computes cash flow and savings rate', () => {
    expect(s.income).toBe(400_000);
    expect(s.outflows).toBe(297_000);
    expect(s.savingsContributions).toBe(40_000);
    expect(s.spending).toBe(257_000);
    expect(s.net).toBe(103_000);
    expect(s.savingsRate).toBeCloseTo((400_000 - 257_000) / 400_000);
  });
  it('excludes transfers and other months', () => {
    expect(s.transactionCount).toBe(8);
  });
  it('splits fixed vs variable spending (savings excluded)', () => {
    expect(s.fixed).toBe(150_000 + 20_000);
    expect(s.variable).toBe(50_000 + 30_000 + 5_000 + 2_000);
    expect(s.fixed + s.variable).toBe(s.spending);
  });
  it('tracks debt payments, fees, methods and uncategorized', () => {
    expect(s.debtPayments).toBe(20_000);
    expect(s.interestAndFees).toBe(5_000);
    expect(s.uncategorized).toBe(2_000);
    expect(s.byMethod.cash).toBe(150_000);
    expect(s.byCategory[0]).toMatchObject({ categoryId: 'c_housing', amount: 150_000 });
  });
  it('checks the 50/30/20 rule', () => {
    const [needs, wants, savings] = fiftyThirtyTwenty(s);
    expect(needs.actual).toBe(150_000 + 50_000 + 5_000);
    expect(wants.actual).toBe(30_000 + 2_000);
    expect(savings.actual).toBe(20_000 + 40_000 + 103_000);
    expect(savings.status).toBe('good');
    // 51% of income on needs is within the 2-point tolerance.
    expect(needs.share).toBeCloseTo(0.5125);
    expect(needs.status).toBe('good');
    const tight = fiftyThirtyTwenty({ ...s, buckets: { ...s.buckets, needs: 300_000 } });
    expect(tight[0].status).toBe('over');
  });
  it('reports budgets and spikes', () => {
    const b = budgetStatuses(
      [
        { categoryId: 'c_dining', amount: 25_000 },
        { categoryId: 'c_groceries', amount: 60_000 },
      ],
      s,
      '2026-03-10',
    );
    expect(b[0]).toMatchObject({ categoryId: 'c_dining', status: 'over', remaining: -5_000 });
    expect(b[1]).toMatchObject({ categoryId: 'c_groceries', status: 'warning', aheadOfPace: true });

    const prev = summarize([tx({ date: '2026-02-10', amount: 10_000, categoryId: 'c_dining' })], idx, '2026-02');
    expect(categorySpikes(s, [prev])).toEqual([{ categoryId: 'c_dining', amount: 30_000, average: 10_000 }]);
    expect(suggestBudgets([s], idx).find((x) => x.categoryId === 'c_dining')?.amount).toBe(30_000);
  });
  it('ranks top merchants', () => {
    const top = topMerchants(
      [tx({ description: 'STARBUCKS #1', amount: 500 }), tx({ description: 'STARBUCKS #2', amount: 700 }), tx({ description: 'SHELL', amount: 900 })],
      '2026-03',
      merchantKey,
    );
    expect(top[0]).toMatchObject({ amount: 1_200, count: 2 });
  });
});

describe('recurring', () => {
  it('converts frequencies to monthly amounts', () => {
    expect(monthlyEquivalent(100_000, 'biweekly')).toBe(216_667);
    expect(monthlyEquivalent(1_200, 'yearly')).toBe(100);
  });
  it('advances dates', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(advanceDate('2026-01-01', 'biweekly')).toBe('2026-01-15');
    expect(advanceDate('2026-01-01', 'semimonthly')).toBe('2026-01-16');
    expect(advanceDate('2026-01-16', 'semimonthly')).toBe('2026-02-01');
  });
  it('lists upcoming bills including overdue ones', () => {
    const rent: Recurring = {
      id: 'r', name: 'Rent', type: 'expense', amount: 150_000, categoryId: 'c_housing', method: 'cash',
      frequency: 'monthly', nextDate: '2026-03-01', active: true,
    };
    const list = upcomingOccurrences([rent], '2026-03-05', 30);
    expect(list.map((o) => o.date)).toEqual(['2026-03-01', '2026-04-01']);
    expect(list[0].daysUntil).toBe(-4);
    expect(monthlyCommitments([rent])).toEqual({ income: 0, expenses: 150_000 });
  });
  it('detects subscriptions from history', () => {
    const history = ['2026-01-05', '2026-02-05', '2026-03-05'].flatMap((d) => [
      tx({ date: d, description: 'NETFLIX.COM 866', amount: 1_549, categoryId: 'c_subscriptions' }),
      tx({ date: d, description: 'SHELL OIL', amount: 3_000 + Number(d.slice(6, 7)) * 1_000 }),
    ]);
    const found = detectRecurring(history);
    expect(found.map((f) => f.key)).toEqual(['netflix.com']);
    expect(found[0]).toMatchObject({ amount: 1_549, months: 3 });
  });
});

describe('health, plan and insights', () => {
  const debt = (p: Partial<Debt>): Debt => ({
    id: 'd', name: 'Visa', kind: 'credit_card', balance: 500_000, originalBalance: 600_000, apr: 25,
    minPayment: 15_000, creditLimit: 800_000, dueDay: 5, createdAt: '', closedAt: null, ...p,
  });

  it('scores financial health', () => {
    const strong = healthScore({ income: 500_000, spending: 350_000, essentials: 200_000, debts: [], emergencyFund: 1_200_000 });
    expect(strong.score).toBe(100);
    const weak = healthScore({
      income: 300_000, spending: 310_000, essentials: 200_000, emergencyFund: 0,
      debts: [debt({ balance: 2_000_000, minPayment: 120_000 })],
    });
    expect(weak.score).toBeLessThan(30);
    expect(weak.grade).toBe('critical');
  });

  it('totals debts and progress', () => {
    const t = debtTotals([debt({}), debt({ id: 'e', balance: 0, originalBalance: 100_000, closedAt: '2026-01-01' })]);
    expect(t.balance).toBe(500_000);
    expect(t.original).toBe(700_000);
    expect(t.progress).toBeCloseTo(2 / 7);
  });

  it('builds the step-by-step plan', () => {
    const steps = buildPlan({
      recentTransactions: 40, budgetsCount: 6, emergencyFund: 50_000, monthlyEssentials: 200_000,
      debts: [debt({})], manualDone: {},
    });
    expect(steps.slice(0, 3).map((s) => s.done)).toEqual([true, true, false]);
    expect(currentStep(steps)?.key).toBe('starter_fund');
    expect(steps.find((s) => s.key === 'high_interest')?.progress).toBeCloseTo(1 / 6);
  });

  it('creates insights ordered by severity', () => {
    const s = summarize([tx({ type: 'income', amount: 100_000 }), tx({ amount: 150_000 })], idx, '2026-03');
    const list = buildInsights({
      summary: s,
      debts: [debt({ minPayment: 5_000 })],
      budgets: [],
      spikes: [],
      uncategorizedCount: 3,
    });
    expect(list[0].severity).toBe('danger');
    expect(list.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['interest_cost', 'minimum_trap', 'overspending', 'high_utilization', 'uncategorized']),
    );
  });
});

describe('dates', () => {
  it('handles month math', () => {
    expect(lastNMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(monthKey('2026-03-15')).toBe('2026-03');
  });
});
