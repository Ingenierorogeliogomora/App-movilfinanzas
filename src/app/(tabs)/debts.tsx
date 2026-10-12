import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { addMonths, formatDate, todayISO } from '@/core/dates';
import { extraNeededForTarget, isMinimumTrap, monthlyInterest, weightedApr } from '@/core/debt';
import { debtTotals } from '@/core/health';
import { parseAmount } from '@/core/money';
import type { Debt } from '@/core/types';
import { useI18n } from '@/i18n';
import { useDebtPlan } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { BalanceLines } from '@/ui/charts';
import { MoneyField, useAmountText } from '@/ui/fields';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  StatBlock,
  Txt,
} from '@/ui/primitives';

export default function Debts() {
  const c = useTheme();
  const { t, money, pct, locale } = useI18n();
  const navigation = useNavigation();
  const debts = useStore((s) => s.debts);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const plan = useDebtPlan();
  const today = todayISO();
  const [extraText, setExtraText] = useAmountText(settings.extraPayment);
  const [target, setTarget] = useState<number | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton name="add" label={t('debt.add')} onPress={() => router.push('/debt/new')} />,
    });
  }, [navigation, t]);

  const commitExtra = (text: string) => {
    const cents = parseAmount(text);
    void updateSettings({ extraPayment: cents && cents > 0 ? cents : 0 });
  };

  const totals = debtTotals(debts);
  const open = debts.filter((d) => !d.closedAt && d.balance > 0);
  const closed = debts.filter((d) => d.closedAt || d.balance <= 0);
  const chosen = plan ? (plan.strategy === 'avalanche' ? plan.avalanche : plan.snowball) : null;
  const monthLabel = (months: number) =>
    formatDate(addMonths(today, months), locale, { month: 'short', year: 'numeric' });

  const targetExtra = useMemo(
    () => (plan && target ? extraNeededForTarget(plan.inputs, plan.strategy, target) : null),
    [plan, target],
  );

  const chart = useMemo(() => {
    if (!plan || !chosen) return null;
    const horizon = Math.min(360, Math.max(chosen.months, plan.minimum.feasible ? plan.minimum.months : chosen.months * 2));
    const start = plan.inputs.reduce((s, d) => s + d.balance, 0);
    const series = (timeline: { totalBalance: number }[]) =>
      [start, ...timeline.map((m) => m.totalBalance)].slice(0, horizon + 1);
    // A minimums-only plan that never ends would flatten the chart; leave it out.
    return { horizon, plan: series(chosen.timeline), minimum: plan.minimum.feasible ? series(plan.minimum.timeline) : null };
  }, [plan, chosen]);

  if (debts.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="card-outline"
          title={t('debt.empty')}
          body={t('debt.emptyHint')}
          action={<Button title={t('debt.add')} icon="add" onPress={() => router.push('/debt/new')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Txt variant="label">{t('debt.total')}</Txt>
        <Txt variant="display">{money(totals.balance)}</Txt>
        <ProgressBar value={totals.progress} color={c.success} height={10} />
        <Txt variant="caption">{t('debt.paidSoFar', { amount: money(totals.paid), pct: pct(totals.progress) })}</Txt>
        <Divider />
        <Row gap={spacing.md}>
          <StatBlock label={t('debt.minimums')} value={money(totals.minPayments)} />
          <StatBlock label={t('debt.monthlyInterest')} value={money(totals.monthlyInterest)} color={c.danger} />
          <StatBlock label={t('debt.avgApr')} value={`${weightedApr(open).toFixed(1)}%`} />
        </Row>
      </Card>

      {plan && chosen ? (
        <>
          <SectionTitle>{t('debt.planTitle')}</SectionTitle>
          <Card>
            <Segmented
              options={[
                { value: 'avalanche', label: t('debt.avalanche') },
                { value: 'snowball', label: t('debt.snowball') },
              ]}
              value={settings.strategy}
              onChange={(v) => void updateSettings({ strategy: v })}
            />
            <Txt variant="caption">{settings.strategy === 'avalanche' ? t('debt.avalancheHint') : t('debt.snowballHint')}</Txt>
            <MoneyField
              label={t('debt.extra')}
              hint={t('debt.extraHint')}
              value={extraText}
              onChangeText={(v) => {
                setExtraText(v);
                commitExtra(v);
              }}
            />
            <Row wrap gap={spacing.sm}>
              {[2500, 5000, 10000, 20000].map((step) => (
                <Chip
                  key={step}
                  label={`+${money(step, { whole: true })}`}
                  onPress={() => void updateSettings({ extraPayment: settings.extraPayment + step })}
                />
              ))}
            </Row>
            <Divider />
            {chosen.feasible ? (
              <>
                <Row gap={spacing.md}>
                  <StatBlock
                    label={t('debt.freeBy')}
                    value={monthLabel(chosen.months)}
                    hint={t('debt.inMonths', { months: chosen.months })}
                    color={c.success}
                  />
                  <StatBlock label={t('debt.totalInterest')} value={money(chosen.totalInterest)} />
                </Row>
                <Card tone={plan.minimum.feasible ? 'success' : 'danger'} style={{ padding: spacing.md }}>
                  <Txt variant="caption" style={{ fontWeight: '700' }}>
                    {t('debt.vsMinimum')}
                  </Txt>
                  <Txt>
                    {plan.minimum.feasible
                      ? t('debt.saved', { amount: money(plan.interestSaved), months: plan.monthsSaved })
                      : t('debt.minimumNever')}
                  </Txt>
                </Card>
              </>
            ) : (
              <Card tone="danger" style={{ padding: spacing.md }}>
                <Txt>{t('debt.infeasible')}</Txt>
              </Card>
            )}
          </Card>

          {chart && chosen.feasible ? (
            <Card>
              <Txt variant="label">{t('debt.balanceOverTime')}</Txt>
              <BalanceLines
                series={[
                  { label: settings.strategy === 'avalanche' ? t('debt.avalanche') : t('debt.snowball'), values: chart.plan, color: c.primary },
                  ...(chart.minimum
                    ? [{ label: t('debt.planMinimum'), values: chart.minimum, color: c.chart.reference, dashed: true }]
                    : []),
                ]}
                xLabels={(i) => monthLabel(i)}
                format={(v) => money(v, { compact: true })}
              />
            </Card>
          ) : null}

          <Card>
            <Txt variant="label">{t('debt.compare')}</Txt>
            <Row>
              <Txt variant="caption" style={{ flex: 2 }} />
              <Txt variant="caption" style={{ flex: 1, textAlign: 'right' }}>
                {t('debt.months')}
              </Txt>
              <Txt variant="caption" style={{ flex: 1.4, textAlign: 'right' }}>
                {t('debt.interest')}
              </Txt>
            </Row>
            {(
              [
                ['avalanche', t('debt.avalanche'), plan.avalanche],
                ['snowball', t('debt.snowball'), plan.snowball],
                ['minimum', t('debt.planMinimum'), plan.minimum],
              ] as const
            ).map(([key, label, r]) => (
              <Row key={key}>
                <Txt style={{ flex: 2, fontWeight: key === settings.strategy ? '700' : '400' }}>{label}</Txt>
                <Txt style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{r.feasible ? r.months : '∞'}</Txt>
                <Txt style={{ flex: 1.4, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {r.feasible ? money(r.totalInterest) : '—'}
                </Txt>
              </Row>
            ))}
          </Card>

          <Card>
            <Txt variant="label">{t('debt.target')}</Txt>
            <Row wrap gap={spacing.sm}>
              {[12, 24, 36, 48].map((m) => (
                <Chip key={m} label={`${m} ${t('common.months')}`} selected={target === m} onPress={() => setTarget(m)} />
              ))}
            </Row>
            {target && targetExtra !== null ? (
              <Txt>
                {targetExtra <= settings.extraPayment
                  ? t('debt.targetAlready', { months: target })
                  : t('debt.targetResult', { months: target, amount: money(targetExtra) })}
              </Txt>
            ) : null}
            {target && targetExtra !== null && targetExtra > settings.extraPayment ? (
              <Button
                small
                variant="secondary"
                title={`${t('debt.extra')}: ${money(targetExtra)}`}
                onPress={() => void updateSettings({ extraPayment: targetExtra })}
              />
            ) : null}
          </Card>

          <Card>
            <Txt variant="label">{t('debt.order')}</Txt>
            {chosen.order.map((id, i) => {
              const info = chosen.debts.find((d) => d.id === id);
              if (!info || info.payoffMonth === null) return null;
              return (
                <Row key={id} gap={spacing.md}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: c.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt style={{ fontWeight: '700', fontSize: 13 }} color={c.primary}>
                      {i + 1}
                    </Txt>
                  </View>
                  <Txt style={{ flex: 1 }} numberOfLines={1}>
                    {info.name}
                  </Txt>
                  <Txt variant="caption">{t('debt.paidIn', { date: monthLabel(info.payoffMonth) })}</Txt>
                </Row>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('debt.title')}</SectionTitle>
      {open.map((d) => (
        <DebtCard key={d.id} debt={d} />
      ))}
      {closed.map((d) => (
        <DebtCard key={d.id} debt={d} />
      ))}
      <Button title={t('debt.add')} icon="add" variant="secondary" onPress={() => router.push('/debt/new')} />
    </Screen>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const c = useTheme();
  const { t, money, pct } = useI18n();
  const paidOff = !!debt.closedAt || debt.balance <= 0;
  const progress = debt.originalBalance > 0 ? 1 - debt.balance / debt.originalBalance : 0;
  const utilization = debt.creditLimit ? debt.balance / debt.creditLimit : null;
  const trap = !paidOff && isMinimumTrap(debt);

  return (
    <Card>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="subtitle" numberOfLines={1}>
            {debt.name}
          </Txt>
          <Txt variant="caption">
            {t(`debt.kind.${debt.kind}`)} · APR {debt.apr}%
          </Txt>
        </View>
        {paidOff ? (
          <Badge label={t('debt.paidOff')} tone="success" />
        ) : (
          <Txt variant="money">{money(debt.balance)}</Txt>
        )}
      </Row>
      {!paidOff ? (
        <>
          <ProgressBar value={progress} color={c.success} />
          <Row justify="space-between">
            <Txt variant="caption">
              {t('debt.minPayment')}: {money(debt.minPayment)}
            </Txt>
            <Txt variant="caption" color={c.danger}>
              {t('debt.interest')}: {money(monthlyInterest(debt.balance, debt.apr))}
              {t('common.perMonth')}
            </Txt>
          </Row>
          {utilization !== null ? (
            <Txt variant="caption" color={utilization > 0.3 ? c.warning : undefined}>
              {t('debt.utilization', { pct: pct(utilization) })}
            </Txt>
          ) : null}
          {trap ? (
            <Row gap={6}>
              <Icon name="warning" size={16} color={c.danger} />
              <Txt variant="caption" color={c.danger}>
                {t('debt.trapWarning')}
              </Txt>
            </Row>
          ) : null}
        </>
      ) : null}
      <Row gap={spacing.sm}>
        {!paidOff ? (
          <Button small title={t('home.pay')} icon="cash-outline" onPress={() => router.push(`/debt/pay?id=${debt.id}`)} style={{ flex: 1 }} />
        ) : null}
        <Button small variant="ghost" title={t('common.edit')} onPress={() => router.push(`/debt/${debt.id}`)} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
