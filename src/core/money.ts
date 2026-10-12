// Money helpers. Amounts are integer cents everywhere in the app.

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Parses an amount typed by a person or found in a bank file.
 * Accepts "1,234.56", "1.234,56", "$ 45", "(12.50)", "-12.50", "12.50-", "1234".
 * Returns signed cents, or null when the text is not a number.
 */
export function parseAmount(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Trailing CR/DR markers used by some banks.
  const marker = s.match(/\s*(CR|DR)$/i);
  if (marker) {
    if (marker[1].toUpperCase() === 'DR') negative = !negative;
    s = s.slice(0, -marker[0].length);
  }
  s = s.replace(/[\s ]/g, '');
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  // Drop currency symbols / codes anywhere (e.g. "$", "USD", "€", "MXN$").
  s = s.replace(/[^\d.,-]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal separator.
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const commaCount = s.split(',').length - 1;
    // "12,5" or "12,50" → decimal comma. "1,234" or "1,234,567" → thousands.
    normalized = commaCount === 1 && decimals !== 3 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    const dotCount = s.split('.').length - 1;
    // "1.234.567" → thousands. "1.234" is ambiguous; treat as decimal (US style).
    normalized = dotCount > 1 && decimals === 3 ? s.replace(/\./g, '') : s;
    if (dotCount > 1 && decimals !== 3) return null;
  } else {
    normalized = s;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string, mode: 'full' | 'compact' | 'whole'): Intl.NumberFormat {
  const cacheKey = `${locale}|${currency}|${mode}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        ...(mode === 'compact' ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
        ...(mode === 'whole' ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
      });
    } catch {
      formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    }
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatMoney(
  cents: number,
  currency = 'USD',
  locale = 'en-US',
  options: { compact?: boolean; signed?: boolean; whole?: boolean } = {},
): string {
  // "whole" drops ".00" only when the amount has no cents ($25 instead of $25.00).
  const mode = options.compact ? 'compact' : options.whole && cents % 100 === 0 ? 'whole' : 'full';
  const formatted = getFormatter(currency, locale, mode).format(Math.abs(cents) / 100);
  if (cents < 0) return `-${formatted}`;
  if (options.signed && cents > 0) return `+${formatted}`;
  return formatted;
}

/** Plain decimal string for editing inputs, e.g. 123456 → "1234.56". */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  const value = Math.abs(cents) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return part / whole;
}
