import { useState, useEffect, useMemo } from 'react';
import { Trash2, Check, Sparkles, Tag, Layers, Percent, Plus, Wand2 } from 'lucide-react';
import { useSessionContext } from '../../lib/SessionContext';
import { mathEngine } from '../../lib/mathEngine';
import { utils, showToast } from '../../lib/utils';
import BottomSheet from '../ui/BottomSheet';
import ToggleSwitch from '../ui/ToggleSwitch';

interface Props {
  activeSheet: 'sc' | 'discount' | 'taxes' | null;
  onClose: () => void;
}

const COMMON_TAX_TEMPLATES = [
  {
    name: 'Food GST',
    rate: 5,
    split: true,
    desc: '2.5% CGST + 2.5% SGST (Standard Restaurant Food)',
  },
  { name: 'Alcohol VAT', rate: 10, split: false, desc: 'State Liquor VAT / Excise Tax' },
  { name: 'Liquor VAT (Assam/KA)', rate: 6, split: false, desc: '6% State Bar / Pub VAT' },
  {
    name: 'Aerated / Sin GST',
    rate: 28,
    split: true,
    desc: '14% CGST + 14% SGST (Energy Drinks / Hookah)',
  },
  { name: 'Tobacco GST', rate: 40, split: true, desc: '20% CGST + 20% SGST' },
  { name: 'Exempt / MRP', rate: 0, split: false, desc: '0% Tax (Bottled Water / MRP Items)' },
];

const PRESET_SC_RATES = [5, 7.5, 10];

