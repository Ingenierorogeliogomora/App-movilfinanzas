import { router, type Href } from 'expo-router';
import { Alert } from 'react-native';

import { exportTransactionsCsv } from '@/data/exportCsv';
import { useI18n, type TKey } from '@/i18n';
import { useCategoryMap } from '@/state/derived';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme';
import { Card, Divider, ListItem, Screen, Txt } from '@/ui/primitives';

const ITEMS: { icon: string; title: TKey; hint: TKey; href: Href }[] = [
  { icon: 'flag-outline', title: 'more.plan', hint: 'more.planHint', href: '/plan' },
  { icon: 'calendar-outline', title: 'more.recurring', hint: 'more.recurringHint', href: '/recurring' },
  { icon: 'wallet-outline', title: 'more.budgets', hint: 'more.budgetsHint', href: '/budgets' },
  { icon: 'cloud-upload-outline', title: 'more.import', hint: 'more.importHint', href: '/import' },
  { icon: 'pricetags-outline', title: 'more.categories', hint: 'more.categoriesHint', href: '/categories' },
];

export default function More() {
  const c = useTheme();
  const { t, categoryName } = useI18n();
  const transactions = useStore((s) => s.transactions);
  const debts = useStore((s) => s.debts);
  const categories = useCategoryMap();

  const exportData = async () => {
    try {
      await exportTransactionsCsv(transactions, categories, debts, categoryName);
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  return (
    <Screen>
      <Card>
        {ITEMS.map((item, i) => (
          <ListItemWithDivider key={item.title} last={i === ITEMS.length - 1}>
            <ListItem icon={item.icon} iconColor={c.primary} title={t(item.title)} subtitle={t(item.hint)} onPress={() => router.push(item.href)} />
          </ListItemWithDivider>
        ))}
      </Card>
      <Card>
        <ListItem icon="download-outline" iconColor={c.info} title={t('more.export')} subtitle={t('more.exportHint')} onPress={() => void exportData()} />
        <Divider />
        <ListItem icon="settings-outline" iconColor={c.muted} title={t('more.settings')} subtitle={t('more.settingsHint')} onPress={() => router.push('/settings')} />
      </Card>
      <Txt variant="caption" center>
        {t('onboarding.disclaimer')}
      </Txt>
    </Screen>
  );
}

function ListItemWithDivider({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <>
      {children}
      {!last ? <Divider /> : null}
    </>
  );
}
