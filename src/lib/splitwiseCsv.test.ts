import { describe, it, expect } from 'vitest';
import { splitwiseCsv } from './splitwiseCsv';

describe('Splitwise CSV Importer', () => {
  const sampleCsvWithTotal = [
    'Date,Description,Category,Cost,Currency,Lakshit,Rahul,Priya',
    '2026-10-01,Toit Brewpub,Dining out,3000.00,INR,2000.00,-1000.00,-1000.00',
    '2026-10-05,Cab Ride,Transport,600.00,INR,-200.00,400.00,-200.00',
    '2026-10-10,Total balance, , ,INR,1800.00,-600.00,-1200.00',
  ].join('\n');

  it('parses Total balance row and extracts pairwise debts for the current user', () => {
    const parsed = splitwiseCsv.parse(sampleCsvWithTotal);
    expect(parsed.people).toEqual(['Lakshit', 'Rahul', 'Priya']);
    expect(parsed.netBalances['Lakshit']).toBe(1800);
    expect(parsed.netBalances['Rahul']).toBe(-600);
    expect(parsed.netBalances['Priya']).toBe(-1200);

    const debts = splitwiseCsv.extractUserDebts(parsed.netBalances, 'Lakshit');
    expect(debts).toEqual([
      { counterpartyName: 'Priya', direction: 'owed_to_me', amount: 1200 },
      { counterpartyName: 'Rahul', direction: 'owed_to_me', amount: 600 },
    ]);
  });

  it('sums expense rows when Total balance row is absent', () => {
    const rawRowsOnly = sampleCsvWithTotal.split('\n').slice(0, 3).join('\n');
    const parsed = splitwiseCsv.parse(rawRowsOnly);
    expect(parsed.netBalances['Lakshit']).toBe(1800);
    expect(parsed.netBalances['Rahul']).toBe(-600);
    expect(parsed.netBalances['Priya']).toBe(-1200);
  });
});
