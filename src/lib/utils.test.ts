import { describe, it, expect } from 'vitest';
import { utils } from './utils';

describe('Calculation Utilities', () => {
  it('correctly parses whole numbers and decimals', () => {
    expect(utils.parseQty('2')).toBe(2);
    expect(utils.parseQty('0.75')).toBe(0.75);
  });

  it('correctly parses fractional strings', () => {
    expect(utils.parseQty('1/2')).toBe(0.5);
    expect(utils.parseQty('1/3')).toBeCloseTo(0.3333, 4);
  });

  it('correctly parses mixed fractions', () => {
    expect(utils.parseQty('1 1/2')).toBe(1.5);
    expect(utils.parseQty('2 3/4')).toBe(2.75);
  });

  it('generates correct fractional display strings for quick splits', () => {
    expect(utils.getFractionString(1, 2)).toBe('1/2');
    expect(utils.getFractionString(3, 2)).toBe('1 1/2');
  });

  it('splits GST into CGST and SGST accurately', () => {
    const split = utils.getSplitNames('Food GST');
    expect(split.cgst).toBe('Food CGST');
    expect(split.sgst).toBe('Food SGST');
  });

  it('nets bilateral balances across registered users and guests accurately', () => {
    const owedToMe = [
      {
        debtor_id: 'u-rahul',
        debtor_name: 'Rahul',
        creditor_id: 'u-me',
        creditor_name: 'Lakshit',
        total_owed: 850,
      },
      {
        debtor_id: null,
        debtor_name: 'Manish',
        creditor_id: 'u-me',
        creditor_name: 'Lakshit',
        total_owed: 400,
      },
      {
        debtor_id: 'u-even',
        debtor_name: 'Trisha',
        creditor_id: 'u-me',
        creditor_name: 'Lakshit',
        total_owed: 500,
      },
    ];

    const iOwe = [
      {
        debtor_id: 'u-me',
        debtor_name: 'Lakshit',
        creditor_id: 'u-rahul',
        creditor_name: 'Rahul',
        total_owed: 350,
      },
      {
        debtor_id: 'u-me',
        debtor_name: 'Lakshit',
        creditor_id: null,
        creditor_name: 'manish ',
        total_owed: 650,
      },
      {
        debtor_id: 'u-me',
        debtor_name: 'Lakshit',
        creditor_id: 'u-even',
        creditor_name: 'Trisha',
        total_owed: 500,
      },
    ];

    const netted = utils.netBilateralBalances(owedToMe, iOwe);

    // Rahul: 850 owed to me - 350 I owe = +500 net owed to me
    expect(netted.netOwedToMe).toHaveLength(1);
    expect(netted.netOwedToMe[0].counterpartyName).toBe('Rahul');
    expect(netted.netOwedToMe[0].netAmount).toBe(500);
    expect(netted.netOwedToMe[0].hasOpposing).toBe(true);

    // Manish (guest): 400 owed to me - 650 I owe = -250 net I owe
    expect(netted.netIOwe).toHaveLength(1);
    expect(netted.netIOwe[0].counterpartyName).toBe('Manish');
    expect(netted.netIOwe[0].netAmount).toBe(250);
    expect(netted.netIOwe[0].hasOpposing).toBe(true);

    // Trisha: 500 - 500 = 0 (mutually offset candidate)
    expect(netted.zeroedCounterparties).toHaveLength(1);
    expect(netted.zeroedCounterparties[0].counterpartyId).toBe('u-even');

    expect(netted.totalOwedToMe).toBe(500);
    expect(netted.totalIOwe).toBe(250);
  });

  it('builds a valid UPI deep link URI', () => {
    const uri = utils.buildUpiUrl({
      upiId: 'lakshit@okaxis',
      payeeName: 'Lakshit Dutta',
      amount: 1379.5,
      note: 'Toit Split',
    });
    expect(uri).toBe(
      'upi://pay?pa=lakshit%40okaxis&pn=Lakshit%20Dutta&am=1379.50&cu=INR&tn=Toit%20Split'
    );
  });
});
