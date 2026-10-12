import Constants from 'expo-constants';
import { Alert } from 'react-native';

import { useI18n } from '@/i18n';
import { CURRENCIES } from '@/i18n/currencies';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';
import { Button, Card, Chip, Row, Screen, Segmented, Txt } from '@/ui/primitives';

export default function Settings() {
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const wipeAll = useStore((s) => s.wipeAll);

  const confirmWipe = () => {
    Alert.alert(t('settings.wipe'), t('settings.wipeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await wipeAll();
        },
      },
    ]);
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
        <Txt variant="label">{t('settings.data')}</Txt>
        <Txt variant="caption">{t('settings.dataHint')}</Txt>
        <Button title={t('settings.wipe')} variant="danger" icon="trash-outline" onPress={confirmWipe} />
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
