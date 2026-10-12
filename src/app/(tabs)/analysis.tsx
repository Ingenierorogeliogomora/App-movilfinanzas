import { useMemo, useState } from 'react';

import { fiftyThirtyTwenty, topMerchants } from '@/core/analytics';
import { merchantKey } from '@/core/categorize';
import { currentMonthKey, formatShortMonth } from '@/core/dates';
import { PAYMENT_METHODS } from '@/core/types';
import { useI18n } from '@/i18n';
import { useCategoryMap, useMonthSummary, useTrend } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { PairBars, RankedBars, SplitBar, TargetBar } from '@/ui/charts';
import { MonthSwitcher, methodIcon } from '@/ui/pickers';
import { Card, Divider, EmptyState, Row, Screen, StatBlock, Txt } from '@/ui/primitives';

export default function Analysis() {
  const c = useTheme();
  const { t, money, pct, locale, categoryName } = useI18n();
  const [month, setMonth] = useState(currentMonthKey());
  const transactions = useStore((s) => s.transactions);
  const categories = useCategoryMap();
  const summary = useMonthSummary(month);
  const trend = useTrend(month, 6);
  const year = useTrend(month, 12);

  const merchants = useMemo(() => topMerchants(transactions, month, merchantKey, 5), [transactions, month]);
  const rule = fiftyThirtyTwenty(summary);
  const interestYear = year.reduce((s, m) => s + m.interestAndFees, 0);
  const creditShare = summary.outflows ? (summary.byMethod.credit_card ?? 0) / summary.outflows : null;
  const compact = (v: number) => money(v, { compact: true });

  return (
    <Screen>
      <MonthSwitcher month={month} onChange={setMonth} />

      <Card>
        <Txt variant="label">{t('analysis.cashflow')}</Txt>
        <Row gap={spacing.md}>
          <StatBlock label={t('home.income')} value={money(summary.income)} />
          <StatBlock label={t('analysis.outflows')} value={money(summary.outflows)} />
          <StatBlock label={t('analysis.net')} value={money(summary.net, { signed: true })} color={summary.net < 0 ? c.danger : c.success} />
        </Row>
        <Row justify="space-between">
          <Txt variant="caption">{t('home.savingsRate')}</Txt>
          <Txt variant="caption" style={{ fontWeight: '700' }}>
            {pct(summary.savingsRate)}
          </Txt>
        </Row>
      </Card>

      <Card>
        <Txt variant="label">{t('analysis.trend')}</Txt>
        <PairBars
          data={trend.map((m) => ({ label: formatShortMonth(m.month, locale), a: m.income, b: m.outflows }))}
          labelA={t('home.income')}
          labelB={t('analysis.outflows')}
          format={compact}
        />
      </Card>

      {summary.transactionCount === 0 ? (
        <EmptyState icon="pie-chart-outline" title={t('analysis.noData')} />
      ) : (
        <>
          <Card>
            <Txt variant="label">{t('analysis.byCategory')}</Txt>
            <RankedBars
              data={summary.byCategory.slice(0, 8).map((ct) => {
                const cat = ct.categoryId ? categories.get(ct.categoryId) : undefined;
                return {
                  key: ct.categoryId ?? 'none',
                  label: categoryName(cat),
                  value: ct.amount,
                  icon: cat?.icon ?? 'help-circle-outline',
                  color: cat?.color ?? c.chart.reference,
                  right: pct(ct.share),
                };
              })}
              format={(v) => money(v)}
              footer={
                summary.uncategorized > 0 ? (
                  <Txt variant="caption" color={c.warning}>
                    {t('analysis.uncategorizedHint', { amount: money(summary.uncategorized) })}
                  </Txt>
                ) : null
              }
            />
          </Card>

          <Card>
            <Txt variant="label">{t('analysis.fixedVariable')}</Txt>
            <SplitBar
              parts={[
                { label: t('nature.fixed'), value: summary.fixed, color: c.chart.fixed },
                { label: t('nature.variable'), value: summary.variable, color: c.chart.variable },
              ]}
              format={(v) => money(v)}
              pct={(r) => pct(r)}
            />
            <Txt variant="caption">{t('analysis.fixedVariableHint')}</Txt>
          </Card>

          <Card>
            <Txt variant="label">{t('analysis.rule')}</Txt>
            {rule.map((b) => (
              <TargetBar
                key={b.bucket}
                label={t(`bucket.${b.bucket}`)}
                actualShare={b.share}
                targetShare={b.targetShare}
                value={money(b.actual)}
                status={b.status}
                pct={(r) => pct(r)}
              />
            ))}
            <Txt variant="caption">{t('analysis.ruleHint')}</Txt>
          </Card>

          <Card>
            <Txt variant="label">{t('analysis.methods')}</Txt>
            <RankedBars
              data={PAYMENT_METHODS.filter((m) => (summary.byMethod[m] ?? 0) > 0)
                .map((m) => ({
                  key: m,
                  label: t(`method.${m}`),
                  value: summary.byMethod[m] ?? 0,
                  icon: methodIcon(m),
                  color: m === 'credit_card' ? c.chart.expense : c.chart.income,
                  right: pct(summary.outflows ? (summary.byMethod[m] ?? 0) / summary.outflows : null),
                }))
                .sort((a, b) => b.value - a.value)}
              format={(v) => money(v)}
            />
            {creditShare ? <Txt variant="caption">{t('analysis.creditShare', { pct: pct(creditShare) })}</Txt> : null}
          </Card>

          {merchants.length ? (
            <Card>
              <Txt variant="label">{t('analysis.topMerchants')}</Txt>
              {merchants.map((m, i) => (
                <Row key={`${m.name}-${i}`} justify="space-between" gap={spacing.md}>
                  <Txt numberOfLines={1} style={{ flex: 1 }}>
                    {i + 1}. {m.name}
                  </Txt>
                  <Txt variant="caption">×{m.count}</Txt>
                  <Txt style={{ fontWeight: '700' }}>{money(m.amount)}</Txt>
                </Row>
              ))}
            </Card>
          ) : null}
        </>
      )}

      <Card tone={interestYear > 0 ? 'danger' : undefined}>
        <Txt variant="label">{t('analysis.interestYear')}</Txt>
        <Txt variant="display" color={interestYear > 0 ? c.danger : undefined}>
          {money(interestYear)}
        </Txt>
        <Divider />
        <Txt variant="caption">{t('analysis.interestYearHint')}</Txt>
      </Card>
    </Screen>
  );
}
