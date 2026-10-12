import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import type { BackupData } from '@/core/backup';
import { DEBT_PAYMENT_CATEGORY_KEY } from '@/core/categories';
import { ruleFromDescription } from '@/core/categorize';
import { todayISO } from '@/core/dates';
import type { PlanStepKey } from '@/core/plan';
import { advanceDate } from '@/core/recurring';
import type {
  Budget,
  Category,
  Debt,
  PaymentMethod,
  Recurring,
  Rule,
  Transaction,
  TxType,
} from '@/core/types';
import * as repo from '@/data/repo';

export type LanguagePref = 'system' | 'es' | 'en';
export type Strategy = 'avalanche' | 'snowball';

export interface Settings {
  onboarded: boolean;
  language: LanguagePref;
  currency: string;
  strategy: Strategy;
  /** Extra amount per month the person commits to debt payoff (cents). */
  extraPayment: number;
  /** Money set aside for emergencies (cents). */
  emergencyFund: number;
  planDone: Partial<Record<PlanStepKey, boolean>>;
  /** Local notifications before bills and debt due dates. */
  remindersEnabled: boolean;
  /** 0 = on the due date. */
  reminderDaysBefore: number;
  /** Local hour (0-23) when reminders fire. */
  reminderHour: number;
  /** Require Face ID / fingerprint / device passcode to open the app. */
  appLock: boolean;
  /** ISO timestamp of the last backup file created. */
  lastBackupAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  language: 'system',
  currency: 'USD',
  strategy: 'avalanche',
  extraPayment: 0,
  emergencyFund: 0,
  planDone: {},
  remindersEnabled: false,
  reminderDaysBefore: 1,
  reminderHour: 9,
  appLock: false,
  lastBackupAt: null,
};

/** Values must have the default's type (settings can come from a restored backup). */
function validSetting(key: keyof Settings, value: unknown): boolean {
  const fallback = DEFAULT_SETTINGS[key];
  if (key === 'lastBackupAt') return value === null || typeof value === 'string';
  if (key === 'planDone') return typeof value === 'object' && value !== null && !Array.isArray(value);
  if (key === 'reminderHour') return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23;
  if (key === 'reminderDaysBefore') return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 14;
  if (typeof fallback === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return typeof value === typeof fallback;
}

function parseSettings(raw: Record<string, string>): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, planDone: {} };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (raw[key] === undefined) continue;
    try {
      const value: unknown = JSON.parse(raw[key]);
      if (validSetting(key, value)) (out as unknown as Record<string, unknown>)[key] = value;
    } catch {
      // Ignore corrupted values and keep the default.
    }
  }
  return out;
}

/** Settings as raw database rows (JSON-encoded values), e.g. for a backup. */
export function serializeSettings(settings: Settings): Record<string, string> {
  return Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, JSON.stringify(v)]));
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'importHash' | 'debtId' | 'recurringId' | 'note'> &
  Partial<Pick<Transaction, 'importHash' | 'debtId' | 'recurringId' | 'note'>>;

interface AppState {
  db: SQLiteDatabase | null;
  ready: boolean;
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  recurring: Recurring[];
  budgets: Budget[];
  rules: Rule[];
  settings: Settings;

  init: (db: SQLiteDatabase) => Promise<void>;
  reload: () => Promise<void>;

  saveTransaction: (t: NewTransaction & { id?: string }) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  importTransactions: (list: NewTransaction[]) => Promise<{ inserted: number; duplicates: number }>;
  /** Changes category/type and remembers it for future imports of the same merchant. */
  learnCategory: (txId: string, categoryId: string | null, type: TxType, applyToSimilar: boolean) => Promise<number>;

