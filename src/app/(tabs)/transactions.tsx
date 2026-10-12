import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';

import { currentMonthKey, formatDate, monthKey } from '@/core/dates';
import type { Transaction } from '@/core/types';
import { useI18n } from '@/i18n';
import { useCategoryMap } from '@/state/derived';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';
import { MonthSwitcher, methodIcon } from '@/ui/pickers';
import { CategoryIcon, ChipGroup, EmptyState, Fab, Icon, IconButton, Row, Txt, Button } from '@/ui/primitives';

type Filter = 'all' | 'expense' | 'income' | 'transfer' | 'uncategorized';

export default function Transactions() {
  const c = useTheme();
  const { t, money, locale, categoryName } = useI18n();
  const navigation = useNavigation();
  const transactions = useStore((s) => s.transactions);
  const categories = useCategoryMap();
  const debts = useStore((s) => s.debts);
  const [month, setMonth] = useState(currentMonthKey());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton name="cloud-upload-outline" label={t('tx.import')} onPress={() => router.push('/import')} />
      ),
    });
  }, [navigation, t]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = transactions.filter((tx) => {
      if (monthKey(tx.date) !== month) return false;
      if (filter === 'uncategorized' && (tx.type === 'transfer' || tx.categoryId)) return false;
      if (filter !== 'all' && filter !== 'uncategorized' && tx.type !== filter) return false;
      if (q) {
        const cat = tx.categoryId ? categoryName(categories.get(tx.categoryId)) : '';
        if (!tx.description.toLowerCase().includes(q) && !cat.toLowerCase().includes(q) && !(tx.note ?? '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
    const byDate = new Map<string, Transaction[]>();
    for (const tx of list) {
      const arr = byDate.get(tx.date) ?? [];
      arr.push(tx);
      byDate.set(tx.date, arr);
    }
    return [...byDate.entries()].map(([date, data]) => ({
      date,
      data,
      net: data.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0), 0),
    }));
  }, [transactions, month, filter, query, categories, categoryName]);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('tx.filter.all') },
    { value: 'expense', label: t('tx.filter.expense') },
    { value: 'income', label: t('tx.filter.income') },
    { value: 'transfer', label: t('tx.filter.transfer') },
    { value: 'uncategorized', label: t('tx.filter.uncategorized') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <MonthSwitcher month={month} onChange={setMonth} />
            <Row
              gap={spacing.sm}
              style={{ backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: c.border }}
            >
              <Icon name="search" size={18} color={c.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.search')}
                placeholderTextColor={c.muted}
                style={{ flex: 1, paddingVertical: 10, color: c.text, fontSize: 16 }}
                clearButtonMode="while-editing"
              />
            </Row>
            <ChipGroup scroll options={filters} value={filter} onChange={setFilter} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
            <Txt variant="label">
              {formatDate(section.date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Txt>
            <Txt variant="caption">{money(section.net, { signed: true })}</Txt>
          </Row>
        )}
        renderItem={({ item }) => {
          const cat = item.categoryId ? categories.get(item.categoryId) : undefined;
          const debt = item.debtId ? debts.find((d) => d.id === item.debtId) : undefined;
          const amountColor = item.type === 'income' ? c.success : item.type === 'transfer' ? c.muted : c.text;
          const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '';
          const subtitle =
            item.type === 'transfer'
              ? t('type.transfer')
              : debt
                ? t('tx.linkedDebt', { name: debt.name })
                : categoryName(cat);
          return (
            <Pressable
              onPress={() => router.push(`/transaction/${item.id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 10,
                paddingHorizontal: spacing.md,
                backgroundColor: c.card,
                borderRadius: radius.md,
                marginBottom: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <CategoryIcon
                icon={item.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'help-circle-outline')}
                color={item.type === 'transfer' ? c.muted : (cat?.color ?? c.warning)}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
                  {item.description || subtitle}
                </Txt>
                <Row gap={4}>
                  <Icon name={methodIcon(item.method)} size={12} color={c.muted} />
                  <Txt variant="caption" numberOfLines={1} color={!cat && item.type === 'expense' ? c.warning : undefined}>
                    {subtitle}
                  </Txt>
                </Row>
              </View>
              <Txt style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }} color={amountColor}>
                {sign}
                {money(item.amount)}
              </Txt>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t('tx.empty')}
            body={t('tx.emptyHint')}
            action={<Button title={t('more.import')} icon="cloud-upload-outline" variant="secondary" onPress={() => router.push('/import')} />}
          />
        }
      />
      <Fab label={t('tx.new')} onPress={() => router.push('/transaction/new')} />
    </View>
  );
}
