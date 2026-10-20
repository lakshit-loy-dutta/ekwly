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

    expect(netted.netOwedToMe).toHaveLength(1);
    expect(netted.netOwedToMe[0].counterpartyName).toBe('Rahul');
    expect(netted.netOwedToMe[0].netAmount).toBe(500);
    expect(netted.netOwedToMe[0].hasOpposing).toBe(true);

    expect(netted.netIOwe).toHaveLength(1);
    expect(netted.netIOwe[0].counterpartyName).toBe('Manish');
    expect(netted.netIOwe[0].netAmount).toBe(250);
    expect(netted.netIOwe[0].hasOpposing).toBe(true);

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

  it('computes Friendship Dossier shared outing count and favorite venue accurately', () => {
    const sharedSessions = [
      {
        id: 's1',
        name: 'Friday Night',
        venue_name: 'Toit Brewpub',
        created_at: '2026-10-01T18:00:00Z',
      },
      {
        id: 's2',
        name: null,
        venue_name: 'Chin Lung Resto Bar',
        created_at: '2026-10-05T19:00:00Z',
      },
      {
        id: 's3',
        name: 'Sunday Beers',
        venue_name: 'toit brewpub',
        created_at: '2026-10-12T20:00:00Z',
      },
    ];

    const stats = utils.computeFriendDossierStats(sharedSessions);
    expect(stats.sharedSessionCount).toBe(3);
    expect(stats.favoriteVenue?.toLowerCase()).toBe('toit brewpub');
    expect(stats.recentSessions[0].id).toBe('s3');
  });
});
