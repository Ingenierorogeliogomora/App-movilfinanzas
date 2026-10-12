// Which payment reminders to schedule as local notifications. Pure logic: the
// app layer turns each item into a localized notification.
//
// Missing a due date is expensive in the US: a late fee (often $30-$40) and,
// after 60 days, a penalty APR near 30%. Reminders cover fixed bills (rent,
// utilities, subscriptions) and the monthly due day of each debt.

import { addDays, addMonths, daysBetween, daysInMonth } from './dates';
import { advanceDate } from './recurring';
import type { Debt, Recurring } from './types';

export interface ReminderItem {
  /** Stable id, also used as the notification identifier. */
  id: string;
  kind: 'bill' | 'debt';
  refId: string;
  name: string;
  amount: number;
  /** Day the payment is due, YYYY-MM-DD. */
  dueDate: string;
  /** Day the notification fires, YYYY-MM-DD (at `hour`:00 local time). */
  fireDate: string;
  hour: number;
  /** Days between the notification and the due date (0 = due that day). */
  daysBefore: number;
}

export interface ReminderOptions {
  today: string;
  /** Current local hour (0-23), so nothing is scheduled in the past. */
  currentHour: number;
  daysBefore: number;
  hour: number;
  horizonDays?: number;
  /** iOS keeps at most 64 pending local notifications per app. */
  max?: number;
}

export const MAX_REMINDERS = 48;

/** Next date (today or later) that falls on `dueDay`, clamped to short months. */
export function nextDueDate(today: string, dueDay: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const thisMonth = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(dueDay, daysInMonth(y, m))).padStart(2, '0')}`;
  if (Math.min(dueDay, daysInMonth(y, m)) >= d) return thisMonth;
  return addMonths(`${y}-${String(m).padStart(2, '0')}-01`, 1, dueDay);
}

/**
 * When to notify for a due date. If the ideal day already passed but the bill
 * is still upcoming (or due today), notify today if there is time left.
 */
function fireDateFor(dueDate: string, opts: ReminderOptions): string | null {
  let fire = addDays(dueDate, -opts.daysBefore);
  if (fire < opts.today) fire = opts.today;
  if (fire === opts.today && opts.currentHour >= opts.hour) return null;
  return fire;
}

export function buildReminders(recurring: Recurring[], debts: Debt[], opts: ReminderOptions): ReminderItem[] {
  const horizon = addDays(opts.today, opts.horizonDays ?? 60);
  const out: ReminderItem[] = [];

  const push = (kind: ReminderItem['kind'], refId: string, name: string, amount: number, dueDate: string) => {
    if (dueDate < opts.today || dueDate > horizon) return;
    const fireDate = fireDateFor(dueDate, opts);
    if (!fireDate) return;
    out.push({
      id: `${kind}:${refId}:${dueDate}`,
      kind,
      refId,
      name,
      amount,
      dueDate,
      fireDate,
      hour: opts.hour,
      daysBefore: daysBetween(fireDate, dueDate),
    });
  };

  for (const r of recurring) {
    // Only money going out needs a reminder.
    if (!r.active || r.type !== 'expense') continue;
    let date = r.nextDate;
    // Skip occurrences already in the past (an overdue bill stays visible in the app).
    for (let guard = 0; date < opts.today && guard < 1000; guard++) date = advanceDate(date, r.frequency);
    for (let guard = 0; date <= horizon && guard < 60; guard++) {
      push('bill', r.id, r.name, r.amount, date);
      date = advanceDate(date, r.frequency);
    }
  }

  for (const d of debts) {
    if (d.closedAt || d.balance <= 0 || !d.dueDay) continue;
    let date = nextDueDate(opts.today, d.dueDay);
    for (let guard = 0; date <= horizon && guard < 4; guard++) {
      push('debt', d.id, d.name, Math.min(d.minPayment, d.balance), date);
      date = addMonths(date, 1, d.dueDay);
    }
  }

  return out
    .sort((a, b) => a.fireDate.localeCompare(b.fireDate) || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .slice(0, opts.max ?? MAX_REMINDERS);
}
