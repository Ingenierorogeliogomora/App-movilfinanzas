import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useCategoryMap } from '@/state/derived';
import { useStore } from '@/state/store';
import { spacing, useTheme } from '@/theme';
import { Card, Divider, IconButton, ListItem, Screen, SectionTitle, Segmented, Txt } from '@/ui/primitives';

export default function Categories() {
  const c = useTheme();
  const { t, categoryName } = useI18n();
  const navigation = useNavigation();
  const categories = useStore((s) => s.categories);
  const rules = useStore((s) => s.rules);
  const deleteRule = useStore((s) => s.deleteRule);
  const categoryMap = useCategoryMap();
  const [type, setType] = useState<'expense' | 'income'>('expense');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton name="add" label={t('categories.new')} onPress={() => router.push(`/category/new?type=${type}`)} />
      ),
    });
  }, [navigation, t, type]);

  const visible = categories.filter((cat) => cat.type === type && !cat.archived);
  const archived = categories.filter((cat) => cat.type === type && cat.archived);

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'expense', label: t('categories.expense') },
          { value: 'income', label: t('categories.income') },
        ]}
        value={type}
        onChange={setType}
      />
      <Card>
        {visible.map((cat, i) => (
          <View key={cat.id}>
            {i > 0 ? <Divider /> : null}
            <ListItem
              icon={cat.icon}
              iconColor={cat.color}
              title={categoryName(cat)}
              subtitle={type === 'expense' ? `${t(`nature.${cat.nature}`)} · ${t(`bucket.${cat.bucket}`)}` : undefined}
              onPress={() => router.push(`/category/${cat.id}`)}
            />
          </View>
        ))}
      </Card>
      {archived.length ? (
        <>
          <SectionTitle>{t('categories.archived')}</SectionTitle>
          <Card>
            {archived.map((cat) => (
              <ListItem key={cat.id} icon={cat.icon} iconColor={c.muted} title={categoryName(cat)} onPress={() => router.push(`/category/${cat.id}`)} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('categories.rules')}</SectionTitle>
      <Txt variant="caption">{t('categories.rulesHint')}</Txt>
      <Card>
        {rules.length === 0 ? <Txt muted>{t('categories.noRules')}</Txt> : null}
        {rules.map((r, i) => {
          const cat = r.categoryId ? categoryMap.get(r.categoryId) : undefined;
          return (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListItem
                icon={r.txType === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'pricetag-outline')}
                iconColor={cat?.color ?? c.muted}
                title={`"${r.pattern}"`}
                subtitle={r.txType === 'transfer' ? t('categories.ruleTransfer') : categoryName(cat)}
                right={<IconButton name="trash-outline" color={c.danger} label={t('common.delete')} onPress={() => void deleteRule(r.id)} size={18} />}
              />
            </View>
          );
        })}
      </Card>
      <View style={{ height: spacing.lg }} />
    </Screen>
  );
}
