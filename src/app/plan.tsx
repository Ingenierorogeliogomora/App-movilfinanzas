import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { addDays, currentMonthKey, todayISO } from '@/core/dates';
import { healthScore } from '@/core/health';
import { parseAmount } from '@/core/money';
import { buildPlan, currentStep, starterFundTarget, type PlanStepKey } from '@/core/plan';
import { useI18n, type TKey } from '@/i18n';
import { useAverages } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { MoneyField, useAmountText } from '@/ui/fields';
import { Badge, Card, Icon, ProgressBar, Row, Screen, SectionTitle, Txt } from '@/ui/primitives';

const TIPS = [1, 2, 3, 4, 5] as const;

export default function Plan() {
  const c = useTheme();
  const { t, money, pct } = useI18n();
  const month = currentMonthKey();
  const debts = useStore((s) => s.debts);
  const budgets = useStore((s) => s.budgets);
  const transactions = useStore((s) => s.transactions);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const averages = useAverages(month);
  const [fundText, setFundText] = useAmountText(settings.emergencyFund);
  const [openTip, setOpenTip] = useState<number | null>(null);

  const since = addDays(todayISO(), -30);
  const recentTransactions = transactions.filter((tx) => tx.date >= since).length;
  const health = healthScore({
    income: averages.income,
    spending: averages.spending,
    essentials: averages.essentials,
    debts,
    emergencyFund: settings.emergencyFund,
  });
  const steps = buildPlan({
    recentTransactions,
    budgetsCount: budgets.length,
    emergencyFund: settings.emergencyFund,
    monthlyEssentials: averages.essentials,
    debts,
    manualDone: settings.planDone,
  });
  const now = currentStep(steps);
  const starter = starterFundTarget(averages.essentials);
  const full = averages.essentials > 0 ? averages.essentials * 3 : starter * 3;

  const componentValue = (key: string, value: number | null) => {
    if (value === null) return '—';
    if (key === 'emergency_fund') return t('plan.monthsValue', { value: value.toFixed(1) });
    return pct(value);
  };

  const toggleManual = (key: PlanStepKey) =>
    void updateSettings({ planDone: { ...settings.planDone, [key]: !settings.planDone[key] } });

  return (
    <Screen>
      <Card>
        <Txt variant="label">{t('plan.healthTitle')}</Txt>
        {health.hasData ? (
          <>
            <Row gap={spacing.md}>
              <Txt variant="display">{health.score}</Txt>
              <Txt muted>/ 100</Txt>
              <Badge
                label={t(`plan.grade.${health.grade}`)}
                tone={health.score >= 70 ? 'success' : health.score >= 50 ? 'warning' : 'danger'}
              />
            </Row>
            {health.components.map((comp) => (
              <View key={comp.key} style={{ gap: 4 }}>
                <Row justify="space-between">
                  <Txt style={{ fontWeight: '600' }}>{t(`plan.comp.${comp.key}` as TKey)}</Txt>
                  <Txt variant="caption">
                    {componentValue(comp.key, comp.value)} · {comp.score}/25
                  </Txt>
                </Row>
                <ProgressBar value={comp.score / 25} color={comp.score >= 18 ? c.success : comp.score >= 10 ? c.warning : c.danger} />
                <Txt variant="caption">{t(`plan.comp.${comp.key}Hint` as TKey)}</Txt>
              </View>
            ))}
          </>
        ) : (
          <Txt muted>{t('plan.healthNoData')}</Txt>
        )}
      </Card>

      <Card>
        <MoneyField
          label={t('plan.emergencyFund')}
          hint={t('plan.emergencyFundHint')}
          value={fundText}
          onChangeText={(v) => {
            setFundText(v);
            const cents = parseAmount(v);
            void updateSettings({ emergencyFund: cents && cents > 0 ? cents : 0 });
          }}
        />
      </Card>

      <Txt muted>{t('plan.intro')}</Txt>
      {steps.map((s, i) => {
        const isNow = now?.key === s.key;
        const body = t(`plan.step.${s.key}Body` as TKey, {
          amount: money(s.key === 'full_fund' ? full : starter, { whole: true }),
        });
        return (
          <Card key={s.key} tone={isNow ? 'primary' : undefined} style={s.done && { opacity: 0.75 }}>
            <Row gap={spacing.md} align="flex-start">
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: s.done ? c.success : isNow ? c.primary : c.cardAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.done ? (
                  <Icon name="checkmark" size={18} color={c.onPrimary} />
                ) : (
                  <Txt style={{ fontWeight: '700' }} color={isNow ? c.onPrimary : c.muted}>
                    {i + 1}
                  </Txt>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={spacing.sm} wrap>
                  <Txt variant="subtitle">{t(`plan.step.${s.key}` as TKey)}</Txt>
                  {isNow ? <Badge label={t('plan.current')} tone="info" /> : null}
                </Row>
                <Txt variant="caption">{body}</Txt>
                {!s.manual && !s.done ? <ProgressBar value={s.progress} /> : null}
                {s.manual ? (
                  <Pressable onPress={() => toggleManual(s.key)} hitSlop={8}>
                    <Row gap={6}>
                      <Icon name={s.done ? 'checkbox' : 'square-outline'} size={20} color={c.primary} />
                      <Txt color={c.primary}>{t('plan.markDone')}</Txt>
                    </Row>
                  </Pressable>
                ) : null}
              </View>
            </Row>
          </Card>
        );
      })}

      <SectionTitle>{t('plan.tipsTitle')}</SectionTitle>
      {TIPS.map((n) => (
        <Card key={n} onPress={() => setOpenTip(openTip === n ? null : n)}>
          <Row justify="space-between">
            <Txt style={{ fontWeight: '600', flex: 1 }}>{t(`plan.tip${n}Title` as TKey)}</Txt>
            <Icon name={openTip === n ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
          </Row>
          {openTip === n ? <Txt>{t(`plan.tip${n}Body` as TKey)}</Txt> : null}
        </Card>
      ))}

      <Txt variant="caption" center>
        {t('plan.disclaimer')}
      </Txt>
    </Screen>
  );
}
