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

export interface EngineParams {
  items: BillItem[];
  members: DBMember[];
  formattedClaims: Record<string, Record<string, string>>;
  discountType: 'none' | 'percentage' | 'flat';
  discountMode: 'pre-tax' | 'post-tax';
  discountValue: string;
  postTaxDiscountType?: 'none' | 'percentage' | 'flat';
  postTaxDiscountValue?: string;
  taxPresets: TaxPreset[];
  scTaxPresetId: string; // 'none', 'inherit', or a specific preset UUID
  isScApplicable?: boolean;
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

function computeItemDiscount(item: BillItem): number {
  const rawBase = Math.max(0, item.totalBase);
  const discVal = Number(item.discountValue || 0);
  if (!Number.isFinite(discVal) || discVal <= 0) return 0;

  if (item.discountType === 'percentage') {
    return Math.min(rawBase, rawBase * (discVal / 100));
  }
  if (item.discountType === 'flat') {
    return Math.min(rawBase, discVal);
  }
  return 0;
}

export const mathEngine = {
  /**
   * Computes the pre-tax discount multiplier applied to eligible items (applyDiscount !== false)
   * after individual item/section discounts have been subtracted.
   */
  computePreTaxMultiplier: (items: BillItem[], preTaxDiscountAmount: number): number => {
    if (!Number.isFinite(preTaxDiscountAmount) || preTaxDiscountAmount <= 0) return 1;

    const eligibleBaseAfterItemDisc = items.reduce((sum, item) => {
      const afterItem = Math.max(0, item.totalBase - computeItemDiscount(item));
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
    const rawBase = Math.max(0, item.totalBase);

    // 1. Item-Specific / Section-Specific Discount
    const itemDiscountAmount = computeItemDiscount(item);
    const baseAfterItemDiscount = Math.max(0, rawBase - itemDiscountAmount);

    // 2. Selective Pre-Tax Bill Discount (only scales items with applyDiscount !== false)
    const eligibleForBillPreTax = item.applyDiscount !== false;
    const multiplier = eligibleForBillPreTax ? (options.preTaxMultiplier ?? 1) : 1;
    const effectiveBase = baseAfterItemDiscount * multiplier;
    const preTaxBillDiscountShare = Math.max(0, baseAfterItemDiscount - effectiveBase);

    // 3. Service Charge & Taxes
    const preset = options.taxPresets.find((t) => t.id === item.taxPresetId);
    const dynamicTaxRate = preset ? preset.rate / 100 : 0;
    const safeScRate =
      Number.isFinite(options.serviceChargeRate) && options.serviceChargeRate > 0
        ? options.serviceChargeRate
        : 0;
    const scEnabled = options.isScApplicable !== false && safeScRate > 0;
    const itemSC = scEnabled && item.applySC ? effectiveBase * safeScRate : 0;
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
      isScApplicable,
      serviceChargeRate,
    } = params;

    const effectiveScRate =
      isScApplicable === false || !Number.isFinite(serviceChargeRate) || serviceChargeRate < 0
        ? 0
        : serviceChargeRate;

    const rawSubTotal = items.reduce((sum, item) => sum + Math.max(0, item.totalBase), 0);

    // Resolve Pre-Tax vs Post-Tax slots cleanly (never silently repurposes a legacy post-tax discount as pre-tax)
    const parsedExplicitPostVal = parseFloat(postTaxDiscountValue) || 0;
    const hasExplicitPostTax = postTaxDiscountType !== 'none' && parsedExplicitPostVal > 0;
    const parsedPrimaryVal = parseFloat(discountValue) || 0;

    const activePreTaxType =
      discountType !== 'none' && discountMode === 'pre-tax' ? discountType : 'none';
    const parsedPreTaxVal = activePreTaxType !== 'none' ? parsedPrimaryVal : 0;

    const activePostTaxType = hasExplicitPostTax
      ? postTaxDiscountType
      : discountType !== 'none' && discountMode === 'post-tax'
        ? discountType
        : 'none';
    const parsedPostTaxVal = hasExplicitPostTax
      ? parsedExplicitPostVal
      : discountMode === 'post-tax'
        ? parsedPrimaryVal
        : 0;

    // Step 1: Compute base after per-item discounts & sum eligible base for Pre-Tax bill discount
    let totalItemDiscounts = 0;
    let eligiblePreTaxSubTotal = 0;

    items.forEach((item) => {
      const itemDisc = computeItemDiscount(item);
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
        ? Math.max(0, (eligiblePreTaxSubTotal - preTaxBillDiscount) / eligiblePreTaxSubTotal)
        : 1;

    const globalSummary: GlobalSummary = {
      totalQty: 0,
      rawSubTotal: utils.round2(rawSubTotal),
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

    // Step 3: Master Bill Calculation across all items (computed once in O(I) and cached)
    const breakdownByItemId = new Map<string, ItemBreakdownResult>();
    items.forEach((item) => {
      const breakdown = mathEngine.calculateItemBreakdown(item, {
        taxPresets,
        isScApplicable,
        serviceChargeRate: effectiveScRate,
        scTaxPresetId,
        preTaxMultiplier,
      });
      breakdownByItemId.set(item.id, breakdown);

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
    const finalRawTotal = Math.max(0, grossTotal - postTaxDiscount);
    const roundedGrandTotal = Math.round(finalRawTotal);
    globalSummary.roundOff = utils.round2(roundedGrandTotal - finalRawTotal);
    globalSummary.grandTotal = roundedGrandTotal;

    const distributionMultiplier = grossTotal > 0 ? roundedGrandTotal / grossTotal : 1;

    // Step 6: Individual Debt Calculation (accumulate full precision, round once per member)
    const individualBreakdowns: Record<string, IndividualBreakdown> = {};
    members.forEach((member) => {
      let rawSubtotal = 0;
      let rawScAmount = 0;
      const consumedItems: { name: string; qtyString: string; cost: number }[] = [];

      items.forEach((item) => {
        const consumedQty = utils.parseQty(formattedClaims[member.id]?.[item.id] || '');
        if (consumedQty > 0 && item.qty > 0) {
          const shareRatio = consumedQty / item.qty;
          const itemBreakdown = breakdownByItemId.get(item.id);
          if (!itemBreakdown) return;

          const effectiveBaseShare = itemBreakdown.effectiveBase * shareRatio;
          const itemTaxShare = itemBreakdown.itemTaxAmount * shareRatio;
          const scShare = itemBreakdown.itemSC * shareRatio;
          const scTaxShare = itemBreakdown.scTaxAmount * shareRatio;

          const rawItemCost = effectiveBaseShare + itemTaxShare;
          rawSubtotal += rawItemCost;
          rawScAmount += scShare + scTaxShare;

          consumedItems.push({
            name: item.name,
            qtyString: formattedClaims[member.id]?.[item.id] || consumedQty.toString(),
            cost: utils.round2(rawItemCost),
          });
        }
      });

      individualBreakdowns[member.id] = {
        memberId: member.id,
        memberName: member.name,
        subtotal: utils.round2(rawSubtotal),
        serviceCharge: utils.round2(rawScAmount),
        totalOwed: utils.round2((rawSubtotal + rawScAmount) * distributionMultiplier),
        items: consumedItems,
      };
    });

    // Step 7: Paisa Conservation Pass (only when 100% of items are claimed)
    const allItemsFullyClaimed =
      items.length > 0 &&
      items.every((item) => {
        const totalClaimed = members.reduce(
          (sum, m) => sum + utils.parseQty(formattedClaims[m.id]?.[item.id] || ''),
          0
        );
        return Math.abs(totalClaimed - item.qty) < 0.01;
      });

    const activeIds = Object.keys(individualBreakdowns).filter(
      (id) => individualBreakdowns[id].totalOwed > 0
    );
    const totalClaimedOwed = utils.round2(
      activeIds.reduce((sum, id) => sum + individualBreakdowns[id].totalOwed, 0)
    );
    const drift = utils.round2(globalSummary.grandTotal - totalClaimedOwed);
    const maxAllowedDrift = Math.max(0.05, activeIds.length * 0.02);

    if (
      allItemsFullyClaimed &&
      activeIds.length > 0 &&
      Math.abs(drift) > 0 &&
      Math.abs(drift) <= maxAllowedDrift
    ) {
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
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];
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
