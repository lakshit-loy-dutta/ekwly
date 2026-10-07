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
  taxPresets: TaxPreset[];
  scTaxPresetId: string; // 'none', 'inherit', or a specific UUID
  serviceChargeRate: number;
}

export const mathEngine = {
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

    // 1. MASTER BILL CALCULATION
    items.forEach((item) => {
      const effectiveBase = item.totalBase * preTaxMultiplier;
      const preset = taxPresets.find((t) => t.id === item.taxPresetId);
      const dynamicTaxRate = preset ? preset.rate / 100 : 0;
      const itemSC = item.applySC ? effectiveBase * serviceChargeRate : 0;

      let itemTaxAmount = 0;
      let scTaxAmount = 0;

      if (scTaxPresetId === 'inherit') {
        // TBC 66 MODEL: Tax applies to (Base + SC)
        itemTaxAmount = effectiveBase * dynamicTaxRate;
        scTaxAmount = itemSC * dynamicTaxRate;
        addTaxToBreakdown(preset, itemTaxAmount + scTaxAmount, 'Other Tax');
      } else {
        // CHIN LUNG MODEL: Item Base is taxed alone. SC is taxed by a global preset.
        itemTaxAmount = effectiveBase * dynamicTaxRate;
        addTaxToBreakdown(preset, itemTaxAmount, 'Other Tax');

        if (scTaxPresetId !== 'none') {
          const scPreset = taxPresets.find((t) => t.id === scTaxPresetId);
          if (scPreset && itemSC > 0) {
            scTaxAmount = itemSC * (scPreset.rate / 100);
            addTaxToBreakdown(scPreset, scTaxAmount, 'S.C. Tax');
          }
        }
      }

      globalSummary.totalQty += item.qty;
      globalSummary.subTotal += effectiveBase;
      globalSummary.serviceCharge += itemSC;
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

    // CALCULATE ROUND OFF TO MATCH PHYSICAL BILL
    const finalRawTotal = grossTotal - postTaxDiscount;
    const roundedGrandTotal = Math.round(finalRawTotal);
    globalSummary.roundOff = utils.round2(roundedGrandTotal - finalRawTotal);
    globalSummary.grandTotal = roundedGrandTotal;

    // The magical multiplier to naturally and fairly distribute the round-off among users
    const distributionMultiplier = finalRawTotal > 0 ? roundedGrandTotal / finalRawTotal : 1;

    // 2. INDIVIDUAL DEBT CALCULATION
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
          const scShare = item.applySC ? effectiveBaseShare * serviceChargeRate : 0;

          let itemTaxAmount = 0;
          let scTaxShare = 0;

          if (scTaxPresetId === 'inherit') {
            itemTaxAmount = effectiveBaseShare * dynamicTaxRate;
            scTaxShare = scShare * dynamicTaxRate;
          } else {
            itemTaxAmount = effectiveBaseShare * dynamicTaxRate;
            if (scTaxPresetId !== 'none') {
              const scPreset = taxPresets.find((t) => t.id === scTaxPresetId);
              if (scPreset && scShare > 0) scTaxShare = scShare * (scPreset.rate / 100);
            }
          }

          const finalCostShare = utils.round2(effectiveBaseShare + itemTaxAmount);
          subtotal = utils.round2(subtotal + finalCostShare);
          totalScAmount = utils.round2(totalScAmount + scShare + scTaxShare);

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
        totalOwed: utils.round2((subtotal + totalScAmount) * distributionMultiplier),
        items: consumedItems, // <-- Add this line back
      };
    });

    return { individualBreakdowns, globalSummary };
  },

  generateTransactions: (members: DBMember[], breakdowns: Record<string, IndividualBreakdown>) => {
    const balances = members.map((m) => ({
      ...m,
      balance: (m.paid_amount || 0) - (breakdowns[m.name]?.totalOwed || 0),
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
