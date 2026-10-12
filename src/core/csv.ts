// Bank / credit card statement import. Every US bank (Chase, Bank of America,
// Wells Fargo, Capital One, Citi, Amex, Discover...) lets you download
// transactions as CSV, which is the fastest private way to capture expenses
// that are almost all digital.

import { makeISODate } from './dates';
import { parseAmount } from './money';

export type DateOrder = 'MDY' | 'DMY' | 'YMD';
/** How outflows (expenses) appear in a single "amount" column. */
export type ExpenseSign = 'negative' | 'positive';

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

export interface CsvAnalysis {
  rows: string[][];
  headerRow: number | null;
  headers: string[];
  mapping: ColumnMapping | null;
  dateOrder: DateOrder;
  expenseSign: ExpenseSign;
}

export interface ImportedRow {
  /** Row index in the original file, for error reporting. */
  line: number;
  date: string;
  description: string;
  /** Positive cents. */
  amount: number;
  direction: 'out' | 'in';
}

export interface ExtractResult {
  rows: ImportedRow[];
  skipped: number;
}

// ---------------------------------------------------------------- parsing --

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20);
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = -1;
  for (const c of candidates) {
    const counts = sample
      .filter((l) => l.trim())
      .map((l) => {
        let n = 0;
        let quoted = false;
        for (const ch of l) {
          if (ch === '"') quoted = !quoted;
          else if (ch === c && !quoted) n++;
        }
        return n;
      });
    if (!counts.length) continue;
    // Prefer delimiters that appear consistently across lines.
    const freq = new Map<number, number>();
    for (const n of counts) if (n > 0) freq.set(n, (freq.get(n) ?? 0) + 1);
    const score = Math.max(0, ...freq.values());
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function parseCSV(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

// ------------------------------------------------------------------ dates --

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

export function parseDate(value: string, order: DateOrder = 'MDY'): string | null {
  const s = value.trim();
  if (!s) return null;

  // ISO-like: 2026-03-15 or 2026/03/15 (time part ignored).
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return makeISODate(+m[1], +m[2], +m[3]);

  // Textual month: "Mar 15, 2026", "15 Mar 2026", "15-mar-26".
  m = s.match(/^([A-Za-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    return makeISODate(expandYear(+m[3]), MONTHS[m[1].toLowerCase()], +m[2]);
  }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,4})[a-z]*\.?[\s-](\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return makeISODate(expandYear(+m[3]), MONTHS[m[2].toLowerCase()], +m[1]);
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = expandYear(+m[3]);
    return order === 'DMY' ? makeISODate(y, b, a) : makeISODate(y, a, b);
  }
  // Compact 20260315
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return makeISODate(+m[1], +m[2], +m[3]);
  return null;
}

/** Looks at many values to decide between month-first and day-first dates. */
export function detectDateOrder(values: string[], fallback: DateOrder = 'MDY'): DateOrder {
  let mdy = 0;
  let dmy = 0;
  for (const v of values) {
    const s = v.trim();
    if (/^\d{4}[-/.]/.test(s)) return 'YMD';
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (!m) continue;
    const a = +m[1];
    const b = +m[2];
    if (a > 12 && b <= 12) dmy++;
    if (b > 12 && a <= 12) mdy++;
  }
  if (dmy > mdy) return 'DMY';
  if (mdy > dmy) return 'MDY';
  return fallback;
}

function looksLikeDate(value: string): boolean {
  return parseDate(value, 'MDY') !== null || parseDate(value, 'DMY') !== null;
}

function looksLikeAmount(value: string): boolean {
  const v = value.trim();
  if (!v || !/\d/.test(v)) return false;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(v)) return false;
  if (/[a-z]{3,}/i.test(v.replace(/usd|mxn|eur|cr|dr/gi, ''))) return false;
  return parseAmount(v) !== null;
}

// ---------------------------------------------------------------- columns --

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreDateHeader(h: string): number {
  if (!/\b(date|fecha|posted|day)\b/.test(h) && !h.includes('date')) return 0;
  if (/\b(trans|transaction|operacion|purchase|compra)\b/.test(h)) return 3;
  if (/\b(post|posted|posting|valor)\b/.test(h)) return 1;
  return 2;
}

function scoreDescriptionHeader(h: string): number {
  if (/^(description|descripcion|transaction description)$/.test(h) || h.includes('description') || h.includes('descripcion')) return 4;
  if (/\b(merchant|payee|comercio|concepto|beneficiario|narrative)\b/.test(h)) return 3;
  if (/\b(name|nombre|detalle)\b/.test(h)) return 2;
  if (/\b(memo|details|reference|referencia)\b/.test(h)) return 1;
  return 0;
}

function isBalanceHeader(h: string): boolean {
  return /\b(balance|bal|saldo|running)\b/.test(h);
}

function scoreAmountHeader(h: string): number {
  if (isBalanceHeader(h)) return 0;
  if (/\b(amount|monto|importe|cantidad|valor|value)\b/.test(h)) return 2;
  return 0;
}

function isDebitHeader(h: string): boolean {
  if (isBalanceHeader(h)) return false;
  return /^(debit|debits|debit amount|withdrawal|withdrawals|withdrawal amount|cargo|cargos|retiro|retiros|money out|paid out|charges?)$/.test(h);
}

function isCreditHeader(h: string): boolean {
  if (isBalanceHeader(h)) return false;
  return /^(credit|credits|credit amount|deposit|deposits|deposit amount|abono|abonos|deposito|depositos|money in|paid in|payments?)$/.test(h);
}

function bestIndex(headers: string[], scorer: (h: string) => number, exclude: Set<number>): number | null {
  let best: number | null = null;
  let bestScore = 0;
  headers.forEach((h, i) => {
    if (exclude.has(i)) return;
    const s = scorer(h);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

function mappingFromHeaders(raw: string[]): ColumnMapping | null {
  const headers = raw.map(norm);
  const used = new Set<number>();
  const date = bestIndex(headers, scoreDateHeader, used);
  if (date === null) return null;
  used.add(date);
  const amount = bestIndex(headers, scoreAmountHeader, used);
  let debit: number | null = null;
  let credit: number | null = null;
  if (amount === null) {
    debit = headers.findIndex((h, i) => !used.has(i) && isDebitHeader(h));
    credit = headers.findIndex((h, i) => !used.has(i) && isCreditHeader(h));
    if (debit < 0) debit = null;
    if (credit < 0) credit = null;
    if (debit === null && credit === null) return null;
  } else {
    used.add(amount);
  }
  if (debit !== null) used.add(debit);
  if (credit !== null) used.add(credit);
  const description = bestIndex(headers, scoreDescriptionHeader, used);
  if (description === null) return null;
  return { date, description, amount, debit, credit };
}

function mappingFromContent(rows: string[][]): ColumnMapping | null {
  const sample = rows.slice(0, 50);
  const width = Math.max(...sample.map((r) => r.length));
  const ratio = (col: number, test: (v: string) => boolean) => {
    const values = sample.map((r) => r[col] ?? '').filter((v) => v !== '');
    if (!values.length) return 0;
    return values.filter(test).length / sample.length;
  };
  let date: number | null = null;
  for (let c = 0; c < width && date === null; c++) if (ratio(c, looksLikeDate) >= 0.8) date = c;
  if (date === null) return null;
  let amount: number | null = null;
  for (let c = 0; c < width && amount === null; c++) {
    if (c !== date && ratio(c, looksLikeAmount) >= 0.8) amount = c;
  }
  if (amount === null) return null;
  let description: number | null = null;
  let bestLen = 0;
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue;
    const avg = sample.reduce((s, r) => s + (r[c]?.length ?? 0), 0) / sample.length;
    if (avg > bestLen) {
      bestLen = avg;
      description = c;
    }
  }
  if (description === null) return null;
  return { date, description, amount, debit: null, credit: null };
}

export function analyzeCSV(text: string, fallbackOrder: DateOrder = 'MDY'): CsvAnalysis {
  const rows = parseCSV(text);
  let headerRow: number | null = null;
  let mapping: ColumnMapping | null = null;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const m = mappingFromHeaders(rows[i]);
    // A header row should not itself contain a date value.
    if (m && !rows[i].some((c) => looksLikeDate(c))) {
      headerRow = i;
      mapping = m;
      break;
    }
  }
  if (!mapping) mapping = mappingFromContent(rows);

  const dataRows = rows.slice(headerRow === null ? 0 : headerRow + 1);
  const dateValues = mapping ? dataRows.map((r) => r[mapping!.date] ?? '') : [];
  const dateOrder = detectDateOrder(dateValues, fallbackOrder);

  let expenseSign: ExpenseSign = 'negative';
  if (mapping && mapping.amount !== null) {
    let neg = 0;
    let pos = 0;
    for (const r of dataRows) {
      const v = parseAmount(r[mapping.amount] ?? '');
      if (v === null || v === 0) continue;
      if (v < 0) neg++;
      else pos++;
    }
    // Most rows in a statement are purchases, so the majority sign is "out".
    expenseSign = pos > neg ? 'positive' : 'negative';
  }

  return {
    rows,
    headerRow,
    headers: headerRow === null ? [] : rows[headerRow],
    mapping,
    dateOrder,
    expenseSign,
  };
}

export function extractRows(
  analysis: Pick<CsvAnalysis, 'rows' | 'headerRow'>,
  mapping: ColumnMapping,
  dateOrder: DateOrder,
  expenseSign: ExpenseSign,
): ExtractResult {
  const out: ImportedRow[] = [];
  let skipped = 0;
  const start = analysis.headerRow === null ? 0 : analysis.headerRow + 1;
  for (let i = start; i < analysis.rows.length; i++) {
    const r = analysis.rows[i];
    const date = parseDate(r[mapping.date] ?? '', dateOrder);
    const description = (r[mapping.description] ?? '').replace(/\s+/g, ' ').trim();
    let signed: number | null = null;

    if (mapping.amount !== null) {
      const v = parseAmount(r[mapping.amount] ?? '');
      if (v !== null) signed = expenseSign === 'negative' ? v : -v;
    } else {
      const debit = mapping.debit !== null ? parseAmount(r[mapping.debit] ?? '') : null;
      const credit = mapping.credit !== null ? parseAmount(r[mapping.credit] ?? '') : null;
      if (debit) signed = -Math.abs(debit);
      else if (credit) signed = Math.abs(credit);
    }

    if (!date || signed === null || signed === 0) {
      skipped++;
      continue;
    }
    out.push({
      line: i + 1,
      date,
      description: description || '—',
      amount: Math.abs(signed),
      direction: signed < 0 ? 'out' : 'in',
    });
  }
  return { rows: out, skipped };
}

// ----------------------------------------------------------------- export --

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => escapeCell(String(c))).join(',')).join('\n');
}

// ------------------------------------------------------------------ dedupe --

/** 53-bit FNV-1a style hash, stable across platforms. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Stable identity for imported rows. Identical rows in the same file (two
 * coffees on the same day) get different occurrence numbers, while importing
 * the same or an overlapping statement again yields the same hashes.
 */
export function importHashes(rows: ImportedRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date}|${r.amount}|${r.direction}|${r.description.toLowerCase().replace(/\s+/g, ' ')}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return hashString(`${base}|${n}`);
  });
}
