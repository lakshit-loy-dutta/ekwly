import { describe, it, expect } from 'vitest';
import { mathEngine } from './mathEngine';
import type { BillItem, TaxPreset } from './types';
import type { DBMember } from './useSession';

describe('Universal Tax & Settlement Engine', () => {
  const members: DBMember[] = [
    { id: 'm1', session_id: 's1', name: 'Alice', paid_amount: 4138 },
    { id: 'm2', session_id: 's1', name: 'Bob', paid_amount: 0 },
    { id: 'm3', session_id: 's1', name: 'Charlie', paid_amount: 0 },
  ];

  const taxPresets: TaxPreset[] = [
    { id: 'gst-5', name: 'Food GST', rate: 5, split: true },
    { id: 'vat-6', name: 'Alcohol VAT', rate: 6, split: false },
    { id: 'tob-40', name: 'Tobacco GST', rate: 40, split: true },
    { id: 'exempt', name: 'Exempt', rate: 0, split: false },
  ];

  it('accurately computes Model A (TBC 66 Guwahati cascading SC + tax) & round-off', () => {
    const items: BillItem[] = [
      {
        id: 'i1',
        name: 'Spring Water',
        qty: 1,
        unitPrice: 65,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: true,
        totalBase: 65,
      },
      {
        id: 'i2',
        name: 'Tikka Platter',
        qty: 1,
        unitPrice: 895,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: true,
        totalBase: 895,
      },
      {
        id: 'i3',
        name: 'Godfather Tower',
        qty: 1,
        unitPrice: 1599,
        taxRate: 0,
        taxPresetId: 'vat-6',
        applySC: true,
        totalBase: 1599,
      },
      {
        id: 'i4',
        name: 'Godfather Pitcher',
        qty: 1,
        unitPrice: 999,
        taxRate: 0,
        taxPresetId: 'vat-6',
        applySC: true,
        totalBase: 999,
      },
    ];

    const formattedClaims = {
      m1: { i1: '1/3', i2: '1/3', i3: '1/3', i4: '1/3' },
      m2: { i1: '1/3', i2: '1/3', i3: '1/3', i4: '1/3' },
      m3: { i1: '1/3', i2: '1/3', i3: '1/3', i4: '1/3' },
    };

    const result = mathEngine.generateSplit({
      items,
      members,
      formattedClaims,
      discountType: 'none',
      discountMode: 'post-tax',
      discountValue: '',
      taxPresets,
      scTaxPresetId: 'inherit',
      serviceChargeRate: 0.1,
    });

    expect(result.globalSummary.subTotal).toBe(3558);
    expect(result.globalSummary.serviceCharge).toBeCloseTo(355.8, 2);
    expect(result.globalSummary.taxBreakdown['Food CGST']).toBeCloseTo(26.4, 2);
    expect(result.globalSummary.taxBreakdown['Food SGST']).toBeCloseTo(26.4, 2);
    expect(result.globalSummary.taxBreakdown['Alcohol VAT']).toBeCloseTo(171.47, 2);
    expect(result.globalSummary.roundOff).toBe(-0.07);
    expect(result.globalSummary.grandTotal).toBe(4138);

    const sumOwed = Object.values(result.individualBreakdowns).reduce(
      (sum, b) => sum + b.totalOwed,
      0
    );
    expect(sumOwed).toBeCloseTo(4138, 2);
  });

  it('accurately computes Model B (Chin Lung independent SC taxed under Food GST)', () => {
    const items: BillItem[] = [
      {
        id: 'c1',
        name: 'Crispy Corn',
        qty: 1,
        unitPrice: 175,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: true,
        totalBase: 175,
      },
      {
        id: 'c2',
        name: 'Red Bull',
        qty: 1,
        unitPrice: 200,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: true,
        totalBase: 200,
      },
      {
        id: 'c3',
        name: 'Smirnoff',
        qty: 2,
        unitPrice: 299,
        taxRate: 0,
        taxPresetId: 'exempt',
        applySC: true,
        totalBase: 598,
      },
      {
        id: 'c4',
        name: 'Classic LIIT',
        qty: 1,
        unitPrice: 449,
        taxRate: 0,
        taxPresetId: 'exempt',
        applySC: true,
        totalBase: 449,
      },
      {
        id: 'c5',
        name: 'Ice Burst Smokes',
        qty: 1,
        unitPrice: 260,
        taxRate: 0,
        taxPresetId: 'tob-40',
        applySC: true,
        totalBase: 260,
      },
      {
        id: 'c6',
        name: 'LIIT Pitcher',
        qty: 1,
        unitPrice: 1450,
        taxRate: 0,
        taxPresetId: 'exempt',
        applySC: true,
        totalBase: 1450,
      },
    ];

    const formattedClaims = {
      m1: { c1: '1', c2: '1', c3: '2', c4: '1', c5: '1', c6: '1' },
    };

    const result = mathEngine.generateSplit({
      items,
      members: [members[0]],
      formattedClaims,
      discountType: 'none',
      discountMode: 'post-tax',
      discountValue: '',
      taxPresets,
      scTaxPresetId: 'gst-5',
      serviceChargeRate: 0.05,
    });

    expect(result.globalSummary.subTotal).toBe(3132);
    expect(result.globalSummary.serviceCharge).toBeCloseTo(156.6, 2);
    expect(result.globalSummary.taxBreakdown['Food CGST']).toBeCloseTo(13.29, 2);
    expect(result.globalSummary.taxBreakdown['Food SGST']).toBeCloseTo(13.29, 2);
    expect(result.globalSummary.taxBreakdown['Tobacco CGST']).toBeCloseTo(52, 2);
    expect(result.globalSummary.taxBreakdown['Tobacco SGST']).toBeCloseTo(52, 2);
    expect(result.globalSummary.grandTotal).toBe(3419);
  });

  it('scales item breakdown accurately when a pre-tax discount multiplier is active', () => {
    const item: BillItem = {
      id: 'd1',
      name: 'Woodfired Pizza',
      qty: 1,
      unitPrice: 1000,
      taxRate: 0,
      taxPresetId: 'gst-5',
      applySC: true,
      totalBase: 1000,
    };

    const breakdown = mathEngine.calculateItemBreakdown(item, {
      taxPresets,
      isScApplicable: true,
      serviceChargeRate: 0.1,
      scTaxPresetId: 'inherit',
      preTaxMultiplier: 0.8,
    });

    expect(breakdown.effectiveBase).toBe(800);
    expect(breakdown.itemSC).toBe(80);
    expect(breakdown.itemTaxAmount).toBe(40);
    expect(breakdown.scTaxAmount).toBe(4);
    expect(breakdown.finalTotal).toBe(924);
  });

  it('handles simultaneous Item-Specific + Selective Pre-Tax (Food only) + Post-Tax Coupon discounts', () => {
    const items: BillItem[] = [
      {
        id: 'f1',
        name: 'Starter Platter (Food)',
        qty: 1,
        unitPrice: 1000,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: false,
        applyDiscount: true, // Eligible for 10% restaurant pre-tax discount -> 900
        discountType: 'none',
        discountValue: 0,
        totalBase: 1000,
      },
      {
        id: 'f2',
        name: 'Chocolate Brownie (50% Happy Hour + 10% Pre-Tax)',
        qty: 1,
        unitPrice: 400,
        taxRate: 0,
        taxPresetId: 'gst-5',
        applySC: false,
        applyDiscount: true, // 400 - 50% item disc = 200; then -10% pre-tax = 180
        discountType: 'percentage',
        discountValue: 50,
        totalBase: 400,
      },
      {
        id: 'b1',
        name: 'Craft Beer Pitcher (Excluded from Pre-Tax Discount)',
        qty: 1,
        unitPrice: 1000,
        taxRate: 0,
        taxPresetId: 'vat-6',
        applySC: false,
        applyDiscount: false, // Excluded from food discount -> stays 1000
        discountType: 'none',
        discountValue: 0,
        totalBase: 1000,
      },
    ];

    const formattedClaims = {
      m1: { f1: '1', f2: '1', b1: '0' }, // Alice ate only Food & Dessert
      m2: { f1: '0', f2: '0', b1: '1' }, // Bob drank only the Beer
    };

    const result = mathEngine.generateSplit({
      items,
      members: [members[0], members[1]],
      formattedClaims,
      discountType: 'percentage',
      discountMode: 'pre-tax',
      discountValue: '10', // 10% Pre-Tax on eligible Food items
      postTaxDiscountType: 'flat',
      postTaxDiscountValue: '114', // ₹114 Flat Swiggy Dineout coupon post-tax
      taxPresets,
      scTaxPresetId: 'none',
      serviceChargeRate: 0,
    });

    // Item discount = 200 (on Brownie)
    expect(result.globalSummary.itemDiscountAmount).toBe(200);
    // Eligible pre-tax base = 1000 + 200 = 1200 -> 10% pre-tax discount = 120
    expect(result.globalSummary.preTaxDiscountAmount).toBe(120);
    // Effective SubTotal = 900 (Starter) + 180 (Brownie) + 1000 (Beer) = 2080
    expect(result.globalSummary.subTotal).toBe(2080);
    // Food GST (5% on 1080 = 54 -> 27 CGST + 27 SGST), Alcohol VAT (6% on 1000 = 60)
    expect(result.globalSummary.taxBreakdown['Food CGST']).toBeCloseTo(27, 2);
    expect(result.globalSummary.taxBreakdown['Food SGST']).toBeCloseTo(27, 2);
    expect(result.globalSummary.taxBreakdown['Alcohol VAT']).toBeCloseTo(60, 2);
    // Gross Total = 2080 + 54 + 60 = 2194; minus ₹114 Post-Tax coupon = 2080
    expect(result.globalSummary.postTaxDiscountAmount).toBe(114);
    expect(result.globalSummary.grandTotal).toBe(2080);

    // Sum of Alice + Bob shares must equal 2080 to the exact paisa
    const totalShares =
      result.individualBreakdowns['m1'].totalOwed + result.individualBreakdowns['m2'].totalOwed;
    expect(totalShares).toBe(2080);
  });
});
