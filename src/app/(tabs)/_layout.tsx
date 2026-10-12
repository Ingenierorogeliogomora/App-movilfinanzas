import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon } from '@/ui/primitives';

const ICONS = {
  index: ['home', 'home-outline'],
  transactions: ['list', 'list-outline'],
  debts: ['card', 'card-outline'],
  analysis: ['pie-chart', 'pie-chart-outline'],
  more: ['grid', 'grid-outline'],
} as const;

export default function TabsLayout() {
  const c = useTheme();
  const { t } = useI18n();
  const icon = (name: keyof typeof ICONS) =>
    function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
      return <Icon name={ICONS[name][focused ? 0 : 1]} size={24} color={String(color)} />;
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: { color: c.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), headerShown: false, tabBarIcon: icon('index') }} />
      <Tabs.Screen name="transactions" options={{ title: t('tabs.transactions'), tabBarIcon: icon('transactions') }} />
      <Tabs.Screen name="debts" options={{ title: t('tabs.debts'), tabBarIcon: icon('debts') }} />
      <Tabs.Screen name="analysis" options={{ title: t('tabs.analysis'), tabBarIcon: icon('analysis') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: icon('more') }} />
    </Tabs>
  );
}
