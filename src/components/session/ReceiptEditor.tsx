import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { utils, showToast } from '../../lib/utils';
import { Edit2, Trash2, ChevronDown, Camera as CameraIcon, Loader2 } from 'lucide-react'; // Added Camera & Loader2
import { useSessionContext } from '../../lib/SessionContext';
import { supabase } from '../../lib/supabase';

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
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Only search if they've typed 2+ chars AND a venue is selected in Step 1
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

  const handleSelectItem = (item: any) => {
    setNewItemName(item.name);
    setNewItemPrice(item.price.toString());
    setShowItemDropdown(false);
  };

  // Converts File OR Blob to Base64
  const fileToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        let encoded = reader.result as string;
        encoded = encoded.replace(/^data:(.*,)?/, '');
        if (encoded.length % 4 > 0) {
          encoded += '='.repeat(4 - (encoded.length % 4));
        }
        resolve(encoded);
      };
      reader.onerror = reject;
    });
  };

  const initiateScan = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setIsScanning(true);
    showToast('Analyzing receipt with AI...', 'default');

    try {
      let base64Image = '';

      if (Capacitor.isNativePlatform()) {
        // MODERN CAPACITOR 7/8 NATIVE FLOW (No Deprecations)
        const image = await Camera.takePhoto({
          quality: 90,
          includeMetadata: false, // Prevents EXIF bloat
        });

        if (!image.uri) throw new Error('Failed to capture image');

        // Convert local device URI to a web-accessible URL and fetch the Blob
        const webSafeUrl = Capacitor.convertFileSrc(image.uri);
        const response = await fetch(webSafeUrl);
        const blob = await response.blob();
        base64Image = await fileToBase64(blob);
      } else {
        // MODERN WEB/PWA FLOW
        const file = e?.target.files?.[0];
        if (!file) throw new Error('No file selected');
        base64Image = await fileToBase64(file);
      }

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: {
          imageBase64: base64Image,
          currentRules: sessionRules,
          currentTaxes: taxPresets,
        },
      });

      // --- SECURE ERROR HANDLING ---
      const errMessage = error?.message || data?.error;
      if (errMessage) {
        if (errMessage === 'RATE_LIMIT_REACHED') {
          throw new Error(
            "You've used your 3 free Magic Scans this month. Upgrade to Pro for unlimited scans."
          );
        }
        if (errMessage.includes('UNAUTHORIZED')) {
          throw new Error('Sign in from your Profile to use Magic Scan.');
        }
        throw new Error(errMessage);
      }
      if (!data?.items) throw new Error('Failed to read receipt');

      // 2. Process Session Rules (Discounts & Service Charge overrides)
      if (data.sessionRules) {
        await actions.updateSessionRulesInDB({
          isScApplicable: data.sessionRules.isScApplicable,
          serviceChargeRate: data.sessionRules.serviceChargeRate,
          discountType: data.sessionRules.discountType,
          discountValue: data.sessionRules.discountValue,
          discountMode: data.sessionRules.discountMode,
        });
      }

      // 3. Process New Tax Presets & Build UUID Mapping
      const tempIdMap: Record<string, string> = {};
      if (data.newTaxPresets && Array.isArray(data.newTaxPresets)) {
        for (const pt of data.newTaxPresets) {
          const newRealId = utils.generateId();
          tempIdMap[pt.tempId] = newRealId;

          await actions.addTaxPresetToDB({
            id: newRealId,
            name: pt.name,
            rate: pt.rate,
            split: pt.split !== false,
          });
        }
      }

      // 4. Process Items
      let addedCount = 0;
      for (const extractedItem of data.items) {
        if (!extractedItem.name || !extractedItem.price) continue;

        const finalTaxId =
          tempIdMap[extractedItem.taxPresetId] ||
          extractedItem.taxPresetId ||
          (taxPresets.length > 0 ? taxPresets[0].id : 'tx-1');

        await actions.addItemToDB?.({
          id: utils.generateId(),
          name: extractedItem.name,
          qty: extractedItem.qty || 1,
          unitPrice: extractedItem.price,
          taxRate: 0,
          taxPresetId: finalTaxId,
          applySC: extractedItem.applySC !== false,
          totalBase: (extractedItem.qty || 1) * extractedItem.price,
        });
        addedCount++;
      }

      showToast(`Magic Scan complete! Extracted ${addedCount} items.`, 'success');
    } catch (err: any) {
      console.error('Scan Error:', err);
      showToast(err.message || 'AI could not read this receipt cleanly.', 'error');
    } finally {
      setIsScanning(false);
      if (e?.target) e.target.value = '';
    }
  };

  // Auto-select the first valid tax preset for new items
  useEffect(() => {
    if (taxPresets.length > 0 && !taxPresets.some((t) => t.id === newItemTaxId)) {
      setNewItemTaxId(taxPresets[0].id);
    }
  }, [taxPresets, newItemTaxId]);

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
      const newItem = {
        id: utils.generateId(),
        name: newItemName.trim(),
        qty: newItemQty,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      };
      actions.addItemToDB?.(newItem);
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
      {/* HIDDEN FOR GUESTS */}
      {isHost && (
        <div className="bg-surface border-y border-border px-4 py-5 flex flex-col gap-4">
          {/* THE MAGIC SCANNER BUTTON */}
          <div className="flex w-full">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={initiateScan}
              className="hidden"
              id="camera-input"
            />
            <button
              type="button"
              disabled={isScanning}
              onClick={() => {
                if (Capacitor.isNativePlatform()) {
                  initiateScan(); // Trigger Native Hardware
                } else {
                  document.getElementById('camera-input')?.click(); // Trigger HTML5 Hidden Input
                }
              }}
              className="w-full h-12 bg-primary/10 hover:bg-primary/20 active:bg-primary/30 text-primary border border-primary/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Analyzing Image...
                </>
              ) : (
                <>
                  <CameraIcon size={18} /> Magic Scan Receipt
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 my-1 opacity-60">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Or Add Manually
            </span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* MAGIC MENU AUTOCOMPLETE CONTAINER */}
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
          {/* END MAGIC MENU AUTOCOMPLETE */}

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
                className="h-10 px-6 bg-primary text-white rounded-lg font-medium text-sm ml-4 shadow-sm"
                onClick={handleSaveItem}
              >
                {editingItemId ? 'Update Item' : 'Add Item'}
              </button>
            </div>

            {sessionRules.serviceChargeRate > 0 && (
              <label className="flex items-center gap-3 cursor-pointer bg-page p-3 rounded-lg border border-border">
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={newItemApplySC}
                    onChange={(e) => setNewItemApplySC(e.target.checked)}
                  />
                  <span className="slider"></span>
                </div>
                <span className="text-sm font-medium text-main">
                  Apply Global Service Charge to this item
                </span>
              </label>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-3 mt-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Added Items ({items.length})
        </h3>
      </div>

      <div className="bg-surface border-y border-border divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">No items added yet.</div>
        ) : (
          items.map((item) => {
            const taxPreset = taxPresets.find((t) => t.id === item.taxPresetId);
            const dynamicTaxRate = taxPreset ? taxPreset.rate / 100 : 0;

            const itemTaxAmount = item.totalBase * dynamicTaxRate;
            const itemSC = item.applySC ? item.totalBase * sessionRules.serviceChargeRate : 0;
            const finalItemTotal = item.totalBase + itemTaxAmount + itemSC;
            const taxName = taxPreset ? `${taxPreset.name} (${taxPreset.rate}%)` : 'Custom Tax';

            return (
              <div key={item.id} className="flex items-center justify-between p-4">
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
                    <div className="flex items-center gap-3 border-l border-border pl-3">
                      <button
                        onClick={() => handleEditItem(item.id)}
                        className="text-muted active:text-primary"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => actions.removeItemFromDB?.(item.id)}
                        className="text-muted active:text-danger"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
