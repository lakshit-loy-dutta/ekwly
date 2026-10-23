import { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Store,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { mathEngine } from '../../lib/mathEngine';
import { utils, showToast } from '../../lib/utils';
import type {
  DatabaseVenue,
  DatabaseItem,
  BillItem,
  SavedSquad,
  SquadMember,
} from '../../lib/types';
import MagicScanner from './MagicScanner';
import WorkbenchRuleDrawers from './WorkbenchRuleDrawers';
import BottomSheet from '../ui/BottomSheet';
import ProUpgradeSheet from '../ui/ProUpgradeSheet';
import AnimatedNumber from '../ui/AnimatedNumber';

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

/** 32-tooth SVG serrated edge fused seamlessly into .pos-receipt with -1px overlap */
function ThermalReceiptSawtooth({ position }: { position: 'top' | 'bottom' }) {
  const teethCount = 32;
  const width = 640;
  const height = 12;
  const step = width / teethCount;

  const pts: string[] = [];
  if (position === 'top') {
    pts.push(`0,${height}`);
    for (let i = 0; i < teethCount; i++) {
      const xStart = i * step;
      const xMid = xStart + step / 2;
      pts.push(`${xStart},${height}`);
      pts.push(`${xMid},1`);
    }
    pts.push(`${width},${height}`);
  } else {
    pts.push('0,0');
    for (let i = 0; i < teethCount; i++) {
      const xStart = i * step;
      const xMid = xStart + step / 2;
      pts.push(`${xStart},0`);
      pts.push(`${xMid},${height - 1}`);
    }
    pts.push(`${width},0`);
  }

  const edgePolyline = pts.slice(1, -1).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="geometricPrecision"
      className={`w-full h-3 block select-none pointer-events-none relative z-20 ${
        position === 'top' ? '-mb-px' : '-mt-px'
      }`}
      aria-hidden="true"
    >
      <polygon points={pts.join(' ')} fill="var(--receipt-bg)" />
      <polyline
        points={edgePolyline}
        fill="none"
        stroke="var(--receipt-border)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  // --- AI MAGIC SCAN QUOTA & ONBOARDING BANNER STATE ---
  const [scansRemaining, setScansRemaining] = useState<number>(3);
  const [isProUser, setIsProUser] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [showQuotaUpsellModal, setShowQuotaUpsellModal] = useState<boolean>(false);
  const [showMagicPromoBanner, setShowMagicPromoBanner] = useState<boolean>(() =>
    typeof window !== 'undefined' ? !localStorage.getItem('ekwly_hide_magic_promo') : true
  );

  // --- VENUE AUTOCOMPLETE STATE (With Remount Guard so Popup Never Re-Triggers Uninvited) ---
  const [localVenue, setLocalVenue] = useState<string>(sessionRules.venueName);
  const [venueResults, setVenueResults] = useState<DatabaseVenue[]>([]);
  const [isSearchingVenue, setIsSearchingVenue] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [loadedVenueBadge, setLoadedVenueBadge] = useState<string | null>(
    sessionRules.venueName || null
  );
  const isVenueEditedByUserRef = useRef<boolean>(false);
  const [showScannerDrawer, setShowScannerDrawer] = useState(false);

  // --- COLLAPSIBLE BILL RULES & TAXES STATE ---
  const [isRulesCollapsed, setIsRulesCollapsed] = useState<boolean>(items.length > 0);

  // --- MEMBER, FRIEND & SAVED SQUAD QUICK-ADD STATE ---
  const [showMemberSheet, setShowMemberSheet] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [myFriends, setMyFriends] = useState<FriendQuickChip[]>([]);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [newSquadNameInput, setNewSquadNameInput] = useState('');
  const [showSaveSquadForm, setShowSaveSquadForm] = useState(false);
  const [profileSearchResults, setProfileSearchResults] = useState<FriendQuickChip[]>([]);
  const [, setIsSearchingProfiles] = useState(false);

  // --- ADD / EDIT ITEM STATE ---
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

  // --- EXPANDED CUSTOM SPLIT ITEM ID ---
  const [expandedCustomSplitItemId, setExpandedCustomSplitItemId] = useState<string | null>(null);

  // --- CONTEXTUAL RULE DRAWERS (DISCOUNT, SERVICE CHARGE, TAX BRACKETS) ---
  const [activeRuleSheet, setActiveRuleSheet] = useState<'sc' | 'discount' | 'taxes' | null>(null);

  // Fetch user's Magic Scan quota and Pro status
  useEffect(() => {
    if (!currentUserId) return;
    const fetchQuota = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_scans_used, last_scan_reset, pro_expires_at, email')
        .eq('id', currentUserId)
        .maybeSingle();
      if (!profile) return;

      setUserEmail(profile.email || '');
      const now = new Date();
      const proActive = Boolean(profile.pro_expires_at && new Date(profile.pro_expires_at) > now);
      setIsProUser(proActive);

      const lastReset = new Date(profile.last_scan_reset || 0);
      const monthRolledOver =
        now.getUTCFullYear() > lastReset.getUTCFullYear() ||
        now.getUTCMonth() > lastReset.getUTCMonth();
      const used = monthRolledOver ? 0 : Number(profile.ai_scans_used || 0);
      setScansRemaining(Math.max(0, 3 - used));
    };
    fetchQuota();
  }, [currentUserId, items.length]);

  // Auto-populate pending Saved Squad if launched via 1-Tap Squad Split from Home
  useEffect(() => {
    if (!isHost || typeof window === 'undefined') return;
    const sId = new URLSearchParams(window.location.search).get('s');
    if (!sId) return;
    const pendingKey = `ekwly_pending_squad_${sId}`;
    const rawPending = localStorage.getItem(pendingKey);
    if (!rawPending) return;

    localStorage.removeItem(pendingKey);
    try {
      const parsedMembers = JSON.parse(rawPending) as SquadMember[];
      if (Array.isArray(parsedMembers) && parsedMembers.length > 0) {
        actions.addMembersBatchToDB(parsedMembers).then((count) => {
          if (count > 0) showToast(`Added ${count} squad members to the table!`, 'success');
        });
      }
    } catch {
      // Ignore malformed storage entry
    }
  }, [isHost, actions]);

  // Sync venue name from DB without opening the dropdown tray
  useEffect(() => {
    setLocalVenue(sessionRules.venueName);
    if (sessionRules.venueName && !isVenueEditedByUserRef.current) {
      setLoadedVenueBadge(sessionRules.venueName);
      setShowVenueDropdown(false);
    }
  }, [sessionRules.venueName]);

  useEffect(() => {
    if (taxPresets.length > 0 && !taxPresets.some((t) => t.id === newItemTaxId)) {
      setNewItemTaxId(taxPresets[0].id);
    }
  }, [taxPresets, newItemTaxId]);

  // Debounce venue name updates only when edited by user
  useEffect(() => {
    if (!isVenueEditedByUserRef.current) return;
    const timer = setTimeout(() => {
      if (localVenue !== sessionRules.venueName) {
        actions.updateSessionRulesInDB({ venueName: localVenue });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localVenue, sessionRules.venueName, actions]);

  // Search known crowdsourced venues ONLY when the user is actively typing
  useEffect(() => {
    if (!isVenueEditedByUserRef.current || localVenue.trim().length < 2 || !isHost) {
      setVenueResults([]);
      setShowVenueDropdown(false);
      return;
    }
    const searchDb = async () => {
      setIsSearchingVenue(true);
      const { data } = await supabase.rpc('search_venues', { search_term: localVenue.trim() });
      if (data && data.length > 0) {
        if (
          loadedVenueBadge &&
          data[0].name.toLowerCase() === loadedVenueBadge.trim().toLowerCase()
        ) {
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
    const timer = setTimeout(searchDb, 280);
    return () => clearTimeout(timer);
  }, [localVenue, isHost, loadedVenueBadge]);

  // Load connected Ekwly Friends & Saved Squads
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

  // Search crowdsourced venue menu items for price autocomplete
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
    }, 260);
    return () => clearTimeout(timer);
  }, [newItemName, sessionRules.venueName]);

  const handleMagicScanClick = () => {
    utils.haptic('medium');
    if (!isProUser && scansRemaining <= 0) {
      showToast("Sorry, you don't have any free Magic Scan quota left for this month.", 'error');
      setShowQuotaUpsellModal(true);
      return;
    }
    setShowScannerDrawer(true);
  };

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
    isVenueEditedByUserRef.current = false;
    setLocalVenue(venue.name);
    setLoadedVenueBadge(venue.name);
    setShowVenueDropdown(false);
    const parsedScRate = Number(venue.service_charge_rate || 0);

    actions.updateSessionRulesInDB({
      venueName: venue.name,
      isScApplicable: parsedScRate > 0,
      serviceChargeRate: parsedScRate,
    });

    if (venue.tax_presets && Array.isArray(venue.tax_presets) && venue.tax_presets.length > 0) {
      const mappedPresets = venue.tax_presets.map((t) => ({
        id: utils.generateId(),
        name: t.name,
        rate: t.rate,
        split: t.split !== false,
      }));
      await actions.replaceTaxPresetsInDB(mappedPresets);
    }
    showToast(`Loaded ${venue.name}'s community tax rules & menu!`, 'success');
  };

  const adjustNewItemQty = (delta: number) => {
    utils.haptic('light');
    const current = parseFloat(newItemQty) || 1;
    const next = Math.max(1, utils.round2(current + delta));
    setNewItemQty(next.toString());
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
    window.scrollTo({ top: 260, behavior: 'smooth' });
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

  const preTaxMultiplier =
    typeof (mathEngine as any).computePreTaxMultiplier === 'function'
      ? (mathEngine as any).computePreTaxMultiplier(items, gs.preTaxDiscountAmount)
      : (() => {
          const elig = items.reduce((sum, item) => {
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
          return elig > 0 ? (elig - gs.preTaxDiscountAmount) / elig : 1;
        })();

  const hasActivePreTaxBillDiscount = gs.preTaxDiscountAmount > 0;
  const scPercent = Math.round(sessionRules.serviceChargeRate * 100);
  const canUseMagicScan = isProUser || scansRemaining > 0;

  return (
    <div className="w-full flex flex-col gap-5 px-4 sm:px-6 pt-5 pb-8 relative z-10">
      {/* ZONE 1: FRONT-AND-CENTER AI MAGIC SCANNER HERO & CROWDSOURCED VENUE AUTOCOMPLETE */}
      {isHost && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col gap-4 relative z-20">
          {/* AI Magic Scanner Hero Banner */}
          {canUseMagicScan ? (
            <div className="premium-gradient-card rounded-2xl p-5 text-white flex flex-col gap-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles size={19} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-base tracking-tight">
                      AI Magic Bill Scanner
                    </span>
                    <span className="text-xs text-white/90 font-semibold tabular-nums mt-0.5">
                      {isProUser
                        ? 'PRO • Unlimited AI Scans Active'
                        : `${scansRemaining} of 3 Free Scans Available This Month`}
                    </span>
                  </div>
                </div>
                {showMagicPromoBanner && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('ekwly_hide_magic_promo', 'true');
                      setShowMagicPromoBanner(false);
                    }}
                    className="p-1.5 text-white/75 hover:text-white rounded-lg"
                    aria-label="Dismiss tip"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {showMagicPromoBanner && (
                <p className="text-xs sm:text-sm text-white/92 leading-relaxed">
                  Skip the tedious task of typing items and figuring out taxes, service charges, and
                  discounts yourself—snap your paper bill and let AI do it in 5 seconds!
                </p>
              )}

              <button
                type="button"
                onClick={handleMagicScanClick}
                className="w-full min-h-12 py-3 px-4 bg-white text-primary hover:bg-white/95 active:scale-[0.98] rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-transform"
              >
                <Sparkles size={16} /> Scan Receipt with AI Magic
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMagicScanClick}
              className="w-full p-4 rounded-2xl bg-page/90 border border-border text-muted flex items-center justify-between gap-3.5 hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-subtle text-muted flex items-center justify-center shrink-0">
                  <Lock size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-xs sm:text-sm text-main truncate">
                    AI Magic Scan (0 / 3 Free Scans Left)
                  </span>
                  <span className="text-xs text-muted truncate mt-0.5">
                    Tap to unlock unlimited AI receipt scans with Ekwly Pro
                  </span>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-primary/15 text-primary text-xs font-extrabold shrink-0">
                Upgrade
              </span>
            </button>
          )}

          {/* Crowdsourced Restaurant / Venue Search (Inline Expandable Tray — Never Re-Triggers on Remount) */}
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Store size={14} className="text-primary shrink-0" /> Restaurant / Venue (Auto-Loads
                Menu &amp; Taxes)
              </label>
              {loadedVenueBadge && (
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/12 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Rules Loaded
                </span>
              )}
            </div>

            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
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
                onChange={(e) => {
                  isVenueEditedByUserRef.current = true;
                  setLocalVenue(e.target.value);
                  setLoadedVenueBadge(null);
                }}
                placeholder="Search restaurant or pub name..."
                className="w-full min-h-12 bg-page/90 border border-border rounded-xl pl-11 pr-4 text-sm sm:text-base font-semibold text-main"
              />
            </div>

            {showVenueDropdown && venueResults.length > 0 && (
              <div className="bg-page/95 border border-primary/35 rounded-2xl overflow-hidden flex flex-col divide-y divide-border/60 shadow-inner">
                <div className="px-4 py-2 bg-primary/10 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles size={12} /> Found in Community Venue Database
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      isVenueEditedByUserRef.current = false;
                      setShowVenueDropdown(false);
                    }}
                    className="p-1 text-muted hover:text-main rounded-lg"
                    aria-label="Dismiss suggestions"
                  >
                    <X size={15} />
                  </button>
                </div>
                {venueResults.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVenue(v)}
                    className="min-h-13 flex items-center justify-between px-4 py-3 hover:bg-subtle/60 text-left gap-3 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-main text-sm truncate">{v.name}</span>
                      <span className="text-xs text-muted truncate mt-0.5">
                        {v.tax_presets ? v.tax_presets.length : 0} Tax Brackets •{' '}
                        {v.service_charge_rate > 0
                          ? `${v.service_charge_rate * 100}% Service Charge`
                          : 'No Service Charge'}
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-extrabold shrink-0 shadow-2xs">
                      Load Rules
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZONE 2: SPACIOUS "AT THE TABLE" MEMBER BAR + 1-TAP FRIEND & SAVED SQUAD CHIPS */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Users size={15} className="text-primary" /> At the Table ({members.length})
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
              className={`min-h-7 px-2.5 py-1 rounded-full text-[0.68rem] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                isRealtimeActive
                  ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/30'
                  : 'bg-page text-muted border-border hover:text-main'
              }`}
            >
              <Radio size={11} className={isRealtimeActive ? 'animate-pulse' : ''} />
              {isRealtimeActive ? 'Live Sync' : 'Solo Mode'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setShowMemberSheet(true);
            }}
            className="min-h-8 px-2.5 py-1 rounded-lg text-xs font-extrabold text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-colors"
          >
            <UserPlus size={15} /> Add / Squads
          </button>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
          {members.map((m) => {
            const owed = liveCalculation.individualBreakdowns[m.id]?.totalOwed || 0;
            const isMe = m.user_id === currentUserId;
            return (
              <div
                key={m.id}
                onClick={() => setShowMemberSheet(true)}
                className={`shrink-0 min-h-10 px-3.5 py-2 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 cursor-pointer transition-colors ${
                  isMe
                    ? 'bg-primary/12 border-primary/35 text-main'
                    : 'bg-page/90 border-border text-main'
                }`}
              >
                <span className="font-bold truncate max-w-32">{m.name}</span>
                <span className="font-extrabold text-primary tabular-nums">
                  <AnimatedNumber value={owed} />
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMemberSheet(true)}
            className="shrink-0 min-h-10 px-3.5 py-2 rounded-xl border border-dashed border-primary/45 text-primary text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-primary/5"
          >
            <Plus size={15} /> Person
          </button>
        </div>

        {isHost && members.length <= 1 && savedSquads.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2.5 border-t border-border/50">
            <span className="text-xs font-bold text-muted shrink-0 pr-1">Squads:</span>
            {savedSquads.map((squad) => (
              <button
                key={squad.id}
                type="button"
                onClick={() => handleApplySquad(squad)}
                className="shrink-0 min-h-9 px-3 py-1.5 rounded-xl bg-primary/12 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Sparkles size={12} /> + {squad.name} ({squad.members.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ZONE 2.5: SPACIOUS, IDIOT-PROOF & COLLAPSIBLE "BILL TAXES, SERVICE CHARGE & OFFERS" CARD */}
      <div className="glass-card rounded-3xl overflow-hidden">
        {isRulesCollapsed ? (
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setIsRulesCollapsed(false);
            }}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-subtle/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-main truncate">
                  Bill Taxes &amp; Charges Configured
                </span>
                <span className="text-xs text-muted truncate tabular-nums mt-0.5">
                  {taxPresets.map((t) => `${t.name} ${t.rate}%`).join(' • ')} •{' '}
                  {sessionRules.isScApplicable && scPercent > 0 ? `S.C. ${scPercent}%` : 'No S.C.'}
                  {gs.discountAmount > 0 ? ` • -${utils.formatMoney(gs.discountAmount)} Off` : ''}
                </span>
              </div>
            </div>
            <span className="min-h-9 px-3 py-1.5 rounded-xl bg-primary/12 text-primary text-xs font-extrabold shrink-0 flex items-center gap-1">
              Edit <ChevronDown size={14} />
            </span>
          </button>
        ) : (
          <div className="p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Layers size={15} /> Step 1: Check the Bottom of Your Bill
                </span>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  Setting your bill&apos;s taxes &amp; charges first ensures every item you add
                  automatically calculates the exact Food GST, Liquor VAT, and Service Charge.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRulesCollapsed(true)}
                className="p-2 text-muted hover:text-main rounded-xl shrink-0"
                title="Collapse section"
              >
                <ChevronUp size={18} />
              </button>
            </div>

            {/* 1. Taxes Section */}
            <div className="bg-page/85 border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-main">
                  1. Which taxes are printed on your bill?
                </span>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('taxes')}
                  className="text-xs font-extrabold text-primary hover:underline"
                >
                  + Add / Pick Taxes
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {taxPresets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveRuleSheet('taxes')}
                    className="min-h-10 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs sm:text-sm font-bold text-main flex items-center gap-2 tabular-nums shadow-2xs"
                  >
                    <span>{t.name}</span>
                    <span className="text-primary font-extrabold">{t.rate}%</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('taxes')}
                  className="min-h-10 px-3.5 py-2 rounded-xl border border-dashed border-primary/45 text-primary text-xs sm:text-sm font-bold flex items-center gap-1.5"
                >
                  <Plus size={14} /> Custom Tax
                </button>
              </div>
            </div>

            {/* 2. Service Charge & Discounts Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveRuleSheet('sc')}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                  sessionRules.isScApplicable && scPercent > 0
                    ? 'bg-primary/10 border-primary/35'
                    : 'bg-page/85 border-border'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs sm:text-sm font-bold text-main">2. Service Charge</span>
                  <span className="text-xs text-muted leading-relaxed">
                    {sessionRules.isScApplicable && scPercent > 0
                      ? `${scPercent}% Active on Bill`
                      : 'None (Tap if bill has 5%–10% S.C.)'}
                  </span>
                </div>
                <span className="min-h-9 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-extrabold text-primary shrink-0 flex items-center">
                  {sessionRules.isScApplicable && scPercent > 0 ? `${scPercent}%` : 'Set'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRuleSheet('discount')}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                  gs.discountAmount > 0
                    ? 'bg-emerald-500/10 border-emerald-500/35'
                    : 'bg-page/85 border-border'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs sm:text-sm font-bold text-main">
                    3. Discounts &amp; Coupons
                  </span>
                  <span className="text-xs text-muted leading-relaxed">
                    {gs.discountAmount > 0
                      ? `Saving ${utils.formatMoney(gs.discountAmount)}`
                      : 'Pre-Tax, Zomato/Swiggy or Item Offers'}
                  </span>
                </div>
                <span className="min-h-9 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-extrabold text-emerald-500 shrink-0 flex items-center gap-1">
                  <Percent size={12} /> {gs.discountAmount > 0 ? 'Edit' : 'Add'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setIsRulesCollapsed(true);
              }}
              className="w-full min-h-11 py-2.5 px-4 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle2 size={16} /> Everything Looks Right — Hide &amp; Add Items
            </button>
          </div>
        )}
      </div>

      {/* ZONE 3: SPACIOUS ADD / EDIT ITEM BAR (FONT-SCALE SAFE STEPPER & CLEAR TAX PILLS) */}
      {isHost && (
        <form
          onSubmit={handleSaveItem}
          className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col gap-4 relative z-15"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
              {editingItemId ? 'Editing Item on Bill' : 'Add Item to Bill'}
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

          {/* Item Name Input with Inline Crowdsourced Menu Price Tray */}
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item Name (e.g. Paneer Tikka, Draft Beer)"
              className="w-full min-h-12 bg-page/90 border border-border rounded-xl px-4 text-sm sm:text-base font-semibold text-main"
            />
            {showItemDropdown && itemResults.length > 0 && (
              <div className="bg-page/95 border border-primary/35 rounded-2xl overflow-hidden flex flex-col divide-y divide-border/60">
                <div className="px-4 py-2 bg-primary/10 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Menu Prices at {sessionRules.venueName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowItemDropdown(false)}
                    className="p-1 text-muted hover:text-main"
                  >
                    <X size={14} />
                  </button>
                </div>
                {itemResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewItemName(item.name);
                      setNewItemPrice(item.price.toString());
                      setShowItemDropdown(false);
                    }}
                    className="min-h-11 flex items-center justify-between px-4 py-2.5 hover:bg-subtle/60 text-left"
                  >
                    <span className="font-semibold text-main text-xs sm:text-sm truncate pr-3">
                      {item.name}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-primary tabular-nums shrink-0">
                      {utils.formatMoney(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spacious Quantity Stepper & Labeled Unit Price Input (Stacks cleanly on narrow/zoomed screens) */}
          <div className="grid grid-cols-12 gap-3.5">
            <div className="col-span-12 sm:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted pl-0.5">
                Quantity (No. of Items)
              </label>
              <div className="h-12 bg-page/90 border border-border rounded-xl overflow-hidden grid grid-cols-[48px_1fr_48px] divide-x divide-border">
                <button
                  type="button"
                  onClick={() => adjustNewItemQty(-1)}
                  className="h-full w-full bg-surface/60 hover:bg-subtle active:bg-border text-muted hover:text-main flex items-center justify-center transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  min="0.01"
                  step="any"
                  className="w-full h-full bg-transparent border-0 rounded-none px-2 text-center text-base font-extrabold text-main tabular-nums focus:ring-0 focus:shadow-none"
                />
                <button
                  type="button"
                  onClick={() => adjustNewItemQty(1)}
                  className="h-full w-full bg-surface/60 hover:bg-subtle active:bg-border text-muted hover:text-main flex items-center justify-center transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="col-span-12 sm:col-span-7 flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted pl-0.5">
                Unit Price (₹ per item)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted font-bold text-base">
                  ₹
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-full h-12 bg-page/90 border border-border rounded-xl pl-9 pr-4 text-base font-bold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* 1-Tap Tax Bracket Pills */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Item Tax Bracket
              </span>
              <button
                type="button"
                onClick={() => setActiveRuleSheet('taxes')}
                className="text-xs font-extrabold text-primary hover:underline"
              >
                + Custom Tax
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
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
                    className={`shrink-0 min-h-10 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-2 tabular-nums ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-page/90 text-muted border-border hover:text-main'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={isSelected ? 'text-white/90' : 'text-primary'}>{t.rate}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Row: Spacious Toggle Chips (+S.C., + Item Discount) + Submit Button */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              {sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 && (
                <button
                  type="button"
                  onClick={() => setNewItemApplySC(!newItemApplySC)}
                  className={`min-h-10 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    newItemApplySC
                      ? 'bg-primary/12 border-primary/35 text-primary'
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
                className={`min-h-10 px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                  hasNewItemOffer
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-500'
                    : 'bg-page/90 border-border text-muted hover:text-main'
                }`}
              >
                <Tag size={13} />
                <span>{hasNewItemOffer ? 'Item Discounted' : '+ Item Discount'}</span>
                {hasNewItemOffer && <X size={13} className="ml-0.5" />}
              </button>
            </div>

            <button
              type="submit"
              className="min-h-11 px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-transform ml-auto shrink-0"
            >
              <Plus size={16} /> {editingItemId ? 'Update Item' : 'Add Item'}
            </button>
          </div>

          {/* Conditional Inline Item Discount Input */}
          {hasNewItemOffer && (
            <div className="flex flex-wrap items-center gap-2.5 bg-page/90 border border-emerald-500/35 p-3 rounded-2xl">
              <div className="flex bg-surface p-1 rounded-xl border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setNewItemDiscType('percentage')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    newItemDiscType === 'percentage' ? 'bg-emerald-500 text-white' : 'text-muted'
                  }`}
                >
                  % Off
                </button>
                <button
                  type="button"
                  onClick={() => setNewItemDiscType('flat')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
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
                className="flex-1 min-w-44 min-h-10 bg-surface border border-border rounded-xl px-3.5 text-sm font-bold tabular-nums"
              />
            </div>
          )}
        </form>
      )}

      {/* ZONE 4: SKEUOMORPHIC LIVE BILL SPLIT RECEIPT (SEAMLESS SAWTOOTH & TIDY 3-ROW ITEMS) */}
      <div className="mt-1 relative z-10">
        <ThermalReceiptSawtooth position="top" />
        <div className="pos-receipt px-4 sm:px-5 py-4 flex flex-col gap-3">
          {/* RECEIPT PAPER HEADER */}
          <div className="flex flex-col items-center text-center pb-3 pos-double-line">
            <span className="text-[0.65rem] font-mono font-extrabold uppercase tracking-[0.22em] text-primary">
              ★ LIVE BILL SPLIT ★
            </span>
            <h3 className="text-base font-extrabold text-main tracking-tight mt-0.5">
              {sessionRules.venueName || 'Dining Table Bill'}
            </h3>
            <span className="text-[0.7rem] font-mono text-muted tabular-nums mt-0.5">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              • {members.length} {members.length === 1 ? 'Person' : 'People'} • {items.length}{' '}
              {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {/* RECEIPT LINE ITEMS */}
          {items.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <Receipt size={26} className="text-muted/40" />
              <p className="text-sm font-bold text-main">No items on the bill yet</p>
              <p className="text-xs text-muted max-w-xs leading-relaxed">
                Use <strong>AI Magic Scan</strong> at the top to extract your paper receipt, or add
                items manually above.
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
                      className="py-3 first:pt-1 flex flex-col gap-2"
                    >
                      {/* ROW 1: Index + Item Name on Left | Total Price + Edit/Delete on Right */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0 flex-1 pr-1">
                          <span className="text-xs font-mono font-bold text-muted tabular-nums shrink-0">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="font-bold text-main text-[0.95rem] leading-snug wrap-break-word">
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono font-extrabold text-main tabular-nums text-[0.95rem]">
                            {utils.formatMoney(breakdown.finalTotal)}
                          </span>
                          {isHost && (
                            <div className="flex items-center ml-0.5">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-subtle"
                                aria-label="Edit item"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => actions.removeItemFromDB(item.id)}
                                className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/10"
                                aria-label="Delete item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ROW 2: Single-Line Compact Metadata Strip (Qty • Rate • Tax Pill • +S.C. • Split Status) */}
                      <div className="flex items-center gap-1.5 flex-wrap pl-5">
                        <span className="text-[0.7rem] font-mono font-bold text-main bg-page px-1.5 py-0.5 rounded border border-border tabular-nums">
                          x{item.qty}
                        </span>
                        <span className="text-[0.72rem] font-mono text-muted tabular-nums">
                          {utils.formatMoney(item.unitPrice)}/ea
                        </span>

                        {hasItemDisc && (
                          <span className="text-[0.65rem] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 tabular-nums">
                            -
                            {item.discountType === 'percentage'
                              ? `${item.discountValue}%`
                              : utils.formatMoney(breakdown.itemDiscountAmount)}
                          </span>
                        )}

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
                            className="receipt-select font-bold bg-page border border-border text-primary cursor-pointer"
                          >
                            {taxPresets.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.rate}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[0.7rem] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
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
                            className={`h-6.5 px-2 rounded-lg text-[0.68rem] font-bold border transition-colors ${
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
                            className={`h-6.5 px-2 rounded-lg text-[0.68rem] font-bold border transition-colors ${
                              item.applyDiscount !== false
                                ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-500'
                                : 'bg-page border-border text-muted line-through'
                            }`}
                          >
                            Pre-Tax Disc
                          </button>
                        )}

                        <span
                          className={`ml-auto text-[0.65rem] font-bold px-2 py-0.5 rounded-full tabular-nums ${
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

                      {/* ROW 3: 1-Tap Member Avatar Split Pills */}
                      {members.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pl-5 pt-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAllOnItem(item)}
                              className={`h-8 px-3 rounded-lg text-xs font-extrabold border transition-all active:scale-95 ${
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
                                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1.5 ${
                                    isClaimed
                                      ? 'bg-primary/15 text-primary border-primary/40 font-bold'
                                      : 'bg-page text-muted border-border hover:text-main'
                                  }`}
                                >
                                  <span>{m.name}</span>
                                  {isClaimed && (
                                    <span className="text-[0.65rem] font-mono bg-primary/20 px-1.5 py-0.2 rounded tabular-nums">
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
                            className={`h-8 w-8 flex items-center justify-center rounded-lg border text-xs font-bold shrink-0 transition-colors ${
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

                      {/* Expandable Custom Fractional Stepper */}
                      {isCustomOpen && (
                        <div className="bg-page border border-border rounded-xl p-3 flex flex-col gap-2.5 mt-1 ml-5">
                          <span className="text-[0.68rem] font-bold uppercase tracking-wider text-muted">
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
                                      className={`h-7 px-2 text-xs font-bold rounded-md border transition-colors ${
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
                                      className="w-7 h-7 rounded-md bg-surface border border-border flex items-center justify-center text-muted"
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
                                      className="w-14 h-7 px-1 text-center text-xs font-bold tabular-nums bg-surface border border-border rounded-md"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = utils.round2(utils.parseQty(currentStr) + 1);
                                        actions.updateClaimInDB(m.id, item.id, next.toString());
                                      }}
                                      className="w-7 h-7 rounded-md bg-surface border border-border flex items-center justify-center text-muted"
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
          <div className="relative py-2 my-0.5">
            <div className="pos-notch-left" />
            <div className="pos-notch-right" />
            <div className="pos-dashed-line w-full" />
          </div>

          {/* LIVE BILL ACCOUNTING SUMMARY */}
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <span className="text-[0.68rem] font-bold uppercase tracking-widest text-muted">
                Bill Summary
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('discount')}
                  className="h-6.5 px-2 rounded-md bg-page border border-border text-[0.68rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  % Offers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('sc')}
                  className="h-6.5 px-2 rounded-md bg-page border border-border text-[0.68rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  S.C. ({scPercent}%)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('taxes')}
                  className="h-6.5 px-2 rounded-md bg-page border border-border text-[0.68rem] font-sans font-bold text-primary hover:border-primary/40"
                >
                  Taxes ({taxPresets.length})
                </button>
              </div>
            </div>

            {(gs.itemDiscountAmount > 0 || gs.preTaxDiscountAmount > 0) && (
              <div className="flex justify-between py-0.5">
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
                className="flex justify-between py-0.5 text-emerald-500 w-full text-left hover:opacity-80"
              >
                <span className="underline decoration-dotted">ITEM / CATEGORY OFFERS</span>
                <span className="font-bold tabular-nums">
                  - {utils.formatMoney(gs.itemDiscountAmount)}
                </span>
              </button>
            )}

            {gs.preTaxDiscountAmount > 0 && (
              <button
                type="button"
                onClick={() => setActiveRuleSheet('discount')}
                className="flex justify-between py-0.5 text-emerald-500 w-full text-left hover:opacity-80"
              >
                <span className="underline decoration-dotted">PRE-TAX DISCOUNT</span>
                <span className="font-bold tabular-nums">
                  - {utils.formatMoney(gs.preTaxDiscountAmount)}
                </span>
              </button>
            )}

            <div className="flex justify-between py-0.5">
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
                    className="flex justify-between py-0.5 w-full text-left hover:opacity-80"
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
              className="flex justify-between py-0.5 w-full text-left hover:opacity-80"
            >
              <span className="text-muted underline decoration-dotted">
                SERVICE CHARGE ({scPercent}%)
              </span>
              <span className="font-bold text-main tabular-nums">
                {utils.formatMoney(gs.serviceCharge)}
              </span>
            </button>

            {gs.postTaxDiscountAmount > 0 && (
              <>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">GROSS TOTAL</span>
                  <span className="font-bold text-main tabular-nums">
                    {utils.formatMoney(computedGrossTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRuleSheet('discount')}
                  className="flex justify-between py-0.5 text-emerald-500 w-full text-left hover:opacity-80"
                >
                  <span className="underline decoration-dotted">POST-TAX COUPON</span>
                  <span className="font-bold tabular-nums">
                    - {utils.formatMoney(gs.postTaxDiscountAmount)}
                  </span>
                </button>
              </>
            )}

            {gs.roundOff !== 0 && (
              <div className="flex justify-between py-0.5">
                <span className="text-muted">POS ROUND OFF</span>
                <span className="font-bold text-main tabular-nums">
                  {gs.roundOff > 0 ? '+' : ''}
                  {utils.formatMoney(gs.roundOff)}
                </span>
              </div>
            )}

            <div className="pos-double-line my-1.5" />

            <div className="flex justify-between items-baseline pt-0.5">
              <span className="font-sans font-extrabold text-main text-base tracking-tight">
                GRAND TOTAL
              </span>
              <span className="font-mono font-extrabold text-primary text-2xl tabular-nums">
                <AnimatedNumber value={gs.grandTotal} />
              </span>
            </div>
          </div>
        </div>
        <ThermalReceiptSawtooth position="bottom" />
      </div>

      {/* DRAWER 1: MAGIC SCANNER */}
      <BottomSheet
        isOpen={showScannerDrawer}
        onClose={() => setShowScannerDrawer(false)}
        title="AI Magic Scan"
      >
        <MagicScanner onScanComplete={() => setShowScannerDrawer(false)} />
      </BottomSheet>

      {/* DRAWER 1B: 0-QUOTA UPSELL MODAL (UNIFIED PRO UPGRADE SHEET) */}
      <ProUpgradeSheet
        isOpen={showQuotaUpsellModal}
        onClose={() => setShowQuotaUpsellModal(false)}
        userId={currentUserId}
        userEmail={userEmail}
        reasonTitle="No Free Magic Scans Left This Month"
      />

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
              className="flex-1 min-h-12 bg-page border border-border rounded-xl px-4 text-sm font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                if (!newMemberName.trim()) return;
                actions.addMemberToDB(newMemberName.trim());
                setNewMemberName('');
              }}
              className="min-h-12 px-4 bg-primary text-white rounded-xl font-bold text-xs shrink-0"
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
                    className="w-full min-h-11 flex items-center justify-between px-4 py-2.5 text-left hover:bg-subtle disabled:opacity-50"
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
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" /> 1-Tap Add Saved Squad
              </span>
              <div className="flex flex-wrap gap-2">
                {savedSquads.map((squad) => (
                  <button
                    key={squad.id}
                    type="button"
                    onClick={() => handleApplySquad(squad)}
                    className="min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all active:scale-95"
                  >
                    + {squad.name} ({squad.members.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {myFriends.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
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
                      className={`min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
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

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Current Table ({members.length})
              </span>
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowSaveSquadForm(!showSaveSquadForm)}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <BookmarkPlus size={14} /> Save Table as Squad
                </button>
              )}
            </div>

            {showSaveSquadForm && (
              <div className="flex gap-2 bg-page border border-primary/30 p-3 rounded-xl">
                <input
                  type="text"
                  value={newSquadNameInput}
                  onChange={(e) => setNewSquadNameInput(e.target.value)}
                  placeholder="Squad Name (e.g. Friday Crew)"
                  className="flex-1 min-h-10 bg-surface border border-border rounded-lg px-3 text-xs sm:text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentTableAsSquad}
                  className="min-h-10 px-4 bg-primary text-white rounded-lg font-bold text-xs shrink-0"
                >
                  Save
                </button>
              </div>
            )}

            <div className="bg-page border border-border rounded-2xl divide-y divide-border">
              {members.map((m) => {
                const isMe = m.user_id === currentUserId;
                const canClaim =
                  !m.user_id &&
                  currentUserId &&
                  !members.some((mem) => mem.user_id === currentUserId);
                return (
                  <div key={m.id} className="min-h-12 flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-main">{m.name}</span>
                      {m.user_id === hostId && (
                        <span className="text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500">
                          Host
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500">
                          You
                        </span>
                      )}
                      {canClaim && (
                        <button
                          type="button"
                          onClick={() => actions.claimMemberIdentity(m.id)}
                          className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg"
                        >
                          Claim My Slot
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.removeMemberFromDB(m.id)}
                      className="p-2 text-muted hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* EXTRACTED RULE DRAWERS */}
      <WorkbenchRuleDrawers
        activeSheet={activeRuleSheet}
        onClose={() => setActiveRuleSheet(null)}
      />
    </div>
  );
}
