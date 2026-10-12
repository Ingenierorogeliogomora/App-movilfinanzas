// Backup file format. Everything lives on the phone, so a backup file is the
// only way to move data to a new phone or recover it after a reinstall.
//
// Restoring never trusts the file: every record is validated and cleaned
// (unknown enums, bad dates, negative amounts and dangling references are
// fixed or dropped) before anything touches the database.

import { isValidISODate } from './dates';
import {
  DEBT_KINDS,
  FREQUENCIES,
  PAYMENT_METHODS,
  type Budget,
  type Category,
  type Debt,
  type Recurring,
  type Rule,
  type Transaction,
} from './types';

export const BACKUP_FORMAT = 'salda-backup';
export const BACKUP_VERSION = 1;

/** Settings that belong to a device, not to the person's data. */
export const DEVICE_ONLY_SETTINGS = ['appLock'];

export interface BackupData {
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  recurring: Recurring[];
  budgets: Budget[];
  rules: Rule[];
  /** Raw settings rows (JSON-encoded values), as stored in the database. */
  settings: Record<string, string>;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}

export interface BackupCounts {
  transactions: number;
  debts: number;
  recurring: number;
  budgets: number;
  categories: number;
  rules: number;
}

export type BackupError = 'invalid_json' | 'not_salda' | 'newer_version' | 'invalid_data';

export type ParseResult =
  | { ok: true; backup: BackupFile; counts: BackupCounts; dropped: number }
  | { ok: false; error: BackupError };

export function createBackup(data: BackupData, meta: { exportedAt: string; appVersion: string }): BackupFile {
  const settings = Object.fromEntries(Object.entries(data.settings).filter(([k]) => !DEVICE_ONLY_SETTINGS.includes(k)));
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: meta.exportedAt, appVersion: meta.appVersion, data: { ...data, settings } };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}

export function backupFileName(exportedAt: string): string {
  return `salda-backup-${exportedAt.slice(0, 10)}.json`;
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    transactions: data.transactions.length,
    debts: data.debts.length,
    recurring: data.recurring.length,
    budgets: data.budgets.length,
    categories: data.categories.length,
    rules: data.rules.length,
  };
}

// ------------------------------------------------------------- validation --

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const optStr = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const cents = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e13 ? Math.round(v) : null;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
const isoDate = (v: unknown): string | null => (typeof v === 'string' && isValidISODate(v) ? v : null);

function category(v: unknown): Category | null {
  if (!isObj(v)) return null;
  const id = nonEmpty(v.id);
  const type = oneOf(v.type, ['income', 'expense'] as const);
  if (!id || !type) return null;
  const key = optStr(v.key);
  const name = optStr(v.name);
  if (!key && !name) return null;
  return {
    id,
    key,
    name,
    type,
    icon: nonEmpty(v.icon) ?? 'ellipsis-horizontal-circle',
    color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#64748B',
    nature: oneOf(v.nature, ['fixed', 'variable'] as const) ?? 'variable',
    bucket: oneOf(v.bucket, ['needs', 'wants', 'savings'] as const) ?? 'wants',
    archived: v.archived === true,
    sort: typeof v.sort === 'number' && Number.isFinite(v.sort) ? v.sort : 0,
  };
}

function debt(v: unknown): Debt | null {
  if (!isObj(v)) return null;
  const id = nonEmpty(v.id);
  const name = nonEmpty(v.name);
  const balance = cents(v.balance);
  const minPayment = cents(v.minPayment);
  const apr = typeof v.apr === 'number' && Number.isFinite(v.apr) && v.apr >= 0 && v.apr < 200 ? v.apr : null;
  if (!id || !name || balance === null || minPayment === null || apr === null) return null;
  const dueDay = typeof v.dueDay === 'number' && Number.isInteger(v.dueDay) && v.dueDay >= 1 && v.dueDay <= 31 ? v.dueDay : null;
  return {
    id,
    name,
    kind: oneOf(v.kind, DEBT_KINDS) ?? 'other',
    balance,
    originalBalance: Math.max(cents(v.originalBalance) ?? balance, balance),
    apr,
    minPayment,
    creditLimit: cents(v.creditLimit) || null,
    dueDay,
    createdAt: nonEmpty(v.createdAt) ?? new Date(0).toISOString(),
    closedAt: optStr(v.closedAt),
  };
}

function recurring(v: unknown): Recurring | null {
  if (!isObj(v)) return null;
  const id = nonEmpty(v.id);
  const name = nonEmpty(v.name);
  const type = oneOf(v.type, ['income', 'expense'] as const);
  const amount = cents(v.amount);
  const frequency = oneOf(v.frequency, FREQUENCIES);
  const nextDate = isoDate(v.nextDate);
  if (!id || !name || !type || amount === null || !frequency || !nextDate) return null;
  return {
    id,
    name,
    type,
    amount,
    categoryId: optStr(v.categoryId),
    method: oneOf(v.method, PAYMENT_METHODS) ?? 'other',
    frequency,
    nextDate,
    active: v.active !== false,
  };
}

