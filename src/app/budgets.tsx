import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { budgetStatuses, suggestBudgets, summarizeMonths } from '@/core/analytics';
import { addMonthsToKey, currentMonthKey, lastNMonths, todayISO } from '@/core/dates';
import { centsToInput, parseAmount } from '@/core/money';
import { useI18n } from '@/i18n';
import { useAverages, useCategoryIndex, useMonthSummary } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { MoneyField } from '@/ui/fields';
import { Button, Card, CategoryIcon, Divider, ProgressBar, Row, Screen, StatBlock, Txt } from '@/ui/primitives';

export default function Budgets() {
  const c = useTheme();
  const { t, money, categoryName } = useI18n();
  const month = currentMonthKey();
  const categories = useStore((s) => s.categories);
  const budgets = useStore((s) => s.budgets);
  const transactions = useStore((s) => s.transactions);
  const setBudget = useStore((s) => s.setBudget);
  const setBudgets = useStore((s) => s.setBudgets);
  const summary = useMonthSummary(month);
  const averages = useAverages(month);
  const idx = useCategoryIndex();

  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(budgets.map((b) => [b.categoryId, centsToInput(b.amount)])),
  );

  const statuses = useMemo(() => new Map(budgetStatuses(budgets, summary, todayISO()).map((s) => [s.categoryId, s])), [budgets, summary]);
  const spentBy = useMemo(() => new Map(summary.byCategory.map((x) => [x.categoryId, x.amount])), [summary]);
  const expenseCategories = categories.filter((cat) => cat.type === 'expense' && !cat.archived);
  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const unassigned = averages.income - totalBudgeted;

  const suggest = async () => {
    // Prefer the 3 months before the current one so a half month does not skew
    // it; new users with only this month's data get a suggestion from it.
    let list = suggestBudgets(summarizeMonths(transactions, idx, lastNMonths(addMonthsToKey(month, -1), 3)), idx);
    if (!list.length) list = suggestBudgets([summary], idx);
    if (!list.length) {
      Alert.alert(t('budget.noHistory'));
      return;
    }
    await setBudgets(list);
    setTexts((prev) => ({ ...prev, ...Object.fromEntries(list.map((b) => [b.categoryId, centsToInput(b.amount)])) }));
    Alert.alert(t('budget.suggested'));
  };

  return (
    <Screen>
      <Txt muted>{t('budget.intro')}</Txt>
      <Card>
        <Row gap={spacing.md}>
          <StatBlock label={t('budget.avgIncome')} value={money(averages.income)} />
          <StatBlock label={t('budget.totalBudgeted')} value={money(totalBudgeted)} />
        </Row>
        {averages.income > 0 ? (
          <Txt color={unassigned < 0 ? c.danger : c.success} style={{ fontWeight: '600' }}>
            {unassigned >= 0
              ? `${t('budget.unassigned')}: ${money(unassigned)}`
              : t('budget.overAssigned', { amount: money(-unassigned) })}
          </Txt>
        ) : null}
        <Button title={t('budget.suggest')} icon="sparkles-outline" variant="secondary" onPress={() => void suggest()} />
      </Card>

      {expenseCategories.map((cat) => {
        const status = statuses.get(cat.id);
        const spent = spentBy.get(cat.id) ?? 0;
        const color = status?.status === 'over' ? c.danger : status?.status === 'warning' ? c.warning : c.success;
        return (
          <Card key={cat.id}>
            <Row gap={spacing.md}>
              <CategoryIcon icon={cat.icon} color={cat.color} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '600' }}>{categoryName(cat)}</Txt>
                <Txt variant="caption">
                  {t(`nature.${cat.nature}`)} · {t(`bucket.${cat.bucket}`)}
                </Txt>
              </View>
              <View style={{ width: 130 }}>
                <MoneyField
                  value={texts[cat.id] ?? ''}
                  onChangeText={(v) => {
                    setTexts((p) => ({ ...p, [cat.id]: v }));
                    void setBudget(cat.id, parseAmount(v) ?? 0);
                  }}
                />
              </View>
            </Row>
            {status ? (
              <>
                <ProgressBar value={status.pct} color={color} />
                <Row justify="space-between">
                  <Txt variant="caption">{t('budget.spentOf', { spent: money(status.spent), budget: money(status.budget) })}</Txt>
                  <Txt variant="caption" color={status.remaining < 0 ? c.danger : undefined}>
                    {status.remaining >= 0
                      ? t('budget.left', { amount: money(status.remaining) })
                      : t('budget.over', { amount: money(-status.remaining) })}
                  </Txt>
                </Row>
              </>
            ) : spent > 0 ? (
              <>
                <Divider />
                <Txt variant="caption">
                  {t('budget.none')} · {t('home.spent')}: {money(spent)}
                </Txt>
              </>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
