import { useState, useEffect } from 'react';
import { utils, showToast } from '../../lib/utils';
import { Edit2, Trash2, ChevronDown, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import type { DatabaseItem } from '../../lib/types';
import SectionHeader from '../ui/SectionHeader';
import ToggleSwitch from '../ui/ToggleSwitch';

export default function ReceiptEditor() {
  const { isHost, items, taxPresets, sessionRules, actions } = useSessionContext();

  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemTaxId, setNewItemTaxId] = useState<string>('tx-1');
  const [newItemApplySC, setNewItemApplySC] = useState<boolean>(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [itemResults, setItemResults] = useState<any[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  useEffect(() => {
    if (taxPresets.length > 0 && !taxPresets.some((t) => t.id === newItemTaxId)) {
      setNewItemTaxId(taxPresets[0].id);
    }
  }, [taxPresets, newItemTaxId]);

  useEffect(() => {
    if (newItemName.trim().length < 2 || !sessionRules.venueName) {
      setItemResults([]);
      setShowItemDropdown(false);
      return;
    }

    const searchItems = async () => {
      const { data } = await supabase.rpc('search_venue_items', {
        p_venue_name: sessionRules.venueName,
        p_search_term: newItemName.trim(),
      });

      if (data && data.length > 0) {
        if (data[0].name.toLowerCase() === newItemName.trim().toLowerCase()) {
          setShowItemDropdown(false);
        } else {
          setItemResults(data);
          setShowItemDropdown(true);
        }
      } else {
        setShowItemDropdown(false);
      }
    };

    const delayDebounceFn = setTimeout(() => searchItems(), 300);
    return () => clearTimeout(delayDebounceFn);
  }, [newItemName, sessionRules.venueName]);

  const handleSelectItem = (item: DatabaseItem) => {
    setNewItemName(item.name);
    setNewItemPrice(item.price.toString());
    setShowItemDropdown(false);
  };

  const handleSaveItem = () => {
    const priceParsed = parseFloat(newItemPrice);
    if (!newItemName.trim() || newItemQty <= 0 || isNaN(priceParsed) || priceParsed < 0) {
      return showToast('Fill all fields correctly.', 'error');
    }
    const preset = taxPresets.find((t) => t.id === newItemTaxId);
    const taxRate = preset ? preset.rate / 100 : 0;
    const totalBase = newItemQty * priceParsed;

    if (editingItemId) {
      actions.updateItemInDB?.({
        id: editingItemId,
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      });
      setEditingItemId(null);
    } else {
      actions.addItemToDB?.({
        id: utils.generateId(),
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      });
    }
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice('');
  };

  const handleEditItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setNewItemName(item.name);
    setNewItemQty(item.qty);
    setNewItemPrice(item.unitPrice.toString());
    setNewItemTaxId(item.taxPresetId);
    setNewItemApplySC(item.applySC);
    setEditingItemId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full flex flex-col">
      {isHost && (
        <div className="bg-surface border-y border-border px-4 py-5 flex flex-col gap-4">
          <div className="relative w-full z-20">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item Name (e.g. Spicy Tuna Roll)"
              className="w-full text-lg font-medium border-0 border-b border-border rounded-none shadow-none px-0 pb-2 focus:ring-0 focus:border-primary h-auto bg-transparent"
            />

            {showItemDropdown && itemResults.length > 0 && (
              <div className="absolute top-10 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg z-30 flex flex-col overflow-hidden max-h-60 overflow-y-auto">
                <div className="px-3 py-2 bg-page/50 border-b border-border text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                  Menu Items at {sessionRules.venueName}
                </div>
                {itemResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-subtle active:bg-border transition-colors text-left border-b border-border/50 last:border-0"
                  >
                    <span className="font-semibold text-main text-[0.95rem] truncate pr-4">
                      {item.name}
                    </span>
                    <span className="text-[0.85rem] font-bold text-muted shrink-0">
                      {utils.formatMoney(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[0.7rem] font-bold text-muted uppercase tracking-wide mb-1 block">
                Qty
              </label>
              <input
                type="number"
                value={newItemQty}
                onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="flex-1">
              <label className="text-[0.7rem] font-bold text-muted uppercase tracking-wide mb-1 block">
                Price (₹)
              </label>
              <input
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-50">
                <select
                  className="w-full h-10 py-0 pl-3 pr-8 text-sm bg-subtle border border-border rounded-lg appearance-none font-medium text-main focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={newItemTaxId}
                  onChange={(e) => setNewItemTaxId(e.target.value)}
                >
                  {taxPresets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.rate}%)
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-muted">
                  <ChevronDown size={16} />
                </div>
              </div>
              <button
                type="button"
                className="h-10 px-6 bg-primary active:bg-primary-hover text-white rounded-lg font-medium text-sm ml-4 shadow-sm transition-colors"
                onClick={handleSaveItem}
              >
                {editingItemId ? 'Update Item' : 'Add Item'}
              </button>
            </div>

            {sessionRules.serviceChargeRate > 0 && (
              <label className="flex items-center gap-3 cursor-pointer bg-page p-3 rounded-lg border border-border">
                <ToggleSwitch checked={newItemApplySC} onChange={setNewItemApplySC} />
                <span className="text-sm font-medium text-main">
                  Apply Global Service Charge to this item
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      <SectionHeader
        title={`Added Items (${items.length})`}
        helpText="Verify the extracted items below. The AI has automatically assigned tax brackets based on the venue's rules. If an item needs a different rate or shouldn't attract Service Charge, tap the pencil icon to edit it."
      />

      <div className="bg-surface border-y border-border divide-y divide-border overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No items added yet.</div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const taxPreset = taxPresets.find((t) => t.id === item.taxPresetId);
              const dynamicTaxRate = taxPreset ? taxPreset.rate / 100 : 0;
              const itemSC = item.applySC ? item.totalBase * sessionRules.serviceChargeRate : 0;

              let itemTaxAmount = 0;
              let scTaxAmount = 0;

              // UNIVERSAL TAX ENGINE SYNC FOR UI
              if (sessionRules.scTaxPresetId === 'inherit') {
                itemTaxAmount = item.totalBase * dynamicTaxRate;
                scTaxAmount = itemSC * dynamicTaxRate;
              } else {
                itemTaxAmount = item.totalBase * dynamicTaxRate;
                if (sessionRules.scTaxPresetId !== 'none') {
                  const scPreset = taxPresets.find((t) => t.id === sessionRules.scTaxPresetId);
                  if (scPreset && itemSC > 0) scTaxAmount = itemSC * (scPreset.rate / 100);
                }
              }

              const finalItemTotal = item.totalBase + itemSC + itemTaxAmount + scTaxAmount;
              const taxName = taxPreset ? `${taxPreset.name} (${taxPreset.rate}%)` : 'Custom Tax';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex flex-col min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-main text-[0.95rem] truncate">
                        {item.name}
                      </span>
                      <span className="text-[0.7rem] font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border shrink-0">
                        x{item.qty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted mt-1 truncate">
                      <span>{utils.formatMoney(item.unitPrice)}</span>
                      <span>•</span>
                      <span className="truncate">{taxName}</span>
                      {item.applySC && sessionRules.serviceChargeRate > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-bold">+ S.C.</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-bold text-main">{utils.formatMoney(finalItemTotal)}</span>
                    {isHost && (
                      <div className="flex items-center gap-2 border-l border-border pl-3">
                        <button
                          onClick={() => handleEditItem(item.id)}
                          className="text-muted hover:bg-subtle active:scale-90 p-2 rounded-full transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => actions.removeItemFromDB?.(item.id)}
                          className="text-muted hover:text-danger hover:bg-danger/10 active:scale-90 p-2 rounded-full transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
