import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';

import { todayISO } from '@/core/dates';
import { centsToInput, parseAmount } from '@/core/money';
import { FREQUENCIES, type CategoryType, type Frequency, type PaymentMethod } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';
import { DateField, Field, MoneyField, SwitchRow, TextField } from '@/ui/fields';
import { CategoryPicker, MethodPicker } from '@/ui/pickers';
import { Button, Card, ChipGroup, Row, Screen, Segmented } from '@/ui/primitives';
import { confirmAsync } from '@/ui/dialogs';
import { goBack } from '@/ui/nav';

export default function RecurringForm() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useStore((s) => s.recurring.find((r) => r.id === id));
  const saveRecurring = useStore((s) => s.saveRecurring);
  const deleteRecurring = useStore((s) => s.deleteRecurring);

  const [type, setType] = useState<CategoryType>(existing?.type ?? 'expense');
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'debit_card');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(existing?.nextDate ?? todayISO());
  const [active, setActive] = useState(existing?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('rec.edit') : t('rec.new') });
  }, [navigation, existing, t]);

  const save = async () => {
    const cents = parseAmount(amount);
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('common.required');
    if (!cents || cents <= 0) e.amount = t('common.invalidAmount');
    setErrors(e);
    if (Object.keys(e).length) return;
    await saveRecurring({
      id: existing?.id,
      name: name.trim(),
      type,
      amount: cents!,
      categoryId,
      method,
      frequency,
      nextDate,
      active,
    });
    goBack();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAsync({
      title: t('common.deleteConfirmTitle'),
      message: t('common.deleteConfirmBody'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deleteRecurring(existing.id);
    goBack();
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'expense', label: t('type.expense') },
          { value: 'income', label: t('type.income') },
        ]}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(null);
          if (v === 'income') setMethod('transfer');
        }}
      />
      <TextField
        label={t('rec.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('rec.namePlaceholder')}
        error={errors.name}
        autoFocus={!existing}
      />
      <MoneyField label={t('tx.amount')} value={amount} onChangeText={setAmount} error={errors.amount} />
      <Field label={t('rec.frequency')}>
        <ChipGroup options={FREQUENCIES.map((f) => ({ value: f, label: t(`freq.${f}`) }))} value={frequency} onChange={setFrequency} />
      </Field>
      <DateField label={t('rec.nextDate')} value={nextDate} onChange={setNextDate} />
      <Field label={t('tx.category')}>
        <CategoryPicker type={type} value={categoryId} onChange={setCategoryId} />
      </Field>
      <Field label={t('tx.method')}>
        <MethodPicker value={method} onChange={setMethod} />
      </Field>
      {existing ? (
        <Card>
          <SwitchRow label={t('rec.active')} value={active} onValueChange={setActive} />
        </Card>
      ) : null}
      <Row gap={spacing.md}>
        {existing ? <Button title={t('common.delete')} variant="danger" onPress={() => void remove()} style={{ flex: 1 }} /> : null}
        <Button title={t('common.save')} onPress={() => void save()} style={{ flex: 2 }} />
      </Row>
    </Screen>
  );
}
