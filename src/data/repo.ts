// Thin persistence layer: maps SQLite rows <-> domain objects.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupData } from '@/core/backup';
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

import { seedCategories } from './db';

type Row = Record<string, unknown>;

const str = (v: unknown) => (v == null ? null : String(v));

function toCategory(r: Row): Category {
  return {
    id: String(r.id),
    key: str(r.key),
    name: str(r.name),
    type: r.type as Category['type'],
    icon: String(r.icon),
    color: String(r.color),
    nature: r.nature as Category['nature'],
    bucket: r.bucket as Category['bucket'],
    archived: !!r.archived,
    sort: Number(r.sort),
  };
}

function toTransaction(r: Row): Transaction {
  return {
    id: String(r.id),
    type: r.type as TxType,
    amount: Number(r.amount),
    date: String(r.date),
    categoryId: str(r.category_id),
    method: r.method as PaymentMethod,
    description: String(r.description ?? ''),
    note: str(r.note),
    debtId: str(r.debt_id),
    recurringId: str(r.recurring_id),
    importHash: str(r.import_hash),
    createdAt: String(r.created_at),
  };
}

function toDebt(r: Row): Debt {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as Debt['kind'],
    balance: Number(r.balance),
    originalBalance: Number(r.original_balance),
    apr: Number(r.apr),
    minPayment: Number(r.min_payment),
    creditLimit: r.credit_limit == null ? null : Number(r.credit_limit),
    dueDay: r.due_day == null ? null : Number(r.due_day),
    createdAt: String(r.created_at),
    closedAt: str(r.closed_at),
  };
}

function toRecurring(r: Row): Recurring {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Recurring['type'],
    amount: Number(r.amount),
    categoryId: str(r.category_id),
    method: r.method as PaymentMethod,
    frequency: r.frequency as Recurring['frequency'],
    nextDate: String(r.next_date),
    active: !!r.active,
  };
}

function toRule(r: Row): Rule {
  return {
    id: String(r.id),
    pattern: String(r.pattern),
    categoryId: str(r.category_id),
    txType: (r.tx_type as TxType | null) ?? null,
    createdAt: String(r.created_at),
  };
}

export interface Snapshot {
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  recurring: Recurring[];
  budgets: Budget[];
  rules: Rule[];
  settings: Record<string, string>;
}

export async function loadAll(db: SQLiteDatabase): Promise<Snapshot> {
  const [categories, transactions, debts, recurring, budgets, rules, settings] = await Promise.all([
    db.getAllAsync<Row>('SELECT * FROM categories ORDER BY sort, rowid'),
    db.getAllAsync<Row>('SELECT * FROM transactions ORDER BY date DESC, created_at DESC'),
    db.getAllAsync<Row>('SELECT * FROM debts ORDER BY created_at'),
    db.getAllAsync<Row>('SELECT * FROM recurring ORDER BY next_date'),
    db.getAllAsync<Row>('SELECT * FROM budgets'),
    listRules(db),
    db.getAllAsync<Row>('SELECT * FROM settings'),
  ]);
  return {
    categories: categories.map(toCategory),
    transactions: transactions.map(toTransaction),
    debts: debts.map(toDebt),
    recurring: recurring.map(toRecurring),
    budgets: budgets.map((r) => ({ categoryId: String(r.category_id), amount: Number(r.amount) })),
    rules,
    settings: Object.fromEntries(settings.map((r) => [String(r.key), String(r.value)])),
  };
}

// ----------------------------------------------------------- transactions --

const TX_COLUMNS =
  'id, type, amount, date, category_id, method, description, note, debt_id, recurring_id, import_hash, created_at';

function txParams(t: Transaction) {
  return [
    t.id,
    t.type,
    t.amount,
    t.date,
    t.categoryId,
    t.method,
    t.description,
    t.note,
    t.debtId,
    t.recurringId,
    t.importHash,
    t.createdAt,
  ];
}

