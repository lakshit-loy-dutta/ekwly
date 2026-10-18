import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Check,
  Users,
  UserPlus,
  Percent,
  Receipt,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Minus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { utils, showToast } from '../../lib/utils';
import type { DatabaseVenue, DatabaseItem, BillItem } from '../../lib/types';
import MagicScanner from './MagicScanner';
import BottomSheet from '../ui/BottomSheet';
import ToggleSwitch from '../ui/ToggleSwitch';

const FRACTION_PILLS = [
  { label: 'Clear', value: '' },
  { label: '1/4', value: '1/4' },
  { label: '1/3', value: '1/3' },
  { label: '1/2', value: '1/2' },
  { label: '1', value: '1' },
];

interface FriendQuickChip {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function ReceiptWorkbench() {
  const {
    isHost,
    items,
    members,
    taxPresets,
    sessionRules,
    currentUserId,
    hostId,
    actions,
    formattedClaims,
    liveCalculation,
  } = useSessionContext() as ReturnType<typeof useSessionContext> & {
    formattedClaims: Record<string, Record<string, string>>;
    liveCalculation: ReturnType<typeof import('../../lib/mathEngine').mathEngine.generateSplit>;
  };

  // --- VENUE AUTOCOMPLETE STATE ---
  const [localVenue, setLocalVenue] = useState<string>(sessionRules.venueName);
  const [venueResults, setVenueResults] = useState<DatabaseVenue[]>([]);
  const [isSearchingVenue, setIsSearchingVenue] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [showScannerDrawer, setShowScannerDrawer] = useState(false);

  // --- MEMBER & FRIEND QUICK-ADD STATE ---
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [myFriends, setMyFriends] = useState<FriendQuickChip[]>([]);
  const [profileSearchResults, setProfileSearchResults] = useState<FriendQuickChip[]>([]);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);

