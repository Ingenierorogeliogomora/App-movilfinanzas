import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { todayISO } from '@/core/dates';
import { centsToInput, parseAmount } from '@/core/money';
import type { PaymentMethod } from '@/core/types';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';
import { DateField, Field, MoneyField, SwitchRow } from '@/ui/fields';
import { MethodPicker } from '@/ui/pickers';
import { Button, Card, Chip, Divider, Row, Screen, Txt } from '@/ui/primitives';
import { goBack } from '@/ui/nav';

export default function DebtPayment() {
  const { t, money } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const debt = useStore((s) => s.debts.find((d) => d.id === id));
  const recordDebtPayment = useStore((s) => s.recordDebtPayment);
  const setDebtBalance = useStore((s) => s.setDebtBalance);

  const [amount, setAmount] = useState(debt ? centsToInput(debt.minPayment) : '');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [asExpense, setAsExpense] = useState(true);
  const [newBalance, setNewBalance] = useState('');
  const [error, setError] = useState<string>();

  if (!debt) return null;

  const pay = async () => {
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) {
      setError(t('common.invalidAmount'));
      return;
    }
    await recordDebtPayment(debt.id, cents, date, method, asExpense);
    goBack();
  };

  const updateBalance = async () => {
    const cents = parseAmount(newBalance);
    if (cents === null || cents < 0) return;
    await setDebtBalance(debt.id, cents);
    goBack();
  };

  return (
    <Screen>
      <Card>
        <Txt variant="subtitle">{debt.name}</Txt>
        <Txt variant="money">{money(debt.balance)}</Txt>
      </Card>
      <MoneyField big label={t('debt.payAmount')} value={amount} onChangeText={setAmount} error={error} />
      <Row gap={spacing.sm} wrap>
        <Chip label={`${t('debt.payMinimum')} ${money(debt.minPayment)}`} onPress={() => setAmount(centsToInput(debt.minPayment))} />
        <Chip label={`${t('debt.payFull')} ${money(debt.balance)}`} onPress={() => setAmount(centsToInput(debt.balance))} />
      </Row>
      <DateField label={t('tx.date')} value={date} onChange={setDate} />
      <Field label={t('tx.method')}>
        <MethodPicker value={method} onChange={setMethod} />
      </Field>
      <Card>
        <SwitchRow label={t('debt.addAsExpense')} hint={t('debt.addAsExpenseHint')} value={asExpense} onValueChange={setAsExpense} />
      </Card>
      <Button title={t('debt.pay')} icon="checkmark" onPress={() => void pay()} />

      <Divider />
      <Txt variant="label">{t('debt.updateBalance')}</Txt>
      <MoneyField label={t('debt.newBalance')} hint={t('debt.newBalanceHint')} value={newBalance} onChangeText={setNewBalance} />
      <Button title={t('debt.updateBalance')} variant="secondary" onPress={() => void updateBalance()} disabled={!newBalance} />
    </Screen>
  );
}
