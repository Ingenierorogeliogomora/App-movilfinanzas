import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { budgetStatuses, categorySpikes } from '@/core/analytics';
import { addMonths, currentMonthKey, daysBetween, formatDate, formatMonthLabel, localDateOf, todayISO } from '@/core/dates';
import { debtTotals, healthScore } from '@/core/health';
import { buildInsights } from '@/core/insights';
import { upcomingOccurrences } from '@/core/recurring';
import { useI18n } from '@/i18n';
import { useAverages, useCategoryMap, useDebtPlan, useMonthSummary, useTrend } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { SEVERITY_ICON, insightText } from '@/ui/insightText';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  Fab,
  Icon,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  SectionTitle,
  StatBlock,
  Txt,
} from '@/ui/primitives';

export default function Home() {
  const c = useTheme();
  const i18n = useI18n();
  const { t, money, pct, locale, categoryName } = i18n;
  const today = todayISO();
  const month = currentMonthKey();

  const transactions = useStore((s) => s.transactions);
  const debts = useStore((s) => s.debts);
  const recurring = useStore((s) => s.recurring);
  const budgets = useStore((s) => s.budgets);
  const emergencyFund = useStore((s) => s.settings.emergencyFund);
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt);
  const markPaid = useStore((s) => s.markRecurringPaid);

  const summary = useMonthSummary(month);
  const trend = useTrend(month, 4);
  const averages = useAverages(month);
  const plan = useDebtPlan();
  const categories = useCategoryMap();

  const totals = debtTotals(debts);
  const budgetList = useMemo(() => budgetStatuses(budgets, summary, today), [budgets, summary, today]);
  const upcoming = useMemo(() => upcomingOccurrences(recurring, today, 7).slice(0, 5), [recurring, today]);
  const uncategorizedCount = useMemo(
    () => transactions.filter((tx) => tx.type === 'expense' && !tx.categoryId && tx.date.startsWith(month)).length,
    [transactions, month],
  );
  const insights = useMemo(
    () =>
      buildInsights({
        summary,
        debts,
        budgets: budgetList,
        spikes: categorySpikes(summary, trend.slice(0, -1)),
        uncategorizedCount,
        transactionCount: transactions.length,
        daysSinceBackup: lastBackupAt ? daysBetween(localDateOf(lastBackupAt), today) : null,
      }),
    [summary, debts, budgetList, trend, uncategorizedCount, transactions.length, lastBackupAt, today],
  );
  const health = healthScore({
    income: averages.income,
    spending: averages.spending,
    essentials: averages.essentials,
    debts,
    emergencyFund,
  });

  const chosen = plan ? (plan.strategy === 'avalanche' ? plan.avalanche : plan.snowball) : null;
  const steps = [
    { done: debts.length > 0, key: 'home.step.debts', route: '/debt/new' },
    { done: transactions.length > 0, key: 'home.step.import', route: '/import' },
    { done: recurring.length > 0, key: 'home.step.fixed', route: '/recurring/new' },
    { done: budgets.length > 0, key: 'home.step.budget', route: '/budgets' },
  ] as const;
  const showSteps = steps.some((s) => !s.done);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen>
        <Row justify="space-between">
          <View>
            <Txt variant="caption">
              {formatMonthLabel(month, locale)}
            </Txt>
            <Txt variant="title">{t('app.name')}</Txt>
          </View>
          <IconButton name="settings-outline" label={t('settings.title')} onPress={() => router.push('/settings')} />
        </Row>

        <Card>
          <Txt variant="label">{t('home.thisMonth')}</Txt>
          <Row gap={spacing.md}>
            <StatBlock label={t('home.income')} value={money(summary.income)} />
            <StatBlock label={t('home.spent')} value={money(summary.outflows)} />
            <StatBlock
              label={t('home.left')}
              value={money(summary.net)}
              color={summary.net < 0 ? c.danger : c.success}
            />
          </Row>
          {summary.income > 0 ? (
            <View style={{ gap: 6 }}>
              <Row justify="space-between">
                <Txt variant="caption">{t('home.savingsRate')}</Txt>
                <Txt variant="caption" style={{ fontWeight: '700' }}>
                  {pct(summary.savingsRate)}
                </Txt>
              </Row>
              <ProgressBar value={summary.savingsRate ?? 0} color={(summary.savingsRate ?? 0) < 0 ? c.danger : c.success} />
            </View>
          ) : null}
        </Card>

        {showSteps ? (
          <Card tone="primary">
            <Txt variant="subtitle">{t('home.gettingStarted')}</Txt>
            {steps.map((s) => (
              <Row key={s.key} gap={spacing.md}>
                <Icon name={s.done ? 'checkmark-circle' : 'ellipse-outline'} color={s.done ? c.success : c.primary} />
                <Txt
                  style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}
                  muted={s.done}
                  onPress={s.done ? undefined : () => router.push(s.route)}
                >
                  {t(s.key)}
                </Txt>
                {!s.done ? <Icon name="chevron-forward" size={16} color={c.primary} /> : null}
              </Row>
            ))}
          </Card>
        ) : null}

        {totals.balance > 0 ? (
          <Card onPress={() => router.push('/debts')}>
            <Row justify="space-between">
              <Txt variant="label">{t('home.debtCard')}</Txt>
              <Icon name="chevron-forward" size={16} color={c.muted} />
            </Row>
            <Txt variant="display">{money(totals.balance)}</Txt>
            <ProgressBar value={totals.progress} color={c.success} />
            <Txt variant="caption">{t('debt.paidSoFar', { amount: money(totals.paid), pct: pct(totals.progress) })}</Txt>
            {chosen ? (
              chosen.feasible ? (
                <Row gap={spacing.sm}>
                  <Icon name="flag-outline" size={18} color={c.success} />
                  <Txt>
                    {t('home.debtFree')}{' '}
                    <Txt style={{ fontWeight: '700' }}>
                      {formatDate(addMonths(today, chosen.months), locale, { month: 'long', year: 'numeric' })}
                    </Txt>
                  </Txt>
                </Row>
              ) : (
                <Txt color={c.danger}>{t('home.debtFreeNever')}</Txt>
              )
            ) : null}
            {totals.monthlyInterest > 0 ? (
              <Txt variant="caption" color={c.danger}>
                {t('home.interestCost', { amount: money(totals.monthlyInterest) })}
              </Txt>
            ) : null}
          </Card>
        ) : null}

        <SectionTitle>{t('home.upcoming')}</SectionTitle>
        <Card>
          {upcoming.length === 0 ? <Txt muted>{t('home.noUpcoming')}</Txt> : null}
          {upcoming.map((o) => {
            const cat = o.recurring.categoryId ? categories.get(o.recurring.categoryId) : undefined;
            const when =
              o.daysUntil < 0
                ? t('home.overdue', { days: -o.daysUntil })
                : o.daysUntil === 0
                  ? t('home.dueToday')
                  : t('home.dueIn', { days: o.daysUntil });
            return (
              <Row key={`${o.recurring.id}-${o.date}`} gap={spacing.md}>
                <CategoryIcon icon={cat?.icon ?? 'calendar-outline'} color={cat?.color ?? c.primary} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '600' }} numberOfLines={1}>
                    {o.recurring.name}
                  </Txt>
                  <Txt variant="caption" color={o.daysUntil < 0 ? c.danger : undefined}>
                    {money(o.recurring.amount)} · {when}
                  </Txt>
                </View>
                {o.date === o.recurring.nextDate ? (
                  <Button
                    small
                    variant="secondary"
                    title={o.recurring.type === 'income' ? t('rec.markReceived') : t('home.pay')}
                    onPress={() => void markPaid(o.recurring.id)}
                  />
                ) : null}
              </Row>
            );
          })}
        </Card>

        {insights.length ? (
          <>
            <SectionTitle>{t('home.alerts')}</SectionTitle>
            {insights.slice(0, 6).map((ins, i) => {
              const color = { danger: c.danger, warning: c.warning, info: c.info, success: c.success }[ins.severity];
              return (
                <Card
                  key={`${ins.kind}-${i}`}
                  tone={ins.severity}
                  onPress={ins.kind === 'backup_due' ? () => router.push('/backup') : undefined}
                >
                  <Row gap={spacing.md} align="flex-start">
                    <Icon name={SEVERITY_ICON[ins.severity]} color={color} />
                    <Txt style={{ flex: 1 }}>{insightText(ins, i18n, categories)}</Txt>
                  </Row>
                </Card>
              );
            })}
          </>
        ) : null}

        <Card onPress={() => router.push('/plan')}>
          <Row justify="space-between">
            <Txt variant="label">{t('home.health')}</Txt>
            <Icon name="chevron-forward" size={16} color={c.muted} />
          </Row>
          {health.hasData ? (
            <Row gap={spacing.md}>
              <Txt variant="display">{health.score}</Txt>
              <Badge
                label={t(`plan.grade.${health.grade}`)}
                tone={health.score >= 70 ? 'success' : health.score >= 50 ? 'warning' : 'danger'}
              />
            </Row>
          ) : (
            <Txt muted>{t('plan.healthNoData')}</Txt>
          )}
        </Card>

        {budgetList.length ? (
          <>
            <SectionTitle>{t('home.budgets')}</SectionTitle>
            <Card onPress={() => router.push('/budgets')}>
              {budgetList.slice(0, 4).map((b) => {
                const cat = categories.get(b.categoryId);
                const color = b.status === 'over' ? c.danger : b.status === 'warning' ? c.warning : c.success;
                return (
                  <View key={b.categoryId} style={{ gap: 6 }}>
                    <Row justify="space-between">
                      <Txt numberOfLines={1} style={{ flex: 1 }}>
                        {categoryName(cat)}
                      </Txt>
                      <Txt variant="caption">{t('budget.spentOf', { spent: money(b.spent), budget: money(b.budget) })}</Txt>
                    </Row>
                    <ProgressBar value={b.pct} color={color} />
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </Screen>
      <Fab label={t('tx.new')} onPress={() => router.push('/transaction/new')} />
    </SafeAreaView>
  );
}
