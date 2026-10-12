import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '@/core/categories';

export const DB_NAME = 'salda.db';

// Each entry upgrades the schema by one version. Never edit a shipped
// migration; append a new one instead.
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        key TEXT,
        name TEXT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        nature TEXT NOT NULL DEFAULT 'variable',
        bucket TEXT NOT NULL DEFAULT 'wants',
        archived INTEGER NOT NULL DEFAULT 0,
        sort INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        balance INTEGER NOT NULL,
        original_balance INTEGER NOT NULL,
        apr REAL NOT NULL,
        min_payment INTEGER NOT NULL,
        credit_limit INTEGER,
        due_day INTEGER,
        created_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS recurring (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        method TEXT NOT NULL,
        frequency TEXT NOT NULL,
        next_date TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        date TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        method TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        note TEXT,
        debt_id TEXT REFERENCES debts(id) ON DELETE SET NULL,
        recurring_id TEXT REFERENCES recurring(id) ON DELETE SET NULL,
        import_hash TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL;
      CREATE TABLE IF NOT EXISTS budgets (
        category_id TEXT PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY NOT NULL,
        pattern TEXT NOT NULL UNIQUE,
        category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
        tx_type TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await seedCategories(db);
  },
];

export async function seedCategories(db: SQLiteDatabase): Promise<void> {
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, key, name, type, icon, color, nature, bucket, archived, sort)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?)`,
      [`cat_${c.key}`, c.key, c.type, c.icon, c.color, c.nature, c.bucket, i],
    );
  }
}

export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await migration(db);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
