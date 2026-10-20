import { useState, useEffect } from 'react';
import { Trash2, Check, Sparkles, Tag, Layers, Percent } from 'lucide-react';
import { useSessionContext } from '../../lib/SessionContext';
import { utils, showToast } from '../../lib/utils';
import BottomSheet from '../ui/BottomSheet';
import ToggleSwitch from '../ui/ToggleSwitch';

interface Props {
  activeSheet: 'sc' | 'discount' | 'taxes' | null;
  onClose: () => void;
}

export default function WorkbenchRuleDrawers({ activeSheet, onClose }: Props) {
  const { isHost, items, taxPresets, sessionRules, actions } = useSessionContext();

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

  const handleApplySectionDiscount = async () => {
    const val = parseFloat(sectionDiscValue);
    if (selectedItemIds.length === 0) {
      return showToast('Select at least one dish or section.', 'error');
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
      // Distribute flat ₹ discount proportionally across the selected section items
      const itemShare =
        totalSelectedBase > 0 ? utils.round2(val * (item.totalBase / totalSelectedBase)) : 0;
      return { ...item, discountType: 'flat' as const, discountValue: itemShare };
    });

    await actions.batchUpdateItemsInDB(updated);
    setSectionDiscValue('');
    showToast(
      val === 0
        ? `Cleared item discounts on ${updated.length} dishes.`
        : `Applied section discount to ${updated.length} dishes!`,
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
    showToast('Tax bracket added.', 'success');
  };

  const postTaxType = sessionRules.postTaxDiscountType || 'none';

  return (
    <>
      {/* DRAWER 1: SERVICE CHARGE CONFIG */}
      <BottomSheet isOpen={activeSheet === 'sc'} onClose={onClose} title="Service Charge Rules">
        <div className="flex flex-col gap-4 pb-4">
          <label className="flex items-center justify-between p-3.5 bg-page border border-border rounded-xl cursor-pointer">
            <span className="font-bold text-sm text-main">Enable Service Charge</span>
            <ToggleSwitch
              checked={sessionRules.isScApplicable}
              onChange={(val) =>
                actions.updateSessionRulesInDB({
                  isScApplicable: val,
                  ...(!val ? { serviceChargeRate: 0, scTaxPresetId: 'none' } : {}),
                })
              }
            />
          </label>

          {sessionRules.isScApplicable && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">
                  Service Charge Rate (%)
                </label>
                <input
                  type="number"
                  disabled={!isHost}
                  value={
                    sessionRules.serviceChargeRate > 0
                      ? Number((sessionRules.serviceChargeRate * 100).toFixed(2))
                      : ''
                  }
                  onChange={(e) =>
                    actions.updateSessionRulesInDB({
                      serviceChargeRate: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  placeholder="e.g. 5 or 10"
                  className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-bold tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">
                  How Does the Restaurant Tax Service Charge?
                </label>
                <select
                  disabled={!isHost}
                  value={
                    sessionRules.scTaxPresetId === 'inherit' ||
                    sessionRules.scTaxPresetId === 'none'
                      ? sessionRules.scTaxPresetId
                      : 'global'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'inherit' || val === 'none') {
                      actions.updateSessionRulesInDB({ scTaxPresetId: val });
                    } else {
                      actions.updateSessionRulesInDB({
                        scTaxPresetId: taxPresets[0]?.id || 'none',
                      });
                    }
                  }}
                  className="w-full h-11 bg-page border border-border rounded-xl px-3 font-semibold text-sm"
                >
                  <option value="inherit">Cascading: Inherit Each Item&apos;s Tax</option>
                  <option value="global">Independent: Tax S.C. by a Global Bracket</option>
                  <option value="none">Untaxed: No Tax on Service Charge</option>
                </select>

                {sessionRules.scTaxPresetId !== 'inherit' &&
                  sessionRules.scTaxPresetId !== 'none' && (
                    <select
                      disabled={!isHost}
                      value={sessionRules.scTaxPresetId}
                      onChange={(e) =>
                        actions.updateSessionRulesInDB({ scTaxPresetId: e.target.value })
                      }
                      className="w-full h-11 mt-2 bg-subtle border border-primary/30 rounded-xl px-3 font-bold text-primary text-sm"
                    >
                      {taxPresets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rate}%)
                        </option>
                      ))}
                    </select>
                  )}
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* DRAWER 2: 3-LAYER DISCOUNTS (PRE-TAX + POST-TAX + ITEM/SECTION) */}
      <BottomSheet isOpen={activeSheet === 'discount'} onClose={onClose} title="Discounts & Offers">
        <div className="flex flex-col gap-4 pb-4">
          {/* 3-Mode Discount Layer Switcher */}
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
              <Layers size={12} /> By Item/Sec
            </button>
          </div>

          {/* TAB 1: PRE-TAX RESTAURANT DISCOUNT + SELECTIVE ITEM ELIGIBILITY */}
          {discountTab === 'pre' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>Pre-Tax Restaurant Discount:</strong> Subtracted before GST/VAT and Service
                Charge. You can uncheck specific dishes (e.g., Alcohol) below if the restaurant
                discount is Food-only.
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
                      <div className="flex items-center justify-between">
                        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                          Eligible Dishes (Tap to Exclude Alcohol/MRP)
                        </span>
                      </div>
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

          {/* TAB 2: SIMULTANEOUS POST-TAX COUPON / APP DISCOUNT */}
          {discountTab === 'post' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>Post-Tax Coupon / App Offer:</strong> Subtracted from the final Gross Total
                after taxes (e.g., Swiggy Dineout, Zomato Gold, or bank card offers). Works
                simultaneously with Pre-Tax and Item discounts.
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

          {/* TAB 3: ITEM & SECTION / CATEGORY DISCOUNT BUILDER */}
          {discountTab === 'section' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted leading-relaxed">
                <strong>Item or Section Discount:</strong> Select specific dishes (or tap a category
                preset like <em>Food GST</em> or <em>Alcohol VAT</em>) to apply a Happy Hour,
                Beverage, or Dessert discount strictly to those items.
              </p>

              {items.length === 0 ? (
                <div className="p-4 bg-page border border-border rounded-xl text-center text-xs text-muted">
                  Add dishes to the receipt first to apply item or section discounts.
                </div>
              ) : (
                <>
                  {/* 1-Tap Category / Tax Bracket Section Filters */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      1. Quick-Select Section or Tap Dishes ({selectedItemIds.length} selected)
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

                  {/* Multi-Select Dish List */}
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

                  {/* Section Discount Type & Amount Controls */}
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
                          {selectedItemIds.length === 1 ? 'Dish' : 'Dishes'}
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

      {/* DRAWER 3: TAX BRACKETS & CGST/SGST SPLIT */}
      <BottomSheet
        isOpen={activeSheet === 'taxes'}
        onClose={onClose}
        title="Tax Brackets (GST / VAT)"
      >
        <div className="flex flex-col gap-5 pb-4">
          {isHost && (
            <div className="bg-page border border-border rounded-2xl p-3.5 flex flex-col gap-3">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Create New Tax Bracket
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="Name (e.g. Liquor VAT)"
                  className="flex-1 h-10 bg-surface border border-border rounded-xl px-3 text-sm font-semibold"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(e.target.value)}
                  placeholder="%"
                  className="w-20 h-10 bg-surface border border-border rounded-xl px-2 text-center text-sm font-bold tabular-nums"
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
                  Add Tax
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Active Brackets ({taxPresets.length})
            </span>
            <div className="bg-page border border-border rounded-2xl divide-y divide-border">
              {taxPresets.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-main">{t.name}</span>
                    <span className="text-xs font-bold text-muted bg-surface px-1.5 py-0.5 rounded border border-border tabular-nums">
                      {t.rate}%
                    </span>
                    {t.split && (
                      <span className="text-[0.6rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase">
                        CGST/SGST
                      </span>
                    )}
                  </div>
                  {isHost && taxPresets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => actions.removeTaxPresetFromDB(t.id)}
                      className="p-1 text-muted hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
