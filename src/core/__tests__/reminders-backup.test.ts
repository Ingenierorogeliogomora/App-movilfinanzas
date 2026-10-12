import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT,
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
  type BackupData,
} from '../backup';
import { DEFAULT_CATEGORIES } from '../categories';
import { buildInsights } from '../insights';
import { summarize, indexCategories } from '../analytics';
import { buildReminders, nextDueDate } from '../reminders';
import type { Category, Debt, Recurring, Transaction } from '../types';

const rent: Recurring = {
  id: 'rent',
  name: 'Renta',
  type: 'expense',
  amount: 150_000,
  categoryId: 'cat_housing',
  method: 'cash',
  frequency: 'monthly',
  nextDate: '2026-11-01',
  active: true,
};

const visa: Debt = {
  id: 'visa',
  name: 'Visa',
  kind: 'credit_card',
  balance: 500_000,
  originalBalance: 500_000,
  apr: 24.99,
  minPayment: 15_000,
  creditLimit: null,
  dueDay: 15,
  createdAt: '2026-01-01T00:00:00.000Z',
  closedAt: null,
};

const opts = { today: '2026-10-12', currentHour: 8, daysBefore: 1, hour: 9 };

describe('nextDueDate', () => {
  it('uses this month when the day has not passed, otherwise next month', () => {
    expect(nextDueDate('2026-10-12', 15)).toBe('2026-10-15');
    expect(nextDueDate('2026-10-12', 12)).toBe('2026-10-12');
    expect(nextDueDate('2026-10-12', 5)).toBe('2026-11-05');
  });
  it('clamps to the last day of short months', () => {
    expect(nextDueDate('2026-02-10', 31)).toBe('2026-02-28');
    expect(nextDueDate('2026-01-31', 30)).toBe('2026-02-28');
  });
});

describe('buildReminders', () => {
  it('schedules bills and debt due days the chosen days before', () => {
    const items = buildReminders([rent], [visa], opts);
    expect(items.map((i) => [i.id, i.fireDate])).toEqual([
      ['debt:visa:2026-10-15', '2026-10-14'],
      ['bill:rent:2026-11-01', '2026-10-31'],
      ['debt:visa:2026-11-15', '2026-11-14'],
      ['bill:rent:2026-12-01', '2026-11-30'],
      // Dec 15 is beyond the default 60-day horizon (Dec 11).
    ]);
    expect(items[0]).toMatchObject({ kind: 'debt', amount: 15_000, daysBefore: 1, hour: 9 });
  });

  it('notifies today when the ideal day passed but the bill is still ahead', () => {
    const items = buildReminders([{ ...rent, nextDate: '2026-10-13' }], [], { ...opts, daysBefore: 3 });
    expect(items[0]).toMatchObject({ dueDate: '2026-10-13', fireDate: '2026-10-12', daysBefore: 1 });
  });

  it('never schedules in the past', () => {
    const late = { ...opts, currentHour: 10 };
    const items = buildReminders([{ ...rent, nextDate: '2026-10-13' }], [], late);
    // Fire date would be today at 9:00, which already passed.
    expect(items.find((i) => i.dueDate === '2026-10-13')).toBeUndefined();
    expect(items.every((i) => i.fireDate > '2026-10-12' || late.currentHour < i.hour)).toBe(true);
  });

  it('skips overdue occurrences, income, paused bills and paid-off debts', () => {
    const items = buildReminders(
      [
        { ...rent, nextDate: '2026-08-01' },
        { ...rent, id: 'pay', type: 'income' },
        { ...rent, id: 'paused', active: false },
      ],
      [{ ...visa, closedAt: '2026-09-01' }, { ...visa, id: 'nodue', dueDay: null }],
      opts,
    );
    expect(items.map((i) => i.id)).toEqual(['bill:rent:2026-11-01', 'bill:rent:2026-12-01']);
  });

  it('caps the total so iOS never drops reminders silently', () => {
    const weekly = Array.from({ length: 10 }, (_, i) => ({ ...rent, id: `w${i}`, frequency: 'weekly' as const }));
    const items = buildReminders(weekly, [], { ...opts, max: 20 });
    expect(items).toHaveLength(20);
    // Soonest first.
    expect(items[0].fireDate <= items[19].fireDate).toBe(true);
  });
});

// ------------------------------------------------------------------ backup --

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `cat_${c.key}`, name: null, archived: false, sort: i }));

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    type: 'expense',
    amount: 1_000,
    date: '2026-10-01',
    categoryId: 'cat_groceries',
    method: 'debit_card',
    description: 'KROGER',
    note: null,
    debtId: null,
    recurringId: null,
    importHash: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...p,
  };
}

