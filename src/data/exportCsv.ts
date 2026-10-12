import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { toCSV } from '@/core/csv';
import type { Category, Debt, Transaction } from '@/core/types';

/** Writes every transaction to a CSV in the cache folder and opens the share sheet. */
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
  const file = new File(Paths.cache, `salda-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(toCSV(rows));
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Salda CSV', UTI: 'public.comma-separated-values-text' });
  return true;
}
