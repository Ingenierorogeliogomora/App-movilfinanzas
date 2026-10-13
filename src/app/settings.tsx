import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { authenticate, canUseDeviceLock, lockSupported, withLockSuspended } from '@/data/deviceLock';
import { cleanupTempFiles } from '@/data/files';
import { remindersSupported, requestReminderPermission } from '@/data/notifications';
import { useI18n } from '@/i18n';
import { CURRENCIES } from '@/i18n/currencies';
import { useReminderStatus } from '@/state/reminderStatus';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { confirmAsync } from '@/ui/dialogs';
import { SwitchRow } from '@/ui/fields';
import { Button, Card, Chip, ChipGroup, Divider, Row, Screen, Segmented, Txt } from '@/ui/primitives';

const DAYS_BEFORE = [0, 1, 3, 7];
const HOURS = [7, 9, 12, 18, 20];

export default function Settings() {
  const c = useTheme();
  const { t, locale } = useI18n();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const wipeAll = useStore((s) => s.wipeAll);
  const [lockAvailable, setLockAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void canUseDeviceLock().then((ok) => alive && setLockAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  // What the last sync really scheduled on this phone (not just what could be).
  const reminderStatus = useReminderStatus();

  const toggleLock = async (on: boolean) => {
    // Turning it off without any lock left on the phone must still work,
    // otherwise the switch could never be turned off again.
    if (!on && !(await canUseDeviceLock())) {
      await updateSettings({ appLock: false });
      return;
    }
    // Turning it on confirms the person can unlock; turning it off needs the
    // owner too, so someone holding the unlocked phone cannot just disable it.
    if (await authenticate(on ? t('lock.enablePrompt') : t('lock.prompt'), t('common.cancel'))) {
      await updateSettings({ appLock: on });
    }
  };

  const toggleReminders = async (on: boolean) => {
    if (!on) {
      await updateSettings({ remindersEnabled: false });
      return;
    }
    if (await requestReminderPermission(t('reminder.channel'))) {
      await updateSettings({ remindersEnabled: true });
      return;
    }
    const open = await confirmAsync({
      title: t('settings.reminders'),
      message: t('settings.remindersDenied'),
      confirmText: t('settings.openPhoneSettings'),
      cancelText: t('common.close'),
    });
    if (open) void withLockSuspended(() => Linking.openSettings());
  };

  const confirmWipe = async () => {
    const ok = await confirmAsync({
      title: t('settings.wipe'),
      message: t('settings.wipeConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await wipeAll();
    cleanupTempFiles();
  };

  const hourLabel = (h: number) => {
    try {
      return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 1, h, 0));
    } catch {
      return `${h}:00`;
    }
  };

  return (
    <Screen>
      <Card>
        <Txt variant="label">{t('settings.language')}</Txt>
        <Segmented
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
          value={settings.language}
          onChange={(v) => void updateSettings({ language: v })}
        />
      </Card>

      <Card>
        <Txt variant="label">{t('settings.currency')}</Txt>
        <Row wrap gap={spacing.sm}>
          {CURRENCIES.map((code) => (
            <Chip key={code} label={code} selected={settings.currency === code} onPress={() => void updateSettings({ currency: code })} />
          ))}
        </Row>
      </Card>

      <Card>
        <Txt variant="label">{t('settings.reminders')}</Txt>
        {remindersSupported ? (
          <>
            <SwitchRow
              label={t('settings.reminders')}
              hint={t('settings.remindersHint')}
              value={settings.remindersEnabled}
              onValueChange={(v) => void toggleReminders(v)}
            />
            {settings.remindersEnabled ? (
              <>
                <Divider />
                <Txt style={{ fontWeight: '600' }}>{t('settings.reminderWhen')}</Txt>
                <ChipGroup
                  options={DAYS_BEFORE.map((d) => ({
                    value: String(d),
                    label:
                      d === 0 ? t('settings.reminderSameDay') : d === 1 ? t('settings.reminderOneDay') : t('settings.reminderDays', { days: d }),
                  }))}
                  value={String(settings.reminderDaysBefore)}
                  onChange={(v) => void updateSettings({ reminderDaysBefore: Number(v) })}
                />
                <Txt style={{ fontWeight: '600' }}>{t('settings.reminderTime')}</Txt>
                <ChipGroup
                  options={HOURS.map((h) => ({ value: String(h), label: hourLabel(h) }))}
                  value={String(settings.reminderHour)}
                  onChange={(v) => void updateSettings({ reminderHour: Number(v) })}
                />
                {reminderStatus.permitted === false ? (
                  <>
                    <Txt variant="caption" color={c.danger}>
                      {t('settings.remindersDenied')}
                    </Txt>
                    <Button
                      small
                      variant="secondary"
                      title={t('settings.openPhoneSettings')}
                      onPress={() => void withLockSuspended(() => Linking.openSettings())}
                    />
                  </>
                ) : (
                  <Txt variant="caption">{t('settings.reminderCount', { count: reminderStatus.scheduled })}</Txt>
                )}
              </>
            ) : null}
          </>
        ) : (
          <Txt variant="caption">{t('settings.remindersWeb')}</Txt>
        )}
      </Card>

      <Card>
        <Txt variant="label">{t('settings.security')}</Txt>
        {lockSupported ? (
          <SwitchRow
            label={t('settings.appLock')}
            hint={
              lockAvailable === false
                ? t('settings.appLockUnavailable')
                : Platform.OS === 'android'
                  ? t('settings.appLockHintAndroid')
                  : t('settings.appLockHint')
            }
            value={settings.appLock}
            onValueChange={(v) => void toggleLock(v)}
          />
        ) : (
          <Txt variant="caption">{t('settings.appLockWeb')}</Txt>
        )}
      </Card>

      <Card>
        <Txt variant="label">{t('settings.data')}</Txt>
        <Txt variant="caption">{t('settings.dataHint')}</Txt>
        <Button title={t('settings.backup')} variant="secondary" icon="shield-checkmark-outline" onPress={() => router.push('/backup')} />
        <Button title={t('settings.wipe')} variant="danger" icon="trash-outline" onPress={() => void confirmWipe()} />
      </Card>

      <Card>
        <Txt variant="label">{t('settings.privacy')}</Txt>
        <Txt>{t('settings.privacyBody')}</Txt>
      </Card>

      <Card>
        <Txt variant="label">{t('settings.legal')}</Txt>
        <Txt>{t('settings.legalBody')}</Txt>
      </Card>

      <Txt variant="caption" center>
        {t('app.name')} · {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Txt>
    </Screen>
  );
}