const data: BackupData = {
  categories,
  transactions: [
    tx({}),
    tx({ id: 't2', type: 'expense', amount: 15_000, categoryId: 'cat_debt_payments', debtId: 'visa' }),
    tx({ id: 't3', type: 'expense', amount: 150_000, categoryId: 'cat_housing', recurringId: 'rent', method: 'cash' }),
  ],
  debts: [visa],
  recurring: [rent],
  budgets: [{ categoryId: 'cat_groceries', amount: 40_000 }],
  rules: [{ id: 'r1', pattern: 'zelle to juan perez', categoryId: 'cat_housing', txType: 'expense', createdAt: '2026-10-01T00:00:00.000Z' }],
  settings: { onboarded: 'true', currency: '"USD"', appLock: 'true', extraPayment: '20000' },
};

describe('backup', () => {
  const file = createBackup(data, { exportedAt: '2026-10-12T15:00:00.000Z', appVersion: '1.1.0' });

  it('round-trips every record', () => {
    const result = parseBackup(serializeBackup(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data.transactions).toEqual(data.transactions);
    expect(result.backup.data.debts).toEqual(data.debts);
    expect(result.backup.data.recurring).toEqual(data.recurring);
    expect(result.backup.data.categories).toEqual(data.categories);
    expect(result.backup.data.budgets).toEqual(data.budgets);
    expect(result.backup.data.rules).toEqual(data.rules);
    expect(result.counts).toMatchObject({ transactions: 3, debts: 1, recurring: 1, budgets: 1 });
    expect(result.dropped).toBe(0);
  });

  it('leaves device-only settings (app lock) out of the file', () => {
    expect(file.data.settings.appLock).toBeUndefined();
    const result = parseBackup(serializeBackup(file));
    expect(result.ok && result.backup.data.settings).toEqual({ onboarded: 'true', currency: '"USD"', extraPayment: '20000' });
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-10-12T15:00:00.000Z')).toBe('salda-backup-2026-10-12.json');
  });

  it.each([
    ['not json', 'invalid_json'],
    ['{"format":"other","version":1}', 'not_salda'],
    [`{"format":"${BACKUP_FORMAT}","version":99,"data":{}}`, 'newer_version'],
    [`{"format":"${BACKUP_FORMAT}","version":1,"data":{"categories":[],"transactions":[]}}`, 'invalid_data'],
    [`{"format":"${BACKUP_FORMAT}","version":1}`, 'invalid_data'],
  ])('rejects %s', (text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  it('cleans bad records and dangling references instead of failing', () => {
    const dirty = JSON.parse(serializeBackup(file));
    dirty.data.transactions.push(
      { id: 'bad-amount', type: 'expense', amount: -5, date: '2026-10-01' },
      { id: 'bad-date', type: 'expense', amount: 5, date: '2026-02-30' },
      { id: 't1', type: 'expense', amount: 5, date: '2026-10-01' }, // duplicate id
      { id: 'orphan', type: 'expense', amount: 500, date: '2026-10-02', categoryId: 'missing', debtId: 'gone', method: 'bitcoin' },
      { id: 'xfer', type: 'transfer', amount: 500, date: '2026-10-02', categoryId: 'cat_housing' },
    );
    dirty.data.budgets.push({ categoryId: 'missing', amount: 100 });
    dirty.data.debts.push({ id: 'd2', name: 'Bad APR', balance: 100, minPayment: 10, apr: 'high' });
    const result = parseBackup(JSON.stringify(dirty));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.backup.data.transactions.map((t) => [t.id, t]));
    expect(byId.has('bad-amount')).toBe(false);
    expect(byId.has('bad-date')).toBe(false);
    expect(byId.get('t1')?.amount).toBe(1_000);
    expect(byId.get('orphan')).toMatchObject({ categoryId: null, debtId: null, method: 'other' });
    expect(byId.get('xfer')?.categoryId).toBeNull();
    expect(result.backup.data.budgets).toEqual(data.budgets);
    expect(result.backup.data.debts.map((d) => d.id)).toEqual(['visa']);
    expect(result.dropped).toBe(5);
  });

  it('keeps import hashes unique', () => {
    const dup = JSON.parse(serializeBackup(file));
    dup.data.transactions = [tx({ id: 'a', importHash: 'h1' }), tx({ id: 'b', importHash: 'h1' })];
    const result = parseBackup(JSON.stringify(dup));
    expect(result.ok && result.backup.data.transactions.map((t) => t.id)).toEqual(['a']);
  });
});

describe('backup reminder insight', () => {
  const summary = summarize([], indexCategories(categories), '2026-10');
  it('suggests a backup once there is data worth protecting', () => {
    const base = { summary, debts: [], budgets: [], spikes: [], uncategorizedCount: 0 };
    expect(buildInsights({ ...base, transactionCount: 50, daysSinceBackup: null }).map((i) => i.kind)).toContain('backup_due');
    expect(buildInsights({ ...base, transactionCount: 50, daysSinceBackup: 45 }).map((i) => i.kind)).toContain('backup_due');
    expect(buildInsights({ ...base, transactionCount: 50, daysSinceBackup: 3 }).map((i) => i.kind)).not.toContain('backup_due');
    expect(buildInsights({ ...base, transactionCount: 5, daysSinceBackup: null }).map((i) => i.kind)).not.toContain('backup_due');
  });
});