function transaction(v: unknown): Transaction | null {
  if (!isObj(v)) return null;
  const id = nonEmpty(v.id);
  const type = oneOf(v.type, ['income', 'expense', 'transfer'] as const);
  const amount = cents(v.amount);
  const date = isoDate(v.date);
  if (!id || !type || amount === null || !date) return null;
  return {
    id,
    type,
    amount,
    date,
    categoryId: type === 'transfer' ? null : optStr(v.categoryId),
    method: oneOf(v.method, PAYMENT_METHODS) ?? 'other',
    description: str(v.description) ?? '',
    note: optStr(v.note),
    debtId: optStr(v.debtId),
    recurringId: optStr(v.recurringId),
    importHash: optStr(v.importHash),
    createdAt: nonEmpty(v.createdAt) ?? `${date}T00:00:00.000Z`,
  };
}

function budget(v: unknown): Budget | null {
  if (!isObj(v)) return null;
  const categoryId = nonEmpty(v.categoryId);
  const amount = cents(v.amount);
  return categoryId && amount ? { categoryId, amount } : null;
}

function rule(v: unknown): Rule | null {
  if (!isObj(v)) return null;
  const id = nonEmpty(v.id);
  const pattern = nonEmpty(v.pattern);
  if (!id || !pattern) return null;
  return {
    id,
    pattern,
    categoryId: optStr(v.categoryId),
    txType: oneOf(v.txType, ['income', 'expense', 'transfer'] as const),
    createdAt: nonEmpty(v.createdAt) ?? new Date(0).toISOString(),
  };
}

/** Keeps the first record for each id (ids are primary keys). */
function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function list<T>(raw: unknown, parse: (v: unknown) => T | null, key: (t: T) => string): { items: T[]; dropped: number } {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 };
  const parsed = raw.map(parse).filter((x): x is T => x !== null);
  const items = uniqueBy(parsed, key);
  return { items, dropped: raw.length - items.length };
}

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!isObj(json) || json.format !== BACKUP_FORMAT) return { ok: false, error: 'not_salda' };
  if (typeof json.version !== 'number' || json.version > BACKUP_VERSION) return { ok: false, error: 'newer_version' };
  const raw = json.data;
  if (!isObj(raw) || !Array.isArray(raw.categories) || !Array.isArray(raw.transactions)) {
    return { ok: false, error: 'invalid_data' };
  }

  const cats = list(raw.categories, category, (c) => c.id);
  if (cats.items.length === 0) return { ok: false, error: 'invalid_data' };
  const debts = list(raw.debts, debt, (d) => d.id);
  const recs = list(raw.recurring, recurring, (r) => r.id);
  const txs = list(raw.transactions, transaction, (t) => t.id);
  const buds = list(raw.budgets, budget, (b) => b.categoryId);
  const rules = list(raw.rules, rule, (r) => r.pattern);

  // Repair references so foreign keys always point at something that exists.
  const catIds = new Set(cats.items.map((c) => c.id));
  const debtIds = new Set(debts.items.map((d) => d.id));
  const recIds = new Set(recs.items.map((r) => r.id));
  const fixCat = (id: string | null) => (id && catIds.has(id) ? id : null);
  const recurringItems = recs.items.map((r) => ({ ...r, categoryId: fixCat(r.categoryId) }));
  const transactionItems = uniqueBy(
    txs.items.map((t) => ({
      ...t,
      categoryId: fixCat(t.categoryId),
      debtId: t.debtId && debtIds.has(t.debtId) ? t.debtId : null,
      recurringId: t.recurringId && recIds.has(t.recurringId) ? t.recurringId : null,
    })),
    // Import hashes are unique in the database; keep the first of any repeat.
    (t) => t.importHash ?? `id:${t.id}`,
  );
  const budgetItems = buds.items.filter((b) => catIds.has(b.categoryId));
  const ruleItems = rules.items.filter((r) => r.categoryId === null || catIds.has(r.categoryId)).map((r) => ({ ...r, categoryId: fixCat(r.categoryId) }));

  const settings: Record<string, string> = {};
  if (isObj(raw.settings)) {
    for (const [k, v] of Object.entries(raw.settings)) {
      if (typeof v === 'string' && !DEVICE_ONLY_SETTINGS.includes(k)) settings[k] = v;
    }
  }
  settings.onboarded = 'true';

  const data: BackupData = {
    categories: cats.items,
    debts: debts.items,
    recurring: recurringItems,
    transactions: transactionItems,
    budgets: budgetItems,
    rules: ruleItems,
    settings,
  };
  const dropped =
    cats.dropped +
    debts.dropped +
    recs.dropped +
    txs.dropped +
    (txs.items.length - transactionItems.length) +
    buds.dropped +
    (buds.items.length - budgetItems.length) +
    rules.dropped +
    (rules.items.length - ruleItems.length);

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: json.version,
      exportedAt: str(json.exportedAt) ?? '',
      appVersion: str(json.appVersion) ?? '',
      data,
    },
    counts: countBackup(data),
    dropped,
  };
}
