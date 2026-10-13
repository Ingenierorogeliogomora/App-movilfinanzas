// Calendar-date helpers. Dates are stored as local "YYYY-MM-DD" strings so a
// purchase made at 11pm never jumps to the next day because of UTC conversion.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar day of a timestamp ("2026-10-12T03:00:00Z" is Oct 11 in the US). */
export function localDateOf(timestamp: string): string {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? timestamp.slice(0, 10) : toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return toISODate(d) === iso;
}

export function makeISODate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidISODate(iso) ? iso : null;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** "2026-03-15" → "2026-03" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKey(todayISO());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Adds months keeping the day when possible (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(iso: string, months: number, preferredDay?: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(preferredDay ?? d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

export function addMonthsToKey(key: string, months: number): string {
  return monthKey(addMonths(`${key}-01`, months));
}

/** Months ending at `endKey` (inclusive), oldest first. */
export function lastNMonths(endKey: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonthsToKey(endKey, -i));
  return out;
}

export function monthBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  return { start: `${key}-01`, end: `${key}-${pad(daysInMonth(y, m))}` };
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

/** Fraction (0..1] of the month that has elapsed on `iso`. */
export function monthProgress(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return d / daysInMonth(y, m);
}

export function formatMonthLabel(key: string, locale: string, style: 'long' | 'short' = 'long'): string {
  const d = parseISODate(`${key}-01`);
  try {
    return capitalizeFirst(new Intl.DateTimeFormat(locale, { month: style, year: 'numeric' }).format(d));
  } catch {
    return key;
  }
}

export function formatShortMonth(key: string, locale: string): string {
  const d = parseISODate(`${key}-01`);
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  } catch {
    return key.slice(5);
  }
}

export function formatDate(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseISODate(iso);
  try {
    return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return iso;
  }
}

/** "octubre de 2026" → "Octubre de 2026" (CSS capitalize would also change "de"). */
export function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}
