import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Alert } from 'react-native';

import { todayISO } from '@/core/dates';
import { centsToInput, parseAmount } from '@/core/money';
import type { PaymentMethod, TxType } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';
import { DateField, Field, MoneyField, SwitchRow, TextField } from '@/ui/fields';
import { CategoryPicker, MethodPicker } from '@/ui/pickers';
import { Button, Card, Row, Screen, Segmented, Txt } from '@/ui/primitives';
import { goBack } from '@/ui/nav';

export default function TransactionForm() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; type?: TxType }>();
  const existing = useStore((s) => s.transactions.find((tx) => tx.id === params.id));
  const saveTransaction = useStore((s) => s.saveTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const learnCategory = useStore((s) => s.learnCategory);

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'debit_card');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [note, setNote] = useState(existing?.note ?? '');
  const [learn, setLearn] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('tx.edit') : t('tx.new') });
  }, [navigation, existing, t]);

  const categoryChanged = !!existing && (existing.categoryId !== categoryId || existing.type !== type);

  const onTypeChange = (next: TxType) => {
    setType(next);
    if (next !== type) setCategoryId(null);
  };

  const save = async () => {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError(t('common.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      const tx = await saveTransaction({
        id: existing?.id,
        type,
        amount: Math.abs(cents),
        date,
        categoryId: type === 'transfer' ? null : categoryId,
        method,
        description,
        note: note.trim() || null,
      });
      if (categoryChanged && learn && tx.description) {
        const count = await learnCategory(tx.id, type === 'transfer' ? null : categoryId, type, true);
        if (count > 1) Alert.alert(t('tx.updatedSimilar', { count }));
      }
      goBack();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('common.deleteConfirmTitle'), t('common.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(existing.id);
          goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'expense', label: t('type.expense') },
          { value: 'income', label: t('type.income') },
          { value: 'transfer', label: t('type.transfer') },
        ]}
        value={type}
        onChange={onTypeChange}
      />
      {type === 'transfer' ? <Txt variant="caption">{t('type.transferHint')}</Txt> : null}

      <MoneyField
        big
        autoFocus={!existing}
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError(undefined);
        }}
        error={error}
      />

      <TextField
        label={t('tx.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('tx.descriptionPlaceholder')}
        returnKeyType="done"
      />

      {type !== 'transfer' ? (
        <Field label={t('tx.category')}>
          <CategoryPicker type={type} value={categoryId} onChange={setCategoryId} />
        </Field>
      ) : null}

      {categoryChanged && type !== 'transfer' ? (
        <Card>
          <SwitchRow label={t('tx.learn')} hint={t('tx.learnHint')} value={learn} onValueChange={setLearn} />
        </Card>
      ) : null}

      <Field label={t('tx.method')}>
        <MethodPicker value={method} onChange={setMethod} />
      </Field>

      <DateField label={t('tx.date')} value={date} onChange={setDate} />

      <TextField label={`${t('tx.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} multiline />

      <Row gap={spacing.md}>
        {existing ? <Button title={t('common.delete')} variant="danger" onPress={remove} style={{ flex: 1 }} /> : null}
        <Button title={t('common.save')} onPress={() => void save()} loading={saving} style={{ flex: 2 }} />
      </Row>
    </Screen>
  );
}
