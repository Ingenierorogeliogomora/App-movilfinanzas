import type { Insight } from '@/core/insights';
import type { Category } from '@/core/types';
import type { I18n } from '@/i18n';

export function insightText(i: Insight, { t, money, pct, categoryName }: I18n, categories: Map<string, Category>): string {
  const cat = (id: string | null) => categoryName(id ? categories.get(id) : null);
  switch (i.kind) {
    case 'interest_cost':
      return t('insight.interest_cost', { monthly: money(i.monthly), yearly: money(i.yearly) });
    case 'minimum_trap':
      return t('insight.minimum_trap', { name: i.debtName, min: money(i.minPayment), interest: money(i.interest) });
    case 'overspending':
      return t('insight.overspending', { amount: money(i.deficit) });
    case 'high_utilization':
      return t('insight.high_utilization', { name: i.debtName, pct: pct(i.utilization) });
    case 'budget_over':
      return t('insight.budget_over', { amount: money(i.over), category: cat(i.categoryId) });
    case 'category_spike':
      return t('insight.category_spike', { category: cat(i.categoryId), amount: money(i.amount), average: money(i.average) });
    case 'uncategorized':
      return i.count === 1 ? t('insight.uncategorizedOne') : t('insight.uncategorized', { count: i.count });
    case 'fees_paid':
      return t('insight.fees_paid', { amount: money(i.amount) });
    case 'positive_month':
      return t('insight.positive_month', { amount: money(i.net), pct: pct(i.savingsRate) });
    case 'backup_due':
      return t('insight.backup_due');
  }
}

export const SEVERITY_ICON = {
  danger: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
  success: 'checkmark-circle',
} as const;
