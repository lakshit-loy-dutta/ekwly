import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import BottomSheet from './ui/BottomSheet';
import {
  Plus,
  QrCode,
  Clock,
  ChevronRight,
  Receipt,
  Loader2,
  KeyRound,
  Trash2,
  X,
} from 'lucide-react';

interface Props {
  onStartNew: () => void;
  onJoinSession: (sessionId: string, pin: string) => void;
  user: any;
}

export default function Home({ onStartNew, onJoinSession, user }: Props) {
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [owedToMe, setOwedToMe] = useState(0);
  const [iOwe, setIOwe] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [manualSessionId, setManualSessionId] = useState('');
  const [manualPin, setManualPin] = useState('');

  // --- HYBRID SCANNER STATE ---
  const [isWebScanning, setIsWebScanning] = useState(false);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.is_anonymous) {
        setIsLoading(false);
        return;
      }

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionData) setRecentSessions(sessionData);

      const { data: creditorData } = await supabase
        .from('ledger')
        .select('amount')
        .eq('creditor_id', user.id)
        .eq('settled', false);

      const { data: debtorData } = await supabase
        .from('ledger')
        .select('amount')
        .eq('debtor_id', user.id)
        .eq('settled', false);

      const totalOwedToMe = creditorData?.reduce((sum, row) => sum + Number(row.amount), 0) || 0;
      const totalIOwe = debtorData?.reduce((sum, row) => sum + Number(row.amount), 0) || 0;

      setOwedToMe(totalOwedToMe);
      setIOwe(totalIOwe);
      setIsLoading(false);
    };

    fetchDashboardData();

    // Cleanup web scanner if component unmounts unexpectedly
    return () => {
      if (qrRef.current?.isScanning) {
        qrRef.current.stop().catch(console.error);
      }
    };
  }, [user]);

  // --- CORE URL PROCESSOR ---
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

    if (sessionId && pin) {
      onJoinSession(sessionId, pin);
    } else {
      showToast('Invalid QR Code. Missing PIN.', 'error');
    }
  };

  // --- WEB SCANNER LOGIC ---
  const startWebScan = () => {
    setIsWebScanning(true);
    // Timeout gives React a millisecond to render the #qr-reader div before attaching the camera
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
          (error) => {
            /* Ignore standard tracking frame errors */
          }
        );
      } catch (err) {
        console.error(err);
        setIsWebScanning(false);
        showToast('Camera permission denied or unavailable.', 'error');
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
      console.error('Error stopping web scanner', err);
    } finally {
      setIsWebScanning(false);
    }
  };

  // --- HYBRID ROUTER ---
  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      startWebScan();
      return;
    }

    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') return showToast('Camera permission denied', 'error');

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        processScannedUrl(barcodes[0].displayValue);
      }
    } catch (error) {
      console.error(error);
      showToast('Error launching native scanner', 'error');
    }
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSessionId.trim() || !manualPin.trim()) return showToast('Enter ID and PIN', 'error');
    onJoinSession(manualSessionId.trim().toLowerCase(), manualPin.trim());
  };

  const handleDeleteSession = async (e: React.MouseEvent, delSessionId: string) => {
    e.stopPropagation();
    if (!window.confirm('Permanently delete this session?')) return;

    setRecentSessions((prev) => prev.filter((s) => s.id !== delSessionId));

    await supabase.from('sessions').delete().eq('id', delSessionId);
    showToast('Session deleted', 'success');
  };

  // --- WEB CAMERA FULLSCREEN OVERLAY ---
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
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-main tracking-tight">
          {user?.user_metadata?.full_name
            ? `Welcome, ${user.user_metadata.full_name.split(' ')[0]}`
            : 'Dashboard'}
        </h2>
        <p className="text-muted text-sm mt-1">Manage your splits and settle debts.</p>
      </div>

      {user?.is_anonymous ? (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6 flex flex-col gap-1">
          <h4 className="text-warning-700 font-bold text-sm">Guest Mode Active</h4>
          <p className="text-warning-700/80 text-xs font-medium">
            Sign in from the profile menu to permanently save your session history and ledger.
          </p>
        </div>
      ) : (
        <div className="bg-primary text-white rounded-2xl p-5 mb-6 shadow-stripe flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-primary-light/80 text-xs font-bold uppercase tracking-wider mb-1">
                Total Owed to You
              </span>
              <span className="text-3xl font-bold tracking-tight">
                {utils.formatMoney(owedToMe)}
              </span>
            </div>
          </div>
          <div className="h-px w-full bg-white/20"></div>
          <div className="flex justify-between items-center">
            <span className="text-primary-light/80 text-sm font-medium">You Owe Others</span>
            <span className="font-semibold">{utils.formatMoney(iOwe)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          onClick={onStartNew}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-24"
        >
          <Plus size={24} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">New Session</span>
        </button>

        <button
          onClick={startScan}
          className="bg-surface active:bg-subtle text-main border border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-24"
        >
          <QrCode size={24} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">Scan QR</span>
        </button>
      </div>

      <button
        onClick={() => setIsJoinModalOpen(true)}
        className="w-full h-12 bg-surface active:bg-subtle text-main border border-border rounded-xl flex items-center justify-center gap-2 font-medium transition-colors mb-8 shadow-sm"
      >
        <KeyRound size={18} className="text-muted" /> Join with ID & PIN
      </button>

      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-muted" />
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
            Your Hosted Sessions
          </h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary opacity-50" size={24} />
          </div>
        ) : recentSessions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                onClick={() =>
                  onJoinSession(
                    session.id,
                    session.pin || localStorage.getItem(`ekwly_pin_${session.id}`) || ''
                  )
                }
                className="bg-surface border border-border hover:border-primary/50 active:bg-subtle rounded-xl p-4 flex items-center justify-between text-left transition-all shadow-sm shrink-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0">
                    <Receipt size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-main text-[0.95rem] truncate">
                      Session {session.id.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted font-medium mt-0.5">
                      {new Date(session.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </div>
                  <ChevronRight size={20} className="text-muted opacity-50" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-surface border border-dashed border-border rounded-xl">
            <Receipt size={32} className="text-muted opacity-30 mb-3" />
            <p className="text-sm font-medium text-muted">No sessions yet.</p>
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Session"
      >
        <form onSubmit={handleManualJoin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Session ID
            </label>
            <input
              type="text"
              value={manualSessionId}
              onChange={(e) => setManualSessionId(e.target.value)}
              placeholder="e.g. kz2x9a"
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              4-Digit PIN
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={manualPin}
              onChange={(e) => setManualPin(e.target.value)}
              placeholder="e.g. 4821"
              className="w-full h-12 bg-page border border-border rounded-xl px-4 font-mono font-bold tracking-widest text-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>
          <button
            type="submit"
            className="h-14 mt-4 w-full bg-primary active:bg-primary-hover text-white rounded-xl font-bold shadow-sm transition-colors"
          >
            Enter Room
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}
