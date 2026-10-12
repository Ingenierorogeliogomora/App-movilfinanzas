import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveLanguage, useI18n } from '@/i18n';
import { CURRENCIES } from '@/i18n/currencies';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { Button, Card, Chip, Icon, Row, Segmented, Stack, Txt } from '@/ui/primitives';

export default function Onboarding() {
  const c = useTheme();
  const { t } = useI18n();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const deviceCurrency = getLocales()[0]?.currencyCode ?? 'USD';
  const [currency, setCurrency] = useState(CURRENCIES.includes(deviceCurrency) ? deviceCurrency : 'USD');

  const lang = resolveLanguage(settings.language);

  const finish = async () => {
    await updateSettings({ currency, language: lang, onboarded: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, flexGrow: 1 }}>
        <Row gap={6} justify="center">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? c.primary : c.border }}
            />
          ))}
        </Row>

        {step === 0 ? (
          <Stack gap={spacing.lg}>
            <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
              <View
                style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="trending-down" size={44} color={c.onPrimary} />
              </View>
              <Txt variant="display" center>
                {t('onboarding.welcomeTitle')}
              </Txt>
              <Txt muted center>
                {t('app.tagline')}
              </Txt>
            </View>
            <Card>
              {(
                [
                  ['flag-outline', 'onboarding.point1'],
                  ['document-text-outline', 'onboarding.point2'],
                  ['pie-chart-outline', 'onboarding.point3'],
                ] as const
              ).map(([icon, key]) => (
                <Row key={key} gap={spacing.md} align="flex-start">
                  <Icon name={icon} size={22} color={c.primary} />
                  <Txt style={{ flex: 1 }}>{t(key)}</Txt>
                </Row>
              ))}
            </Card>
            <Txt variant="label">{t('onboarding.language')}</Txt>
            <Segmented
              options={[
                { value: 'es', label: 'Español' },
                { value: 'en', label: 'English' },
              ]}
              value={lang}
              onChange={(v) => updateSettings({ language: v })}
            />
          </Stack>
        ) : null}

        {step === 1 ? (
          <Stack gap={spacing.lg}>
            <Txt variant="title" style={{ marginTop: spacing.xl }}>
              {t('onboarding.currencyTitle')}
            </Txt>
            <Row wrap gap={spacing.sm}>
              {CURRENCIES.map((code) => (
                <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
              ))}
            </Row>
          </Stack>
        ) : null}

        {step === 2 ? (
          <Stack gap={spacing.lg}>
            <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
              <Icon name="lock-closed-outline" size={48} color={c.primary} />
              <Txt variant="title" center>
                {t('onboarding.privacyTitle')}
              </Txt>
              <Txt muted center>
                {t('onboarding.privacyBody')}
              </Txt>
            </View>
            <Card tone="warning">
              <Row gap={spacing.md} align="flex-start">
                <Icon name="information-circle" size={22} color={c.warning} />
                <Txt style={{ flex: 1 }}>{t('onboarding.disclaimer')}</Txt>
              </Row>
            </Card>
          </Stack>
        ) : null}

        <View style={{ flex: 1 }} />
        <Row gap={spacing.md}>
          {step > 0 ? <Button title={t('common.back')} variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          <Button
            title={step < 2 ? t('common.next') : t('onboarding.start')}
            onPress={() => (step < 2 ? setStep(step + 1) : void finish())}
            style={{ flex: 2 }}
          />
        </Row>
      </ScrollView>
    </SafeAreaView>
  );
}
