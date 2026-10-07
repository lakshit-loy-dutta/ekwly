import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import BottomSheet from './ui/BottomSheet';
import {
  Plus,
  QrCode,
  Clock,
  ChevronRight,
  KeyRound,
  Trash2,
  X,
  Edit2,
  Check,
  Loader2,
} from 'lucide-react';

interface Props {
  onOpenLobby: (mode: 'create' | 'join') => void;
  onJoinSession: (sessionId: string, pin: string) => void;
  onViewLedger: () => void;
  user: SupabaseUser | null;
}

// FIX: Destructure onOpenLobby instead of onStartNew
export default function Home({ onOpenLobby, onJoinSession, onViewLedger, user }: Props) {
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [owedToMe, setOwedToMe] = useState(0);
  const [iOwe, setIOwe] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Editing Session Names
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');

  const [isWebScanning, setIsWebScanning] = useState(false);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.is_anonymous) return setIsLoading(false);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (sessionData) setRecentSessions(sessionData);

      const { data: creditorData } = await supabase
        .from('global_ledger')
        .select('total_owed')
        .eq('creditor_id', user.id);
      const { data: debtorData } = await supabase
        .from('global_ledger')
        .select('total_owed')
        .eq('debtor_id', user.id);

      setOwedToMe(creditorData?.reduce((sum, row) => sum + Number(row.total_owed), 0) || 0);
      setIOwe(debtorData?.reduce((sum, row) => sum + Number(row.total_owed), 0) || 0);
      setIsLoading(false);
    };

    fetchDashboardData();
    return () => {
      if (qrRef.current?.isScanning) qrRef.current.stop().catch(console.error);
    };
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
    else showToast('Invalid QR Code.', 'error');
  };

  const startWebScan = () => {
    setIsWebScanning(true);
    setTimeout(async () => {
      try {
        qrRef.current = new Html5Qrcode('qr-reader');
        await qrRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            stopWebScan();
            processScannedUrl(decodedText);
          },
          () => {}
        );
      } catch (err) {
        setIsWebScanning(false);
        showToast('Camera permission denied.', 'error');
      }
    }, 100);
  };

  const stopWebScan = async () => {
    try {
      if (qrRef.current?.isScanning) {
        await qrRef.current.stop();
        qrRef.current.clear();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWebScanning(false);
    }
  };

  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) return startWebScan();
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') return showToast('Camera permission denied', 'error');
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) processScannedUrl(barcodes[0].displayValue);
    } catch (error) {
      showToast('Error launching native scanner', 'error');
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, delSessionId: string) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this session?')) return;
    setRecentSessions((prev) => prev.filter((s) => s.id !== delSessionId));
    await supabase.from('sessions').delete().eq('id', delSessionId);
    showToast('Session deleted', 'success');
  };

  const handleRenameSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!editSessionName.trim()) return setEditingSessionId(null);

    // Optimistic UI Update
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

  // Theming Helpers
  const getSessionTitle = (session: any) =>
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

  if (isWebScanning) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <button
          onClick={stopWebScan}
          className="absolute top-12 right-6 z-50 p-3 bg-white/20 rounded-full text-white backdrop-blur-md transition-colors active:bg-white/40"
        >
          <X size={24} />
        </button>
        <h2 className="text-white text-xl font-bold mb-8 text-center">Scan Room QR</h2>
        <div
          id="qr-reader"
          className="w-full max-w-sm rounded-3xl overflow-hidden border-2 border-primary bg-black shadow-[0_0_40px_rgba(99,91,255,0.3)]"
        ></div>
        <p className="text-white/60 mt-8 text-sm font-medium text-center">
          Align the QR code within the frame.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col flex-1 relative bg-page">
      {/* GLOBAL TEXTURE */}
      <div className="absolute inset-0 bg-grid-pattern z-0"></div>

      <div className="w-full flex flex-col px-4 py-6 md:px-8 relative z-10">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-main tracking-tight">
              {user?.user_metadata?.full_name
                ? `Hi, ${user.user_metadata.full_name.split(' ')[0]} 👋`
                : 'Dashboard'}
            </h2>
            <p className="text-muted text-sm mt-1 font-medium">Ready to settle up?</p>
          </div>
        </div>

        {user?.is_anonymous ? (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 mb-6 flex flex-col gap-1 backdrop-blur-sm">
            <h4 className="text-warning-700 font-bold text-sm">Guest Mode Active</h4>
            <p className="text-warning-700/80 text-xs font-medium leading-relaxed">
              Sign in from the profile menu to permanently save your session history and ledger.
            </p>
          </div>
        ) : (
          <button
            onClick={onViewLedger}
            className="w-full text-left premium-gradient-card text-white rounded-3xl p-6 mb-6 flex flex-col gap-5 transition-transform active:scale-[0.98]"
          >
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1.5 drop-shadow-sm">
                  Total Owed to You
                </span>
                <span className="text-4xl font-extrabold tracking-tight drop-shadow-md">
                  {utils.formatMoney(owedToMe)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-white text-sm font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full backdrop-blur-md transition-colors shadow-sm">
                Ledger <ChevronRight size={16} />
              </div>
            </div>
            <div className="h-px w-full bg-white/20"></div>
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-sm font-medium drop-shadow-sm">
                You Owe Others
              </span>
              <span className="font-bold tracking-wide drop-shadow-sm">
                {utils.formatMoney(iOwe)}
              </span>
            </div>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => onOpenLobby('create')}
            className="bg-surface/80 backdrop-blur-md active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 shadow-sm transition-all h-28"
          >
            <div className="bg-primary/10 p-2.5 rounded-full text-primary">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[0.95rem]">New Session</span>
          </button>
          <button
            onClick={startScan}
            className="bg-surface/80 backdrop-blur-md active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 shadow-sm transition-all h-28"
          >
            <div className="bg-primary/10 p-2.5 rounded-full text-primary">
              <QrCode size={24} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[0.95rem]">Scan Room</span>
          </button>
        </div>

        <button
          onClick={() => onOpenLobby('join')}
          className="w-full h-12 bg-surface/80 backdrop-blur-md active:bg-subtle text-main border border-border rounded-xl flex items-center justify-center gap-2 font-semibold transition-all mb-8 shadow-sm hover:border-primary/30"
        >
          <KeyRound size={18} className="text-muted" /> Join with ID & PIN
        </button>

        <div className="flex flex-col flex-1 pb-10">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Clock size={16} className="text-muted" />
            <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
              Recent Activity
            </h3>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-primary opacity-50" size={24} />
            </div>
          ) : recentSessions.length > 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              className="flex flex-col gap-3"
            >
              <AnimatePresence>
                {recentSessions.map((session) => {
                  const title = getSessionTitle(session);
                  const isEditing = editingSessionId === session.id;

                  return (
                    <motion.div
                      key={session.id}
                      variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-surface/90 backdrop-blur-xl border border-border hover:border-primary/40 rounded-2xl p-4 flex items-center justify-between text-left transition-all shadow-sm group"
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
                                  e.key === 'Enter' && handleRenameSession(e as any, session.id)
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
                                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-primary transition-opacity"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                          <span className="text-[0.75rem] text-muted font-medium mt-0.5">
                            {new Date(session.created_at).toLocaleDateString()} • ID:{' '}
                            {session.id.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-2">
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors active:scale-90"
                        >
                          <Trash2 size={18} />
                        </button>
                        <ChevronRight size={20} className="text-muted/40" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 bg-surface/50 border border-dashed border-border rounded-2xl text-center">
              <div className="w-16 h-16 bg-page rounded-full flex items-center justify-center mb-4">
                <Plus size={32} className="text-muted/50" />
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
