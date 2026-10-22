import { utils } from './utils';
import type {
  BillItem,
  TaxPreset,
  GlobalSummary,
  IndividualBreakdown,
  CalculationResult,
  Transaction,
} from './types';
import type { DBMember } from './useSession';

interface EngineParams {
  items: BillItem[];
  members: DBMember[];
  formattedClaims: Record<string, Record<string, string>>;
  discountType: 'none' | 'percentage' | 'flat';
  discountMode: 'pre-tax' | 'post-tax';
  discountValue: string;
  postTaxDiscountType?: 'none' | 'percentage' | 'flat';
  postTaxDiscountValue?: string;
  taxPresets: TaxPreset[];
  scTaxPresetId: string; // 'none', 'inherit', or a specific UUID
  serviceChargeRate: number;
}

export interface ItemBreakdownResult {
  rawBase: number;
  itemDiscountAmount: number;
  baseAfterItemDiscount: number;
  preTaxBillDiscountShare: number;
  effectiveBase: number;
  itemSC: number;
  itemTaxAmount: number;
  scTaxAmount: number;
  finalTotal: number;
  dynamicTaxRate: number;
  preset: TaxPreset | undefined;
}

export const mathEngine = {
  /**
   * Computes the pre-tax discount multiplier applied to eligible items (applyDiscount !== false)
   * after individual item/section discounts have been subtracted.
   */
  computePreTaxMultiplier: (items: BillItem[], preTaxDiscountAmount: number): number => {
    if (!preTaxDiscountAmount || preTaxDiscountAmount <= 0) return 1;
    const eligibleBaseAfterItemDisc = items.reduce((sum, item) => {
      const discVal = Number(item.discountValue || 0);
      let itemDisc = 0;
      if (item.discountType === 'percentage' && discVal > 0) {
        itemDisc = Math.min(item.totalBase, item.totalBase * (discVal / 100));
      } else if (item.discountType === 'flat' && discVal > 0) {
        itemDisc = Math.min(item.totalBase, discVal);
      }
      const afterItem = Math.max(0, item.totalBase - itemDisc);
      return item.applyDiscount !== false ? sum + afterItem : sum;
    }, 0);

    return eligibleBaseAfterItemDisc > 0
      ? Math.max(0, (eligibleBaseAfterItemDisc - preTaxDiscountAmount) / eligibleBaseAfterItemDisc)
      : 1;
  },
  calculateItemBreakdown: (
    item: BillItem,
    options: {
      taxPresets: TaxPreset[];
      isScApplicable?: boolean;
      serviceChargeRate: number;
      scTaxPresetId: string;
      preTaxMultiplier?: number;
    }
  ): ItemBreakdownResult => {
    const rawBase = item.totalBase;

    // 1. Item-Specific / Section-Specific Discount
    let itemDiscountAmount = 0;
    const itemDiscVal = Number(item.discountValue || 0);
    if (item.discountType === 'percentage' && itemDiscVal > 0) {
      itemDiscountAmount = Math.min(rawBase, rawBase * (itemDiscVal / 100));
    } else if (item.discountType === 'flat' && itemDiscVal > 0) {
      itemDiscountAmount = Math.min(rawBase, itemDiscVal);
    }

    const baseAfterItemDiscount = Math.max(0, rawBase - itemDiscountAmount);

    // 2. Selective Pre-Tax Bill Discount (only scales items with applyDiscount !== false)
    const eligibleForBillPreTax = item.applyDiscount !== false;
    const multiplier = eligibleForBillPreTax ? (options.preTaxMultiplier ?? 1) : 1;
    const effectiveBase = baseAfterItemDiscount * multiplier;
    const preTaxBillDiscountShare = Math.max(0, baseAfterItemDiscount - effectiveBase);

    // 3. Service Charge & Taxes
    const preset = options.taxPresets.find((t) => t.id === item.taxPresetId);
    const dynamicTaxRate = preset ? preset.rate / 100 : 0;

    const scEnabled = options.isScApplicable !== false && options.serviceChargeRate > 0;
    const itemSC = scEnabled && item.applySC ? effectiveBase * options.serviceChargeRate : 0;

    const itemTaxAmount = effectiveBase * dynamicTaxRate;
    let scTaxAmount = 0;

    if (options.scTaxPresetId === 'inherit') {
      scTaxAmount = itemSC * dynamicTaxRate;
    } else if (options.scTaxPresetId !== 'none') {
      const scPreset = options.taxPresets.find((t) => t.id === options.scTaxPresetId);
      if (scPreset && itemSC > 0) {
        scTaxAmount = itemSC * (scPreset.rate / 100);
      }
    }

    return {
      rawBase,
      itemDiscountAmount,
      baseAfterItemDiscount,
      preTaxBillDiscountShare,
      effectiveBase,
      itemSC,
      itemTaxAmount,
      scTaxAmount,
      finalTotal: effectiveBase + itemSC + itemTaxAmount + scTaxAmount,
      dynamicTaxRate,
      preset,
    };
  },

  generateSplit: (params: EngineParams): CalculationResult => {
    const {
      items,
      members,
      formattedClaims,
      discountValue,
      discountType,
      discountMode,
      postTaxDiscountType = 'none',
      postTaxDiscountValue = '',
      taxPresets,
      scTaxPresetId,
      serviceChargeRate,
    } = params;

    const rawSubTotal = items.reduce((sum, item) => sum + item.totalBase, 0);

    // Resolve Pre-Tax vs Post-Tax slots (supports both simultaneous slots AND legacy discountMode)
    const hasExplicitPostTax =
      postTaxDiscountType !== 'none' && (parseFloat(postTaxDiscountValue) || 0) > 0;

    const activePreTaxType =
      discountType !== 'none' && (discountMode === 'pre-tax' || hasExplicitPostTax)
        ? discountType
        : 'none';
    const parsedPreTaxVal = parseFloat(discountValue) || 0;

    const activePostTaxType = hasExplicitPostTax
      ? postTaxDiscountType
      : discountType !== 'none' && discountMode === 'post-tax'
        ? discountType
        : 'none';
    const parsedPostTaxVal = hasExplicitPostTax
      ? parseFloat(postTaxDiscountValue) || 0
      : discountMode === 'post-tax'
        ? parseFloat(discountValue) || 0
        : 0;

    // Step 1: Compute base after per-item discounts & sum eligible base for Pre-Tax bill discount
    let totalItemDiscounts = 0;
    let eligiblePreTaxSubTotal = 0;

    items.forEach((item) => {
      const discVal = Number(item.discountValue || 0);
      let itemDisc = 0;
      if (item.discountType === 'percentage' && discVal > 0) {
        itemDisc = Math.min(item.totalBase, item.totalBase * (discVal / 100));
      } else if (item.discountType === 'flat' && discVal > 0) {
        itemDisc = Math.min(item.totalBase, discVal);
      }
      totalItemDiscounts += itemDisc;
      const afterItem = Math.max(0, item.totalBase - itemDisc);
      if (item.applyDiscount !== false) {
        eligiblePreTaxSubTotal += afterItem;
      }
    });

    // Step 2: Compute Selective Pre-Tax Bill Discount & Multiplier
    let preTaxBillDiscount = 0;
    if (activePreTaxType !== 'none' && parsedPreTaxVal > 0 && eligiblePreTaxSubTotal > 0) {
      preTaxBillDiscount =
        activePreTaxType === 'percentage'
          ? eligiblePreTaxSubTotal * (parsedPreTaxVal / 100)
          : parsedPreTaxVal;
      preTaxBillDiscount = Math.min(preTaxBillDiscount, eligiblePreTaxSubTotal);
    }

    const preTaxMultiplier =
      eligiblePreTaxSubTotal > 0
        ? (eligiblePreTaxSubTotal - preTaxBillDiscount) / eligiblePreTaxSubTotal
        : 1;

    const globalSummary: GlobalSummary = {
      totalQty: 0,
      rawSubTotal,
      itemDiscountAmount: utils.round2(totalItemDiscounts),
      preTaxDiscountAmount: utils.round2(preTaxBillDiscount),
      postTaxDiscountAmount: 0,
      discountAmount: 0,
      discountMode,
      subTotal: 0,
      taxBreakdown: {},
      serviceCharge: 0,
      roundOff: 0,
      grandTotal: 0,
    };

    const addTaxToBreakdown = (
      preset: TaxPreset | undefined,
      amount: number,
      fallbackName: string
    ) => {
      if (amount <= 0) return;
      if (preset) {
        if (preset.split) {
          const names = utils.getSplitNames(preset.name);
          globalSummary.taxBreakdown[names.cgst] =
            (globalSummary.taxBreakdown[names.cgst] || 0) + amount / 2;
          globalSummary.taxBreakdown[names.sgst] =
            (globalSummary.taxBreakdown[names.sgst] || 0) + amount / 2;
        } else {
          globalSummary.taxBreakdown[preset.name] =
            (globalSummary.taxBreakdown[preset.name] || 0) + amount;
        }
      } else {
        globalSummary.taxBreakdown[fallbackName] =
          (globalSummary.taxBreakdown[fallbackName] || 0) + amount;
      }
    };

    // Step 3: Master Bill Calculation across all items
    items.forEach((item) => {
      const breakdown = mathEngine.calculateItemBreakdown(item, {
        taxPresets,
        serviceChargeRate,
        scTaxPresetId,
        preTaxMultiplier,
      });

      if (scTaxPresetId === 'inherit') {
        addTaxToBreakdown(
          breakdown.preset,
          breakdown.itemTaxAmount + breakdown.scTaxAmount,
          'Other Tax'
        );
      } else {
        addTaxToBreakdown(breakdown.preset, breakdown.itemTaxAmount, 'Other Tax');
        if (scTaxPresetId !== 'none' && breakdown.scTaxAmount > 0) {
          const scPreset = taxPresets.find((t) => t.id === scTaxPresetId);
          addTaxToBreakdown(scPreset, breakdown.scTaxAmount, 'S.C. Tax');
        }
      }

      globalSummary.totalQty += item.qty;
      globalSummary.subTotal += breakdown.effectiveBase;
      globalSummary.serviceCharge += breakdown.itemSC;
    });

    const grossTotal =
      globalSummary.subTotal +
      globalSummary.serviceCharge +
      Object.values(globalSummary.taxBreakdown).reduce((a, b) => a + b, 0);

    // Step 4: Post-Tax Bill/Coupon Discount
    let postTaxDiscount = 0;
    if (activePostTaxType !== 'none' && parsedPostTaxVal > 0 && grossTotal > 0) {
      postTaxDiscount =
        activePostTaxType === 'percentage'
          ? grossTotal * (parsedPostTaxVal / 100)
          : parsedPostTaxVal;
      postTaxDiscount = Math.min(postTaxDiscount, grossTotal);
    }

    globalSummary.postTaxDiscountAmount = utils.round2(postTaxDiscount);
    globalSummary.discountAmount = utils.round2(
      totalItemDiscounts + preTaxBillDiscount + postTaxDiscount
    );

    // Step 5: POS Round-Off
    const finalRawTotal = grossTotal - postTaxDiscount;
    const roundedGrandTotal = Math.round(finalRawTotal);
    globalSummary.roundOff = utils.round2(roundedGrandTotal - finalRawTotal);
    globalSummary.grandTotal = roundedGrandTotal;

    const distributionMultiplier = grossTotal > 0 ? roundedGrandTotal / grossTotal : 1;

    // Step 6: Individual Debt Calculation
    const individualBreakdowns: Record<string, IndividualBreakdown> = {};

    members.forEach((member) => {
      let subtotal = 0;
      let totalScAmount = 0;
      const consumedItems: { name: string; qtyString: string; cost: number }[] = [];

      items.forEach((item) => {
        const consumedQty = utils.parseQty(formattedClaims[member.id]?.[item.id] || '');
        if (consumedQty > 0) {
          const shareRatio = consumedQty / item.qty;
          const itemBreakdown = mathEngine.calculateItemBreakdown(item, {
            taxPresets,
            serviceChargeRate,
            scTaxPresetId,
            preTaxMultiplier,
          });

          const effectiveBaseShare = itemBreakdown.effectiveBase * shareRatio;
          const itemTaxShare = itemBreakdown.itemTaxAmount * shareRatio;
          const scShare = itemBreakdown.itemSC * shareRatio;
          const scTaxShare = itemBreakdown.scTaxAmount * shareRatio;

          const finalCostShare = utils.round2(effectiveBaseShare + itemTaxShare);
          subtotal = utils.round2(subtotal + finalCostShare);
          totalScAmount = utils.round2(totalScAmount + scShare + scTaxShare);

          consumedItems.push({
            name: item.name,
            qtyString: formattedClaims[member.id]?.[item.id] || consumedQty.toString(),
            cost: finalCostShare,
          });
        }
      });

      individualBreakdowns[member.id] = {
        memberId: member.id,
        memberName: member.name,
        subtotal,
        serviceCharge: totalScAmount,
        totalOwed: utils.round2((subtotal + totalScAmount) * distributionMultiplier),
        items: consumedItems,
      };
    });

    // Step 7: Paisa Conservation Pass
    const activeIds = Object.keys(individualBreakdowns).filter(
      (id) => individualBreakdowns[id].totalOwed > 0
    );
    const totalClaimedOwed = utils.round2(
      activeIds.reduce((sum, id) => sum + individualBreakdowns[id].totalOwed, 0)
    );
    const drift = utils.round2(globalSummary.grandTotal - totalClaimedOwed);
    if (activeIds.length > 0 && Math.abs(drift) > 0 && Math.abs(drift) <= 0.05) {
      const largestShareId = activeIds.reduce((a, b) =>
        individualBreakdowns[a].totalOwed >= individualBreakdowns[b].totalOwed ? a : b
      );
      individualBreakdowns[largestShareId].totalOwed = utils.round2(
        individualBreakdowns[largestShareId].totalOwed + drift
      );
    }

    return { individualBreakdowns, globalSummary };
  },

  generateTransactions: (members: DBMember[], breakdowns: Record<string, IndividualBreakdown>) => {
    const balances = members.map((m) => ({
      ...m,
      balance:
        (m.paid_amount || 0) - (breakdowns[m.id]?.totalOwed ?? breakdowns[m.name]?.totalOwed ?? 0),
    }));
    const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
    const creditors = balances
      .filter((b) => b.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);
    const transactions: Transaction[] = [];
    let d = 0,
      c = 0;
    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d],
        creditor = creditors[c];
      const amount = Math.min(-debtor.balance, creditor.balance);
      transactions.push({
        creditor_id: creditor.user_id || null,
        creditor_name: creditor.name,
        debtor_id: debtor.user_id || null,
        debtor_name: debtor.name,
        amount: utils.round2(amount),
      });
      debtors[d].balance += amount;
      creditors[c].balance -= amount;
      if (Math.abs(debtors[d].balance) < 0.01) d++;
      if (Math.abs(creditors[c].balance) < 0.01) c++;
    }
    return transactions;
  },
};
