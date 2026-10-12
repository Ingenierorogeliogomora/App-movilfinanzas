import { toCSV } from '@/core/csv';
import type { Category, Debt, Transaction } from '@/core/types';

import { saveTextFile } from './files';

/** Exports every transaction as CSV through the share sheet (or a download on web). */
export async function exportTransactionsCsv(
  transactions: Transaction[],
  categories: Map<string, Category>,
  debts: Debt[],
  categoryName: (c: Category | undefined) => string,
): Promise<boolean> {
  const debtNames = new Map(debts.map((d) => [d.id, d.name]));
  const rows: (string | number)[][] = [
    ['date', 'type', 'amount', 'category', 'payment_method', 'description', 'note', 'debt'],
    ...transactions.map((t) => [
      t.date,
      t.type,
      (t.amount / 100).toFixed(2),
      t.categoryId ? categoryName(categories.get(t.categoryId)) : '',
      t.method,
      t.description,
      t.note ?? '',
      t.debtId ? (debtNames.get(t.debtId) ?? '') : '',
    ]),
  ];
  const name = `salda-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return saveTextFile(name, toCSV(rows), 'text/csv', 'public.comma-separated-values-text');
}