export async function upsertTransaction(db: SQLiteDatabase, t: Transaction): Promise<void> {
  await db.runAsync(`INSERT OR REPLACE INTO transactions (${TX_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, txParams(t));
}

/** Inserts many rows atomically. Rows whose import hash already exists are skipped. */
export async function insertTransactions(db: SQLiteDatabase, list: Transaction[]): Promise<Transaction[]> {
  const inserted: Transaction[] = [];
  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      `INSERT OR IGNORE INTO transactions (${TX_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    try {
      for (const t of list) {
        const res = await stmt.executeAsync(txParams(t));
        if (res.changes > 0) inserted.push(t);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
  return inserted;
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function existingImportHashes(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<Row>('SELECT import_hash FROM transactions WHERE import_hash IS NOT NULL');
  return new Set(rows.map((r) => String(r.import_hash)));
}

export async function recategorizeByIds(
  db: SQLiteDatabase,
  ids: string[],
  categoryId: string | null,
  type: TxType,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('UPDATE transactions SET category_id = ?, type = ? WHERE id = ?', [categoryId, type, id]);
    }
  });
}

// ------------------------------------------------------------------ debts --

export async function upsertDebt(db: SQLiteDatabase, d: Debt): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO debts (id, name, kind, balance, original_balance, apr, min_payment, credit_limit, due_day, created_at, closed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id, d.name, d.kind, d.balance, d.originalBalance, d.apr, d.minPayment, d.creditLimit, d.dueDay, d.createdAt, d.closedAt],
  );
}

export async function deleteDebt(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

// -------------------------------------------------------------- recurring --

export async function upsertRecurring(db: SQLiteDatabase, r: Recurring): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO recurring (id, name, type, amount, category_id, method, frequency, next_date, active)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [r.id, r.name, r.type, r.amount, r.categoryId, r.method, r.frequency, r.nextDate, r.active ? 1 : 0],
  );
}

export async function deleteRecurring(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recurring WHERE id = ?', [id]);
}

// ------------------------------------------------------- budgets & rules --

export async function setBudget(db: SQLiteDatabase, b: Budget): Promise<void> {
  if (b.amount > 0) {
    await db.runAsync('INSERT OR REPLACE INTO budgets (category_id, amount) VALUES (?, ?)', [b.categoryId, b.amount]);
  } else {
    await db.runAsync('DELETE FROM budgets WHERE category_id = ?', [b.categoryId]);
  }
}

export async function upsertRule(db: SQLiteDatabase, r: Rule): Promise<void> {
  await db.runAsync(
    `INSERT INTO rules (id, pattern, category_id, tx_type, created_at) VALUES (?,?,?,?,?)
     ON CONFLICT(pattern) DO UPDATE SET category_id = excluded.category_id, tx_type = excluded.tx_type`,
    [r.id, r.pattern, r.categoryId, r.txType, r.createdAt],
  );
}

export async function listRules(db: SQLiteDatabase): Promise<Rule[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM rules');
  return rows.map(toRule);
}

export async function deleteRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM rules WHERE id = ?', [id]);
}

// ------------------------------------------------------------- categories --

export async function upsertCategory(db: SQLiteDatabase, c: Category): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO categories (id, key, name, type, icon, color, nature, bucket, archived, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [c.id, c.key, c.name, c.type, c.icon, c.color, c.nature, c.bucket, c.archived ? 1 : 0, c.sort],
  );
}

// --------------------------------------------------------------- settings --

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function wipeAll(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM rules;
      DELETE FROM recurring;
      DELETE FROM debts;
      DELETE FROM categories;
      DELETE FROM settings;
    `);
    await seedCategories(db);
  });
}

/**
 * Replaces every table with the given data in one transaction, so a failed
 * restore leaves the previous data untouched. Parents are inserted before
 * the rows that reference them.
 */
export async function replaceAll(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM rules;
      DELETE FROM recurring;
      DELETE FROM debts;
      DELETE FROM categories;
      DELETE FROM settings;
    `);
    for (const c of data.categories) await upsertCategory(db, c);
    for (const d of data.debts) await upsertDebt(db, d);
    for (const r of data.recurring) await upsertRecurring(db, r);
    const stmt = await db.prepareAsync(`INSERT INTO transactions (${TX_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    try {
      for (const t of data.transactions) await stmt.executeAsync(txParams(t));
    } finally {
      await stmt.finalizeAsync();
    }
    for (const b of data.budgets) await setBudget(db, b);
    for (const r of data.rules) await upsertRule(db, r);
    for (const [key, value] of Object.entries(data.settings)) await setSetting(db, key, value);
  });
}
