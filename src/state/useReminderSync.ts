import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { formatDate, todayISO } from '@/core/dates';
import { buildReminders, type ReminderItem } from '@/core/reminders';
import { cancelAllReminders, remindersSupported, replaceReminders, type ScheduledReminder } from '@/data/notifications';
import { useI18n, type I18n } from '@/i18n';

import { useStore } from './store';

// One sync at a time: each run clears and reschedules everything.
let queue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>): void {
  queue = queue.then(task).catch(() => undefined);
}

export function toNotification(item: ReminderItem, { t, money, locale }: I18n): ScheduledReminder {
  const amount = money(item.amount);
  let body =
    item.daysBefore === 0
      ? t('reminder.dueToday', { amount })
      : item.daysBefore === 1
        ? t('reminder.dueTomorrow', { amount })
        : t('reminder.dueIn', { amount, days: item.daysBefore, date: formatDate(item.dueDate, locale, { day: 'numeric', month: 'short' }) });
  if (item.kind === 'debt') body = `${body} ${t('reminder.debtHint')}`;
  const [y, m, d] = item.fireDate.split('-').map(Number);
  return {
    id: item.id,
    title: item.kind === 'debt' ? t('reminder.debtTitle', { name: item.name }) : t('reminder.billTitle', { name: item.name }),
    body,
    date: new Date(y, m - 1, d, item.hour, 0, 0),
    url: item.kind === 'debt' ? '/debts' : '/recurring',
  };
}

/**
 * Keeps scheduled notifications in line with the data: reschedules whenever
 * bills, debts or reminder settings change, and when the app comes back to
 * the foreground (a new day may have started).
 */
export function useReminderSync(): void {
  const i18n = useI18n();
  const recurring = useStore((s) => s.recurring);
  const debts = useStore((s) => s.debts);
  const enabled = useStore((s) => s.settings.remindersEnabled);
  const daysBefore = useStore((s) => s.settings.reminderDaysBefore);
  const hour = useStore((s) => s.settings.reminderHour);
  const [wake, setWake] = useState(0);

  useEffect(() => {
    if (!remindersSupported) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setWake((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!remindersSupported) return;
    // Debounce bursts of edits (e.g. a CSV import or a restore).
    const timer = setTimeout(() => {
      if (!enabled) {
        enqueue(cancelAllReminders);
        return;
      }
      const now = new Date();
      const items = buildReminders(recurring, debts, {
        today: todayISO(),
        currentHour: now.getHours(),
        daysBefore,
        hour,
      });
      enqueue(() => replaceReminders(items.map((item) => toNotification(item, i18n)), i18n.t('reminder.channel')));
    }, 800);
    return () => clearTimeout(timer);
  }, [recurring, debts, enabled, daysBefore, hour, i18n, wake]);
}
