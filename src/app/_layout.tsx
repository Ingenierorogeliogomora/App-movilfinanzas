import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DB_NAME, migrateDb } from '@/data/db';
import { cleanupTempFiles } from '@/data/files';
import { configureNotifications, remindersSupported } from '@/data/notifications';
import { useI18n } from '@/i18n';
import { useLockStatus } from '@/state/lock';
import { useReminderSync } from '@/state/useReminderSync';
import { useStore } from '@/state/store';
import { useIsDark, useTheme } from '@/theme';
import { LockGate } from '@/ui/LockGate';

configureNotifications();

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
    // Leftover exports / picked files from a previous session (plain-text financial data).
    cleanupTempFiles();
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
  // Behind the lock screen nothing should be reachable by screen readers.
  const locked = useLockStatus((s) => s.locked);

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
      <View
        style={{ flex: 1 }}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={locked}
      >
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
            <Stack.Screen name="backup" options={{ title: t('backup.title') }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </View>
      {/* Always mounted so turning reminders off (or wiping data) cancels them. */}
      <Background />
      <LockGate />
    </ThemeProvider>
  );
}

/** Work that runs while the app is open: reminders and opening a tapped reminder. */
function Background() {
  useReminderSync();
  return remindersSupported ? <OpenTappedReminder /> : null;
}

function OpenTappedReminder() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    // Handle each tap once, even if this component mounts again.
    Notifications.clearLastNotificationResponse();
    const url = response.notification.request.content.data?.url;
    if (url !== '/recurring' && url !== '/debts') return;
    // Go back to the main screens instead of stacking another copy of the tabs.
    if (router.canDismiss()) router.dismissAll();
    router.navigate(url);
  }, [response]);
  return null;
}