  saveDebt: (d: Omit<Debt, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  recordDebtPayment: (debtId: string, amount: number, date: string, method: PaymentMethod, addTransaction: boolean) => Promise<void>;
  setDebtBalance: (debtId: string, balance: number) => Promise<void>;

  saveRecurring: (r: Omit<Recurring, 'id'> & { id?: string }) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  markRecurringPaid: (id: string, amount?: number, date?: string) => Promise<void>;
  skipRecurring: (id: string) => Promise<void>;

  setBudget: (categoryId: string, amount: number) => Promise<void>;
  setBudgets: (list: Budget[]) => Promise<void>;

  saveCategory: (c: Omit<Category, 'id' | 'sort'> & { id?: string; sort?: number }) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  wipeAll: () => Promise<void>;

  /** Everything needed to rebuild the app on another phone. */
  backupData: () => BackupData;
  /** Replaces all data with a validated backup. Keeps this device's app-lock setting. */
  restoreBackup: (data: BackupData) => Promise<void>;
}

const nowIso = () => new Date().toISOString();

function sortTx(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export const useStore = create<AppState>((set, get) => {
  const db = () => {
    const d = get().db;
    if (!d) throw new Error('Database not ready');
    return d;
  };

  return {
    db: null,
    ready: false,
    categories: [],
    transactions: [],
    debts: [],
    recurring: [],
    budgets: [],
    rules: [],
    settings: DEFAULT_SETTINGS,

    init: async (database) => {
      set({ db: database });
      await get().reload();
      set({ ready: true });
    },

    reload: async () => {
      const snap = await repo.loadAll(db());
      set({
        categories: snap.categories,
        transactions: snap.transactions,
        debts: snap.debts,
        recurring: snap.recurring,
        budgets: snap.budgets,
        rules: snap.rules,
        settings: parseSettings(snap.settings),
      });
    },

    saveTransaction: async (input) => {
      const existing = input.id ? get().transactions.find((t) => t.id === input.id) : undefined;
      const tx: Transaction = {
        id: input.id ?? randomUUID(),
        type: input.type,
        amount: Math.abs(Math.round(input.amount)),
        date: input.date,
        categoryId: input.type === 'transfer' ? null : input.categoryId,
        method: input.method,
        description: input.description.trim(),
        note: input.note ?? existing?.note ?? null,
        debtId: input.debtId ?? existing?.debtId ?? null,
        recurringId: input.recurringId ?? existing?.recurringId ?? null,
        importHash: input.importHash ?? existing?.importHash ?? null,
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await repo.upsertTransaction(db(), tx);
      set({ transactions: sortTx([...get().transactions.filter((t) => t.id !== tx.id), tx]) });
      return tx;
    },

    deleteTransaction: async (id) => {
      await repo.deleteTransaction(db(), id);
      set({ transactions: get().transactions.filter((t) => t.id !== id) });
    },

    importTransactions: async (list) => {
      const created = nowIso();
      const rows: Transaction[] = list.map((t) => ({
        id: randomUUID(),
        type: t.type,
        amount: Math.abs(Math.round(t.amount)),
        date: t.date,
        categoryId: t.type === 'transfer' ? null : t.categoryId,
        method: t.method,
        description: t.description,
        note: t.note ?? null,
        debtId: t.debtId ?? null,
        recurringId: t.recurringId ?? null,
        importHash: t.importHash ?? null,
        createdAt: created,
      }));
      const inserted = await repo.insertTransactions(db(), rows);
      set({ transactions: sortTx([...get().transactions, ...inserted]) });
      return { inserted: inserted.length, duplicates: rows.length - inserted.length };
    },

    learnCategory: async (txId, categoryId, type, applyToSimilar) => {
      const tx = get().transactions.find((t) => t.id === txId);
      if (!tx) return 0;
      const pattern = ruleFromDescription(tx.description);
      const finalCategory = type === 'transfer' ? null : categoryId;
      let ids = [txId];
      if (pattern) {
        const rule: Rule = { id: randomUUID(), pattern, categoryId: finalCategory, txType: type, createdAt: nowIso() };
        await repo.upsertRule(db(), rule);
        if (applyToSimilar) {
          // Same merchant and same direction (money in vs. money out).
          const inflow = tx.type === 'income';
          ids = get()
            .transactions.filter(
              (t) => t.id === txId || ((t.type === 'income') === inflow && ruleFromDescription(t.description) === pattern),
            )
            .map((t) => t.id);
        }
      }
      await repo.recategorizeByIds(db(), ids, finalCategory, type);
      const idSet = new Set(ids);
      const rules = await repo.listRules(db());
      set({
        rules,
        transactions: get().transactions.map((t) => (idSet.has(t.id) ? { ...t, categoryId: finalCategory, type } : t)),
      });
      return ids.length;
    },

    saveDebt: async (input) => {
      const existing = input.id ? get().debts.find((d) => d.id === input.id) : undefined;
      const debt: Debt = {
        ...input,
        id: input.id ?? randomUUID(),
        createdAt: input.createdAt ?? existing?.createdAt ?? nowIso(),
        originalBalance: Math.max(input.originalBalance, input.balance),
      };
      await repo.upsertDebt(db(), debt);
      set({ debts: [...get().debts.filter((d) => d.id !== debt.id), debt].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
    },

    deleteDebt: async (id) => {
      await repo.deleteDebt(db(), id);
      set({
        debts: get().debts.filter((d) => d.id !== id),
        transactions: get().transactions.map((t) => (t.debtId === id ? { ...t, debtId: null } : t)),
      });
    },

    recordDebtPayment: async (debtId, amount, date, method, addTransaction) => {
      const debt = get().debts.find((d) => d.id === debtId);
      if (!debt) return;
      const balance = Math.max(0, debt.balance - amount);
      await get().saveDebt({ ...debt, balance, closedAt: balance === 0 ? date : null });
      if (addTransaction) {
        const categoryId = get().categories.find((c) => c.key === DEBT_PAYMENT_CATEGORY_KEY)?.id ?? null;
        await get().saveTransaction({
          type: 'expense',
          amount,
          date,
          categoryId,
          method,
          description: debt.name,
          debtId,
        });
      }
    },

    setDebtBalance: async (debtId, balance) => {
      const debt = get().debts.find((d) => d.id === debtId);
      if (!debt) return;
      await get().saveDebt({ ...debt, balance, closedAt: balance === 0 ? todayISO() : null });
    },

    saveRecurring: async (input) => {
      const r: Recurring = { ...input, id: input.id ?? randomUUID() };
      await repo.upsertRecurring(db(), r);
      set({
        recurring: [...get().recurring.filter((x) => x.id !== r.id), r].sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
      });
    },

    deleteRecurring: async (id) => {
      await repo.deleteRecurring(db(), id);
      set({ recurring: get().recurring.filter((r) => r.id !== id) });
    },

    markRecurringPaid: async (id, amount, date) => {
      const r = get().recurring.find((x) => x.id === id);
      if (!r) return;
      await get().saveTransaction({
        type: r.type,
        amount: amount ?? r.amount,
        date: date ?? todayISO(),
        categoryId: r.categoryId,
        method: r.method,
        description: r.name,
        recurringId: r.id,
      });
      await get().saveRecurring({ ...r, nextDate: advanceDate(r.nextDate, r.frequency) });
    },

    skipRecurring: async (id) => {
      const r = get().recurring.find((x) => x.id === id);
      if (!r) return;
      await get().saveRecurring({ ...r, nextDate: advanceDate(r.nextDate, r.frequency) });
    },

    setBudget: async (categoryId, amount) => {
      await repo.setBudget(db(), { categoryId, amount });
      const rest = get().budgets.filter((b) => b.categoryId !== categoryId);
      set({ budgets: amount > 0 ? [...rest, { categoryId, amount }] : rest });
    },

    setBudgets: async (list) => {
      for (const b of list) await repo.setBudget(db(), b);
      const map = new Map(get().budgets.map((b) => [b.categoryId, b]));
      for (const b of list) {
        if (b.amount > 0) map.set(b.categoryId, b);
        else map.delete(b.categoryId);
      }
      set({ budgets: [...map.values()] });
    },

    saveCategory: async (input) => {
      const existing = input.id ? get().categories.find((c) => c.id === input.id) : undefined;
      const c: Category = {
        ...input,
        id: input.id ?? `cat_${randomUUID()}`,
        sort: input.sort ?? existing?.sort ?? get().categories.length,
      };
      await repo.upsertCategory(db(), c);
      set({ categories: [...get().categories.filter((x) => x.id !== c.id), c].sort((a, b) => a.sort - b.sort) });
    },

    deleteRule: async (id) => {
      await repo.deleteRule(db(), id);
      set({ rules: get().rules.filter((r) => r.id !== id) });
    },

    updateSettings: async (patch) => {
      const next = { ...get().settings, ...patch };
      for (const [key, value] of Object.entries(patch)) {
        await repo.setSetting(db(), key, JSON.stringify(value));
      }
      set({ settings: next });
    },

    wipeAll: async () => {
      await repo.wipeAll(db());
      await get().reload();
    },

    backupData: () => {
      const { categories, transactions, debts, recurring, budgets, rules, settings } = get();
      return { categories, transactions, debts, recurring, budgets, rules, settings: serializeSettings(settings) };
    },

    restoreBackup: async (data) => {
      const { appLock } = get().settings;
      await repo.replaceAll(db(), {
        ...data,
        settings: { ...data.settings, appLock: JSON.stringify(appLock), onboarded: 'true' },
      });
      await get().reload();
    },
  };
});
