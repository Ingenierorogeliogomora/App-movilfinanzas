import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { addDays, formatDate, parseISODate, toISODate, todayISO } from '@/core/dates';
import { centsToInput, parseAmount } from '@/core/money';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { Chip, Icon, Row, Txt } from './primitives';

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt style={{ fontWeight: '600', fontSize: 14 }}>{label}</Txt> : null}
      {children}
      {error ? <Txt variant="caption" color={c.danger}>{error}</Txt> : hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}

export function TextField({
  label,
  hint,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const c = useTheme();
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        placeholderTextColor={c.muted}
        {...rest}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.card, borderColor: error ? c.danger : c.border },
          rest.multiline && { minHeight: 80, textAlignVertical: 'top' },
          style,
        ]}
      />
    </Field>
  );
}

/**
 * Text state for an amount stored elsewhere (settings, store). Follows outside
 * changes (chips, buttons) without reformatting what the person is typing.
 */
export function useAmountText(cents: number): [string, (v: string) => void] {
  const [text, setText] = useState(() => centsToInput(cents));
  const [synced, setSynced] = useState(cents);
  if (synced !== cents) {
    setSynced(cents);
    if ((parseAmount(text) ?? 0) !== cents) setText(centsToInput(cents));
  }
  return [text, setText];
}

/** Amount input. Keeps the raw text so people can type freely; parse on save. */
export function MoneyField({
  label,
  value,
  onChangeText,
  hint,
  error,
  big,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  error?: string;
  big?: boolean;
  autoFocus?: boolean;
}) {
  const c = useTheme();
  const { currency, locale } = useI18n();
  let symbol = '$';
  try {
    symbol =
      new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '$';
  } catch {
    // Keep "$".
  }
  return (
    <Field label={label} hint={hint} error={error}>
      <View
        style={[
          styles.input,
          styles.moneyWrap,
          { backgroundColor: c.card, borderColor: error ? c.danger : c.border },
          big && { paddingVertical: spacing.md },
        ]}
      >
        <Txt style={{ fontSize: big ? 28 : 16, fontWeight: '700' }} muted>
          {symbol}
        </Txt>
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(v.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={c.muted}
          autoFocus={autoFocus}
          style={{ flex: 1, color: c.text, fontSize: big ? 32 : 16, fontWeight: big ? '800' : '500', padding: 0 }}
        />
      </View>
    </Field>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const c = useTheme();
  return (
    <Row justify="space-between" gap={spacing.md}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '600' }}>{label}</Txt>
        {hint ? <Txt variant="caption">{hint}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: c.primary }} />
    </Row>
  );
}

export function DateField({ label, value, onChange }: { label?: string; value: string; onChange: (iso: string) => void }) {
  const c = useTheme();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const yesterday = addDays(today, -1);

  return (
    <Field label={label}>
      <Row wrap gap={spacing.sm}>
        <Chip label={t('common.today')} selected={value === today} onPress={() => onChange(today)} />
        <Chip label={t('common.yesterday')} selected={value === yesterday} onPress={() => onChange(yesterday)} />
        <Pressable
          onPress={() => setOpen((o) => !o)}
          style={[styles.dateButton, { borderColor: value !== today && value !== yesterday ? c.primary : c.border, backgroundColor: c.card }]}
        >
          <Row gap={6}>
            <Icon name="calendar-outline" size={16} color={c.primary} />
            <Txt>{formatDate(value, locale)}</Txt>
          </Row>
        </Pressable>
      </Row>
      {open ? (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={(_, date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            onChange(toISODate(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  moneyWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateButton: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
