import { Pressable, StyleSheet, View } from 'react-native';

import { addMonthsToKey, currentMonthKey, formatMonthLabel } from '@/core/dates';
import { PAYMENT_METHODS, type CategoryType, type PaymentMethod } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

import { CategoryIcon, ChipGroup, IconButton, Row, Txt } from './primitives';

const METHOD_ICONS: Record<PaymentMethod, string> = {
  credit_card: 'card',
  debit_card: 'card-outline',
  transfer: 'swap-horizontal',
  digital_wallet: 'phone-portrait-outline',
  cash: 'cash-outline',
  check: 'receipt-outline',
  other: 'ellipsis-horizontal-circle',
};

export function methodIcon(m: PaymentMethod): string {
  return METHOD_ICONS[m];
}

export function MethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const { t } = useI18n();
  return (
    <ChipGroup
      options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`method.${m}`), icon: METHOD_ICONS[m] }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function CategoryPicker({
  type,
  value,
  onChange,
}: {
  type: CategoryType;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const c = useTheme();
  const { categoryName } = useI18n();
  const categories = useStore((s) => s.categories).filter((cat) => cat.type === type && (!cat.archived || cat.id === value));
  return (
    <View style={styles.grid}>
      {categories.map((cat) => {
        const selected = cat.id === value;
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(cat.id)}
            style={[
              styles.cell,
              { borderColor: selected ? cat.color : c.border, backgroundColor: selected ? `${cat.color}18` : c.card },
            ]}
          >
            <CategoryIcon icon={cat.icon} color={cat.color} size={32} />
            <Txt variant="caption" center numberOfLines={2} color={selected ? c.text : undefined} style={{ fontSize: 12 }}>
              {categoryName(cat)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { locale } = useI18n();
  const c = useTheme();
  const isCurrent = month >= currentMonthKey();
  const label = formatMonthLabel(month, locale);
  return (
    <Row justify="space-between" style={[styles.switcher, { backgroundColor: c.card, borderColor: c.border }]}>
      <IconButton name="chevron-back" label="Previous month" onPress={() => onChange(addMonthsToKey(month, -1))} />
      <Txt variant="subtitle">
        {label}
      </Txt>
      <IconButton
        name="chevron-forward"
        label="Next month"
        color={isCurrent ? c.border : undefined}
        onPress={() => !isCurrent && onChange(addMonthsToKey(month, 1))}
      />
    </Row>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '33%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  switcher: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, paddingVertical: 4 },
});
