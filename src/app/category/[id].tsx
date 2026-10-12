import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/core/categories';
import type { Bucket, CategoryType, Nature } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { Field, SwitchRow, TextField } from '@/ui/fields';
import { Button, Card, CategoryIcon, Row, Screen, Segmented, Txt } from '@/ui/primitives';
import { goBack } from '@/ui/nav';

export default function CategoryForm() {
  const c = useTheme();
  const { t, categoryName } = useI18n();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; type?: CategoryType }>();
  const existing = useStore((s) => s.categories.find((cat) => cat.id === params.id));
  const saveCategory = useStore((s) => s.saveCategory);

  const type: CategoryType = existing?.type ?? params.type ?? 'expense';
  const [name, setName] = useState(existing ? categoryName(existing) : '');
  const [icon, setIcon] = useState(existing?.icon ?? CATEGORY_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);
  const [nature, setNature] = useState<Nature>(existing?.nature ?? 'variable');
  const [bucket, setBucket] = useState<Bucket>(existing?.bucket ?? 'wants');
  const [archived, setArchived] = useState(existing?.archived ?? false);
  const [error, setError] = useState<string>();

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('categories.edit') : t('categories.new') });
  }, [navigation, existing, t]);

  const save = async () => {
    if (!name.trim()) {
      setError(t('common.required'));
      return;
    }
    // Built-in categories keep their translated name unless the person renamed them.
    const keepTranslated = existing?.key && name.trim() === categoryName({ ...existing, name: null });
    await saveCategory({
      id: existing?.id,
      key: existing?.key ?? null,
      name: keepTranslated ? null : name.trim(),
      type,
      icon,
      color,
      nature,
      bucket,
      archived,
    });
    goBack();
  };

  return (
    <Screen>
      <Row gap={spacing.md}>
        <CategoryIcon icon={icon} color={color} size={52} />
        <View style={{ flex: 1 }}>
          <TextField value={name} onChangeText={setName} placeholder={t('categories.name')} error={error} />
        </View>
      </Row>
      <Field label={t('categories.icon')}>
        <Row wrap gap={spacing.sm}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === icon }}
              style={{ borderRadius: 22, borderWidth: 2, borderColor: i === icon ? color : 'transparent' }}
            >
              <CategoryIcon icon={i} color={i === icon ? color : c.muted} size={40} />
            </Pressable>
          ))}
        </Row>
      </Field>
      <Field label={t('categories.color')}>
        <Row wrap gap={spacing.sm}>
          {CATEGORY_COLORS.map((col) => (
            <Pressable
              key={col}
              onPress={() => setColor(col)}
              accessibilityRole="button"
              accessibilityState={{ selected: col === color }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: col,
                borderWidth: 3,
                borderColor: col === color ? c.text : 'transparent',
              }}
            />
          ))}
        </Row>
      </Field>
      {type === 'expense' ? (
        <>
          <Field label={t('categories.nature')} hint={nature === 'fixed' ? t('nature.fixedHint') : t('nature.variableHint')}>
            <Segmented
              options={[
                { value: 'fixed', label: t('nature.fixed') },
                { value: 'variable', label: t('nature.variable') },
              ]}
              value={nature}
              onChange={setNature}
            />
          </Field>
          <Field label={t('categories.bucket')}>
            <Segmented
              options={[
                { value: 'needs', label: t('bucket.needs') },
                { value: 'wants', label: t('bucket.wants') },
                { value: 'savings', label: t('bucket.savings') },
              ]}
              value={bucket}
              onChange={setBucket}
            />
          </Field>
        </>
      ) : null}
      {existing ? (
        <Card>
          <SwitchRow label={t('categories.archive')} value={archived} onValueChange={setArchived} />
        </Card>
      ) : null}
      <Button title={t('common.save')} onPress={() => void save()} />
      <Txt variant="caption" center>
        {t('analysis.ruleHint')}
      </Txt>
    </Screen>
  );
}