export default function WorkbenchRuleDrawers({ activeSheet, onClose }: Props) {
  const { isHost, items, members, formattedClaims, taxPresets, sessionRules, actions } =
    useSessionContext();

  // --- SERVICE CHARGE AUTO-DETECT STATE ---
  const [printedBillTotalInput, setPrintedBillTotalInput] = useState('');
  const [autoMatchedModeLabel, setAutoMatchedModeLabel] = useState<string | null>(null);

  // --- DISCOUNT DRAWER STATE ---
  const [discountTab, setDiscountTab] = useState<'pre' | 'post' | 'section'>('pre');
  const [localPreDiscount, setLocalPreDiscount] = useState<string>(sessionRules.discountValue);
  const [localPostDiscount, setLocalPostDiscount] = useState<string>(
    sessionRules.postTaxDiscountValue || ''
  );

  // Section / Multi-Item Discount Builder State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [sectionDiscType, setSectionDiscType] = useState<'percentage' | 'flat'>('percentage');
  const [sectionDiscValue, setSectionDiscValue] = useState<string>('');

  // --- TAX BRACKET DRAWER STATE ---
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [newTaxSplit, setNewTaxSplit] = useState(true);

  useEffect(() => {
    setLocalPreDiscount(sessionRules.discountValue);
  }, [sessionRules.discountValue]);

  useEffect(() => {
    setLocalPostDiscount(sessionRules.postTaxDiscountValue || '');
  }, [sessionRules.postTaxDiscountValue]);

  // Debounce Pre-Tax Discount Value
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPreDiscount !== sessionRules.discountValue) {
        actions.updateSessionRulesInDB({
          discountValue: localPreDiscount,
          discountMode: 'pre-tax',
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localPreDiscount, sessionRules.discountValue, actions]);

  // Debounce Post-Tax Discount Value
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPostDiscount !== (sessionRules.postTaxDiscountValue || '')) {
        actions.updateSessionRulesInDB({
          postTaxDiscountValue: localPostDiscount,
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localPostDiscount, sessionRules.postTaxDiscountValue, actions]);

  const foodPresetId = useMemo(() => {
    const found = taxPresets.find((t) => /food|gst/i.test(t.name) && t.rate > 0) || taxPresets[0];
    return found?.id || 'none';
  }, [taxPresets]);

  // Compute live previews for each of the 3 Service Charge tax modes so the user can visually match their paper receipt
  const scModePreviews = useMemo(() => {
    const computeForPresetId = (targetScTaxPresetId: string) => {
      if (items.length === 0) return { totalTax: 0, grandTotal: 0 };
      const res = mathEngine.generateSplit({
        items,
        members,
        formattedClaims,
        discountType: sessionRules.discountType,
        discountMode: sessionRules.discountMode,
        discountValue: sessionRules.discountValue,
        postTaxDiscountType: sessionRules.postTaxDiscountType,
        postTaxDiscountValue: sessionRules.postTaxDiscountValue,
        taxPresets,
        scTaxPresetId: targetScTaxPresetId,
        serviceChargeRate: sessionRules.isScApplicable ? sessionRules.serviceChargeRate : 0,
      });
      const totalTax = utils.round2(
        Object.values(res.globalSummary.taxBreakdown).reduce((a, b) => a + b, 0)
      );
      return {
        totalTax,
        grandTotal: res.globalSummary.grandTotal,
        rawTotal:
          res.globalSummary.subTotal +
          res.globalSummary.serviceCharge +
          totalTax -
          res.globalSummary.postTaxDiscountAmount,
      };
    };

    return {
      inherit: computeForPresetId('inherit'),
      global: computeForPresetId(foodPresetId),
      none: computeForPresetId('none'),
    };
  }, [items, members, formattedClaims, sessionRules, taxPresets, foodPresetId]);

  // Auto-detect which SC mode matches the user's printed paper bill Grand Total
  const handleAutoDetectScMode = (inputStr: string) => {
    setPrintedBillTotalInput(inputStr);
    const target = parseFloat(inputStr);
    if (isNaN(target) || target <= 0 || items.length === 0) {
      setAutoMatchedModeLabel(null);
      return;
    }

    const candidates = [
      {
        mode: 'inherit',
        presetVal: 'inherit',
        label: 'Taxed along with items',
        diff: Math.min(
          Math.abs(scModePreviews.inherit.grandTotal - target),
          Math.abs((scModePreviews.inherit.rawTotal || 0) - target)
        ),
      },
      {
        mode: 'global',
        presetVal: foodPresetId,
        label: 'Taxed separately under Food GST (5%)',
        diff: Math.min(
          Math.abs(scModePreviews.global.grandTotal - target),
          Math.abs((scModePreviews.global.rawTotal || 0) - target)
        ),
      },
      {
        mode: 'none',
        presetVal: 'none',
        label: 'No extra tax on Service Charge',
        diff: Math.min(
          Math.abs(scModePreviews.none.grandTotal - target),
          Math.abs((scModePreviews.none.rawTotal || 0) - target)
        ),
      },
    ].sort((a, b) => a.diff - b.diff);

    const best = candidates[0];
    if (best.diff <= 2.0) {
      utils.haptic('medium');
      actions.updateSessionRulesInDB({ scTaxPresetId: best.presetVal });
      setAutoMatchedModeLabel(best.label);
    } else {
      setAutoMatchedModeLabel(null);
    }
  };

  const handleApplySectionDiscount = async () => {
    const val = parseFloat(sectionDiscValue);
    if (selectedItemIds.length === 0) {
      return showToast('Select at least one item or category.', 'error');
    }
    if (isNaN(val) || val < 0) {
      return showToast('Enter a valid discount value.', 'error');
    }

    utils.haptic('medium');
    const targetItems = items.filter((i) => selectedItemIds.includes(i.id));
    const totalSelectedBase = targetItems.reduce((sum, i) => sum + i.totalBase, 0);

    const updated = targetItems.map((item) => {
      if (val === 0) {
        return { ...item, discountType: 'none' as const, discountValue: 0 };
      }
      if (sectionDiscType === 'percentage') {
        return { ...item, discountType: 'percentage' as const, discountValue: val };
      }
      const itemShare =
        totalSelectedBase > 0 ? utils.round2(val * (item.totalBase / totalSelectedBase)) : 0;
      return { ...item, discountType: 'flat' as const, discountValue: itemShare };
    });

    await actions.batchUpdateItemsInDB(updated);
    setSectionDiscValue('');
    showToast(
      val === 0
        ? `Cleared item discounts on ${updated.length} items.`
        : `Applied discount to ${updated.length} items!`,
      'success'
    );
  };

  const handleClearAllItemDiscounts = async () => {
    const discounted = items.filter(
      (i) => i.discountType && i.discountType !== 'none' && (i.discountValue || 0) > 0
    );
    if (discounted.length === 0) return;
    utils.haptic('light');
    await actions.batchUpdateItemsInDB(
      discounted.map((i) => ({ ...i, discountType: 'none' as const, discountValue: 0 }))
    );
    showToast('Cleared all item/section discounts.', 'success');
  };

  const handleAddTaxPreset = () => {
    const rate = parseFloat(newTaxRate);
    if (!newTaxName.trim() || isNaN(rate) || rate < 0) {
      return showToast('Enter a valid tax name and rate.', 'error');
    }
    utils.haptic('light');
    actions.addTaxPresetToDB({
      id: utils.generateId(),
      name: newTaxName.trim(),
      rate,
      split: newTaxSplit,
    });
    setNewTaxName('');
    setNewTaxRate('');
    setNewTaxSplit(true);
    showToast('Tax bracket added to bill.', 'success');
  };

  const handleToggleQuickTaxTemplate = (tpl: (typeof COMMON_TAX_TEMPLATES)[number]) => {
    utils.haptic('light');
    const existing = taxPresets.find(
      (t) => t.name.toLowerCase() === tpl.name.toLowerCase() && t.rate === tpl.rate
    );
    if (existing) {
      if (taxPresets.length <= 1) {
        return showToast('At least 1 tax bracket must remain active.', 'default');
      }
      actions.removeTaxPresetFromDB(existing.id);
    } else {
      actions.addTaxPresetToDB({
        id: utils.generateId(),
        name: tpl.name,
        rate: tpl.rate,
        split: tpl.split,
      });
    }
  };

  const postTaxType = sessionRules.postTaxDiscountType || 'none';
  const scRatePct = Number((sessionRules.serviceChargeRate * 100).toFixed(2));
  const isPresetScRate = PRESET_SC_RATES.some((p) => Math.abs(scRatePct - p) < 0.01);

  return (
    <>
      {/* DRAWER 1: SMART SERVICE CHARGE SETUP WITH AUTO-DETECT & LIVE RUPEE PREVIEWS */}
      <BottomSheet isOpen={activeSheet === 'sc'} onClose={onClose} title="Service Charge Setup">
        <div className="flex flex-col gap-4 pb-4">
          <p className="text-xs text-muted leading-relaxed">
            Check the bottom of your paper bill. If the restaurant added a{' '}
            <strong>Service Charge (usually 5% or 10%)</strong>, turn this on and pick the rate.
          </p>

          <label className="flex items-center justify-between p-3.5 bg-page border border-border rounded-xl cursor-pointer">
            <span className="font-bold text-sm text-main">Bill has a Service Charge</span>
            <ToggleSwitch
              checked={sessionRules.isScApplicable}
              onChange={(val) =>
                actions.updateSessionRulesInDB({
                  isScApplicable: val,
                  ...(val && sessionRules.serviceChargeRate === 0
                    ? { serviceChargeRate: 0.1, scTaxPresetId: 'inherit' }
                    : {}),
                  ...(!val ? { serviceChargeRate: 0, scTaxPresetId: 'none' } : {}),
                })
              }
            />
          </label>

          {sessionRules.isScApplicable && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">
                  Service Charge Percentage (%)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_SC_RATES.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        utils.haptic('light');
                        actions.updateSessionRulesInDB({ serviceChargeRate: pct / 100 });
                      }}
                      className={`h-10 rounded-xl font-extrabold text-xs border tabular-nums transition-all ${
                        Math.abs(scRatePct - pct) < 0.01
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-page text-main border-border'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    disabled={!isHost}
                    value={!isPresetScRate && scRatePct > 0 ? scRatePct : ''}
                    onChange={(e) =>
                      actions.updateSessionRulesInDB({
                        serviceChargeRate: (parseFloat(e.target.value) || 0) / 100,
                      })
                    }
                    placeholder="Other %"
                    className={`h-10 bg-page border rounded-xl px-2 text-center text-xs font-bold tabular-nums ${
                      !isPresetScRate && scRatePct > 0
                        ? 'border-primary text-primary'
                        : 'border-border text-main'
                    }`}
                  />
                </div>
              </div>

              {/* AUTO-DETECT SOLVER WHEN ITEMS ARE ON THE BILL */}
              {items.length > 0 && (
                <div className="bg-primary/8 border border-primary/25 rounded-2xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Wand2 size={14} />
                    <span className="text-xs font-extrabold">
                      Not sure how Service Charge is taxed? Auto-Detect it:
                    </span>
                  </div>
                  <p className="text-[0.7rem] text-muted leading-relaxed">
                    Type the final <strong>Grand Total</strong> printed on your paper bill (or just
                    compare the resulting rupee totals on the 3 options below):
                  </p>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-xs">
                      ₹
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={printedBillTotalInput}
                      onChange={(e) => handleAutoDetectScMode(e.target.value)}
                      placeholder="Enter printed Grand Total (e.g. 1453)"
                      className="w-full h-10 bg-surface border border-border rounded-xl pl-7 pr-3 text-xs font-bold tabular-nums"
                    />
                  </div>
                  {autoMatchedModeLabel && (
                    <div className="flex items-center gap-1.5 text-[0.7rem] font-extrabold text-emerald-500 pt-0.5">
                      <Check size={13} /> Auto-Matched: &ldquo;{autoMatchedModeLabel}&rdquo;
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">
                  How is Service Charge taxed on your bill?
                </label>

                {[
                  {
                    id: 'inherit' as const,
                    title: 'Standard — Taxed along with items (Most Common)',
                    desc: 'GST/VAT is calculated on (Item Price + Service Charge).',
                    preview: scModePreviews.inherit,
                  },
                  {
                    id: 'global' as const,
                    title: 'Taxed separately under Food GST (5%)',
                    desc: 'Service Charge attracts 5% GST even on liquor bills.',
                    preview: scModePreviews.global,
                  },
                  {
                    id: 'none' as const,
                    title: 'No extra tax on Service Charge',
                    desc: 'Service Charge is added flat after taxes.',
                    preview: scModePreviews.none,
                  },
                ].map((opt) => {
                  const currentMode =
                    sessionRules.scTaxPresetId === 'inherit' ||
                    sessionRules.scTaxPresetId === 'none'
                      ? sessionRules.scTaxPresetId
                      : 'global';
                  const isSelected = currentMode === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => {
                        utils.haptic('light');
                        if (opt.id === 'inherit' || opt.id === 'none') {
                          actions.updateSessionRulesInDB({ scTaxPresetId: opt.id });
                        } else {
                          actions.updateSessionRulesInDB({
                            scTaxPresetId: foodPresetId,
                          });
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary/40 text-main'
                          : 'bg-page border-border text-muted hover:text-main'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <span className="text-xs font-extrabold text-main">{opt.title}</span>
                        <span className="text-[0.7rem] text-muted leading-relaxed">{opt.desc}</span>
                        {items.length > 0 && (
                          <div className="mt-1 pt-1.5 border-t border-border/60 flex items-center justify-between text-[0.7rem] font-mono tabular-nums">
                            <span className="text-muted">
                              Total Tax: <strong>{utils.formatMoney(opt.preview.totalTax)}</strong>
                            </span>
                            <span className="text-primary font-extrabold">
                              Bill Total: {utils.formatMoney(opt.preview.grandTotal)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 mt-1 bg-primary text-white rounded-xl font-bold text-xs shadow-sm"
          >
            Done
          </button>
        </div>
      </BottomSheet>

      {/* DRAWER 2: 3-LAYER DISCOUNTS (PRE-TAX + POST-TAX + ITEM/SECTION) */}
      <BottomSheet isOpen={activeSheet === 'discount'} onClose={onClose} title="Discounts & Offers">
        <div className="flex flex-col gap-4 pb-4">
          <div className="grid grid-cols-3 gap-1 bg-page p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setDiscountTab('pre')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                discountTab === 'pre'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Percent size={12} /> Pre-Tax
            </button>
            <button
              type="button"
              onClick={() => setDiscountTab('post')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                discountTab === 'post'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Tag size={12} /> Post-Tax
            </button>
            <button
              type="button"
              onClick={() => setDiscountTab('section')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                discountTab === 'section'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-main'
              }`}
            >
              <Layers size={12} /> By Item
            </button>
          </div>

          {discountTab === 'pre' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>In-House Restaurant Discount (Pre-Tax):</strong> Subtracted from the
                subtotal <em>before</em> GST/VAT is calculated. Tap any item below to exclude
                Alcohol/MRP if the offer was Food-only.
              </p>

              <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
                {(['none', 'percentage', 'flat'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      actions.updateSessionRulesInDB({
                        discountType: type,
                        discountMode: 'pre-tax',
                      })
                    }
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                      sessionRules.discountType === type
                        ? 'bg-surface text-primary border border-primary/30 shadow-2xs'
                        : 'text-muted hover:text-main'
                    }`}
                  >
                    {type === 'flat' ? 'Flat (₹)' : type === 'percentage' ? 'Percent (%)' : 'None'}
                  </button>
                ))}
              </div>

              {sessionRules.discountType !== 'none' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted">
                      Pre-Tax Discount{' '}
                      {sessionRules.discountType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      disabled={!isHost}
                      value={localPreDiscount}
                      onChange={(e) => setLocalPreDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-bold tabular-nums"
                    />
                  </div>

                  {items.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                        Eligible Items (Tap to Exclude Alcohol/MRP)
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                        {items.map((item) => {
                          const eligible = item.applyDiscount !== false;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={!isHost}
                              onClick={() =>
                                actions.updateItemInDB({
                                  ...item,
                                  applyDiscount: !eligible,
                                })
                              }
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                                eligible
                                  ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/30'
                                  : 'bg-page text-muted border-border line-through opacity-70'
                              }`}
                            >
                              {eligible && <Check size={12} />}
                              <span className="truncate max-w-36">{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {discountTab === 'post' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>App / Bank Coupon (Post-Tax):</strong> Subtracted from the final bill{' '}
                <em>after</em> taxes (e.g., Swiggy Dineout, Zomato Gold, EazyDiner). Works alongside
                Pre-Tax discounts.
              </p>

              <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
                {(['none', 'percentage', 'flat'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      actions.updateSessionRulesInDB({
                        postTaxDiscountType: type,
                        ...(type === 'none' ? { postTaxDiscountValue: '' } : {}),
                      })
                    }
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                      postTaxType === type
                        ? 'bg-surface text-primary border border-primary/30 shadow-2xs'
                        : 'text-muted hover:text-main'
                    }`}
                  >
                    {type === 'flat' ? 'Flat (₹)' : type === 'percentage' ? 'Percent (%)' : 'None'}
                  </button>
                ))}
              </div>

              {postTaxType !== 'none' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted">
                    Post-Tax Coupon {postTaxType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    disabled={!isHost}
                    value={localPostDiscount}
                    onChange={(e) => setLocalPostDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-bold tabular-nums"
                  />
                </div>
              )}
            </div>
          )}

          {discountTab === 'section' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>Item or Category Discount:</strong> Select specific items (or tap a category
                like <em>Food GST</em> or <em>Alcohol VAT</em>) to apply a Happy Hour or Dessert
                discount strictly to those items.
              </p>

              {items.length === 0 ? (
                <div className="p-4 bg-page border border-border rounded-xl text-center text-xs text-muted">
                  Add items to the bill first to apply item-specific discounts.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      1. Quick-Select Category or Tap Items ({selectedItemIds.length} selected)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItemIds(
                            selectedItemIds.length === items.length ? [] : items.map((i) => i.id)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-page border border-border text-[0.7rem] font-bold text-main"
                      >
                        {selectedItemIds.length === items.length ? 'Clear Selection' : 'Select All'}
                      </button>
                      {taxPresets.map((preset) => {
                        const matchingIds = items
                          .filter((i) => i.taxPresetId === preset.id)
                          .map((i) => i.id);
                        if (matchingIds.length === 0) return null;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedItemIds(matchingIds)}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[0.7rem] font-bold flex items-center gap-1"
                          >
                            <Sparkles size={10} /> All {preset.name} ({matchingIds.length})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-page border border-border rounded-xl divide-y divide-border max-h-44 overflow-y-auto">
                    {items.map((item) => {
                      const isSelected = selectedItemIds.includes(item.id);
                      const hasItemDisc =
                        item.discountType &&
                        item.discountType !== 'none' &&
                        (item.discountValue || 0) > 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setSelectedItemIds((prev) =>
                              isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                            )
                          }
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-subtle/50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                isSelected
                                  ? 'bg-primary border-primary text-white'
                                  : 'border-border bg-surface'
                              }`}
                            >
                              {isSelected && <Check size={11} />}
                            </div>
                            <span className="text-xs font-bold text-main truncate">
                              {item.name}
                            </span>
                            {hasItemDisc && (
                              <span className="text-[0.65rem] font-extrabold text-emerald-500 bg-emerald-500/12 px-1.5 py-0.5 rounded tabular-nums shrink-0">
                                -
                                {item.discountType === 'percentage'
                                  ? `${item.discountValue}%`
                                  : `₹${item.discountValue}`}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-muted tabular-nums shrink-0">
                            {utils.formatMoney(item.totalBase)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isHost && (
                    <div className="flex flex-col gap-2.5 pt-1">
                      <div className="flex gap-2">
                        <div className="flex bg-page p-1 rounded-xl border border-border shrink-0">
                          <button
                            type="button"
                            onClick={() => setSectionDiscType('percentage')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              sectionDiscType === 'percentage'
                                ? 'bg-primary text-white'
                                : 'text-muted'
                            }`}
                          >
                            % Off
                          </button>
                          <button
                            type="button"
                            onClick={() => setSectionDiscType('flat')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              sectionDiscType === 'flat' ? 'bg-primary text-white' : 'text-muted'
                            }`}
                          >
                            ₹ Flat
                          </button>
                        </div>

                        <input
                          type="number"
                          inputMode="decimal"
                          value={sectionDiscValue}
                          onChange={(e) => setSectionDiscValue(e.target.value)}
                          placeholder={
                            sectionDiscType === 'percentage'
                              ? 'e.g. 20 (%)'
                              : 'e.g. 250 (₹ across selected)'
                          }
                          className="flex-1 h-10 bg-page border border-border rounded-xl px-3 text-sm font-bold tabular-nums"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleClearAllItemDiscounts}
                          className="h-10 px-3 bg-page border border-border text-muted hover:text-danger rounded-xl font-bold text-xs shrink-0"
                        >
                          Reset All
                        </button>
                        <button
                          type="button"
                          onClick={handleApplySectionDiscount}
                          className="flex-1 h-10 bg-primary text-white rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-transform"
                        >
                          Apply to {selectedItemIds.length} Selected{' '}
                          {selectedItemIds.length === 1 ? 'Item' : 'Items'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* DRAWER 3: IDIOT-PROOF TAX BRACKETS SELECTOR */}
      <BottomSheet
        isOpen={activeSheet === 'taxes'}
        onClose={onClose}
        title="Select Bill Tax Brackets"
      >
        <div className="flex flex-col gap-5 pb-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-main">
              Look at the bottom of your paper bill and tap the taxes you see:
            </span>
            <p className="text-[0.72rem] text-muted leading-relaxed">
              Selected taxes become 1-tap buttons when you add items, so Food GST goes to food
              eaters and Liquor VAT goes strictly to drinkers.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              {COMMON_TAX_TEMPLATES.map((tpl) => {
                const isActive = taxPresets.some(
                  (t) => t.name.toLowerCase() === tpl.name.toLowerCase() && t.rate === tpl.rate
                );
                return (
                  <button
                    key={`${tpl.name}-${tpl.rate}`}
                    type="button"
                    disabled={!isHost}
                    onClick={() => handleToggleQuickTaxTemplate(tpl)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 text-main'
                        : 'bg-page border-border text-muted hover:text-main'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-main">{tpl.name}</span>
                        <span className="text-[0.7rem] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded tabular-nums">
                          {tpl.rate}%
                        </span>
                      </div>
                      <span className="text-[0.68rem] text-muted truncate mt-0.5">{tpl.desc}</span>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                        isActive
                          ? 'bg-primary border-primary text-white'
                          : 'border-border bg-surface text-muted'
                      }`}
                    >
                      {isActive ? <Check size={14} /> : <Plus size={14} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isHost && (
            <div className="bg-page border border-border rounded-2xl p-3.5 flex flex-col gap-3">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                See a different tax % on your bill? Add Custom:
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="Name (e.g. Wine VAT)"
                  className="flex-1 h-10 bg-surface border border-border rounded-xl px-3 text-xs font-semibold"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(e.target.value)}
                  placeholder="Rate %"
                  className="w-24 h-10 bg-surface border border-border rounded-xl px-2 text-center text-xs font-bold tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <ToggleSwitch checked={newTaxSplit} onChange={setNewTaxSplit} />
                  <span className="text-xs font-semibold text-main">
                    Split 50/50 into CGST &amp; SGST
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleAddTaxPreset}
                  className="h-9 px-4 bg-primary text-white rounded-xl font-bold text-xs"
                >
                  + Add Custom
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Active on This Bill ({taxPresets.length})
            </span>
            <div className="bg-page border border-border rounded-2xl divide-y divide-border">
              {taxPresets.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-main">{t.name}</span>
                    <span className="text-xs font-bold text-primary bg-surface px-1.5 py-0.5 rounded border border-border tabular-nums">
                      {t.rate}%
                    </span>
                    {t.split && (
                      <span className="text-[0.6rem] font-bold text-muted uppercase">
                        (CGST/SGST)
                      </span>
                    )}
                  </div>
                  {isHost && taxPresets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => actions.removeTaxPresetFromDB(t.id)}
                      className="p-1 text-muted hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-primary text-white rounded-xl font-bold text-xs shadow-sm"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
