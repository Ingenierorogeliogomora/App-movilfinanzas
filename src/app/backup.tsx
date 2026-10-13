import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { backupFileName, createBackup, parseBackup, serializeBackup } from '@/core/backup';
import { formatDate, localDateOf } from '@/core/dates';
import { pickTextFile, saveTextFile } from '@/data/files';
import { useI18n, type TKey } from '@/i18n';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme';
import { confirmAsync, notify } from '@/ui/dialogs';
import { Button, Card, Icon, Row, Screen, Txt } from '@/ui/primitives';

export default function Backup() {
  const c = useTheme();
  const { t, locale } = useI18n();
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt);
  const backupData = useStore((s) => s.backupData);
  const restoreBackup = useStore((s) => s.restoreBackup);
  const updateSettings = useStore((s) => s.updateSettings);
  const [busy, setBusy] = useState<'create' | 'restore' | null>(null);

  const create = async () => {
    setBusy('create');
    try {
      const exportedAt = new Date().toISOString();
      const file = createBackup(backupData(), { exportedAt, appVersion: Constants.expoConfig?.version ?? '' });
      const shared = await saveTextFile(backupFileName(exportedAt), serializeBackup(file), 'application/json', 'public.json');
      if (!shared) {
        notify(t('common.error'));
        return;
      }
      // The share sheet does not say whether the file was saved, so ask.
      const saved =
        Platform.OS === 'web' ||
        (await confirmAsync({
          title: t('backup.savedQuestion'),
          message: t('backup.savedHint'),
          confirmText: t('backup.savedYes'),
          cancelText: t('backup.savedNo'),
        }));
      if (saved) {
        await updateSettings({ lastBackupAt: exportedAt });
        if (Platform.OS === 'web') notify(t('backup.created'));
      }
    } catch {
      notify(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const file = await pickTextFile('.json,application/json');
      if (!file) return;
      const parsed = parseBackup(file.text);
      if (!parsed.ok) {
        notify(t(`backup.error.${parsed.error}` as TKey));
        return;
      }
      const date = parsed.backup.exportedAt ? formatDate(localDateOf(parsed.backup.exportedAt), locale) : '—';
      const ok = await confirmAsync({
        title: t('backup.restoreTitle'),
        message: t('backup.restoreBody', {
          date,
          transactions: parsed.counts.transactions,
          debts: parsed.counts.debts,
          recurring: parsed.counts.recurring,
          budgets: parsed.counts.budgets,
        }),
        confirmText: t('backup.restoreConfirm'),
        cancelText: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
      try {
        await restoreBackup(parsed.backup.data);
      } catch {
        // The restore runs in one database transaction, so current data is intact.
        notify(t('common.error'));
        return;
      }
      notify(t('backup.restored'), parsed.dropped ? t('backup.dropped', { count: parsed.dropped }) : undefined);
      // Back to Home without leaving a second copy of the tabs in the history.
      if (router.canDismiss()) router.dismissAll();
      router.navigate('/');
    } catch {
      // Reading the picked file failed.
      notify(t('backup.error.invalid_json'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Txt>{t('backup.intro')}</Txt>
      <Card>
        <Row gap={10}>
          <Icon name="time-outline" color={c.primary} />
          <Txt style={{ flex: 1 }}>
            {lastBackupAt ? t('backup.last', { date: formatDate(localDateOf(lastBackupAt), locale) }) : t('backup.never')}
          </Txt>
        </Row>
        <Button title={t('backup.create')} icon="download-outline" onPress={() => void create()} loading={busy === 'create'} disabled={busy !== null} />
      </Card>
      <Card tone="warning">
        <Row gap={10} align="flex-start">
          <Icon name="warning" color={c.warning} />
          <Txt style={{ flex: 1 }}>{t('backup.warning')}</Txt>
        </Row>
      </Card>
      <Card>
        <Txt variant="caption">{t('backup.restoreHint')}</Txt>
        <Button
          title={t('backup.restore')}
          icon="cloud-upload-outline"
          variant="secondary"
          onPress={() => void restore()}
          loading={busy === 'restore'}
          disabled={busy !== null}
        />
      </Card>
    </Screen>
  );
}
