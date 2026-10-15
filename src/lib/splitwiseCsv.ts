import { utils } from './utils';

export interface SplitwiseParseResult {
  people: string[];
  netBalances: Record<string, number>;
  currency: string;
}

export interface ImportedDebtRow {
  counterpartyName: string;
  direction: 'owed_to_me' | 'i_owe';
  amount: number;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export const splitwiseCsv = {
  parse(csvText: string): SplitwiseParseResult {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error('CSV file is empty or missing expense rows.');
    }

    const headers = parseCsvLine(lines[0]);
    const currencyIdx = headers.findIndex((h) => /^currency\$/i.test(h));
    if (currencyIdx === -1 || currencyIdx >= headers.length - 1) {
      throw new Error('Invalid Splitwise CSV format: Missing Currency or member columns.');
    }

    const people = headers.slice(currencyIdx + 1).filter(Boolean);
    if (people.length < 2) {
      throw new Error('Splitwise CSV must contain at least 2 people.');
    }

    const netBalances: Record<string, number> = {};
    people.forEach((p) => (netBalances[p] = 0));
    let detectedCurrency = 'INR';

    // Check if Splitwise included a final "Total balance" summary row
    const totalRowLine = lines.slice(1).find((line) => /^[^,]*,\s*"?total balance"?/i.test(line));

    if (totalRowLine) {
      const cols = parseCsvLine(totalRowLine);
      if (cols[currencyIdx]) detectedCurrency = cols[currencyIdx];
      people.forEach((person, idx) => {
        const val = parseFloat(cols[currencyIdx + 1 + idx] || '0');
        netBalances[person] = utils.round2(isNaN(val) ? 0 : val);
      });
    } else {
      // Otherwise sum all individual expense rows
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length <= currencyIdx + 1) continue;
        if (cols[currencyIdx]) detectedCurrency = cols[currencyIdx];

        people.forEach((person, idx) => {
          const val = parseFloat(cols[currencyIdx + 1 + idx] || '0');
          if (!isNaN(val)) {
            netBalances[person] = utils.round2(netBalances[person] + val);
          }
        });
      }
    }

    return { people, netBalances, currency: detectedCurrency };
  },

  /**
   * Runs greedy settlement across all group members' net balances and returns
   * only the transactions involving the selected `selfName`.
   */
  extractUserDebts(netBalances: Record<string, number>, selfName: string): ImportedDebtRow[] {
    const debtors = Object.entries(netBalances)
      .filter(([, bal]) => bal < -0.01)
      .map(([name, bal]) => ({ name, balance: bal }))
      .sort((a, b) => a.balance - b.balance);

    const creditors = Object.entries(netBalances)
      .filter(([, bal]) => bal > 0.01)
      .map(([name, bal]) => ({ name, balance: bal }))
      .sort((a, b) => b.balance - a.balance);

    const userDebts: ImportedDebtRow[] = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];
      const amount = utils.round2(Math.min(-debtor.balance, creditor.balance));

      if (amount > 0.01) {
        if (creditor.name === selfName && debtor.name !== selfName) {
          userDebts.push({
            counterpartyName: debtor.name,
            direction: 'owed_to_me',
            amount,
          });
        } else if (debtor.name === selfName && creditor.name !== selfName) {
          userDebts.push({
            counterpartyName: creditor.name,
            direction: 'i_owe',
            amount,
          });
        }
      }

      debtor.balance += amount;
      creditor.balance -= amount;
      if (Math.abs(debtor.balance) < 0.01) d++;
      if (Math.abs(creditor.balance) < 0.01) c++;
    }

    return userDebts;
  },
};
