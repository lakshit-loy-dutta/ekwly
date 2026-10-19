import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import type { DatabaseSession, GlobalLedgerRow } from '../lib/types';
import QrScannerModal from './ui/QrScannerModal';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
import { Plus, QrCode, Clock, ChevronRight, KeyRound, Trash2, Edit2, Check } from 'lucide-react';

interface Props {
  onOpenLobby: (mode: 'create' | 'join') => void;
  onJoinSession: (sessionId: string, pin: string) => void;
  onViewLedger: () => void;
  user: SupabaseUser | null;
}

export default function Home({ onOpenLobby, onJoinSession, onViewLedger, user }: Props) {
  const [recentSessions, setRecentSessions] = useState<DatabaseSession[]>([]);
  const [owedToMe, setOwedToMe] = useState(0);
  const [iOwe, setIOwe] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [isScanningRoom, setIsScanningRoom] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<DatabaseSession | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.is_anonymous) return setIsLoading(false);

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

      if (sessionRes.data) setRecentSessions(sessionRes.data as DatabaseSession[]);

      const netted = utils.netBilateralBalances(
        (creditorRes.data || []) as GlobalLedgerRow[],
        (debtorRes.data || []) as GlobalLedgerRow[]
      );
      setOwedToMe(netted.totalOwedToMe);
      setIOwe(netted.totalIOwe);
      setIsLoading(false);
    };

    fetchDashboardData();
  }, [user]);

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
    setRecentSessions((prev) => prev.filter((s) => s.id !== delId));
    await supabase.from('sessions').delete().eq('id', delId);
    showToast('Session deleted', 'success');
  };

  const handleRenameSession = async (
    e: React.MouseEvent | React.KeyboardEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    if (!editSessionName.trim()) return setEditingSessionId(null);

    setRecentSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: editSessionName.trim() } : s))
    );
    setEditingSessionId(null);

    const { error } = await supabase
      .from('sessions')
      .update({ name: editSessionName.trim() })
      .eq('id', sessionId);
    if (error) showToast('Failed to rename session', 'error');
  };

  const getSessionTitle = (session: DatabaseSession) =>
    session.name ||
    session.venue_name ||
    `${new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} Session`;

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

  return (
    <div className="w-full flex flex-col flex-1 relative bg-page pb-24">
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
        description={`Are you sure you want to permanently delete "${sessionToDelete ? getSessionTitle(sessionToDelete) : ''}" and all of its split records?`}
        confirmLabel="Delete Room"
        variant="danger"
      />

      <div className="absolute inset-0 bg-grid-pattern z-0" />

      <div className="w-full flex flex-col px-4 py-6 md:px-8 relative z-10">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-main tracking-tight">
              {user?.user_metadata?.full_name
                ? `Hi, ${user.user_metadata.full_name.split(' ')[0]}`
                : 'Dashboard'}
            </h2>
            <p className="text-muted text-sm mt-1 font-medium">Ready to settle up?</p>
          </div>
        </div>

        {user?.is_anonymous ? (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 mb-6 flex flex-col gap-1">
            <h4 className="text-warning-700 font-bold text-sm">Guest Mode Active</h4>
            <p className="text-warning-700/80 text-xs font-medium leading-relaxed">
              Sign in from the profile menu to permanently save your session history and ledger.
            </p>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              utils.haptic('light');
              onViewLedger();
            }}
            className="w-full text-left premium-gradient-card text-white rounded-3xl p-6 mb-6 flex flex-col gap-5 gpu-layer"
          >
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1.5">
                  Net Owed to You
                </span>
                <span className="text-4xl font-extrabold tracking-tight tabular-nums">
                  {utils.formatMoney(owedToMe)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-white text-sm font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors shadow-sm">
                Ledger <ChevronRight size={16} />
              </div>
            </div>
            <div className="h-px w-full bg-white/20" />
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-sm font-medium">Net You Owe Others</span>
              <span className="font-bold tracking-wide tabular-nums">
                {utils.formatMoney(iOwe)}
              </span>
            </div>
          </motion.button>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              utils.haptic('light');
              onOpenLobby('create');
            }}
            className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 shadow-sm transition-colors h-28"
          >
            <div className="bg-primary/10 p-2.5 rounded-full text-primary">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[0.95rem]">New Session</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              utils.haptic('light');
              setIsScanningRoom(true);
            }}
            className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 shadow-sm transition-colors h-28"
          >
            <div className="bg-primary/10 p-2.5 rounded-full text-primary">
              <QrCode size={24} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[0.95rem]">Scan Room</span>
          </motion.button>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            utils.haptic('light');
            onOpenLobby('join');
          }}
          className="w-full h-12 bg-surface active:bg-subtle text-main border border-border rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors mb-8 shadow-sm hover:border-primary/30"
        >
          <KeyRound className="text-muted" size={18} /> Join with ID & PIN
        </motion.button>

        <div className="flex flex-col flex-1 pb-6">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Clock className="text-muted" size={16} />
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
              Recent Activity
            </h3>
          </div>

          {isLoading ? (
            <BrandLoader label="Loading Sessions..." />
          ) : recentSessions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {recentSessions.map((session) => {
                  const title = getSessionTitle(session);
                  const isEditing = editingSessionId === session.id;

                  return (
                    <motion.div
                      key={session.id}
                      layout="position"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="bg-surface border border-border hover:border-primary/40 rounded-2xl p-4 flex items-center justify-between text-left shadow-sm group gpu-layer"
                    >
                      <div
                        className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          !isEditing &&
                          onJoinSession(
                            session.id,
                            session.pin || localStorage.getItem(`ekwly_pin_${session.id}`) || ''
                          )
                        }
                      >
                        <div
                          className={`w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 font-bold text-lg shadow-inner ${getAvatarColor(title)}`}
                        >
                          {title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          {isEditing ? (
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                type="text"
                                value={editSessionName}
                                onChange={(e) => setEditSessionName(e.target.value)}
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && handleRenameSession(e, session.id)
                                }
                                className="h-8 w-full bg-page border border-primary/50 rounded-md px-2 text-sm font-bold text-main"
                              />
                              <button
                                onClick={(e) => handleRenameSession(e, session.id)}
                                className="p-1.5 bg-primary text-white rounded-md"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-main text-[1rem] truncate">
                                {title}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.id);
                                  setEditSessionName(title);
                                }}
                                className="opacity-60 hover:opacity-100 p-1 text-muted hover:text-primary transition-opacity"
                                aria-label="Rename session"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                          <span className="text-[0.75rem] text-muted font-medium tabular-nums mt-0.5">
                            {new Date(session.created_at).toLocaleDateString()} • ID:{' '}
                            {session.id.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors active:scale-90"
                          aria-label="Delete session"
                        >
                          <Trash2 size={18} />
                        </button>
                        <ChevronRight className="text-muted/40" size={20} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 bg-surface border border-dashed border-border rounded-2xl text-center">
              <div className="w-16 h-16 bg-page rounded-full flex items-center justify-center mb-4">
                <Plus className="text-muted/50" size={32} />
              </div>
              <h3 className="font-bold text-main mb-1">No sessions yet</h3>
              <p className="text-sm font-medium text-muted">
                Tap 'New Session' to start splitting a bill with your friends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
