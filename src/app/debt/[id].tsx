import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';

import { todayISO } from '@/core/dates';
import { suggestedCardMinimum } from '@/core/debt';
import { centsToInput, parseAmount } from '@/core/money';
import { DEBT_KINDS, type DebtKind } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';
import { Field, MoneyField, TextField } from '@/ui/fields';
import { Button, ChipGroup, Row, Screen } from '@/ui/primitives';
import { confirmAsync } from '@/ui/dialogs';
import { goBack } from '@/ui/nav';

export default function DebtForm() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useStore((s) => s.debts.find((d) => d.id === id));
  const saveDebt = useStore((s) => s.saveDebt);
  const deleteDebt = useStore((s) => s.deleteDebt);

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<DebtKind>(existing?.kind ?? 'credit_card');
  const [balance, setBalance] = useState(existing ? centsToInput(existing.balance) : '');
  const [original, setOriginal] = useState(existing ? centsToInput(existing.originalBalance) : '');
  const [apr, setApr] = useState(existing ? String(existing.apr) : '');
  const [minPayment, setMinPayment] = useState(existing ? centsToInput(existing.minPayment) : '');
  const [limit, setLimit] = useState(existing?.creditLimit ? centsToInput(existing.creditLimit) : '');
  const [dueDay, setDueDay] = useState(existing?.dueDay ? String(existing.dueDay) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('debt.edit') : t('debt.new') });
  }, [navigation, existing, t]);

  const parseApr = (v: string) => {
    const n = Number(v.replace(',', '.').replace('%', '').trim());
    return Number.isFinite(n) && n >= 0 && n < 200 ? n : null;
  };

  const suggest = () => {
    const b = parseAmount(balance);
    const a = parseApr(apr);
    if (b && b > 0 && a !== null) setMinPayment(centsToInput(suggestedCardMinimum(b, a)));
  };

  const save = async () => {
    const e: Record<string, string> = {};
    const b = parseAmount(balance);
    const a = parseApr(apr);
    const m = parseAmount(minPayment);
    const o = original ? parseAmount(original) : null;
    const l = limit ? parseAmount(limit) : null;
    const day = dueDay ? Number(dueDay) : null;
    if (!name.trim()) e.name = t('common.required');
    if (b === null || b < 0) e.balance = t('common.invalidAmount');
    if (a === null) e.apr = t('common.invalidAmount');
    if (m === null || m < 0) e.minPayment = t('common.invalidAmount');
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) e.dueDay = t('common.invalidAmount');
    setErrors(e);
    if (Object.keys(e).length) return;

    await saveDebt({
      id: existing?.id,
      name: name.trim(),
      kind,
      balance: b!,
      originalBalance: Math.max(o ?? existing?.originalBalance ?? b!, b!),
      apr: a!,
      minPayment: m!,
      creditLimit: kind === 'credit_card' && l ? l : null,
      dueDay: day,
      closedAt: b === 0 ? (existing?.closedAt ?? todayISO()) : null,
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
    await deleteDebt(existing.id);
    goBack();
  };

  return (
    <Screen>
      <TextField
        label={t('debt.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('debt.namePlaceholder')}
        error={errors.name}
        autoFocus={!existing}
      />
      <Field label={t('debt.kind')}>
        <ChipGroup options={DEBT_KINDS.map((k) => ({ value: k, label: t(`debt.kind.${k}`) }))} value={kind} onChange={setKind} />
      </Field>
      <MoneyField label={t('debt.balance')} value={balance} onChangeText={setBalance} error={errors.balance} />
      <TextField
        label={t('debt.apr')}
        hint={t('debt.aprHint')}
        value={apr}
        onChangeText={(v) => setApr(v.replace(/[^\d.,]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="24.99"
        error={errors.apr}
      />
      <MoneyField label={t('debt.minPayment')} value={minPayment} onChangeText={setMinPayment} error={errors.minPayment} />
      {kind === 'credit_card' ? (
        <>
          <Button small variant="ghost" title={t('debt.suggestMin')} icon="calculator-outline" onPress={suggest} />
          <MoneyField label={`${t('debt.creditLimit')} (${t('common.optional')})`} value={limit} onChangeText={setLimit} />
        </>
      ) : null}
      <TextField
        label={`${t('debt.dueDay')} (${t('common.optional')})`}
        value={dueDay}
        onChangeText={(v) => setDueDay(v.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        error={errors.dueDay}
      />
      {existing ? (
        <MoneyField label={t('debt.originalBalance')} value={original} onChangeText={setOriginal} />
      ) : null}
      <Row gap={spacing.md}>
        {existing ? <Button title={t('common.delete')} variant="danger" onPress={() => void remove()} style={{ flex: 1 }} /> : null}
        <Button title={t('common.save')} onPress={() => void save()} style={{ flex: 2 }} />
      </Row>
    </Screen>
  );
}
