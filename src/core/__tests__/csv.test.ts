import { describe, expect, it } from 'vitest';

import { analyzeCSV, detectDateOrder, extractRows, importHashes, parseCSV, parseDate, toCSV } from '../csv';
import { parseAmount } from '../money';

function importAll(text: string) {
  const a = analyzeCSV(text);
  expect(a.mapping).not.toBeNull();
  return { analysis: a, ...extractRows(a, a.mapping!, a.dateOrder, a.expenseSign) };
}

describe('parseCSV', () => {
  it('handles quotes, escaped quotes, CRLF and BOM', () => {
    const rows = parseCSV('﻿a,b,c\r\n"1,5","say ""hi""",x\r\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1,5', 'say "hi"', 'x'],
    ]);
  });
  it('detects semicolon-separated files', () => {
    expect(parseCSV('Fecha;Concepto;Importe\n01/02/2026;Mercado;-12,50')[1]).toEqual(['01/02/2026', 'Mercado', '-12,50']);
  });
  it('round-trips through toCSV', () => {
    const data = [['date', 'desc'], ['2026-01-01', 'Coffee, "large"']];
    expect(parseCSV(toCSV(data))).toEqual(data);
  });
});

describe('parseAmount', () => {
  it.each([
    ['123.45', 12345],
    ['-123.45', -12345],
    ['$1,234.56', 123456],
    ['(45.00)', -4500],
    ['45.00-', -4500],
    ['1.234,56', 123456],
    ['12,5', 1250],
    ['1,234', 123400],
    ['USD 10', 1000],
    ['-$5.10', -510],
    ['20.00 CR', 2000],
    ['', null],
    ['abc', null],
  ])('%s → %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('dates', () => {
  it('parses common bank formats', () => {
    expect(parseDate('03/15/2026')).toBe('2026-03-15');
    expect(parseDate('3/5/26')).toBe('2026-03-05');
    expect(parseDate('2026-03-15')).toBe('2026-03-15');
    expect(parseDate('15/03/2026', 'DMY')).toBe('2026-03-15');
    expect(parseDate('Mar 15, 2026')).toBe('2026-03-15');
    expect(parseDate('15-Mar-2026')).toBe('2026-03-15');
    expect(parseDate('02/30/2026')).toBeNull();
  });
  it('detects day-first files', () => {
    expect(detectDateOrder(['01/02/2026', '25/02/2026'])).toBe('DMY');
    expect(detectDateOrder(['01/02/2026', '02/25/2026'])).toBe('MDY');
    expect(detectDateOrder(['01/02/2026'], 'DMY')).toBe('DMY');
  });
});

describe('bank formats', () => {
  it('Chase credit card (purchases negative, payments positive)', () => {
    const csv = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '03/14/2026,03/15/2026,STARBUCKS STORE 12345,Food & Drink,Sale,-6.45,',
      '03/12/2026,03/13/2026,AMAZON MKTPL*2K3,Shopping,Sale,-45.99,',
      '03/10/2026,03/10/2026,Payment Thank You-Mobile,,Payment,500.00,',
    ].join('\n');
    const { rows, analysis } = importAll(csv);
    expect(analysis.expenseSign).toBe('negative');
    expect(analysis.mapping).toMatchObject({ date: 0, description: 2, amount: 5 });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-03-14', amount: 645, direction: 'out' });
    expect(rows[2]).toMatchObject({ amount: 50_000, direction: 'in' });
  });

  it('Amex / Discover (charges positive)', () => {
    const csv = [
      'Date,Description,Amount',
      '03/01/2026,NETFLIX.COM,15.49',
      '03/03/2026,SHELL OIL 5744,40.00',
      '03/05/2026,UBER TRIP,12.30',
      '03/09/2026,AUTOPAY PAYMENT - THANK YOU,-300.00',
    ].join('\n');
    const { rows, analysis } = importAll(csv);
    expect(analysis.expenseSign).toBe('positive');
    expect(rows.filter((r) => r.direction === 'out')).toHaveLength(3);
    expect(rows[3].direction).toBe('in');
  });

  it('Capital One (separate debit / credit columns)', () => {
    const csv = [
      'Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit',
      '2026-03-02,2026-03-03,1234,KROGER #123,Groceries,82.10,',
      '2026-03-05,2026-03-05,1234,CAPITAL ONE MOBILE PYMT,Payment/Credit,,250.00',
    ].join('\n');
    const { rows, analysis } = importAll(csv);
    expect(analysis.mapping).toMatchObject({ date: 0, description: 3, amount: null, debit: 5, credit: 6 });
    expect(rows).toEqual([
      expect.objectContaining({ date: '2026-03-02', amount: 8210, direction: 'out' }),
      expect.objectContaining({ date: '2026-03-05', amount: 25_000, direction: 'in' }),
    ]);
  });

  it('Bank of America checking (summary block before the header)', () => {
    const csv = [
      'Description,,Summary Amt.',
      'Beginning balance as of 03/01/2026,,"1,000.00"',
      'Total credits,,"2,000.00"',
      '',
      'Date,Description,Amount,Running Bal.',
      '03/01/2026,Beginning balance as of 03/01/2026,,"1,000.00"',
      '03/02/2026,"ACME CORP DES:PAYROLL ID:123","2,000.00","3,000.00"',
      '03/03/2026,"DUKE ENERGY DES:ONLINE PMT","-120.55","2,879.45"',
      '03/04/2026,"WAL-MART #1234","-60.00","2,819.45"',
      '03/05/2026,"ZELLE TO LANDLORD","-900.00","1,919.45"',
    ].join('\n');
    const { rows, skipped, analysis } = importAll(csv);
    // Blank lines are dropped, so the header is the 4th parsed row.
    expect(analysis.headerRow).toBe(3);
    expect(analysis.mapping).toMatchObject({ amount: 2 });
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ amount: 200_000, direction: 'in' });
  });

  it('Wells Fargo (no header row)', () => {
    const csv = [
      '"03/14/2026","-45.67","*","","PURCHASE AUTHORIZED ON 03/13 TARGET T-1234 HOUSTON TX"',
      '"03/15/2026","1500.00","*","","DIRECT DEP ACME PAYROLL"',
      '"03/16/2026","-9.99","*","","RECURRING PAYMENT AUTHORIZED ON 03/15 SPOTIFY USA"',
    ].join('\n');
    const { rows, analysis } = importAll(csv);
    expect(analysis.headerRow).toBeNull();
    expect(analysis.mapping).toMatchObject({ date: 0, amount: 1, description: 4 });
    expect(rows.map((r) => r.direction)).toEqual(['out', 'in', 'out']);
  });

  it('Spanish bank with Cargo / Abono columns and day-first dates', () => {
    const csv = ['Fecha;Concepto;Cargo;Abono;Saldo', '25/02/2026;OXXO;150,00;;1.000,00', '26/02/2026;NOMINA;;12.000,00;13.000,00'].join('\n');
    const { rows, analysis } = importAll(csv);
    expect(analysis.dateOrder).toBe('DMY');
    expect(rows[0]).toMatchObject({ date: '2026-02-25', amount: 15_000, direction: 'out' });
    expect(rows[1]).toMatchObject({ date: '2026-02-26', amount: 1_200_000, direction: 'in' });
  });
});

describe('importHashes', () => {
  it('distinguishes identical rows in one file but is stable across imports', () => {
    const rows = [
      { line: 1, date: '2026-03-01', description: 'COFFEE', amount: 500, direction: 'out' as const },
      { line: 2, date: '2026-03-01', description: 'COFFEE', amount: 500, direction: 'out' as const },
    ];
    const a = importHashes(rows);
    expect(a[0]).not.toBe(a[1]);
    expect(importHashes(rows)).toEqual(a);
  });
});
