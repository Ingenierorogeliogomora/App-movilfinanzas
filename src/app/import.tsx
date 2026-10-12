import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { categorize } from '@/core/categorize';
import {
  analyzeCSV,
  extractRows,
  importHashes,
  type ColumnMapping,
  type CsvAnalysis,
  type DateOrder,
  type ExpenseSign,
} from '@/core/csv';
import { formatDate } from '@/core/dates';
import type { PaymentMethod } from '@/core/types';
import { pickTextFile } from '@/data/files';
import { useI18n } from '@/i18n';
import { useCategoryMap } from '@/state/derived';
import { useStore, type NewTransaction } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { Field } from '@/ui/fields';
import { Button, Card, CategoryIcon, ChipGroup, Divider, EmptyState, Icon, Row, Screen, Segmented, Txt } from '@/ui/primitives';

type Account = 'credit' | 'bank';
type Phase = 'intro' | 'loading' | 'review' | 'done';

export default function ImportScreen() {
  const c = useTheme();
  const { t, money, locale, categoryName } = useI18n();
  const categories = useStore((s) => s.categories);
  const rules = useStore((s) => s.rules);
  const transactions = useStore((s) => s.transactions);
  const importTransactions = useStore((s) => s.importTransactions);
  const categoryMap = useCategoryMap();

  const [phase, setPhase] = useState<Phase>('intro');
  const [account, setAccount] = useState<Account>('credit');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CsvAnalysis | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder>('MDY');
  const [sign, setSign] = useState<ExpenseSign>('negative');
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async () => {
    setError(null);
    try {
      const file = await pickTextFile('.csv,text/csv,text/plain');
      if (!file) return;
      setPhase('loading');
      const text = file.text;
      const usesMonthFirst = /-(US|PH|CA)$/.test(locale);
      const a = analyzeCSV(text, usesMonthFirst ? 'MDY' : 'DMY');
      if (!a.mapping) throw new Error('unrecognized');
      setAnalysis(a);
      setMapping(a.mapping);
      setDateOrder(a.dateOrder);
      setSign(a.expenseSign);
      setPhase('review');
    } catch {
      setError(t('import.failed'));
      setPhase('intro');
    }
  };

  const preview = useMemo(() => {
    if (!analysis || !mapping) return null;
    const { rows, skipped } = extractRows(analysis, mapping, dateOrder, sign);
    const hashes = importHashes(rows);
    const existing = new Set(transactions.map((tx) => tx.importHash).filter(Boolean));
    const idByKey = new Map<string, string>(categories.filter((cat) => cat.key).map((cat) => [cat.key!, cat.id]));
    const method: PaymentMethod = account === 'credit' ? 'credit_card' : 'debit_card';
    const items: (NewTransaction & { duplicate: boolean })[] = rows.map((r, i) => {
      const cat = categorize(r.description, r.direction, { rules, idByKey });
      return {
        type: cat.type,
        amount: r.amount,
        date: r.date,
        categoryId: cat.categoryId,
        method,
        description: r.description,
        importHash: hashes[i],
        duplicate: existing.has(hashes[i]),
      };
    });
    const fresh = items.filter((x) => !x.duplicate);
    const sumOf = (type: string) => fresh.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
    return {
      items,
      fresh,
      skipped,
      expenses: fresh.filter((x) => x.type === 'expense').length,
      incomes: fresh.filter((x) => x.type === 'income').length,
      transfers: fresh.filter((x) => x.type === 'transfer').length,
      uncategorized: fresh.filter((x) => x.type !== 'transfer' && !x.categoryId).length,
      expenseTotal: sumOf('expense'),
      incomeTotal: sumOf('income'),
      duplicates: items.length - fresh.length,
    };
  }, [analysis, mapping, dateOrder, sign, transactions, categories, rules, account]);

  const confirm = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await importTransactions(preview.fresh.map(({ duplicate: _duplicate, ...tx }) => tx));
      setResult(res);
      setPhase('done');
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setAnalysis(null);
    setMapping(null);
    setResult(null);
    setPhase('intro');
  };

  if (phase === 'loading') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl }}>
          <ActivityIndicator color={c.primary} />
          <Txt muted>{t('import.reading')}</Txt>
        </View>
      </Screen>
    );
  }

  if (phase === 'done' && result) {
    return (
      <Screen>
        <EmptyState
          icon="checkmark-circle"
          title={result.inserted ? t('import.done', { count: result.inserted }) : t('import.nothing')}
          body={result.duplicates ? t('import.duplicates', { count: result.duplicates }) : undefined}
          action={
            <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
              <Button title={t('import.viewTx')} onPress={() => router.replace('/transactions')} />
              <Button title={t('import.another')} variant="ghost" onPress={reset} />
            </View>
          }
        />
      </Screen>
    );
  }

  if (phase === 'review' && analysis && mapping && preview) {
    const width = Math.max(...analysis.rows.slice(0, 10).map((r) => r.length));
    const firstData = analysis.rows[analysis.headerRow === null ? 0 : analysis.headerRow + 1] ?? [];
    const columns = Array.from({ length: width }, (_, i) => ({
      value: String(i),
      label: analysis.headers[i] ? analysis.headers[i].slice(0, 22) : `#${i + 1}`,
    }));
    const noneOption = { value: '-1', label: t('common.none') };
    const setCol = (key: keyof ColumnMapping, v: string) => {
      const n = Number(v);
      setMapping({ ...mapping, [key]: n < 0 ? null : n });
    };
    const sample = (col: number | null) => (col === null ? '' : (firstData[col] ?? ''));

    return (
      <Screen>
        <Card>
          <Txt variant="label">{t('import.columns')}</Txt>
          {(
            [
              ['date', t('import.colDate'), false],
              ['description', t('import.colDescription'), false],
              ['amount', t('import.colAmount'), true],
              ...(mapping.amount === null
                ? ([
                    ['debit', t('import.colDebit'), true],
                    ['credit', t('import.colCredit'), true],
                  ] as const)
                : []),
            ] as const
          ).map(([key, label, optional]) => (
            <Field key={key} label={label} hint={sample(mapping[key]) ? `→ ${sample(mapping[key])}` : undefined}>
              <ChipGroup
                scroll
                options={optional ? [noneOption, ...columns] : columns}
                value={String(mapping[key] ?? -1)}
                onChange={(v) => setCol(key, v)}
              />
            </Field>
          ))}
          <Field label={t('import.dateOrder')}>
            <ChipGroup
              options={[
                { value: 'MDY', label: 'MM/DD/YYYY' },
                { value: 'DMY', label: 'DD/MM/YYYY' },
                { value: 'YMD', label: 'YYYY-MM-DD' },
              ]}
              value={dateOrder}
              onChange={setDateOrder}
            />
          </Field>
          {mapping.amount !== null ? (
            <Field label={t('import.sign')}>
              <Segmented
                options={[
                  { value: 'negative', label: t('import.signNegative') },
                  { value: 'positive', label: t('import.signPositive') },
                ]}
                value={sign}
                onChange={setSign}
              />
            </Field>
          ) : null}
        </Card>

        <Card>
          <Txt variant="label">{t('import.summary')}</Txt>
          <Txt style={{ fontWeight: '700' }}>{t('import.rows', { count: preview.items.length })}</Txt>
          <Txt>{t('import.expenses', { count: preview.expenses, amount: money(preview.expenseTotal) })}</Txt>
          <Txt>{t('import.incomes', { count: preview.incomes, amount: money(preview.incomeTotal) })}</Txt>
          <Txt>{t('import.transfers', { count: preview.transfers })}</Txt>
          {preview.uncategorized ? <Txt color={c.warning}>{t('import.uncategorized', { count: preview.uncategorized })}</Txt> : null}
          {preview.duplicates ? <Txt muted>{t('import.duplicates', { count: preview.duplicates })}</Txt> : null}
          {preview.skipped ? <Txt muted>{t('import.skipped', { count: preview.skipped })}</Txt> : null}
        </Card>

        <Card>
          <Txt variant="label">{t('import.preview')}</Txt>
          {preview.items.slice(0, 12).map((item, i) => {
            const cat = item.categoryId ? categoryMap.get(item.categoryId) : undefined;
            const label = item.type === 'transfer' ? t('type.transfer') : categoryName(cat);
            return (
              <View key={`${item.importHash}-${i}`} style={{ opacity: item.duplicate ? 0.45 : 1 }}>
                <Row gap={spacing.md}>
                  <CategoryIcon
                    size={30}
                    icon={item.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'help-circle-outline')}
                    color={item.type === 'transfer' ? c.muted : (cat?.color ?? c.warning)}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{item.description}</Txt>
                    <Txt variant="caption" numberOfLines={1}>
                      {formatDate(item.date, locale, { day: 'numeric', month: 'short' })} · {label}
                    </Txt>
                  </View>
                  <Txt style={{ fontWeight: '700' }} color={item.type === 'income' ? c.success : undefined}>
                    {item.type === 'income' ? '+' : item.type === 'expense' ? '-' : ''}
                    {money(item.amount)}
                  </Txt>
                </Row>
              </View>
            );
          })}
        </Card>

        {error ? <Txt color={c.danger}>{error}</Txt> : null}
        <Button
          title={t('import.confirm', { count: preview.fresh.length })}
          onPress={() => void confirm()}
          loading={saving}
          disabled={preview.fresh.length === 0}
        />
        <Button title={t('common.cancel')} variant="ghost" onPress={reset} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt>{t('import.intro')}</Txt>
      <Card>
        <Txt variant="label">{t('import.accountType')}</Txt>
        <Segmented
          options={[
            { value: 'credit', label: t('import.creditCard') },
            { value: 'bank', label: t('import.bankAccount') },
          ]}
          value={account}
          onChange={setAccount}
        />
      </Card>
      {error ? (
        <Card tone="danger">
          <Row gap={spacing.md}>
            <Icon name="alert-circle" color={c.danger} />
            <Txt style={{ flex: 1 }}>{error}</Txt>
          </Row>
        </Card>
      ) : null}
      <Button title={t('import.pick')} icon="document-text-outline" onPress={() => void pick()} />
      <Card tone="info">
        <Txt variant="label">{t('import.tipsTitle')}</Txt>
        <Divider />
        {t('import.tips')
          .split('. ')
          .map((line) => (
            <Row key={line} gap={spacing.sm} align="flex-start">
              <Icon name="ellipse" size={8} color={c.info} />
              <Txt variant="caption" style={{ flex: 1 }}>
                {line.replace(/\.$/, '')}
              </Txt>
            </Row>
          ))}
      </Card>
    </Screen>
  );
}
