import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import type {
  SavedSquad,
  SquadMember,
  FriendDossierStats,
  CoDinerSuggestion,
  GlobalLedgerRow,
  NettedBalanceRow,
} from '../lib/types';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
import QrScannerModal from './ui/QrScannerModal';
import {
  User,
  Trash2,
  Users,
  UserPlus,
  QrCode,
  ScanLine,
  Share,
  Copy,
  Search,
  Loader2,
  Sparkles,
  Store,
  Calendar,
  Plus,
  Check,
  MessageCircle,
  Smartphone,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface FriendProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  upi_id: string | null;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
}

export default function Friends({ user }: Props) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [suggestions, setSuggestions] = useState<CoDinerSuggestion[]>([]);
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>([]);
  const [myUpiId, setMyUpiId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- QR & SHARE STATE ---
  const [showMyQR, setShowMyQR] = useState(false);
  const [isScanningFriend, setIsScanningFriend] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendProfile | null>(null);

  // --- LIVE USER SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // --- SAVED SQUADS BUILDER STATE ---
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [selectedSquadFriendIds, setSelectedSquadFriendIds] = useState<string[]>([]);
  const [customSquadGuests, setCustomSquadGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [squadToDelete, setSquadToDelete] = useState<SavedSquad | null>(null);

  // --- FRIENDSHIP DINING DOSSIER STATE ---
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [dossierStats, setDossierStats] = useState<FriendDossierStats | null>(null);
  const [dossierBalance, setDossierBalance] = useState<NettedBalanceRow | null>(null);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);
  const [showDossierQr, setShowDossierQr] = useState(false);
  const [confirmSettleDossier, setConfirmSettleDossier] = useState(false);

  const friendLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?add_friend=${user?.id}`
      : '';

  const fetchNetworkAndSuggestions = useCallback(async () => {
    if (!user || user.is_anonymous) {
      setSavedSquads(utils.getSavedSquads(null));
      setIsLoading(false);
      return;
    }

    setSavedSquads(utils.getSavedSquads(user.id));

    const [connectionsRes, myProfileRes, myMembershipsRes, hostedSessionsRes] = await Promise.all([
      supabase
        .from('connections')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
      supabase.from('profiles').select('upi_id').eq('id', user.id).maybeSingle(),
      supabase.from('members').select('session_id').eq('user_id', user.id).limit(50),
      supabase.from('sessions').select('id').eq('host_id', user.id).limit(50),
    ]);

    setMyUpiId(myProfileRes.data?.upi_id || null);

    const connections = connectionsRes.data || [];
    const friendIds = Array.from(
      new Set(connections.map((c) => (c.user_id === user.id ? c.friend_id : c.user_id)))
    );

    let loadedFriends: FriendProfile[] = [];
    if (friendIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, upi_id')
        .in('id', friendIds);
      if (profiles) loadedFriends = profiles;
    }
    setFriends(loadedFriends);

    // Discover "People You've Dined With" from shared sessions
    const sessionIds = Array.from(
      new Set([
        ...(myMembershipsRes.data || []).map((m) => m.session_id),
        ...(hostedSessionsRes.data || []).map((s) => s.id),
      ])
    );

    if (sessionIds.length > 0) {
      const { data: coMembers } = await supabase
        .from('members')
        .select('user_id, session_id')
        .in('session_id', sessionIds)
        .not('user_id', 'is', null);

      const friendIdSet = new Set(friendIds);
      const coDinerCounts = new Map<string, Set<string>>();

      for (const row of coMembers || []) {
        const uid = row.user_id as string | null;
        if (!uid || uid === user.id || friendIdSet.has(uid)) continue;
        if (!coDinerCounts.has(uid)) coDinerCounts.set(uid, new Set());
        coDinerCounts.get(uid)!.add(row.session_id);
      }

      const candidateIds = Array.from(coDinerCounts.keys()).slice(0, 8);
      if (candidateIds.length > 0) {
        const { data: candidateProfiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, upi_id')
          .in('id', candidateIds);

        const builtSuggestions: CoDinerSuggestion[] = (candidateProfiles || [])
          .filter((p) => p.name && !/^Guest\s+[0-9a-f]{5}$/i.test(p.name))
          .map((p) => ({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            upi_id: p.upi_id,
            sharedCount: coDinerCounts.get(p.id)?.size || 1,
          }))
          .sort((a, b) => b.sharedCount - a.sharedCount);

        setSuggestions(builtSuggestions);
      } else {
        setSuggestions([]);
      }
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNetworkAndSuggestions();
  }, [fetchNetworkAndSuggestions]);

  // Debounced Live User Search (uses idx_profiles_name_trgm GIN index)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, upi_id')
        .ilike('name', `%${searchQuery.trim()}%`)
        .limit(6);

      const filtered = (data || []).filter(
        (p) => p.id !== user?.id && p.name && !/^Guest\s+[0-9a-f]{5}$/i.test(p.name)
      );
      setSearchResults(filtered);
      setIsSearchingUsers(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const handleConnectUser = async (targetUserId: string, targetName?: string) => {
    if (!user || user.is_anonymous) {
      return showToast('Sign in to add friends.', 'error');
    }
    if (targetUserId === user.id) {
      return showToast("You can't add yourself as a friend.", 'default');
    }
    if (friends.some((f) => f.id === targetUserId)) {
      return showToast('Already in your friends network!', 'default');
    }

    utils.haptic('medium');
    const { error } = await supabase
      .from('connections')
      .insert({ user_id: user.id, friend_id: targetUserId });

    if (error) {
      showToast('Could not add friend or already connected.', 'error');
    } else {
      showToast(`${targetName || 'Friend'} added to your network!`, 'success');
      setSearchQuery('');
      setSearchResults([]);
      fetchNetworkAndSuggestions();
    }
  };

  const handleScannedFriendUrl = async (scannedText: string) => {
    let friendId: string | null = null;
    try {
      const url = new URL(scannedText);
      friendId = url.searchParams.get('add_friend');
    } catch {
      const queryPart = scannedText.split('?')[1] || '';
      friendId = new URLSearchParams(queryPart).get('add_friend');
    }
    if (!friendId) return showToast('Invalid Friend QR Code.', 'error');
    await handleConnectUser(friendId);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove || !user) return;
    const friendId = friendToRemove.id;

    await supabase
      .from('connections')
      .delete()
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
      );

    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    if (selectedFriend?.id === friendId) setSelectedFriend(null);
    showToast('Friend removed.', 'success');
  };

  // --- SAVED SQUADS HANDLERS ---
  const handleCreateSquad = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newSquadName.trim();
    if (!trimmedName) return showToast('Enter a squad name (e.g. Friday Crew).', 'error');

    const selectedFriends: SquadMember[] = friends
      .filter((f) => selectedSquadFriendIds.includes(f.id))
      .map((f) => ({ name: f.name, user_id: f.id }));

    const guestMembers: SquadMember[] = customSquadGuests.map((g) => ({
      name: g,
      user_id: null,
    }));

    const combined = [...selectedFriends, ...guestMembers];
    if (combined.length === 0) {
      return showToast('Select at least 1 friend or guest for this squad.', 'error');
    }

    utils.haptic('medium');
    const newSquad: SavedSquad = {
      id: utils.generateId(),
      name: trimmedName,
      members: combined,
      createdAt: new Date().toISOString(),
    };

    const nextSquads = [newSquad, ...savedSquads];
    setSavedSquads(nextSquads);
    utils.saveSquads(user?.id, nextSquads);

    setNewSquadName('');
    setSelectedSquadFriendIds([]);
    setCustomSquadGuests([]);
    setGuestInput('');
    setShowSquadModal(false);
    showToast(`Saved "${trimmedName}" squad!`, 'success');
  };

  const confirmDeleteSquad = () => {
    if (!squadToDelete) return;
    const nextSquads = savedSquads.filter((s) => s.id !== squadToDelete.id);
    setSavedSquads(nextSquads);
    utils.saveSquads(user?.id, nextSquads);
    setSquadToDelete(null);
    showToast('Squad deleted.', 'success');
  };

  // --- FRIENDSHIP DINING DOSSIER LOADER ---
  const openFriendDossier = async (friend: FriendProfile) => {
    if (!user) return;
    utils.haptic('light');
    setSelectedFriend(friend);
    setShowDossierQr(false);
    setIsLoadingDossier(true);

    try {
      const [
        myMembershipsRes,
        friendMembershipsRes,
        myHostedRes,
        friendHostedRes,
        credRes,
        debtRes,
      ] = await Promise.all([
        supabase.from('members').select('session_id').eq('user_id', user.id),
        supabase.from('members').select('session_id').eq('user_id', friend.id),
        supabase.from('sessions').select('id').eq('host_id', user.id),
        supabase.from('sessions').select('id').eq('host_id', friend.id),
        supabase
          .from('global_ledger')
          .select('*')
          .eq('creditor_id', user.id)
          .eq('debtor_id', friend.id),
        supabase
          .from('global_ledger')
          .select('*')
          .eq('debtor_id', user.id)
          .eq('creditor_id', friend.id),
      ]);

      const mySessionSet = new Set([
        ...(myMembershipsRes.data || []).map((m) => m.session_id),
        ...(myHostedRes.data || []).map((s) => s.id),
      ]);
      const friendSessionSet = new Set([
        ...(friendMembershipsRes.data || []).map((m) => m.session_id),
        ...(friendHostedRes.data || []).map((s) => s.id),
      ]);

      const sharedIds = Array.from(mySessionSet).filter((id) => friendSessionSet.has(id));

      if (sharedIds.length > 0) {
        const { data: sharedSessions } = await supabase
          .from('sessions')
          .select('id, name, venue_name, created_at')
          .in('id', sharedIds);
        setDossierStats(utils.computeFriendDossierStats(sharedSessions || []));
      } else {
        setDossierStats({ sharedSessionCount: 0, favoriteVenue: null, recentSessions: [] });
      }

      const netted = utils.netBilateralBalances(
        (credRes.data || []) as GlobalLedgerRow[],
        (debtRes.data || []) as GlobalLedgerRow[]
      );
      const balanceRow = netted.netOwedToMe[0] || netted.netIOwe[0] || null;
      setDossierBalance(balanceRow);
    } finally {
      setIsLoadingDossier(false);
    }
  };

  const handleSettleDossierBalance = async () => {
    if (!user || !selectedFriend || !dossierBalance) return;
    await Promise.all([
      supabase
        .from('ledger')
        .update({ settled: true })
        .eq('settled', false)
        .eq('creditor_id', user.id)
        .eq('debtor_id', selectedFriend.id),
      supabase
        .from('ledger')
        .update({ settled: true })
        .eq('settled', false)
        .eq('debtor_id', user.id)
        .eq('creditor_id', selectedFriend.id),
    ]);
    setDossierBalance(null);
    setConfirmSettleDossier(false);
    showToast(`Settled up with ${selectedFriend.name}!`, 'success');
  };

  const handleShareLink = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Add me on Ekwly',
          text: 'Tap this link to add me as a friend on Ekwly so we can split bills!',
          url: friendLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(friendLink);
      showToast('Invite link copied to clipboard!', 'success');
    }
  };

  if (isLoading) {
    return <BrandLoader label="Loading Network..." fullScreen />;
  }

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-28">
      <QrScannerModal
        isOpen={isScanningFriend}
        title="Scan Friend QR"
        onClose={() => setIsScanningFriend(false)}
        onScanSuccess={handleScannedFriendUrl}
      />

      <ConfirmSheet
        isOpen={!!friendToRemove}
        onClose={() => setFriendToRemove(null)}
        onConfirm={confirmRemoveFriend}
        title="Remove Friend?"
        description={`Remove ${friendToRemove?.name || 'this user'} from your Ekwly connections?`}
        confirmLabel="Remove"
        variant="danger"
      />

      <ConfirmSheet
        isOpen={!!squadToDelete}
        onClose={() => setSquadToDelete(null)}
        onConfirm={confirmDeleteSquad}
        title="Delete Saved Squad?"
        description={`Delete "${squadToDelete?.name || ''}"? This won't remove anyone from your Friends list.`}
        confirmLabel="Delete Squad"
        variant="danger"
      />

      <ConfirmSheet
        isOpen={confirmSettleDossier}
        onClose={() => setConfirmSettleDossier(false)}
        onConfirm={handleSettleDossierBalance}
        title="Settle Net Balance?"
        description={
          dossierBalance && selectedFriend
            ? `Mark your net balance of ${utils.formatMoney(dossierBalance.netAmount)} with ${selectedFriend.name} as settled?`
            : ''
        }
        confirmLabel="Mark Settled"
        variant="success"
      />

      <div className="flex flex-col items-center mb-5 mt-1 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-3 shadow-sm">
          <Users size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Dining Network</h2>
        <p className="text-muted text-sm font-medium">
          Friends, Saved Squads & shared dining history
        </p>
      </div>

      {/* 1. LIVE FRIEND SEARCH BAR (idx_profiles_name_trgm) */}
      <div className="relative mb-5 z-20">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted">
            {isSearchingUsers ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : (
              <Search size={16} />
            )}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Ekwly users by name..."
            className="w-full h-12 bg-surface border border-border rounded-2xl pl-10 pr-4 text-sm font-semibold text-main shadow-sm"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 bg-surface border border-border rounded-2xl shadow-xl divide-y divide-border overflow-hidden">
            {searchResults.map((profile) => {
              const isAlreadyFriend = friends.some((f) => f.id === profile.id);
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-subtle/50"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-main truncate">{profile.name}</span>
                      <span className="text-[0.7rem] text-muted truncate">
                        {profile.upi_id ? 'UPI Linked' : 'Ekwly Member'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isAlreadyFriend}
                    onClick={() => handleConnectUser(profile.id, profile.name)}
                    className={`h-8 px-3 rounded-xl font-bold text-xs shrink-0 transition-transform active:scale-95 ${
                      isAlreadyFriend
                        ? 'bg-page text-muted border border-border'
                        : 'bg-primary text-white shadow-sm'
                    }`}
                  >
                    {isAlreadyFriend ? 'Connected' : '+ Connect'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. QR & INVITE ACTIONS */}
      <div className="grid grid-cols-2 gap-3 mb-7">
        <button
          type="button"
          onClick={() => setShowMyQR(true)}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-22"
        >
          <QrCode size={22} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-sm">My Friend QR</span>
        </button>
        <button
          type="button"
          onClick={() => setIsScanningFriend(true)}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-22"
        >
          <ScanLine size={22} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-sm">Scan Friend QR</span>
        </button>
        <button
          type="button"
          onClick={handleShareLink}
          className="col-span-2 bg-primary/10 active:bg-primary/20 text-primary border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-2 shadow-sm transition-colors font-bold text-xs uppercase tracking-wider"
        >
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
            <Share size={15} />
          ) : (
            <Copy size={15} />
          )}
          Share Friend Invite Link
        </button>
      </div>

      {/* 3. SAVED SQUADS (1-TAP GROUP PRESETS) */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" /> Saved Squads ({savedSquads.length})
        </h3>
        <button
          type="button"
          onClick={() => {
            utils.haptic('light');
            setShowSquadModal(true);
          }}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          <Plus size={14} /> New Squad
        </button>
      </div>

      {savedSquads.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-2xl p-5 mb-7 text-center flex flex-col items-center gap-2">
          <p className="text-xs text-muted max-w-xs leading-relaxed">
            Create a <strong>Saved Squad</strong> (like <em>&quot;BLR Flatmates&quot;</em> or{' '}
            <em>&quot;Friday Crew&quot;</em>) to populate your entire table in 1 tap when splitting
            a bill.
          </p>
          <button
            type="button"
            onClick={() => setShowSquadModal(true)}
            className="mt-1 h-9 px-4 bg-primary/10 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <Plus size={14} /> Create First Squad
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
          {savedSquads.map((squad) => (
            <div
              key={squad.id}
              className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-main text-sm truncate">{squad.name}</span>
                  <span className="text-[0.7rem] text-muted font-semibold tabular-nums">
                    {squad.members.length} {squad.members.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSquadToDelete(squad)}
                  className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-danger/10"
                  aria-label="Delete squad"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {squad.members.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-page border border-border text-[0.7rem] font-semibold text-main truncate max-w-28"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. PEOPLE YOU'VE DINED WITH (CO-DINER SUGGESTIONS) */}
      {suggestions.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
              People You&apos;ve Dined With
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 hover:bg-subtle/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold overflow-hidden shrink-0 border border-amber-500/25">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-main truncate">{s.name}</span>
                    <span className="text-xs text-muted font-medium tabular-nums">
                      Dined together {s.sharedCount} {s.sharedCount === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleConnectUser(s.id, s.name)}
                  className="h-9 px-3.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs shrink-0 active:scale-95 transition-transform"
                >
                  + Add Friend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CONNECTED FRIENDS LIST (TAP FOR FRIENDSHIP DOSSIER) */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Your Friends ({friends.length})
        </h3>
        {friends.length > 0 && (
          <span className="text-[0.7rem] text-muted font-medium">Tap a friend for stats</span>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden flex flex-col">
        {friends.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <UserPlus size={32} className="text-muted opacity-40 mb-3" />
            <p className="text-main font-bold text-[0.95rem] mb-1">No friends connected yet</p>
            <p className="text-muted text-xs max-w-xs">
              Search by name above or share your invite link to build your dining network.
            </p>
          </div>
        ) : (
          friends.map((friend) => (
            <div
              key={friend.id}
              onClick={() => openFriendDossier(friend)}
              className="flex items-center justify-between p-4 bg-surface hover:bg-subtle/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div className="flex flex-col min-w-0 pr-3">
                  <span className="font-semibold text-main text-[0.95rem] truncate">
                    {friend.name || 'Ekwly User'}
                  </span>
                  <span className="text-[0.75rem] font-medium text-muted truncate mt-0.5">
                    {friend.upi_id || 'Tap to view shared outings'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFriendToRemove(friend);
                  }}
                  className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                  aria-label="Remove friend"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={18} className="text-muted/50" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: MY FRIEND QR CODE */}
      <BottomSheet isOpen={showMyQR} onClose={() => setShowMyQR(false)} title="My Friend Code">
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted text-center mb-6">
            Have a friend scan this code to instantly add you to their Ekwly network.
          </p>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-border mb-6">
            <QRCode value={friendLink} size={220} />
          </div>
          <div className="bg-subtle border border-border rounded-xl px-6 py-3 w-full text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Friend ID</p>
            <p className="text-lg font-mono font-bold text-primary truncate tabular-nums">
              {user?.id.split('-')[0]}
            </p>
          </div>
        </div>
      </BottomSheet>

      {/* MODAL 2: CREATE SAVED SQUAD */}
      <BottomSheet
        isOpen={showSquadModal}
        onClose={() => setShowSquadModal(false)}
        title="Create Saved Squad"
      >
        <form onSubmit={handleCreateSquad} className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Squad Name
            </label>
            <input
              type="text"
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              placeholder="e.g. BLR Flatmates, Friday Crew"
              className="w-full h-11 bg-page border border-border rounded-xl px-3.5 text-sm font-semibold"
              required
            />
          </div>

          {friends.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Tap Friends to Include ({selectedSquadFriendIds.length})
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                {friends.map((f) => {
                  const isSelected = selectedSquadFriendIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        utils.haptic('light');
                        setSelectedSquadFriendIds((prev) =>
                          isSelected ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-page text-main border-border'
                      }`}
                    >
                      {isSelected && <Check size={13} />}
                      <span>{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Add Regular Guests (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = guestInput.trim();
                    if (trimmed && !customSquadGuests.includes(trimmed)) {
                      setCustomSquadGuests((prev) => [...prev, trimmed]);
                      setGuestInput('');
                    }
                  }
                }}
                placeholder="Type guest name..."
                className="flex-1 h-10 bg-page border border-border rounded-xl px-3 text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = guestInput.trim();
                  if (trimmed && !customSquadGuests.includes(trimmed)) {
                    setCustomSquadGuests((prev) => [...prev, trimmed]);
                    setGuestInput('');
                  }
                }}
                className="h-10 px-3.5 bg-subtle text-primary border border-primary/25 rounded-xl font-bold text-xs"
              >
                + Guest
              </button>
            </div>

            {customSquadGuests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customSquadGuests.map((g, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-page border border-border text-xs font-semibold text-main flex items-center gap-1.5"
                  >
                    {g}
                    <button
                      type="button"
                      onClick={() =>
                        setCustomSquadGuests((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-muted hover:text-danger font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full h-12 mt-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
          >
            Save Squad
          </button>
        </form>
      </BottomSheet>

      {/* MODAL 3: FRIENDSHIP DINING DOSSIER */}
      <BottomSheet
        isOpen={!!selectedFriend}
        onClose={() => setSelectedFriend(null)}
        title={selectedFriend ? selectedFriend.name : 'Friend Dossier'}
      >
        {selectedFriend && (
          <div className="flex flex-col gap-5 pb-4">
            <div className="flex items-center gap-3.5 bg-page border border-border rounded-2xl p-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                {selectedFriend.avatar_url ? (
                  <img
                    src={selectedFriend.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={26} />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-extrabold text-main text-lg truncate">
                  {selectedFriend.name}
                </span>
                <span className="text-xs font-mono text-muted truncate">
                  {selectedFriend.upi_id || 'No UPI ID linked'}
                </span>
              </div>
            </div>

            {isLoadingDossier ? (
              <BrandLoader label="Calculating Shared Stats..." />
            ) : (
              <>
                {/* SHARED DINING KPI GRID */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-page border border-border rounded-2xl p-3.5 flex flex-col">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1">
                      <Calendar size={12} className="text-primary" /> Shared Outings
                    </span>
                    <span className="text-2xl font-extrabold text-main tabular-nums mt-1">
                      {dossierStats?.sharedSessionCount || 0}
                    </span>
                  </div>
                  <div className="bg-page border border-border rounded-2xl p-3.5 flex flex-col min-w-0">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted flex items-center gap-1">
                      <Store size={12} className="text-success" /> Go-To Spot
                    </span>
                    <span className="text-sm font-extrabold text-main truncate mt-1.5">
                      {dossierStats?.favoriteVenue || 'None yet'}
                    </span>
                  </div>
                </div>

                {/* BILATERAL NET BALANCE & INSTANT SETTLEMENT */}
                <div className="bg-page border border-border rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">
                      Net Balance Together
                    </span>
                    {dossierBalance ? (
                      <span
                        className={`text-base font-extrabold tabular-nums ${
                          dossierBalance.direction === 'owed_to_me' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {dossierBalance.direction === 'owed_to_me' ? '+' : '-'}
                        {utils.formatMoney(dossierBalance.netAmount)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-success bg-success/10 px-2.5 py-0.5 rounded-full">
                        ✓ All Settled Up
                      </span>
                    )}
                  </div>

                  {dossierBalance && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {dossierBalance.direction === 'owed_to_me' ? (
                        <>
                          <a
                            href={utils.buildWhatsAppReminderUrl({
                              debtorName: selectedFriend.name,
                              creditorName: user?.user_metadata?.full_name || 'me',
                              amount: dossierBalance.netAmount,
                              upiId: myUpiId,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 h-10 px-3 bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle size={15} /> WhatsApp Nudge
                          </a>
                          <button
                            type="button"
                            onClick={() => setConfirmSettleDossier(true)}
                            className="flex-1 h-10 px-3 bg-primary text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 size={15} /> Settle Up
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedFriend.upi_id && (
                            <>
                              <a
                                href={utils.buildUpiUrl({
                                  upiId: selectedFriend.upi_id,
                                  payeeName: selectedFriend.name,
                                  amount: dossierBalance.netAmount,
                                  note: 'Ekwly Net Settlement',
                                })}
                                className="flex-1 h-10 px-3 bg-primary text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <Smartphone size={15} /> Pay via UPI
                              </a>
                              <button
                                type="button"
                                onClick={() => setShowDossierQr(!showDossierQr)}
                                className="h-10 px-3 bg-surface text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-1"
                              >
                                <QrCode size={15} /> QR
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmSettleDossier(true)}
                            className="flex-1 h-10 px-3 bg-success text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 size={15} /> Mark Paid
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {showDossierQr && selectedFriend.upi_id && dossierBalance && (
                    <div className="flex flex-col items-center pt-3 border-t border-border">
                      <div className="bg-white p-4 rounded-2xl border border-border shadow-sm">
                        <QRCode
                          value={utils.buildUpiUrl({
                            upiId: selectedFriend.upi_id,
                            payeeName: selectedFriend.name,
                            amount: dossierBalance.netAmount,
                            note: 'Ekwly Net Settlement',
                          })}
                          size={180}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted mt-2">
                        {selectedFriend.upi_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* RECENT SHARED SESSIONS */}
                {dossierStats && dossierStats.recentSessions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      Recent Outings Together
                    </span>
                    <div className="bg-page border border-border rounded-2xl divide-y divide-border overflow-hidden">
                      {dossierStats.recentSessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                        >
                          <span className="font-bold text-main truncate pr-2">{s.title}</span>
                          <span className="text-muted tabular-nums shrink-0">
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
