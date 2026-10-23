import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { showToast, utils } from '../lib/utils';
import type { DatabaseSession, GlobalLedgerRow, NettedBalanceRow, SavedSquad } from '../lib/types';
import QrScannerModal from './ui/QrScannerModal';
import ConfirmSheet from './ui/ConfirmSheet';
import BottomSheet from './ui/BottomSheet';
import BrandLoader from './ui/BrandLoader';
import AnimatedNumber from './ui/AnimatedNumber';
import {
  Plus,
  QrCode,
  Clock,
  ChevronRight,
  KeyRound,
  Trash2,
  Edit2,
  Check,
  X,
  Lock,
  FileEdit,
  Sparkles,
  FolderKanban,
  Users,
  Search,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';

interface TripFolder {
  id: string;
  name: string;
  sessionIds: string[];
  createdAt: string;
}

interface CachedHomeData {
  recentSessions: DatabaseSession[];
  owedToMe: number;
  iOwe: number;
  topPendingCreditors: NettedBalanceRow[];
  isPro: boolean;
  scansLeft: number;
}

interface Props {
  onOpenLobby: (mode: 'create' | 'join', customTitle?: string) => void;
  onJoinSession: (sessionId: string, pin: string) => void;
  onLaunchSquadSession?: (squad: SavedSquad) => void;
  onViewLedger: () => void;
  onOpenProPlans?: () => void;
  onRequireSignIn?: () => void;
  user: SupabaseUser | null;
}

export default function Home({
  onOpenLobby,
  onJoinSession,
  onLaunchSquadSession,
  onViewLedger,
  onOpenProPlans,
  onRequireSignIn,
  user,
}: Props) {
  const cacheKey = `home_${user?.id || 'guest'}`;
  const cached = swrCache.get<CachedHomeData>(cacheKey);

  const [recentSessions, setRecentSessions] = useState<DatabaseSession[]>(
    cached?.recentSessions || []
  );
  const [owedToMe, setOwedToMe] = useState(cached?.owedToMe || 0);
  const [iOwe, setIOwe] = useState(cached?.iOwe || 0);
  const [topPending, setTopPending] = useState<NettedBalanceRow[]>(
    cached?.topPendingCreditors || []
  );
  const [isPro, setIsPro] = useState(cached?.isPro || false);
  const [scansLeft, setScansLeft] = useState(cached?.scansLeft ?? 3);
  const [isLoading, setIsLoading] = useState(!cached);

  // Saved Squads & Trip Folders
  const [savedSquads, setSavedSquads] = useState<SavedSquad[]>(() =>
    utils.getSavedSquads(user?.id)
  );
  const tripStorageKey = `ekwly_trips_${user?.id || 'guest'}`;
  const [tripFolders, setTripFolders] = useState<TripFolder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(tripStorageKey) || '[]');
    } catch {
      return [];
    }
  });

  // Trip Folder Modals State
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [selectedTripSessionIds, setSelectedTripSessionIds] = useState<string[]>([]);
  const [activeTripFolder, setActiveTripFolder] = useState<TripFolder | null>(null);
  const [tripNettedDebts, setTripNettedDebts] = useState<
    { from: string; to: string; amount: number }[]
  >([]);
  const [isLoadingTripStats, setIsLoadingTripStats] = useState(false);

  // Session Filters & Editing
  const [sessionFilter, setSessionFilter] = useState<'all' | 'draft' | 'locked'>('all');
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [isScanningRoom, setIsScanningRoom] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<DatabaseSession | null>(null);

  useEffect(() => {
    setSavedSquads(utils.getSavedSquads(user?.id));
    if (typeof window !== 'undefined') {
      try {
        setTripFolders(JSON.parse(localStorage.getItem(tripStorageKey) || '[]'));
      } catch {
        setTripFolders([]);
      }
    }
  }, [user?.id, tripStorageKey]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.is_anonymous) {
        setIsLoading(false);
        return;
      }

      const [sessionRes, creditorRes, debtorRes, profileRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, name, venue_name, host_id, pin, status, created_at')
          .eq('host_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('global_ledger').select('*').eq('creditor_id', user.id),
        supabase.from('global_ledger').select('*').eq('debtor_id', user.id),
        supabase
          .from('profiles')
          .select('ai_scans_used, last_scan_reset, pro_expires_at')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      const nextSessions = (sessionRes.data || []) as DatabaseSession[];
      const netted = utils.netBilateralBalances(
        (creditorRes.data || []) as GlobalLedgerRow[],
        (debtorRes.data || []) as GlobalLedgerRow[]
      );

      const now = new Date();
      const proActive = Boolean(
        profileRes.data?.pro_expires_at && new Date(profileRes.data.pro_expires_at) > now
      );
      const lastReset = new Date(profileRes.data?.last_scan_reset || 0);
      const monthRolledOver =
        now.getUTCFullYear() > lastReset.getUTCFullYear() ||
        now.getUTCMonth() > lastReset.getUTCMonth();
      const used = monthRolledOver ? 0 : Number(profileRes.data?.ai_scans_used || 0);
      const remainingScans = Math.max(0, 3 - used);

      setRecentSessions(nextSessions);
      setOwedToMe(netted.totalOwedToMe);
      setIOwe(netted.totalIOwe);
      setTopPending(netted.netOwedToMe.slice(0, 3));
      setIsPro(proActive);
      setScansLeft(remainingScans);

      swrCache.set<CachedHomeData>(cacheKey, {
        recentSessions: nextSessions,
        owedToMe: netted.totalOwedToMe,
        iOwe: netted.totalIOwe,
        topPendingCreditors: netted.netOwedToMe.slice(0, 3),
        isPro: proActive,
        scansLeft: remainingScans,
      });

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [user, cacheKey]);

  const saveTripsToStorage = (nextTrips: TripFolder[]) => {
    setTripFolders(nextTrips);
    if (typeof window !== 'undefined') {
      localStorage.setItem(tripStorageKey, JSON.stringify(nextTrips));
    }
  };

  const handleCreateTripFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTripName.trim();
    if (!trimmed) return showToast('Enter a trip or event name (e.g. Goa Oct 26)', 'error');

    utils.haptic('medium');
    const newTrip: TripFolder = {
      id: utils.generateId(),
      name: trimmed,
      sessionIds: selectedTripSessionIds,
      createdAt: new Date().toISOString(),
    };
    saveTripsToStorage([newTrip, ...tripFolders]);
    setNewTripName('');
    setSelectedTripSessionIds([]);
    setShowCreateTripModal(false);
    showToast(`Created "${trimmed}" Trip Folder!`, 'success');
  };

  const openTripFolderDetails = async (trip: TripFolder) => {
    utils.haptic('light');
    setActiveTripFolder(trip);
    if (trip.sessionIds.length === 0) {
      setTripNettedDebts([]);
      return;
    }

    setIsLoadingTripStats(true);
    try {
      const { data: ledgerRows } = await supabase
        .from('ledger')
        .select('*')
        .in('session_id', trip.sessionIds)
        .eq('settled', false);

      // Consolidate all unsettled transfers across all sessions in this Trip Folder
      const netByPerson = new Map<string, number>();
      (ledgerRows || []).forEach((row: any) => {
        const creditor = (row.creditor_fallback_name || 'Host').trim();
        const debtor = (row.debtor_fallback_name || 'Guest').trim();
        const amt = Number(row.amount || 0);
        netByPerson.set(creditor, (netByPerson.get(creditor) || 0) + amt);
        netByPerson.set(debtor, (netByPerson.get(debtor) || 0) - amt);
      });

      const debtors: { name: string; bal: number }[] = [];
      const creditors: { name: string; bal: number }[] = [];
      netByPerson.forEach((bal, name) => {
        if (bal < -0.05) debtors.push({ name, bal });
        else if (bal > 0.05) creditors.push({ name, bal });
      });

      debtors.sort((a, b) => a.bal - b.bal);
      creditors.sort((a, b) => b.bal - a.bal);

      const consolidated: { from: string; to: string; amount: number }[] = [];
      let d = 0;
      let c = 0;
      while (d < debtors.length && c < creditors.length) {
        const pay = utils.round2(Math.min(-debtors[d].bal, creditors[c].bal));
        if (pay > 0.05) {
          consolidated.push({ from: debtors[d].name, to: creditors[c].name, amount: pay });
        }
        debtors[d].bal += pay;
        creditors[c].bal -= pay;
        if (Math.abs(debtors[d].bal) <= 0.05) d++;
        if (Math.abs(creditors[c].bal) <= 0.05) c++;
      }

      setTripNettedDebts(consolidated);
    } finally {
      setIsLoadingTripStats(false);
    }
  };

  const handleSettleEntireTrip = async () => {
    if (!activeTripFolder || activeTripFolder.sessionIds.length === 0) return;
    utils.haptic('heavy');
    await supabase
      .from('ledger')
      .update({ settled: true })
      .in('session_id', activeTripFolder.sessionIds)
      .eq('settled', false);
    swrCache.invalidate('home_');
    swrCache.invalidate('ledger_');
    setTripNettedDebts([]);
    showToast(`All bills in "${activeTripFolder.name}" marked settled!`, 'success');
  };

  const processScannedUrl = (scannedUrl: string) => {
    let sessionId = null;
    let pin = null;
    try {
      const url = new URL(scannedUrl);
      sessionId = url.searchParams.get('s');
      pin = url.searchParams.get('p');
    } catch {
      const urlParams = new URLSearchParams(scannedUrl.split('?')[1]);
      sessionId = urlParams.get('s');
      pin = urlParams.get('p');
    }
    if (sessionId && pin) onJoinSession(sessionId, pin);
    else showToast('Invalid Room QR Code.', 'error');
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const delId = sessionToDelete.id;
    const updated = recentSessions.filter((s) => s.id !== delId);
    setRecentSessions(updated);
    swrCache.set<CachedHomeData>(cacheKey, {
      recentSessions: updated,
      owedToMe,
      iOwe,
      topPendingCreditors: topPending,
      isPro,
      scansLeft,
    });
    await supabase.from('sessions').delete().eq('id', delId);
    swrCache.invalidate('ledger_');
    swrCache.invalidate('analytics_');
    showToast('Session deleted', 'success');
  };

  const handleRenameSession = async (
    e: React.MouseEvent | React.KeyboardEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    const trimmed = editSessionName.trim();
    if (!trimmed) return setEditingSessionId(null);

    const updated = recentSessions.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s));
    setRecentSessions(updated);
    setEditingSessionId(null);

    const { error } = await supabase.from('sessions').update({ name: trimmed }).eq('id', sessionId);
    if (error) showToast('Failed to rename session', 'error');
  };

  const getSessionTitle = (session: DatabaseSession) =>
    session.name ||
    `${new Date(session.created_at).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} Session`;

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-emerald-500',
      'bg-violet-500',
      'bg-amber-500',
      'bg-rose-500',
    ];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  const filteredSessions = useMemo(() => {
    return recentSessions.filter((s) => {
      if (sessionFilter === 'draft' && s.status === 'locked') return false;
      if (sessionFilter === 'locked' && s.status !== 'locked') return false;
      if (sessionSearch.trim()) {
        const q = sessionSearch.trim().toLowerCase();
        const title = getSessionTitle(s).toLowerCase();
        const venue = (s.venue_name || '').toLowerCase();
        return title.includes(q) || venue.includes(q) || s.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [recentSessions, sessionFilter, sessionSearch]);

  const firstName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ')[0]
    : '';

  return (
    <div className="w-full flex flex-col flex-1 relative bg-page pb-32">
      <QrScannerModal
        isOpen={isScanningRoom}
        title="Scan Room QR"
        onClose={() => setIsScanningRoom(false)}
        onScanSuccess={processScannedUrl}
      />

      <ConfirmSheet
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Session?"
        description={`Are you sure you want to permanently delete "${
          sessionToDelete ? getSessionTitle(sessionToDelete) : ''
        }" and all of its split records?`}
        confirmLabel="Delete Room"
        variant="danger"
      />

      <div className="absolute inset-0 bg-grid-pattern z-0" />

      <div className="w-full flex flex-col gap-5 px-4 py-5 md:px-8 relative z-10">
        {/* GREETING & AI SCAN STATUS HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">
              {firstName ? `Hi, ${firstName}` : 'Command Center'}
            </h2>
            <p className="text-muted text-xs sm:text-sm font-medium mt-0.5">
              Split a restaurant bill or settle up with your crew
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              if (onOpenProPlans) onOpenProPlans();
            }}
            className={`px-3 py-1.5 rounded-2xl border text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95 ${
              isPro
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                : 'glass-card text-main hover:border-primary/40'
            }`}
          >
            <Sparkles size={14} className={isPro ? 'text-amber-400' : 'text-primary'} />
            <span className="tabular-nums">
              {isPro ? 'PRO ∞ Scans' : `${scansLeft}/3 Free AI Scans`}
            </span>
          </button>
        </div>

        {/* HERO LEDGER COMMAND CARD OR GUEST BANNER */}
        {user?.is_anonymous ? (
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              if (onRequireSignIn) onRequireSignIn();
            }}
            className="w-full text-left glass-card bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-3xl p-5 flex items-center justify-between gap-3 transition-colors active:scale-[0.99]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-amber-500 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} /> Guest Mode Active
              </span>
              <span className="text-main text-xs sm:text-sm font-medium leading-relaxed">
                Tap here to link Google or Email so your rooms, friends &amp; ledger never get lost.
              </span>
            </div>
            <ChevronRight size={20} className="text-amber-500 shrink-0" />
          </button>
        ) : (
          <div className="w-full premium-gradient-card text-white rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
            <div
              onClick={() => {
                utils.haptic('light');
                onViewLedger();
              }}
              className="flex flex-wrap justify-between items-end gap-3 cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">
                  Net Owed to You
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                  <AnimatedNumber value={owedToMe} />
                </span>
              </div>
              <div className="flex items-center gap-1 text-white text-xs font-bold bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-full transition-colors shadow-sm">
                Open Ledger <ChevronRight size={15} />
              </div>
            </div>

            <div className="h-px w-full bg-white/20" />

            <div className="flex flex-wrap justify-between items-center gap-2 text-xs sm:text-sm">
              <span className="text-white/85 font-medium">Net You Owe Others</span>
              <span className="font-extrabold tracking-wide tabular-nums">
                <AnimatedNumber value={iOwe} />
              </span>
            </div>

            {/* Live Pending Settlements Quick Strip */}
            {topPending.length > 0 && (
              <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-white/75 mr-1">
                    Pending:
                  </span>
                  {topPending.map((row) => (
                    <button
                      key={row.counterpartyKey}
                      type="button"
                      onClick={onViewLedger}
                      className="px-2.5 py-1 rounded-full bg-black/25 hover:bg-black/35 text-white text-xs font-bold tabular-nums flex items-center gap-1 transition-colors"
                    >
                      <span>{row.counterpartyName.split(' ')[0]}</span>
                      <span className="text-emerald-300">+{utils.formatMoney(row.netAmount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRIMARY QUICK ACTIONS (SPACIOUS GLASS CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              utils.haptic('medium');
              onOpenLobby('create');
            }}
            className="glass-card hover:border-primary/50 text-main rounded-2xl p-4 flex items-center gap-3.5 transition-colors text-left min-h-18"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base text-main">New Bill Split</span>
              <span className="text-xs text-muted font-medium">
                AI Magic Scan or manual receipt
              </span>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              utils.haptic('light');
              setIsScanningRoom(true);
            }}
            className="glass-card hover:border-primary/50 text-main rounded-2xl p-4 flex items-center gap-3.5 transition-colors text-left min-h-18"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <QrCode size={22} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base text-main">Scan Table QR</span>
              <span className="text-xs text-muted font-medium">
                Join a friend&apos;s live session
              </span>
            </div>
          </motion.button>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            utils.haptic('light');
            onOpenLobby('join');
          }}
          className="w-full min-h-11 py-2.5 px-4 glass-card hover:border-primary/40 text-muted hover:text-main rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-colors"
        >
          <KeyRound size={15} className="text-primary shrink-0" /> Have a Room ID &amp; 4-Digit PIN?
          Enter here
        </motion.button>

        {/* 1-TAP SAVED SQUAD QUICK-LAUNCH BAR */}
        {savedSquads.length > 0 && (
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-main flex items-center gap-1.5">
                <Users size={14} className="text-primary" /> 1-Tap Squad Split
              </span>
              <span className="text-xs text-muted font-medium">Starts room with crew added</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {savedSquads.map((squad) => (
                <button
                  key={squad.id}
                  type="button"
                  onClick={() => {
                    utils.haptic('medium');
                    if (onLaunchSquadSession) {
                      onLaunchSquadSession(squad);
                    } else {
                      onOpenLobby('create', `${squad.name} Split`);
                    }
                  }}
                  className="shrink-0 min-h-10 px-3.5 py-2 rounded-xl bg-primary/12 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-extrabold flex items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Sparkles size={13} /> {squad.name} ({squad.members.length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PRO MULTI-BILL TRIP & EVENT FOLDERS */}
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-primary" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-main">
                Trip &amp; Event Folders ({tripFolders.length})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[0.62rem] font-extrabold uppercase">
                Multi-Bill
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                utils.haptic('light');
                setShowCreateTripModal(true);
              }}
              className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> New Trip
            </button>
          </div>

          {tripFolders.length === 0 ? (
            <p className="text-xs text-muted leading-relaxed">
              Bar-hopping or on a weekend trip? Group multiple bills into a{' '}
              <strong className="text-main">Trip Folder</strong> (e.g.{' '}
              <em>&ldquo;Goa Oct &apos;26&rdquo;</em>) to settle the entire weekend in one
              consolidated payment per person.
            </p>
          ) : (
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5">
              {tripFolders.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => openTripFolderDetails(trip)}
                  className="shrink-0 min-h-14 px-4 py-2.5 rounded-2xl bg-page border border-border hover:border-primary/40 text-left flex flex-col justify-center gap-0.5 transition-all active:scale-95"
                >
                  <span className="font-extrabold text-sm text-main">{trip.name}</span>
                  <span className="text-xs text-primary font-bold tabular-nums">
                    {trip.sessionIds.length} {trip.sessionIds.length === 1 ? 'bill' : 'bills'} • Tap
                    to Settle
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RECENT SESSIONS LIST WITH SEARCH & STATUS FILTERS */}
        <div className="flex flex-col flex-1 pb-4 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              <Clock className="text-muted" size={15} />
              <h3 className="text-xs font-extrabold text-muted uppercase tracking-widest">
                Recent Sessions ({filteredSessions.length})
              </h3>
            </div>

            <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
              {(['all', 'draft', 'locked'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSessionFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                    sessionFilter === f ? 'bg-primary text-white' : 'text-muted hover:text-main'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {recentSessions.length > 3 && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Search sessions by name or restaurant..."
                className="w-full min-h-11 bg-surface border border-border rounded-xl pl-10 pr-4 text-sm font-semibold text-main"
              />
            </div>
          )}

          {isLoading ? (
            <BrandLoader label="Loading Sessions..." />
          ) : filteredSessions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {filteredSessions.map((session) => {
                  const title = getSessionTitle(session);
                  const isEditing = editingSessionId === session.id;
                  const isLocked = session.status === 'locked';
                  const hasDistinctVenue = Boolean(
                    session.venue_name &&
                    (!session.name ||
                      session.name.toLowerCase() !== session.venue_name.toLowerCase())
                  );

                  return (
                    <motion.div
                      key={session.id}
                      layout="position"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="glass-card hover:border-primary/40 rounded-2xl p-4 flex items-center justify-between text-left"
                    >
                      <div
                        className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          !isEditing &&
                          onJoinSession(
                            session.id,
                            session.pin || localStorage.getItem('ekwly_pin_' + session.id) || ''
                          )
                        }
                      >
                        <div
                          className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 font-extrabold text-base shadow-inner ${getAvatarColor(
                            title
                          )}`}
                        >
                          {title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          {isEditing ? (
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                type="text"
                                value={editSessionName}
                                onChange={(e) => setEditSessionName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameSession(e, session.id);
                                  if (e.key === 'Escape') setEditingSessionId(null);
                                }}
                                className="min-h-9 flex-1 bg-page border border-primary/50 rounded-lg px-2.5 text-sm font-bold text-main"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleRenameSession(e, session.id)}
                                className="p-2 bg-primary text-white rounded-lg"
                                aria-label="Save name"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(null);
                                }}
                                className="p-2 bg-page text-muted rounded-lg border border-border"
                                aria-label="Cancel rename"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-main text-base truncate">
                                {title}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.65rem] font-extrabold uppercase tracking-wider shrink-0 ${
                                  isLocked
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : 'bg-amber-500/15 text-amber-500'
                                }`}
                              >
                                {isLocked ? <Lock size={10} /> : <FileEdit size={10} />}
                                {isLocked ? 'Locked' : 'Draft'}
                              </span>
                            </div>
                          )}

                          <span className="text-xs text-muted font-medium tabular-nums truncate mt-0.5">
                            {hasDistinctVenue ? `${session.venue_name} • ` : ''}
                            {new Date(session.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            • #{session.id.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 pl-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditSessionName(title);
                            }}
                            className="p-2.5 text-muted hover:text-primary hover:bg-subtle rounded-xl transition-colors"
                            aria-label="Rename session"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(session);
                            }}
                            className="p-2.5 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
                            aria-label="Delete session"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 glass-card border-dashed rounded-3xl text-center">
              <div className="w-13 h-13 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3">
                <Plus size={26} />
              </div>
              <h3 className="font-extrabold text-main text-base mb-1">No matching sessions</h3>
              <p className="text-xs sm:text-sm font-medium text-muted max-w-xs">
                Tap <strong>New Bill Split</strong> above or the <strong>+</strong> button in the
                dock to scan your first receipt.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CREATE TRIP / EVENT FOLDER */}
      <BottomSheet
        isOpen={showCreateTripModal}
        onClose={() => setShowCreateTripModal(false)}
        title="Create Trip / Event Folder"
      >
        <form onSubmit={handleCreateTripFolder} className="flex flex-col gap-4 pb-4">
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Group multiple bills from a vacation, house party, or weekend bar-hop into one folder to
            settle all bills in a single transfer per person.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted">
              Trip or Event Name
            </label>
            <input
              type="text"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              placeholder="e.g. Goa Oct '26, Koramangala Hop"
              className="w-full min-h-12 bg-page border border-border rounded-xl px-3.5 text-sm font-semibold"
              required
            />
          </div>

          {recentSessions.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Select Bills to Include ({selectedTripSessionIds.length})
              </label>
              <div className="bg-page border border-border rounded-2xl divide-y divide-border max-h-52 overflow-y-auto">
                {recentSessions.map((s) => {
                  const isSel = selectedTripSessionIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setSelectedTripSessionIds((prev) =>
                          isSel ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-subtle/50"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-sm text-main truncate">
                          {getSessionTitle(s)}
                        </span>
                        <span className="text-xs text-muted truncate">
                          {s.venue_name || 'Dining Session'} •{' '}
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          isSel ? 'bg-primary border-primary text-white' : 'border-border'
                        }`}
                      >
                        {isSel && <Check size={13} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-12 mt-2 premium-gradient-card text-white font-bold rounded-xl text-sm shadow-sm"
          >
            Save Trip Folder
          </button>
        </form>
      </BottomSheet>

      {/* MODAL 2: TRIP FOLDER CONSOLIDATED SETTLEMENT */}
      <BottomSheet
        isOpen={!!activeTripFolder}
        onClose={() => setActiveTripFolder(null)}
        title={activeTripFolder ? activeTripFolder.name : 'Trip Folder'}
      >
        {activeTripFolder && (
          <div className="flex flex-col gap-5 pb-4">
            <div className="flex items-center justify-between gap-2 bg-page border border-border rounded-2xl p-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Bills in This Trip
                </span>
                <span className="text-xl font-extrabold text-main tabular-nums">
                  {activeTripFolder.sessionIds.length}{' '}
                  {activeTripFolder.sessionIds.length === 1 ? 'Session' : 'Sessions'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const tripName = activeTripFolder.name;
                  setActiveTripFolder(null);
                  onOpenLobby('create', `${tripName} — Bill`);
                }}
                className="min-h-10 px-4 bg-primary text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> Add New Bill to Trip
              </button>
            </div>

            {isLoadingTripStats ? (
              <BrandLoader label="Consolidating Trip Balances..." />
            ) : (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Consolidated Trip Settlement (Net Across All Bills)
                </span>
                {tripNettedDebts.length === 0 ? (
                  <div className="p-6 bg-page border border-border rounded-2xl text-center text-xs sm:text-sm text-muted font-medium">
                    No unsettled balances across the locked bills in this trip!
                  </div>
                ) : (
                  <div className="bg-page border border-border rounded-2xl divide-y divide-border overflow-hidden">
                    {tripNettedDebts.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="font-bold text-main">
                          {t.from} <span className="text-muted font-normal mx-1">pays</span> {t.to}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-primary tabular-nums">
                            {utils.formatMoney(t.amount)}
                          </span>
                          <a
                            href={utils.buildWhatsAppReminderUrl({
                              debtorName: t.from,
                              creditorName: t.to,
                              amount: t.amount,
                              venueName: activeTripFolder.name,
                              isReminder: true,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-emerald-500/12 text-emerald-500 hover:bg-emerald-500/20"
                            title="Send WhatsApp Trip Summary"
                          >
                            <MessageCircle size={15} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tripNettedDebts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSettleEntireTrip}
                    className="w-full min-h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                  >
                    <CheckCircle2 size={16} /> Mark Entire Trip Settled
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const next = tripFolders.filter((t) => t.id !== activeTripFolder.id);
                saveTripsToStorage(next);
                setActiveTripFolder(null);
                showToast('Trip folder removed.', 'default');
              }}
              className="text-xs font-bold text-danger self-center hover:underline pt-2"
            >
              Remove Trip Folder
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
