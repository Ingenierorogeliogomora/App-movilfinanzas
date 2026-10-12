import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo } from 'react';
import { View } from 'react-native';

import { merchantKey } from '@/core/categorize';
import { addMonths, daysBetween, formatDate, todayISO } from '@/core/dates';
import { detectRecurring, monthlyCommitments } from '@/core/recurring';
import { useI18n } from '@/i18n';
import { useCategoryMap } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { methodIcon } from '@/ui/pickers';
import { Button, Card, CategoryIcon, EmptyState, Icon, IconButton, Row, Screen, SectionTitle, StatBlock, Txt } from '@/ui/primitives';

export default function RecurringList() {
  const c = useTheme();
  const { t, money, locale } = useI18n();
  const navigation = useNavigation();
  const recurring = useStore((s) => s.recurring);
  const transactions = useStore((s) => s.transactions);
  const saveRecurring = useStore((s) => s.saveRecurring);
  const markPaid = useStore((s) => s.markRecurringPaid);
  const skip = useStore((s) => s.skipRecurring);
  const categories = useCategoryMap();
  const today = todayISO();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton name="add" label={t('rec.add')} onPress={() => router.push('/recurring/new')} />,
    });
  }, [navigation, t]);

  const totals = monthlyCommitments(recurring);
  const suggestions = useMemo(() => {
    const known = new Set(recurring.map((r) => merchantKey(r.name)));
    return detectRecurring(transactions).filter((s) => !known.has(s.key)).slice(0, 8);
  }, [transactions, recurring]);

  return (
    <Screen>
      <Card>
        <Row gap={spacing.md}>
          <StatBlock label={t('rec.monthlyExpenses')} value={money(totals.expenses)} />
          <StatBlock label={t('rec.monthlyIncome')} value={money(totals.income)} />
        </Row>
      </Card>

      {recurring.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={t('rec.empty')}
          body={t('rec.emptyHint')}
          action={<Button title={t('rec.add')} icon="add" onPress={() => router.push('/recurring/new')} />}
        />
      ) : (
        recurring.map((r) => {
          const cat = r.categoryId ? categories.get(r.categoryId) : undefined;
          const days = daysBetween(today, r.nextDate);
          const when =
            days < 0 ? t('home.overdue', { days: -days }) : days === 0 ? t('home.dueToday') : t('home.dueIn', { days });
          return (
            <Card key={r.id} onPress={() => router.push(`/recurring/${r.id}`)} style={!r.active && { opacity: 0.55 }}>
              <Row gap={spacing.md}>
                <CategoryIcon icon={cat?.icon ?? 'calendar-outline'} color={cat?.color ?? c.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '600' }} numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Row gap={4}>
                    <Icon name={methodIcon(r.method)} size={12} color={c.muted} />
                    <Txt variant="caption">
                      {t(`freq.${r.frequency}`)} · {formatDate(r.nextDate, locale, { day: 'numeric', month: 'short' })}
                    </Txt>
                  </Row>
                  {r.active ? (
                    <Txt variant="caption" color={days < 0 ? c.danger : days <= 3 ? c.warning : undefined}>
                      {when}
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="money" color={r.type === 'income' ? c.success : undefined}>
                  {money(r.amount)}
                </Txt>
              </Row>
              {r.active && days <= 7 ? (
                <Row gap={spacing.sm}>
                  <Button
                    small
                    title={r.type === 'income' ? t('rec.markReceived') : t('rec.markPaid')}
                    icon="checkmark"
                    onPress={() => void markPaid(r.id)}
                    style={{ flex: 1 }}
                  />
                  <Button small variant="ghost" title={t('rec.skip')} onPress={() => void skip(r.id)} style={{ flex: 1 }} />
                </Row>
              ) : null}
            </Card>
          );
        })
      )}

      {suggestions.length ? (
        <>
          <SectionTitle>{t('rec.detected')}</SectionTitle>
          <Txt variant="caption">{t('rec.detectedHint')}</Txt>
          {suggestions.map((s) => {
            const cat = s.categoryId ? categories.get(s.categoryId) : undefined;
            return (
              <Card key={s.key}>
                <Row gap={spacing.md}>
                  <CategoryIcon icon={cat?.icon ?? 'repeat'} color={cat?.color ?? c.primary} />
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '600' }} numberOfLines={1}>
                      {s.name}
                    </Txt>
                    <Txt variant="caption">{t('rec.detectedItem', { amount: money(s.amount), months: s.months })}</Txt>
                  </View>
                  <Button
                    small
                    variant="secondary"
                    title={t('common.add')}
                    onPress={() =>
                      void saveRecurring({
                        name: s.name,
                        type: 'expense',
                        amount: s.amount,
                        categoryId: s.categoryId,
                        method: s.method,
                        frequency: 'monthly',
                        nextDate: addMonths(s.lastDate, 1),
                        active: true,
                      })
                    }
                  />
                </Row>
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
