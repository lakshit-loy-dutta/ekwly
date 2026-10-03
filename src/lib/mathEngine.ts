import { utils } from './utils';
import type {
  BillItem,
  TaxPreset,
  GlobalSummary,
  IndividualBreakdown,
  CalculationResult,
} from './types';
import type { DBMember } from './useSession';
import type { Transaction } from './types';

interface EngineParams {
  items: BillItem[];
  members: DBMember[];
  formattedClaims: Record<string, Record<string, string>>;
  discountType: 'none' | 'percentage' | 'flat';
  discountMode: 'pre-tax' | 'post-tax';
  discountValue: string;
  taxPresets: TaxPreset[];
  scTaxPresetId: string;
  serviceChargeRate: number;
}

export const mathEngine = {
  // 1. Core Calculator (Determines total owed and individual shares)
  generateSplit: (params: EngineParams): CalculationResult => {
    const {
      items,
      members,
      formattedClaims,
      discountValue,
      discountType,
      discountMode,
      taxPresets,
      scTaxPresetId,
      serviceChargeRate,
    } = params;

    const rawSubTotal = items.reduce((sum, item) => sum + item.totalBase, 0);
    const parsedDiscount = parseFloat(discountValue) || 0;

    let preTaxDiscount = 0;
    let postTaxDiscount = 0;

    if (discountType !== 'none' && discountMode === 'pre-tax') {
      preTaxDiscount =
        discountType === 'percentage' ? rawSubTotal * (parsedDiscount / 100) : parsedDiscount;
      preTaxDiscount = Math.min(preTaxDiscount, rawSubTotal);
    }
    const preTaxMultiplier = rawSubTotal > 0 ? (rawSubTotal - preTaxDiscount) / rawSubTotal : 1;

    let globalSummary: GlobalSummary = {
      totalQty: 0,
      rawSubTotal,
      discountAmount: 0,
      discountMode,
      subTotal: 0,
      taxBreakdown: {},
      serviceCharge: 0,
      grandTotal: 0,
    };
    const scTaxPreset = taxPresets.find((t) => t.id === scTaxPresetId);

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
        } else
          globalSummary.taxBreakdown[preset.name] =
            (globalSummary.taxBreakdown[preset.name] || 0) + amount;
      } else
        globalSummary.taxBreakdown[fallbackName] =
          (globalSummary.taxBreakdown[fallbackName] || 0) + amount;
    };

    items.forEach((item) => {
      const effectiveBase = item.totalBase * preTaxMultiplier;
      const preset = taxPresets.find((t) => t.id === item.taxPresetId);
      const dynamicTaxRate = preset ? preset.rate / 100 : 0;

      const itemTaxAmount = effectiveBase * dynamicTaxRate;
      const itemSC = item.applySC ? effectiveBase * serviceChargeRate : 0;
      const itemSCTaxAmount = scTaxPreset && itemSC > 0 ? itemSC * (scTaxPreset.rate / 100) : 0;

      globalSummary.totalQty += item.qty;
      globalSummary.subTotal += effectiveBase;
      globalSummary.serviceCharge += itemSC;

      addTaxToBreakdown(preset, itemTaxAmount, 'Other Tax');
      addTaxToBreakdown(scTaxPreset, itemSCTaxAmount, 'S.C. Tax');
    });

    let grossTotal =
      globalSummary.subTotal +
      globalSummary.serviceCharge +
      Object.values(globalSummary.taxBreakdown).reduce((a, b) => a + b, 0);
    if (discountType !== 'none' && discountMode === 'post-tax') {
      postTaxDiscount =
        discountType === 'percentage' ? grossTotal * (parsedDiscount / 100) : parsedDiscount;
      postTaxDiscount = Math.min(postTaxDiscount, grossTotal);
    }
    globalSummary.discountAmount = discountMode === 'pre-tax' ? preTaxDiscount : postTaxDiscount;
    globalSummary.grandTotal = grossTotal - postTaxDiscount;
    const postTaxMultiplier = grossTotal > 0 ? (grossTotal - postTaxDiscount) / grossTotal : 1;

    const individualBreakdowns: Record<string, IndividualBreakdown> = {};
    members.forEach((member) => {
      let subtotal = 0;
      let totalScAmount = 0;
      let consumedItems: { name: string; qtyString: string; cost: number }[] = [];
      items.forEach((item) => {
        const consumedQty = utils.parseQty(formattedClaims[member.id]?.[item.id] || '');
        if (consumedQty > 0) {
          const effectiveBaseShare = (consumedQty / item.qty) * item.totalBase * preTaxMultiplier;
          const preset = taxPresets.find((t) => t.id === item.taxPresetId);
          const dynamicTaxRate = preset ? preset.rate / 100 : 0;

          const itemTaxAmount = effectiveBaseShare * dynamicTaxRate;
          const scShare = item.applySC ? effectiveBaseShare * serviceChargeRate : 0;
          const scTaxShare = scTaxPreset && scShare > 0 ? scShare * (scTaxPreset.rate / 100) : 0;

          const finalCostShare = effectiveBaseShare + itemTaxAmount;
          subtotal += finalCostShare;
          totalScAmount += scShare + scTaxShare;

          consumedItems.push({
            name: item.name,
            qtyString: formattedClaims[member.id]?.[item.id] || consumedQty.toString(),
            cost: finalCostShare,
          });
        }
      });
      individualBreakdowns[member.name] = {
        subtotal,
        serviceCharge: totalScAmount,
        totalOwed: (subtotal + totalScAmount) * postTaxMultiplier,
        items: consumedItems,
      };
    });

    return { individualBreakdowns, globalSummary };
  },

  // 2. The Splitwise Greedy Algorithm (Minimizes transactions)
  generateTransactions: (members: DBMember[], breakdowns: Record<string, IndividualBreakdown>) => {
    const balances = members.map((m) => {
      const share = breakdowns[m.name]?.totalOwed || 0;
      const paid = m.paid_amount || 0;
      return { ...m, balance: paid - share };
    });

    // Debtors owe money (Negative Balance). Creditors are owed money (Positive Balance).
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