  // --- ADD / EDIT DISH STATE ---
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemTaxId, setNewItemTaxId] = useState<string>(taxPresets[0]?.id || 'tx-1');
  const [newItemApplySC, setNewItemApplySC] = useState<boolean>(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemResults, setItemResults] = useState<DatabaseItem[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- EXPANDED CUSTOM SPLIT DISH ID ---
  const [expandedCustomSplitItemId, setExpandedCustomSplitItemId] = useState<string | null>(null);

  // --- CONTEXTUAL RULE DRAWERS (DISCOUNT, SERVICE CHARGE, TAX BRACKETS) ---
  const [activeRuleSheet, setActiveRuleSheet] = useState<'sc' | 'discount' | 'taxes' | null>(null);
  const [localDiscount, setLocalDiscount] = useState<string>(sessionRules.discountValue);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [newTaxSplit, setNewTaxSplit] = useState(true);

  useEffect(() => {
    setLocalVenue(sessionRules.venueName);
  }, [sessionRules.venueName]);

  useEffect(() => {
    setLocalDiscount(sessionRules.discountValue);
  }, [sessionRules.discountValue]);

  useEffect(() => {
    if (taxPresets.length > 0 && !taxPresets.some((t) => t.id === newItemTaxId)) {
      setNewItemTaxId(taxPresets[0].id);
    }
  }, [taxPresets, newItemTaxId]);

  // Debounce venue name updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVenue !== sessionRules.venueName) {
        actions.updateSessionRulesInDB({ venueName: localVenue });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localVenue, sessionRules.venueName, actions]);

  // Debounce discount value updates
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDiscount !== sessionRules.discountValue) {
        actions.updateSessionRulesInDB({ discountValue: localDiscount });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [localDiscount, sessionRules.discountValue, actions]);

  // Search known venues
  useEffect(() => {
    if (localVenue.trim().length < 2 || !isHost) {
      setVenueResults([]);
      setShowVenueDropdown(false);
      return;
    }
    const searchDb = async () => {
      setIsSearchingVenue(true);
      const { data } = await supabase.rpc('search_venues', { search_term: localVenue.trim() });
      if (data && data.length > 0) {
        if (data[0].name.toLowerCase() === localVenue.trim().toLowerCase()) {
          setShowVenueDropdown(false);
        } else {
          setVenueResults(data);
          setShowVenueDropdown(true);
        }
      } else {
        setShowVenueDropdown(false);
      }
      setIsSearchingVenue(false);
    };
    const timer = setTimeout(searchDb, 300);
    return () => clearTimeout(timer);
  }, [localVenue, isHost]);

  // Load connected Ekwly Friends for 1-tap table population
  useEffect(() => {
    if (!currentUserId) return;
    const loadFriends = async () => {
      const { data: conns } = await supabase
        .from('connections')
        .select('user_id, friend_id')
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);
      if (!conns || conns.length === 0) return;
      const friendIds = conns.map((c) => (c.user_id === currentUserId ? c.friend_id : c.user_id));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', friendIds);
      if (profiles) setMyFriends(profiles);
    };
    loadFriends();
  }, [currentUserId]);

  // Search global Ekwly profiles when typing a member name
  useEffect(() => {
    if (newMemberName.trim().length < 2) {
      setProfileSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingProfiles(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${newMemberName.trim()}%`)
        .limit(5);
      setProfileSearchResults(data || []);
      setIsSearchingProfiles(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [newMemberName]);

  // Search venue menu items for price autocomplete
  useEffect(() => {
    if (newItemName.trim().length < 2 || !sessionRules.venueName) {
      setItemResults([]);
      setShowItemDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
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
    }, 280);
    return () => clearTimeout(timer);
  }, [newItemName, sessionRules.venueName]);

  const handleSelectVenue = async (venue: DatabaseVenue) => {
    utils.haptic('medium');
    setLocalVenue(venue.name);
    setShowVenueDropdown(false);
    const parsedScRate = Number(venue.service_charge_rate || 0);

    actions.updateSessionRulesInDB({
      venueName: venue.name,
      isScApplicable: parsedScRate > 0,
      serviceChargeRate: parsedScRate,
    });

    if (venue.tax_presets && Array.isArray(venue.tax_presets)) {
      const mappedPresets = venue.tax_presets.map((t) => ({
        id: utils.generateId(),
        name: t.name,
        rate: t.rate,
        split: t.split !== false,
      }));
      await actions.replaceTaxPresetsInDB(mappedPresets);
      showToast(`${venue.name} tax & SC rules applied!`, 'success');
    }
  };

  const handleSaveItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    const qtyParsed = parseFloat(newItemQty) || 0;
    const priceParsed = parseFloat(newItemPrice);
    if (!newItemName.trim() || qtyParsed <= 0 || isNaN(priceParsed) || priceParsed < 0) {
      return showToast('Enter a valid item name, quantity, and price.', 'error');
    }
    utils.haptic('light');
    const preset = taxPresets.find((t) => t.id === newItemTaxId);
    const taxRate = preset ? preset.rate / 100 : 0;
    const totalBase = qtyParsed * priceParsed;

    if (editingItemId) {
      actions.updateItemInDB({
        id: editingItemId,
        name: newItemName.trim(),
        qty: qtyParsed,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      });
      setEditingItemId(null);
    } else {
      actions.addItemToDB({
        id: utils.generateId(),
        name: newItemName.trim(),
        qty: qtyParsed,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        totalBase,
      });
    }
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
    setShowItemDropdown(false);
  };

  const handleEditItem = (item: BillItem) => {
    utils.haptic('light');
    setNewItemName(item.name);
    setNewItemQty(item.qty.toString());
    setNewItemPrice(item.unitPrice.toString());
    setNewItemTaxId(item.taxPresetId);
    setNewItemApplySC(item.applySC);
    setEditingItemId(item.id);
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // --- 1-TAP ITEM-CENTRIC AVATAR CLAIMING ---
  const handleToggleMemberOnItem = (item: BillItem, targetMemberId: string) => {
    utils.haptic('light');
    const currentlyClaimedIds = members
      .filter((m) => utils.parseQty(formattedClaims[m.id]?.[item.id]) > 0)
      .map((m) => m.id);

    const isAlreadyClaimed = currentlyClaimedIds.includes(targetMemberId);
    const nextClaimedIds = isAlreadyClaimed
      ? currentlyClaimedIds.filter((id) => id !== targetMemberId)
      : [...currentlyClaimedIds, targetMemberId];

    const newFraction =
      nextClaimedIds.length > 0 ? utils.getFractionString(item.qty, nextClaimedIds.length) : '';

    const updates = members.map((m) => ({
      memberId: m.id,
      itemId: item.id,
      value: nextClaimedIds.includes(m.id) ? newFraction : '',
    }));

    actions.batchUpdateClaimsInDB(updates);
  };

  const handleToggleAllOnItem = (item: BillItem) => {
    utils.haptic('medium');
    if (members.length === 0) return;

    const allClaimed = members.every((m) => utils.parseQty(formattedClaims[m.id]?.[item.id]) > 0);

    const evenShare = allClaimed ? '' : utils.getFractionString(item.qty, members.length);
    const updates = members.map((m) => ({
      memberId: m.id,
      itemId: item.id,
      value: evenShare,
    }));

    actions.batchUpdateClaimsInDB(updates);
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

  const gs = liveCalculation.globalSummary;
  const computedGrossTotal =
    gs.subTotal + gs.serviceCharge + Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full flex flex-col gap-4 px-4 pt-3 pb-36">
      {/* ZONE 1: VENUE & AI MAGIC SCAN HEADER CARD */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative z-30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
              {isSearchingVenue ? (
                <Loader2 size={16} className="animate-spin text-primary" />
              ) : (
                <Search size={16} />
              )}
            </div>
            <input
              type="text"
              disabled={!isHost}
              value={localVenue}
              onChange={(e) => setLocalVenue(e.target.value)}
              placeholder="Restaurant / Venue (e.g. Toit, Chin Lung)"
              className="w-full h-11 bg-page border border-border rounded-xl pl-9 pr-3 text-sm font-semibold text-main"
            />

            {showVenueDropdown && venueResults.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl z-40 flex flex-col overflow-hidden max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 bg-page border-b border-border text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                  Auto-Load Known Venue Rules
                </div>
                {venueResults.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVenue(v)}
                    className="flex flex-col px-3.5 py-2.5 hover:bg-subtle text-left border-b border-border/50 last:border-0"
                  >
                    <span className="font-bold text-main text-sm truncate">{v.name}</span>
                    <span className="text-[0.7rem] text-muted">
                      {v.tax_presets ? v.tax_presets.length : 0} Tax Brackets •{' '}
                      {v.service_charge_rate > 0
                        ? `${v.service_charge_rate * 100}% S.C.`
                        : 'No S.C.'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isHost && (
            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setShowScannerDrawer(true);
              }}
              className="h-11 px-3.5 premium-gradient-card text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 transition-transform"
            >
              <Sparkles size={15} /> Magic Scan
            </button>
          )}
        </div>
      </div>

      {/* ZONE 2: "AT THE TABLE" MEMBER BAR + 1-TAP FRIEND CHIPS */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
            <Users size={13} className="text-primary" /> At the Table ({members.length})
          </span>
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setShowMemberSheet(true);
            }}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <UserPlus size={14} /> Add / Manage People
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {members.map((m) => {
            const owed = liveCalculation.individualBreakdowns[m.id]?.totalOwed || 0;
            const isMe = m.user_id === currentUserId;
            return (
              <div
                key={m.id}
                onClick={() => setShowMemberSheet(true)}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                  isMe
                    ? 'bg-primary/10 border-primary/30 text-main'
                    : 'bg-page border-border text-main'
                }`}
              >
                <span className="font-bold truncate max-w-24">{m.name}</span>
                <span className="font-extrabold text-primary tabular-nums">
                  {utils.formatMoney(owed)}
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMemberSheet(true)}
            className="shrink-0 h-8 px-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-bold flex items-center gap-1 hover:bg-primary/5"
          >
            <Plus size={14} /> Person
          </button>
        </div>
      </div>

      {/* ZONE 3: ADD / EDIT DISH BAR (HOST ONLY) */}
      {isHost && (
        <form
          onSubmit={handleSaveItem}
          className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative z-20"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted">
              {editingItemId ? 'Editing Dish' : 'Add Dish to Receipt'}
            </span>
            {editingItemId && (
              <button
                type="button"
                onClick={() => {
                  setEditingItemId(null);
                  setNewItemName('');
                  setNewItemQty('1');
                  setNewItemPrice('');
                }}
                className="text-xs font-bold text-danger"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Dish or Drink Name (e.g. Crispy Corn)"
              className="w-full h-11 bg-page border border-border rounded-xl px-3.5 text-sm font-semibold text-main"
            />
            {showItemDropdown && itemResults.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-surface border border-border rounded-xl shadow-xl z-30 flex flex-col overflow-hidden max-h-48 overflow-y-auto">
                {itemResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewItemName(item.name);
                      setNewItemPrice(item.price.toString());
                      setShowItemDropdown(false);
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-subtle text-left border-b border-border/50 last:border-0"
                  >
                    <span className="font-semibold text-main text-sm truncate pr-3">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold text-primary tabular-nums shrink-0">
                      {utils.formatMoney(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-3">
              <input
                type="number"
                inputMode="decimal"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qty"
                min="0.01"
                step="any"
                className="w-full h-10 bg-page border border-border rounded-xl px-2.5 text-center text-sm font-bold tabular-nums"
              />
            </div>
            <div className="col-span-4">
              <input
                type="number"
                inputMode="decimal"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="₹ Unit Price"
                min="0"
                step="any"
                className="w-full h-10 bg-page border border-border rounded-xl px-3 text-sm font-bold tabular-nums"
              />
            </div>
            <div className="col-span-5 relative">
              <select
                value={newItemTaxId}
                onChange={(e) => setNewItemTaxId(e.target.value)}
                className="w-full h-10 bg-page border border-border rounded-xl pl-2.5 pr-7 text-xs font-bold text-main appearance-none truncate"
              >
                {taxPresets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.rate}%)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-3 pointer-events-none text-muted"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 ? (
              <button
                type="button"
                onClick={() => setNewItemApplySC(!newItemApplySC)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  newItemApplySC
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-page border-border text-muted'
                }`}
              >
                {newItemApplySC ? '✓ Service Charge Applied' : 'No Service Charge on Item'}
              </button>
            ) : (
              <span className="text-[0.7rem] text-muted font-medium">
                Tap avatars on each dish below to assign shares
              </span>
            )}

            <button
              type="submit"
              className="h-10 px-5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform ml-auto"
            >
              <Plus size={15} /> {editingItemId ? 'Update Dish' : 'Add Dish'}
            </button>
          </div>
        </form>
      )}

      {/* ZONE 4: INTERACTIVE DISH CARDS (1-TAP AVATAR CLAIMING + INLINE TAX/SC + FRACTIONS) */}
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="bg-surface border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center gap-2">
            <Receipt size={28} className="text-muted/40" />
            <p className="text-sm font-bold text-main">No dishes on the receipt yet</p>
            <p className="text-xs text-muted max-w-xs">
              Tap <strong>Magic Scan</strong> above to extract a photo of your bill with AI, or add
              dishes manually.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const taxPreset = taxPresets.find((t) => t.id === item.taxPresetId);
              const dynamicTaxRate = taxPreset ? taxPreset.rate / 100 : 0;
              const itemSC =
                sessionRules.isScApplicable && item.applySC
                  ? item.totalBase * sessionRules.serviceChargeRate
                  : 0;

              let itemTaxAmount = item.totalBase * dynamicTaxRate;
              let scTaxAmount = 0;

              if (sessionRules.scTaxPresetId === 'inherit') {
                scTaxAmount = itemSC * dynamicTaxRate;
              } else if (sessionRules.scTaxPresetId !== 'none') {
                const scPreset = taxPresets.find((t) => t.id === sessionRules.scTaxPresetId);
                if (scPreset && itemSC > 0) scTaxAmount = itemSC * (scPreset.rate / 100);
              }

              const finalItemTotal = item.totalBase + itemSC + itemTaxAmount + scTaxAmount;

              let claimedQty = 0;
              members.forEach((m) => {
                claimedQty += utils.parseQty(formattedClaims[m.id]?.[item.id]);
              });
              const remainingQty = utils.round2(item.qty - claimedQty);
              const isFullyClaimed = Math.abs(remainingQty) < 0.01;
              const isOverClaimed = remainingQty < -0.01;
              const isCustomOpen = expandedCustomSplitItemId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className={`bg-surface border rounded-2xl p-4 shadow-sm flex flex-col gap-3 gpu-layer ${
                    isFullyClaimed
                      ? 'border-emerald-500/35'
                      : isOverClaimed
                        ? 'border-rose-500/50'
                        : 'border-border'
                  }`}
                >
                  {/* Top Row: Dish Name, Inline Tax/SC Badges & Total */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-main text-[0.95rem] leading-snug">
                          {item.name}
                        </span>
                        <span className="text-[0.7rem] font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border tabular-nums">
                          x{item.qty}
                        </span>
                        <span
                          className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                            isFullyClaimed
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : isOverClaimed
                                ? 'bg-rose-500/15 text-rose-500'
                                : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          {isFullyClaimed
                            ? '✓ Split'
                            : isOverClaimed
                              ? `Over by ${Math.abs(remainingQty)}`
                              : `${remainingQty} left`}
                        </span>
                      </div>

                      {/* Inline Tax Bracket Selector & Item-Wise Service Charge Pill */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted tabular-nums">
                          {utils.formatMoney(item.unitPrice)}/ea
                        </span>
                        <span className="text-muted text-xs">•</span>
                        {isHost ? (
                          <select
                            value={item.taxPresetId}
                            onChange={(e) => {
                              const nextPreset = taxPresets.find((t) => t.id === e.target.value);
                              actions.updateItemInDB({
                                ...item,
                                taxPresetId: e.target.value,
                                taxRate: nextPreset ? nextPreset.rate / 100 : 0,
                              });
                            }}
                            className="h-6! w-auto! py-0! pl-2! pr-5! text-[0.7rem]! font-bold bg-page border border-border rounded-md text-muted"
                          >
                            {taxPresets.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.rate}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[0.7rem] font-semibold text-muted">
                            {taxPreset ? `${taxPreset.name} (${taxPreset.rate}%)` : 'Tax'}
                          </span>
                        )}

                        {sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 && (
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={() =>
                              actions.updateItemInDB({ ...item, applySC: !item.applySC })
                            }
                            className={`px-1.5 py-0.5 rounded text-[0.65rem] font-bold border transition-colors ${
                              item.applySC
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-page border-border text-muted line-through'
                            }`}
                            title="Toggle Service Charge for this item"
                          >
                            +S.C.
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold text-main tabular-nums text-base">
                        {utils.formatMoney(finalItemTotal)}
                      </span>
                      {isHost && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-subtle"
                            aria-label="Edit dish"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => actions.removeItemFromDB(item.id)}
                            className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/10"
                            aria-label="Delete dish"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: 1-Tap Member Avatar Pills ([All] [Member 1] [Member 2]...) */}
                  {members.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1.5 flex-wrap flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAllOnItem(item)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all active:scale-95 ${
                            members.every(
                              (m) => utils.parseQty(formattedClaims[m.id]?.[item.id]) > 0
                            )
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-page text-muted border-border hover:text-main'
                          }`}
                        >
                          All
                        </button>

                        {members.map((m) => {
                          const rawClaim = formattedClaims[m.id]?.[item.id] || '';
                          const parsedClaim = utils.parseQty(rawClaim);
                          const isClaimed = parsedClaim > 0;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleToggleMemberOnItem(item, m.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1 ${
                                isClaimed
                                  ? 'bg-primary/15 text-primary border-primary/40 font-bold'
                                  : 'bg-page text-muted border-border hover:text-main'
                              }`}
                            >
                              <span>{m.name}</span>
                              {isClaimed && (
                                <span className="text-[0.65rem] bg-primary/20 px-1 rounded tabular-nums">
                                  {rawClaim}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedCustomSplitItemId(isCustomOpen ? null : item.id)}
                        className={`p-1.5 rounded-lg border text-xs font-bold shrink-0 transition-colors ${
                          isCustomOpen
                            ? 'bg-primary text-white border-primary'
                            : 'bg-page text-muted border-border hover:text-main'
                        }`}
                        title="Custom uneven or fractional shares"
                      >
                        <SlidersHorizontal size={14} />
                      </button>
                    </div>
                  )}

                  {/* Expandable Custom / Uneven Fractional Drawer */}
                  {isCustomOpen && (
                    <div className="bg-page border border-border rounded-xl p-3 flex flex-col gap-2.5 mt-1">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                        Custom Shares (Fractions like 1/3 or exact quantities)
                      </span>
                      {members.map((m) => {
                        const currentStr = formattedClaims[m.id]?.[item.id] || '';
                        return (
                          <div
                            key={m.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
                          >
                            <span className="text-xs font-bold text-main truncate">{m.name}</span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {FRACTION_PILLS.map((pill) => (
                                <button
                                  key={pill.label}
                                  type="button"
                                  onClick={() => actions.updateClaimInDB(m.id, item.id, pill.value)}
                                  className={`px-2 py-1 text-[0.65rem] font-bold rounded border transition-colors ${
                                    currentStr === pill.value
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-surface text-muted border-border'
                                  }`}
                                >
                                  {pill.label}
                                </button>
                              ))}
                              <div className="flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.max(
                                      0,
                                      utils.round2(utils.parseQty(currentStr) - 1)
                                    );
                                    actions.updateClaimInDB(
                                      m.id,
                                      item.id,
                                      next === 0 ? '' : next.toString()
                                    );
                                  }}
                                  className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center text-muted"
                                >
                                  <Minus size={12} />
                                </button>
                                <input
                                  type="text"
                                  value={currentStr}
                                  onChange={(e) =>
                                    actions.updateClaimInDB(m.id, item.id, e.target.value)
                                  }
                                  placeholder="0"
                                  className="w-14! h-7! px-1! text-center text-xs font-bold tabular-nums bg-surface border border-border rounded"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = utils.round2(utils.parseQty(currentStr) + 1);
                                    actions.updateClaimInDB(m.id, item.id, next.toString());
                                  }}
                                  className="w-7 h-7 rounded bg-surface border border-border flex items-center justify-center text-muted"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ZONE 5: LIVE INTERACTIVE BILL FOOTER (DISCOUNTS, SERVICE CHARGE, TAXES & GRAND TOTAL) */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col divide-y divide-border/60 mt-2">
        <div className="flex items-center justify-between pb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">
            Live Receipt Breakdown
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveRuleSheet('discount')}
              className="px-2.5 py-1 rounded-lg bg-page border border-border text-[0.7rem] font-bold text-primary hover:border-primary/40 flex items-center gap-1"
            >
              <Percent size={11} /> Discount
            </button>
            <button
              type="button"
              onClick={() => setActiveRuleSheet('sc')}
              className="px-2.5 py-1 rounded-lg bg-page border border-border text-[0.7rem] font-bold text-primary hover:border-primary/40"
            >
              S.C. ({Math.round(sessionRules.serviceChargeRate * 100)}%)
            </button>
            <button
              type="button"
              onClick={() => setActiveRuleSheet('taxes')}
              className="px-2.5 py-1 rounded-lg bg-page border border-border text-[0.7rem] font-bold text-primary hover:border-primary/40"
            >
              Taxes ({taxPresets.length})
            </button>
          </div>
        </div>

        {gs.discountAmount > 0 && gs.discountMode === 'pre-tax' && (
          <>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-muted">Raw Subtotal</span>
              <span className="font-semibold text-main tabular-nums">
                {utils.formatMoney(gs.rawSubTotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveRuleSheet('discount')}
              className="flex justify-between py-2 text-sm text-success w-full text-left hover:opacity-80"
            >
              <span className="font-medium underline decoration-dotted">
                Pre-Tax Discount ({sessionRules.discountType})
              </span>
              <span className="font-bold tabular-nums">
                - {utils.formatMoney(gs.discountAmount)}
              </span>
            </button>
          </>
        )}

        <div className="flex justify-between py-2 text-sm">
          <span className="text-muted">Base Subtotal</span>
          <span className="font-semibold text-main tabular-nums">
            {utils.formatMoney(gs.subTotal)}
          </span>
        </div>

        {Object.entries(gs.taxBreakdown).map(
          ([taxName, amount]) =>
            amount > 0 && (
              <button
                key={taxName}
                type="button"
                onClick={() => setActiveRuleSheet('taxes')}
                className="flex justify-between py-2 text-sm w-full text-left hover:bg-subtle/40"
              >
                <span className="text-muted underline decoration-dotted">{taxName}</span>
                <span className="font-semibold text-main tabular-nums">
                  {utils.formatMoney(amount)}
                </span>
              </button>
            )
        )}

        <button
          type="button"
          onClick={() => setActiveRuleSheet('sc')}
          className="flex justify-between py-2 text-sm w-full text-left hover:bg-subtle/40"
        >
          <span className="text-muted underline decoration-dotted">
            Service Charge ({Math.round(sessionRules.serviceChargeRate * 100)}% •{' '}
            {sessionRules.scTaxPresetId === 'inherit'
              ? 'Cascading Tax'
              : sessionRules.scTaxPresetId === 'none'
                ? 'Untaxed'
                : 'Global Tax'}
            )
          </span>
          <span className="font-semibold text-main tabular-nums">
            {utils.formatMoney(gs.serviceCharge)}
          </span>
        </button>

        {gs.discountAmount > 0 && gs.discountMode === 'post-tax' && (
          <>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-muted">Gross Total</span>
              <span className="font-semibold text-main tabular-nums">
                {utils.formatMoney(computedGrossTotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveRuleSheet('discount')}
              className="flex justify-between py-2 text-sm text-success w-full text-left hover:opacity-80"
            >
              <span className="font-medium underline decoration-dotted">
                Post-Tax Discount ({sessionRules.discountType})
              </span>
              <span className="font-bold tabular-nums">
                - {utils.formatMoney(gs.discountAmount)}
              </span>
            </button>
          </>
        )}

        {gs.roundOff !== 0 && (
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted">POS Round Off</span>
            <span className="font-semibold text-main tabular-nums">
              {gs.roundOff > 0 ? '+' : ''}
              {utils.formatMoney(gs.roundOff)}
            </span>
          </div>
        )}

        <div className="flex justify-between pt-3 pb-1 items-baseline">
          <span className="font-extrabold text-main text-base">Grand Total</span>
          <span className="font-extrabold text-primary text-2xl tabular-nums">
            {utils.formatMoney(gs.grandTotal)}
          </span>
        </div>
      </div>

      {/* DRAWER 1: MAGIC SCANNER */}
      <BottomSheet
        isOpen={showScannerDrawer}
        onClose={() => setShowScannerDrawer(false)}
        title="AI Magic Scan"
      >
        <MagicScanner onScanComplete={() => setShowScannerDrawer(false)} />
      </BottomSheet>

      {/* DRAWER 2: TABLE MEMBERS & 1-TAP FRIEND CHIPS */}
      <BottomSheet
        isOpen={showMemberSheet}
        onClose={() => setShowMemberSheet(false)}
        title="People at the Table"
      >
        <div className="flex flex-col gap-5 pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newMemberName.trim()) {
                  actions.addMemberToDB(newMemberName.trim());
                  setNewMemberName('');
                }
              }}
              placeholder="Type name or search Ekwly user..."
              className="flex-1 h-11 bg-page border border-border rounded-xl px-3.5 text-sm font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                if (!newMemberName.trim()) return;
                actions.addMemberToDB(newMemberName.trim());
                setNewMemberName('');
              }}
              className="h-11 px-4 bg-primary text-white rounded-xl font-bold text-xs shrink-0"
            >
              Add Guest
            </button>
          </div>

          {/* Live Profile Search Results */}
          {profileSearchResults.length > 0 && (
            <div className="bg-page border border-border rounded-xl divide-y divide-border overflow-hidden">
              {profileSearchResults.map((p) => {
                const alreadyAdded = members.some((m) => m.user_id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      actions.addMemberToDB(p.name, p.id);
                      setNewMemberName('');
                      setProfileSearchResults([]);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-subtle disabled:opacity-50"
                  >
                    <span className="font-bold text-sm text-main">{p.name}</span>
                    <span className="text-xs font-bold text-primary">
                      {alreadyAdded ? 'Added' : '+ Link User'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 1-Tap Friends Quick Chips */}
          {myFriends.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                1-Tap Add from Your Friends
              </span>
              <div className="flex flex-wrap gap-2">
                {myFriends.map((f) => {
                  const inRoom = members.some(
                    (m) => m.user_id === f.id || m.name.toLowerCase() === f.name.toLowerCase()
                  );
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={inRoom}
                      onClick={() => {
                        utils.haptic('light');
                        actions.addMemberToDB(f.name, f.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        inRoom
                          ? 'bg-primary/10 border-primary/30 text-primary opacity-60'
                          : 'bg-page border-border text-main hover:border-primary'
                      }`}
                    >
                      {inRoom ? `✓ ${f.name}` : `+ ${f.name}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Table Members List */}
          <div className="flex flex-col gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Current Table ({members.length})
            </span>
            <div className="bg-page border border-border rounded-xl divide-y divide-border">
              {members.map((m) => {
                const isMe = m.user_id === currentUserId;
                const canClaim =
                  !m.user_id &&
                  currentUserId &&
                  !members.some((mem) => mem.user_id === currentUserId);
                return (
                  <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-main">{m.name}</span>
                      {m.user_id === hostId && (
                        <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                          Host
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                          You
                        </span>
                      )}
                      {canClaim && (
                        <button
                          type="button"
                          onClick={() => actions.claimMemberIdentity(m.id)}
                          className="text-[0.65rem] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded"
                        >
                          Claim My Slot
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.removeMemberFromDB(m.id)}
                      className="p-1.5 text-muted hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* DRAWER 3: SERVICE CHARGE CONFIG */}
      <BottomSheet
        isOpen={activeRuleSheet === 'sc'}
        onClose={() => setActiveRuleSheet(null)}
        title="Service Charge Rules"
      >
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
                  <option value="inherit">Cascading: Inherit Each Item's Tax</option>
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

      {/* DRAWER 4: DISCOUNT CONFIG (PRE-TAX / POST-TAX / % / FLAT) */}
      <BottomSheet
        isOpen={activeRuleSheet === 'discount'}
        onClose={() => setActiveRuleSheet(null)}
        title="Restaurant & Platform Discounts"
      >
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
            {(['none', 'percentage', 'flat'] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={!isHost}
                onClick={() => actions.updateSessionRulesInDB({ discountType: type })}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  sessionRules.discountType === type
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-main'
                }`}
              >
                {type === 'flat' ? 'Flat (₹)' : type === 'percentage' ? 'Percent (%)' : 'None'}
              </button>
            ))}
          </div>

          {sessionRules.discountType !== 'none' && (
            <>
              <div className="flex items-center gap-1 bg-page p-1 rounded-xl border border-border">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => actions.updateSessionRulesInDB({ discountMode: 'pre-tax' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    sessionRules.discountMode === 'pre-tax'
                      ? 'bg-surface text-main border border-border shadow-sm'
                      : 'text-muted'
                  }`}
                >
                  Pre-Tax (Before GST/VAT)
                </button>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => actions.updateSessionRulesInDB({ discountMode: 'post-tax' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    sessionRules.discountMode === 'post-tax'
                      ? 'bg-surface text-main border border-border shadow-sm'
                      : 'text-muted'
                  }`}
                >
                  Post-Tax (On Final Bill)
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">
                  Discount {sessionRules.discountType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={!isHost}
                  value={localDiscount}
                  onChange={(e) => setLocalDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-bold tabular-nums"
                />
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* DRAWER 5: TAX BRACKETS & CGST/SGST SPLIT */}
      <BottomSheet
        isOpen={activeRuleSheet === 'taxes'}
        onClose={() => setActiveRuleSheet(null)}
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
                  className="w-20! h-10 bg-surface border border-border rounded-xl px-2 text-center text-sm font-bold tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <ToggleSwitch checked={newTaxSplit} onChange={setNewTaxSplit} />
                  <span className="text-xs font-semibold text-main">
                    Split 50/50 into CGST & SGST
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
    </div>
  );
}
