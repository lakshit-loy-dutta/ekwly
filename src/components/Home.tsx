import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { showToast, utils } from '../lib/utils';
import type { DatabaseSession, GlobalLedgerRow } from '../lib/types';
import QrScannerModal from './ui/QrScannerModal';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
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
} from 'lucide-react';

interface CachedHomeData {
  recentSessions: DatabaseSession[];
  owedToMe: number;
  iOwe: number;
}

interface Props {
  onOpenLobby: (mode: 'create' | 'join') => void;
  onJoinSession: (sessionId: string, pin: string) => void;
  onViewLedger: () => void;
  onRequireSignIn?: () => void;
  user: SupabaseUser | null;
}

export default function Home({
  onOpenLobby,
  onJoinSession,
  onViewLedger,
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
  const [isLoading, setIsLoading] = useState(!cached);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [isScanningRoom, setIsScanningRoom] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<DatabaseSession | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.is_anonymous) {
        setIsLoading(false);
        return;
      }

      const [sessionRes, creditorRes, debtorRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, name, venue_name, host_id, pin, status, created_at')
          .eq('host_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase.from('global_ledger').select('*').eq('creditor_id', user.id),
        supabase.from('global_ledger').select('*').eq('debtor_id', user.id),
      ]);

      const nextSessions = (sessionRes.data || []) as DatabaseSession[];
      const netted = utils.netBilateralBalances(
        (creditorRes.data || []) as GlobalLedgerRow[],
        (debtorRes.data || []) as GlobalLedgerRow[]
      );

      setRecentSessions(nextSessions);
      setOwedToMe(netted.totalOwedToMe);
      setIOwe(netted.totalIOwe);

      swrCache.set<CachedHomeData>(cacheKey, {
        recentSessions: nextSessions,
        owedToMe: netted.totalOwedToMe,
        iOwe: netted.totalIOwe,
      });

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [user, cacheKey]);

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
    swrCache.set<CachedHomeData>(cacheKey, {
      recentSessions: updated,
      owedToMe,
      iOwe,
    });
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

  const firstName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ')[0]
    : '';

  return (
    <div className="w-full flex flex-col flex-1 relative bg-page pb-28">
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

      <div className="w-full flex flex-col px-4 py-5 md:px-8 relative z-10">
        {/* GREETING HEADER */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">
              {firstName ? `Hi, ${firstName}` : 'Dashboard'}
            </h2>
            <p className="text-muted text-xs sm:text-sm font-medium">
              Split a receipt or settle up with your crew
            </p>
          </div>
        </div>

        {/* HERO LEDGER CARD OR INTERACTIVE GUEST BANNER */}
        {user?.is_anonymous ? (
          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              if (onRequireSignIn) {
                onRequireSignIn();
              } else {
                supabase.auth.signOut().then(() => window.location.reload());
              }
            }}
            className="w-full text-left bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3 transition-colors active:scale-[0.99]"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-amber-500 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} /> Guest Mode Active
              </span>
              <span className="text-main text-xs font-medium leading-relaxed">
                Tap here to link Google or Email so your rooms, friends &amp; ledger never get lost.
              </span>
            </div>
            <ChevronRight size={18} className="text-amber-500 shrink-0" />
          </button>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              utils.haptic('light');
              onViewLedger();
            }}
            className="w-full text-left premium-gradient-card text-white rounded-3xl p-5 sm:p-6 mb-4 flex flex-col gap-4 gpu-layer"
          >
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-white/80 text-[0.65rem] font-bold uppercase tracking-widest mb-1">
                  Net Owed to You
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
                  {utils.formatMoney(owedToMe)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-white text-xs font-bold bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-full transition-colors shadow-sm">
                Open Ledger <ChevronRight size={15} />
              </div>
            </div>
            <div className="h-px w-full bg-white/20" />
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-white/80 font-medium">Net You Owe Others</span>
              <span className="font-extrabold tracking-wide tabular-nums">
                {utils.formatMoney(iOwe)}
              </span>
            </div>
          </motion.button>
        )}

        {/* COMPACT THUMB-FRIENDLY QUICK ACTION BAR */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              utils.haptic('medium');
              onOpenLobby('create');
            }}
            className="bg-surface hover:border-primary/50 text-main border border-border rounded-2xl p-3.5 flex items-center gap-3 shadow-sm transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-main truncate">New Split</span>
              <span className="text-[0.68rem] text-muted font-medium truncate">
                Scan or add bill
              </span>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              utils.haptic('light');
              setIsScanningRoom(true);
            }}
            className="bg-surface hover:border-primary/50 text-main border border-border rounded-2xl p-3.5 flex items-center gap-3 shadow-sm transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <QrCode size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-main truncate">Scan QR</span>
              <span className="text-[0.68rem] text-muted font-medium truncate">
                Join live table
              </span>
            </div>
          </motion.button>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            utils.haptic('light');
            onOpenLobby('join');
          }}
          className="w-full h-10 bg-surface/80 hover:bg-surface text-muted hover:text-main border border-border rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors mb-6 shadow-2xs"
        >
          <KeyRound size={14} className="text-primary" /> Have a Room ID &amp; 4-Digit PIN? Join
          here
        </motion.button>

        {/* RECENT ACTIVITY LIST */}
        <div className="flex flex-col flex-1 pb-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <Clock className="text-muted" size={14} />
              <h3 className="text-[0.7rem] font-bold text-muted uppercase tracking-widest">
                Recent Sessions ({recentSessions.length})
              </h3>
            </div>
          </div>

          {isLoading ? (
            <BrandLoader label="Loading Sessions..." />
          ) : recentSessions.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {recentSessions.map((session) => {
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
                      className="bg-surface border border-border hover:border-primary/40 rounded-2xl p-3.5 flex items-center justify-between text-left shadow-sm gpu-layer"
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
                          className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 font-extrabold text-base shadow-inner ${getAvatarColor(
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
                                className="h-8 flex-1 bg-page border border-primary/50 rounded-lg px-2.5 text-sm font-bold text-main"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleRenameSession(e, session.id)}
                                className="p-1.5 bg-primary text-white rounded-lg"
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
                                className="p-1.5 bg-page text-muted rounded-lg border border-border"
                                aria-label="Cancel rename"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-main text-[0.95rem] truncate">
                                {title}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-extrabold uppercase tracking-wider shrink-0 ${
                                  isLocked
                                    ? 'bg-emerald-500/15 text-emerald-500'
                                    : 'bg-amber-500/15 text-amber-500'
                                }`}
                              >
                                {isLocked ? <Lock size={9} /> : <FileEdit size={9} />}
                                {isLocked ? 'Locked' : 'Draft'}
                              </span>
                            </div>
                          )}

                          <span className="text-[0.72rem] text-muted font-medium tabular-nums truncate mt-0.5">
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
                            className="p-2 text-muted hover:text-primary hover:bg-subtle rounded-xl transition-colors"
                            aria-label="Rename session"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(session);
                            }}
                            className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
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
            <div className="flex flex-col items-center justify-center py-10 px-6 bg-surface border border-dashed border-border rounded-2xl text-center">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3">
                <Plus size={24} />
              </div>
              <h3 className="font-bold text-main text-sm mb-1">No bills split yet</h3>
              <p className="text-xs font-medium text-muted max-w-xs">
                Tap <strong>New Split</strong> above or the <strong>+</strong> button in the dock to
                scan your first receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
