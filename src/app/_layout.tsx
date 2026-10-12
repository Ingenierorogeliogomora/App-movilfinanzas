import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DB_NAME, migrateDb } from '@/data/db';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { useIsDark, useTheme } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrateDb}>
      <Bootstrap />
    </SQLiteProvider>
  );
}

function Bootstrap() {
  const db = useSQLiteContext();
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const c = useTheme();

  useEffect(() => {
    void init(db);
  }, [db, init]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  return <Navigator />;
}

function Navigator() {
  const c = useTheme();
  const dark = useIsDark();
  const { t } = useI18n();
  const onboarded = useStore((s) => s.settings.onboarded);

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.card, text: c.text, border: c.border },
    };
  }, [dark, c]);

  const modal = { presentation: 'modal' as const };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.primary,
          headerTitleStyle: { color: c.text },
          headerShadowVisible: false,
          headerBackTitle: t('common.back'),
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction/[id]" options={{ ...modal, title: t('tx.new') }} />
          <Stack.Screen name="debt/[id]" options={{ ...modal, title: t('debt.new') }} />
          <Stack.Screen name="debt/pay" options={{ ...modal, title: t('debt.payTitle') }} />
          <Stack.Screen name="recurring/index" options={{ title: t('rec.title') }} />
          <Stack.Screen name="recurring/[id]" options={{ ...modal, title: t('rec.new') }} />
          <Stack.Screen name="category/[id]" options={{ ...modal, title: t('categories.new') }} />
          <Stack.Screen name="budgets" options={{ title: t('budget.title') }} />
          <Stack.Screen name="plan" options={{ title: t('plan.title') }} />
          <Stack.Screen name="import" options={{ title: t('import.title') }} />
          <Stack.Screen name="categories" options={{ title: t('categories.title') }} />
          <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
