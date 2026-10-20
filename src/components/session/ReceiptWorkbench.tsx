import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Users,
  UserPlus,
  Percent,
  Receipt,
  SlidersHorizontal,
  Sparkles,
  Minus,
  Radio,
  BookmarkPlus,
  Tag,
  Layers,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { mathEngine } from '../../lib/mathEngine';
import { utils, showToast } from '../../lib/utils';
import type { DatabaseVenue, DatabaseItem, BillItem, SavedSquad } from '../../lib/types';
import MagicScanner from './MagicScanner';
import WorkbenchRuleDrawers from './WorkbenchRuleDrawers';
import BottomSheet from '../ui/BottomSheet';

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
    isRealtimeActive,
    enableRealtime,
    actions,
    formattedClaims,
    liveCalculation,
  } = useSessionContext();

  // --- VENUE AUTOCOMPLETE STATE ---
  const [localVenue, setLocalVenue] = useState<string>(sessionRules.venueName);
  const [venueResults, setVenueResults] = useState<DatabaseVenue[]>([]);
  const [isSearchingVenue, setIsSearchingVenue] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [showScannerDrawer, setShowScannerDrawer] = useState(false);

  // --- MEMBER, FRIEND & SAVED SQUAD QUICK-ADD STATE ---
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [myFriends, setMyFriends] = useState<FriendQuickChip[]>([]);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [newSquadNameInput, setNewSquadNameInput] = useState('');
  const [showSaveSquadForm, setShowSaveSquadForm] = useState(false);
  const [profileSearchResults, setProfileSearchResults] = useState<FriendQuickChip[]>([]);
  const [, setIsSearchingProfiles] = useState(false);

  // --- ADD / EDIT DISH STATE ---
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemTaxId, setNewItemTaxId] = useState<string>(taxPresets[0]?.id || 'tx-1');
  const [newItemApplySC, setNewItemApplySC] = useState<boolean>(true);
  const [hasNewItemOffer, setHasNewItemOffer] = useState<boolean>(false);
  const [newItemDiscType, setNewItemDiscType] = useState<'percentage' | 'flat'>('percentage');
  const [newItemDiscVal, setNewItemDiscVal] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemResults, setItemResults] = useState<DatabaseItem[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- EXPANDED CUSTOM SPLIT DISH ID ---
  const [expandedCustomSplitItemId, setExpandedCustomSplitItemId] = useState<string | null>(null);

  // --- CONTEXTUAL RULE DRAWERS (DISCOUNT, SERVICE CHARGE, TAX BRACKETS) ---
  const [activeRuleSheet, setActiveRuleSheet] = useState<'sc' | 'discount' | 'taxes' | null>(null);

  useEffect(() => {
    setLocalVenue(sessionRules.venueName);
  }, [sessionRules.venueName]);

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

  // Load connected Ekwly Friends & Saved Squads for 1-tap table population
  useEffect(() => {
    setSavedSquads(utils.getSavedSquads(currentUserId));
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

  const handleApplySquad = async (squad: SavedSquad) => {
    utils.haptic('medium');
    const addedCount = await actions.addMembersBatchToDB(squad.members);
    if (addedCount > 0) {
      showToast(`Added ${addedCount} from "${squad.name}"!`, 'success');
    } else {
      showToast(`Everyone from "${squad.name}" is already at the table.`, 'default');
    }
  };

  const handleSaveCurrentTableAsSquad = () => {
    const trimmed = newSquadNameInput.trim();
    if (!trimmed) return showToast('Enter a name for this squad.', 'error');
    const nonSelfMembers = members
      .filter((m) => !currentUserId || m.user_id !== currentUserId)
      .map((m) => ({ name: m.name, user_id: m.user_id || null }));

    if (nonSelfMembers.length === 0) {
      return showToast('Add at least 1 other person to save a squad.', 'error');
    }

    const newSquad: SavedSquad = {
      id: utils.generateId(),
      name: trimmed,
      members: nonSelfMembers,
      createdAt: new Date().toISOString(),
    };
    const next = [newSquad, ...savedSquads];
    setSavedSquads(next);
    utils.saveSquads(currentUserId, next);
    setNewSquadNameInput('');
    setShowSaveSquadForm(false);
    showToast(`Saved "${trimmed}" squad!`, 'success');
  };

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
    const parsedDiscVal = hasNewItemOffer ? parseFloat(newItemDiscVal) || 0 : 0;
    const finalDiscType = hasNewItemOffer && parsedDiscVal > 0 ? newItemDiscType : 'none';

    if (editingItemId) {
      const existing = items.find((i) => i.id === editingItemId);
      actions.updateItemInDB({
        id: editingItemId,
        name: newItemName.trim(),
        qty: qtyParsed,
        unitPrice: priceParsed,
        taxRate,
        taxPresetId: newItemTaxId,
        applySC: newItemApplySC,
        applyDiscount: existing?.applyDiscount !== false,
        discountType: finalDiscType,
        discountValue: finalDiscType === 'none' ? 0 : parsedDiscVal,
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
        applyDiscount: true,
        discountType: finalDiscType,
        discountValue: finalDiscType === 'none' ? 0 : parsedDiscVal,
        totalBase,
      });
    }
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
    setHasNewItemOffer(false);
    setNewItemDiscVal('');
    setShowItemDropdown(false);
  };

  const handleEditItem = (item: BillItem) => {
    utils.haptic('light');
    setNewItemName(item.name);
    setNewItemQty(item.qty.toString());
    setNewItemPrice(item.unitPrice.toString());
    setNewItemTaxId(item.taxPresetId);
    setNewItemApplySC(item.applySC);
    const itemHasOffer =
      Boolean(item.discountType && item.discountType !== 'none') && Number(item.discountValue) > 0;
    setHasNewItemOffer(itemHasOffer);
    setNewItemDiscType(item.discountType === 'flat' ? 'flat' : 'percentage');
    setNewItemDiscVal(item.discountValue ? item.discountValue.toString() : '');
    setEditingItemId(item.id);
    window.scrollTo({ top: 220, behavior: 'smooth' });
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

  const gs = liveCalculation.globalSummary;
  const computedGrossTotal =
    gs.subTotal + gs.serviceCharge + Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);

  // Compute preTaxMultiplier for individual Dish Card display parity
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

  const preTaxMultiplier =
    eligibleBaseAfterItemDisc > 0
      ? (eligibleBaseAfterItemDisc - gs.preTaxDiscountAmount) / eligibleBaseAfterItemDisc
      : 1;

  const hasActivePreTaxBillDiscount = gs.preTaxDiscountAmount > 0;
  const scPercent = Math.round(sessionRules.serviceChargeRate * 100);

  return (
    <div className="w-full flex flex-col gap-3.5 px-4 pt-3 pb-36">
      {/* ZONE 1: VENUE & AI MAGIC SCAN HEADER CARD */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5 relative z-30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted">
              {isSearchingVenue ? (
                <Loader2 size={15} className="animate-spin text-primary" />
              ) : (
                <Search size={15} />
              )}
            </div>
            <input
              type="text"
              disabled={!isHost}
              value={localVenue}
              onChange={(e) => setLocalVenue(e.target.value)}
              placeholder="Venue (e.g. Toit, Chin Lung)"
              className="w-full h-11 bg-page border border-border rounded-xl pl-10 pr-3 text-sm font-semibold text-main"
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

      {/* ZONE 2: "AT THE TABLE" MEMBER BAR + 1-TAP FRIEND & SAVED SQUAD CHIPS */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Users size={13} className="text-primary" /> At the Table ({members.length})
            </span>
            <button
              type="button"
              onClick={() => {
                if (!isRealtimeActive) {
                  utils.haptic('light');
                  enableRealtime();
                  showToast('Live Multiplayer Sync activated!', 'success');
                }
              }}
              className={`px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                isRealtimeActive
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                  : 'bg-page text-muted border-border hover:text-main'
              }`}
              title={
                isRealtimeActive
                  ? 'Realtime WebSockets active'
                  : 'Solo Fast Mode (Tap or open Invite QR to enable live multiplayer sync)'
              }
            >
              <Radio size={10} className={isRealtimeActive ? 'animate-pulse' : ''} />
              {isRealtimeActive ? 'Live Sync' : 'Solo Mode'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setShowMemberSheet(true);
            }}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <UserPlus size={14} /> Add / Squads
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
                <span className="font-bold truncate max-w-28">{m.name}</span>
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

        {isHost && members.length <= 1 && savedSquads.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-border/50">
            <span className="text-[0.65rem] font-bold text-muted shrink-0 pr-1">Squads:</span>
            {savedSquads.map((squad) => (
              <button
                key={squad.id}
                type="button"
                onClick={() => handleApplySquad(squad)}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[0.7rem] font-bold flex items-center gap-1 active:scale-95 transition-transform"
              >
                <Sparkles size={11} /> + {squad.name} ({squad.members.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ZONE 2.5: PROMINENT BILL RULES, DISCOUNTS, S.C. & TAX BRACKETS BAR */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
            <Layers size={13} className="text-primary" /> Bill Rules, Taxes &amp; Offers
          </span>
          <span className="text-[0.65rem] text-muted font-medium">Tap to configure</span>
        </div>

        {/* Row 1: Global Discounts, Service Charge, and Custom Tax Trigger */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setActiveRuleSheet('discount');
            }}
            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all active:scale-95 ${
              gs.discountAmount > 0
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-500'
                : 'bg-page border-border text-main hover:border-primary/40'
            }`}
          >
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <Percent size={10} className="text-emerald-500" /> Discounts
            </span>
            <span className="text-xs font-extrabold tabular-nums truncate">
              {gs.discountAmount > 0 ? `-${utils.formatMoney(gs.discountAmount)}` : 'Add Offer'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setActiveRuleSheet('sc');
            }}
            className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all active:scale-95 ${
              sessionRules.isScApplicable && scPercent > 0
                ? 'bg-primary/10 border-primary/35 text-primary'
                : 'bg-page border-border text-main hover:border-primary/40'
            }`}
          >
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
              Service Chg
            </span>
            <span className="text-xs font-extrabold tabular-nums truncate">
              {sessionRules.isScApplicable && scPercent > 0 ? `${scPercent}% Active` : 'None (0%)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setActiveRuleSheet('taxes');
            }}
            className="p-2.5 rounded-xl border bg-page border-border hover:border-primary/40 text-main text-left flex flex-col gap-0.5 transition-all active:scale-95"
          >
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
              Tax Brackets
            </span>
            <span className="text-xs font-extrabold text-primary truncate">
              {taxPresets.length} Active • +Add
            </span>
          </button>
        </div>

        {/* Row 2: Visible Tax Preset Pills + 1-Tap "+ Custom Tax" */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {taxPresets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveRuleSheet('taxes')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-page border border-border text-[0.68rem] font-bold text-muted hover:text-main hover:border-primary/40 tabular-nums flex items-center gap-1"
            >
              <span className="text-main">{t.name}</span>
              <span className="text-primary">{t.rate}%</span>
            </button>
          ))}
          {isHost && (
            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setActiveRuleSheet('taxes');
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-dashed border-primary/40 text-primary text-[0.68rem] font-bold flex items-center gap-1 hover:bg-primary/5"
            >
              <Plus size={11} /> Custom Tax
            </button>
          )}
        </div>
      </div>

      {/* ZONE 3: ADD / EDIT DISH BAR (HOST ONLY — WITH VISIBLE TAX PILLS & COMPACT OFFER TOGGLE) */}
      {isHost && (
        <form
          onSubmit={handleSaveItem}
          className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative z-20"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted">
              {editingItemId ? 'Editing Dish on Receipt' : 'Add Dish to Receipt'}
            </span>
            {editingItemId && (
              <button
                type="button"
                onClick={() => {
                  setEditingItemId(null);
                  setNewItemName('');
                  setNewItemQty('1');
                  setNewItemPrice('');
                  setHasNewItemOffer(false);
                  setNewItemDiscVal('');
                }}
                className="text-xs font-bold text-danger"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Dish Name + Qty + Unit Price Row */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-6 relative">
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

            <div className="col-span-4 sm:col-span-2">
              <input
                type="number"
                inputMode="decimal"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qty"
                min="0.01"
                step="any"
                className="w-full h-11 bg-page border border-border rounded-xl px-2 text-center text-sm font-bold tabular-nums"
              />
            </div>

            <div className="col-span-8 sm:col-span-4 relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-sm">
                ₹
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Unit Price"
                min="0"
                step="any"
                className="w-full h-11 bg-page border border-border rounded-xl pl-7 pr-3 text-sm font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Clear, Un-Truncated 1-Tap Tax Bracket Selector Pills */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Select Item Tax Bracket
              </span>
              <button
                type="button"
                onClick={() => setActiveRuleSheet('taxes')}
                className="text-[0.68rem] font-bold text-primary hover:underline"
              >
                + Add Custom Tax
              </button>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {taxPresets.map((t) => {
                const isSelected = newItemTaxId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      utils.haptic('light');
                      setNewItemTaxId(t.id);
                    }}
                    className={`shrink-0 h-8 px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 tabular-nums ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-page text-muted border-border hover:text-main'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={isSelected ? 'text-white/90' : 'text-primary'}>{t.rate}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Row: Compact Toggle Chips (+S.C., % Item Discount) + Submit Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5 flex-wrap">
              {sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 && (
                <button
                  type="button"
                  onClick={() => setNewItemApplySC(!newItemApplySC)}
                  className={`h-8 px-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    newItemApplySC
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-page border-border text-muted line-through'
                  }`}
                >
                  +S.C.
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  utils.haptic('light');
                  setHasNewItemOffer(!hasNewItemOffer);
                }}
                className={`h-8 px-2.5 rounded-xl text-xs font-bold border flex items-center gap-1 transition-colors ${
                  hasNewItemOffer
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-500'
                    : 'bg-page border-border text-muted hover:text-main'
                }`}
              >
                <Tag size={12} />
                <span>{hasNewItemOffer ? 'Item Discounted' : '+ Item Discount'}</span>
                {hasNewItemOffer && <X size={12} className="ml-0.5" />}
              </button>
            </div>

            <button
              type="submit"
              className="h-9 px-4 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform ml-auto shrink-0"
            >
              <Plus size={14} /> {editingItemId ? 'Update Dish' : 'Add Dish'}
            </button>
          </div>

          {/* Conditional Inline Item Discount Input (Only shown when '+ Item Discount' chip is active) */}
          {hasNewItemOffer && (
            <div className="flex items-center gap-2 bg-page border border-emerald-500/30 p-2.5 rounded-xl">
              <div className="flex bg-surface p-0.5 rounded-lg border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setNewItemDiscType('percentage')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    newItemDiscType === 'percentage' ? 'bg-emerald-500 text-white' : 'text-muted'
                  }`}
                >
                  % Off
                </button>
                <button
                  type="button"
                  onClick={() => setNewItemDiscType('flat')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    newItemDiscType === 'flat' ? 'bg-emerald-500 text-white' : 'text-muted'
                  }`}
                >
                  ₹ Off
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={newItemDiscVal}
                onChange={(e) => setNewItemDiscVal(e.target.value)}
                placeholder={
                  newItemDiscType === 'percentage'
                    ? 'Enter % off this item (e.g. 20)'
                    : 'Enter ₹ off this item (e.g. 100)'
                }
                className="flex-1 h-8 bg-surface border border-border rounded-lg px-2.5 text-xs font-bold tabular-nums"
              />
            </div>
          )}
        </form>
      )}

      {/* ZONE 4: SKEUOMORPHIC LIVE THERMAL POS RECEIPT (UNIFIED DISH LIST + ACCOUNTING LEDGER) */}
      <div className="mt-1">
        <div className="pos-receipt-edge-top" />
        <div className="pos-receipt px-4 py-5 flex flex-col gap-3">
          {/* RECEIPT PAPER HEADER */}
          <div className="flex flex-col items-center text-center pb-3 pos-double-line pt-3">
            <span className="text-[0.62rem] font-mono font-bold uppercase tracking-[0.22em] text-muted">
              ★ LIVE POS SPLIT RECEIPT ★
            </span>
            <h3 className="text-base font-extrabold text-main tracking-tight mt-0.5">
              {sessionRules.venueName || 'Dining Table Receipt'}
            </h3>
            <span className="text-[0.68rem] font-mono text-muted tabular-nums mt-0.5">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              • {members.length} {members.length === 1 ? 'Guest' : 'Guests'} • {items.length}{' '}
              {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {/* RECEIPT LINE ITEMS */}
          {items.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <Receipt size={26} className="text-muted/40" />
              <p className="text-sm font-bold text-main">Receipt is currently blank</p>
              <p className="text-xs text-muted max-w-xs">
                Tap <strong>Magic Scan</strong> at the top to extract your paper bill with AI, or
                add dishes above.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-dashed divide-border/80">
              <AnimatePresence initial={false}>
                {items.map((item, idx) => {
                  const breakdown = mathEngine.calculateItemBreakdown(item, {
                    taxPresets,
                    isScApplicable: sessionRules.isScApplicable,
                    serviceChargeRate: sessionRules.serviceChargeRate,
                    scTaxPresetId: sessionRules.scTaxPresetId,
                    preTaxMultiplier,
                  });

                  let claimedQty = 0;
                  members.forEach((m) => {
                    claimedQty += utils.parseQty(formattedClaims[m.id]?.[item.id]);
                  });
                  const remainingQty = utils.round2(item.qty - claimedQty);
                  const isFullyClaimed = Math.abs(remainingQty) < 0.01;
                  const isOverClaimed = remainingQty < -0.01;
                  const isCustomOpen = expandedCustomSplitItemId === item.id;
                  const hasItemDisc = breakdown.itemDiscountAmount > 0;

                  return (
                    <motion.div
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="py-3.5 first:pt-1 flex flex-col gap-2.5 gpu-layer"
                    >
                      {/* Receipt Line 1: Item Number, Dish Name, Qty, Status & Line Total */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[0.7rem] font-mono font-bold text-muted tabular-nums">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <span className="font-bold text-main text-[0.95rem] leading-snug">
                              {item.name}
                            </span>
                            <span className="text-[0.68rem] font-mono font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border tabular-nums">
                              x{item.qty}
                            </span>
                            {hasItemDisc && (
                              <span className="text-[0.62rem] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 tabular-nums">
                                -
                                {item.discountType === 'percentage'
                                  ? `${item.discountValue}%`
                                  : utils.formatMoney(breakdown.itemDiscountAmount)}
                              </span>
                            )}
                            <span
                              className={`text-[0.62rem] font-bold px-2 py-0.5 rounded-full tabular-nums ${
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
                                  ? `Over ${Math.abs(remainingQty)}`
                                  : `${remainingQty} left`}
                            </span>
                          </div>

                          {/* Receipt Sub-Line: Unit Price + Compact Tax Pill + S.C. Pill */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap pl-5">
                            <span className="text-[0.72rem] font-mono text-muted tabular-nums">
                              {utils.formatMoney(item.unitPrice)}/ea
                            </span>
                            <span className="text-muted text-xs">•</span>
                            {isHost ? (
                              <select
                                value={item.taxPresetId}
                                onChange={(e) => {
                                  const nextPreset = taxPresets.find(
                                    (t) => t.id === e.target.value
                                  );
                                  actions.updateItemInDB({
                                    ...item,
                                    taxPresetId: e.target.value,
                                    taxRate: nextPreset ? nextPreset.rate / 100 : 0,
                                  });
                                }}
                                className="h-6 w-auto py-0 px-2 text-[0.68rem] font-bold bg-page border border-border rounded-md text-primary cursor-pointer"
                              >
                                {taxPresets.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.rate}%)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[0.68rem] font-semibold text-muted">
                                {breakdown.preset
                                  ? `${breakdown.preset.name} (${breakdown.preset.rate}%)`
                                  : 'Tax'}
                              </span>
                            )}

                            {sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 && (
                              <button
                                type="button"
                                disabled={!isHost}
                                onClick={() =>
                                  actions.updateItemInDB({ ...item, applySC: !item.applySC })
                                }
                                className={`px-1.5 py-0.5 rounded text-[0.62rem] font-bold border transition-colors ${
                                  item.applySC
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-page border-border text-muted line-through'
                                }`}
                              >
                                +S.C.
                              </button>
                            )}

                            {hasActivePreTaxBillDiscount && (
                              <button
                                type="button"
                                disabled={!isHost}
                                onClick={() =>
                                  actions.updateItemInDB({
                                    ...item,
                                    applyDiscount: item.applyDiscount === false,
                                  })
                                }
                                className={`px-1.5 py-0.5 rounded text-[0.62rem] font-bold border transition-colors ${
                                  item.applyDiscount !== false
                                    ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-500'
                                    : 'bg-page border-border text-muted line-through'
                                }`}
                              >
                                Pre-Tax Disc
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono font-extrabold text-main tabular-nums text-[0.95rem]">
                            {utils.formatMoney(breakdown.finalTotal)}
                          </span>
                          {isHost && (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-subtle"
                                aria-label="Edit dish"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => actions.removeItemFromDB(item.id)}
                                className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/10"
                                aria-label="Delete dish"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 1-Tap Member Avatar Split Pills */}
                      {members.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pl-5">
                          <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAllOnItem(item)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition-all active:scale-95 ${
                                members.every(
                                  (m) => utils.parseQty(formattedClaims[m.id]?.[item.id]) > 0
                                )
                                  ? 'bg-primary text-white border-primary shadow-2xs'
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
                                    <span className="text-[0.62rem] font-mono bg-primary/20 px-1 rounded tabular-nums">
                                      {rawClaim}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCustomSplitItemId(isCustomOpen ? null : item.id)
                            }
                            className={`p-1.5 rounded-lg border text-xs font-bold shrink-0 transition-colors ${
                              isCustomOpen
                                ? 'bg-primary text-white border-primary'
                                : 'bg-page text-muted border-border hover:text-main'
                            }`}
                            title="Custom uneven or fractional shares"
                          >
                            <SlidersHorizontal size={13} />
                          </button>
                        </div>
                      )}

                      {/* Expandable Custom Fractional Stepper */}
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
                                <span className="text-xs font-bold text-main truncate">
                                  {m.name}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {FRACTION_PILLS.map((pill) => (
                                    <button
                                      key={pill.label}
                                      type="button"
                                      onClick={() =>
                                        actions.updateClaimInDB(m.id, item.id, pill.value)
                                      }
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
                                      className="w-14 h-7 px-1 text-center text-xs font-bold tabular-nums bg-surface border border-border rounded"
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
            </div>
          )}

          {/* PERFORATED THERMAL TEAR DIVIDER */}
          <div className="relative py-2 my-1">
            <div className="pos-notch-left" />
            <div className="pos-notch-right" />
            <div className="pos-dashed-line w-full" />
          </div>

          {/* LIVE RECEIPT ACCOUNTING SUMMARY (INTEGRATED ON THE SAME RECEIPT PAPER) */}
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Tax &amp; Charge Breakdown
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('discount')}
                  className="px-2 py-0.5 rounded bg-page border border-border text-[0.65rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  % Offers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('sc')}
                  className="px-2 py-0.5 rounded bg-page border border-border text-[0.65rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  S.C. ({scPercent}%)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('taxes')}
                  className="px-2 py-0.5 rounded bg-page border border-border text-[0.65rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  Taxes ({taxPresets.length})
                </button>
              </div>
            </div>

            {(gs.itemDiscountAmount > 0 || gs.preTaxDiscountAmount > 0) && (
              <div className="flex justify-between py-1">
                <span className="text-muted">RAW SUBTOTAL</span>
                <span className="font-bold text-main tabular-nums">
                  {utils.formatMoney(gs.rawSubTotal)}
                </span>
              </div>
            )}

            {gs.itemDiscountAmount > 0 && (
              <button
                type="button"
                onClick={() => setActiveRuleSheet('discount')}
                className="flex justify-between py-1 text-emerald-500 w-full text-left hover:opacity-80"
              >
                <span className="underline decoration-dotted">ITEM / SECTION OFFERS</span>
                <span className="font-bold tabular-nums">
                  - {utils.formatMoney(gs.itemDiscountAmount)}
                </span>
              </button>
            )}

            {gs.preTaxDiscountAmount > 0 && (
              <button
                type="button"
                onClick={() => setActiveRuleSheet('discount')}
                className="flex justify-between py-1 text-emerald-500 w-full text-left hover:opacity-80"
              >
                <span className="underline decoration-dotted">PRE-TAX DISCOUNT</span>
                <span className="font-bold tabular-nums">
                  - {utils.formatMoney(gs.preTaxDiscountAmount)}
                </span>
              </button>
            )}

            <div className="flex justify-between py-1">
              <span className="text-muted">TAXABLE BASE SUBTOTAL</span>
              <span className="font-bold text-main tabular-nums">
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
                    className="flex justify-between py-1 w-full text-left hover:opacity-80"
                  >
                    <span className="text-muted underline decoration-dotted uppercase">
                      {taxName}
                    </span>
                    <span className="font-bold text-main tabular-nums">
                      {utils.formatMoney(amount)}
                    </span>
                  </button>
                )
            )}

            <button
              type="button"
              onClick={() => setActiveRuleSheet('sc')}
              className="flex justify-between py-1 w-full text-left hover:opacity-80"
            >
              <span className="text-muted underline decoration-dotted">
                SERVICE CHARGE ({scPercent}% •{' '}
                {sessionRules.scTaxPresetId === 'inherit'
                  ? 'CASCADING'
                  : sessionRules.scTaxPresetId === 'none'
                    ? 'UNTAXED'
                    : 'GLOBAL'}
                )
              </span>
              <span className="font-bold text-main tabular-nums">
                {utils.formatMoney(gs.serviceCharge)}
              </span>
            </button>

            {gs.postTaxDiscountAmount > 0 && (
              <>
                <div className="flex justify-between py-1">
                  <span className="text-muted">GROSS TOTAL</span>
                  <span className="font-bold text-main tabular-nums">
                    {utils.formatMoney(computedGrossTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('discount')}
                  className="flex justify-between py-1 text-emerald-500 w-full text-left hover:opacity-80"
                >
                  <span className="underline decoration-dotted">POST-TAX COUPON</span>
                  <span className="font-bold tabular-nums">
                    - {utils.formatMoney(gs.postTaxDiscountAmount)}
                  </span>
                </button>
              </>
            )}

            {gs.roundOff !== 0 && (
              <div className="flex justify-between py-1">
                <span className="text-muted">POS ROUND OFF</span>
                <span className="font-bold text-main tabular-nums">
                  {gs.roundOff > 0 ? '+' : ''}
                  {utils.formatMoney(gs.roundOff)}
                </span>
              </div>
            )}

            <div className="pos-double-line my-2" />

            <div className="flex justify-between items-baseline pt-1">
              <span className="font-sans font-extrabold text-main text-base tracking-tight">
                GRAND TOTAL
              </span>
              <span className="font-mono font-extrabold text-primary text-2xl tabular-nums">
                {utils.formatMoney(gs.grandTotal)}
              </span>
            </div>
          </div>
        </div>
        <div className="pos-receipt-edge-bottom" />
      </div>

      {/* DRAWER 1: MAGIC SCANNER */}
      <BottomSheet
        isOpen={showScannerDrawer}
        onClose={() => setShowScannerDrawer(false)}
        title="AI Magic Scan"
      >
        <MagicScanner onScanComplete={() => setShowScannerDrawer(false)} />
      </BottomSheet>

      {/* DRAWER 2: TABLE MEMBERS, SAVED SQUADS & 1-TAP FRIEND CHIPS */}
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

          {savedSquads.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1">
                <Sparkles size={11} className="text-primary" /> 1-Tap Add Saved Squad
              </span>
              <div className="flex flex-wrap gap-2">
                {savedSquads.map((squad) => (
                  <button
                    key={squad.id}
                    type="button"
                    onClick={() => handleApplySquad(squad)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all active:scale-95"
                  >
                    + {squad.name} ({squad.members.length})
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                Current Table ({members.length})
              </span>
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowSaveSquadForm(!showSaveSquadForm)}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <BookmarkPlus size={13} /> Save Table as Squad
                </button>
              )}
            </div>

            {showSaveSquadForm && (
              <div className="flex gap-2 bg-page border border-primary/30 p-2.5 rounded-xl">
                <input
                  type="text"
                  value={newSquadNameInput}
                  onChange={(e) => setNewSquadNameInput(e.target.value)}
                  placeholder="Squad Name (e.g. Friday Crew)"
                  className="flex-1 h-9 bg-surface border border-border rounded-lg px-2.5 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentTableAsSquad}
                  className="h-9 px-3 bg-primary text-white rounded-lg font-bold text-xs shrink-0"
                >
                  Save
                </button>
              </div>
            )}

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

      {/* EXTRACTED RULE DRAWERS (SERVICE CHARGE, 3-LAYER DISCOUNTS & TAX BRACKETS) */}
      <WorkbenchRuleDrawers
        activeSheet={activeRuleSheet}
        onClose={() => setActiveRuleSheet(null)}
      />
    </div>
  );
}
