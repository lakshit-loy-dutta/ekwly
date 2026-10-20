import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, KeyRound, Hash, ArrowRight, QrCode } from 'lucide-react';
import { showToast, utils } from '../lib/utils';
import QrScannerModal from './ui/QrScannerModal';

interface Props {
  initialMode?: 'create' | 'join';
  onClose: () => void;
  onLaunch?: (name: string, pin: string) => void;
  onJoin: (id: string, pin: string) => void;
}

export default function Lobby({ onClose, onJoin }: Props) {
  const [joinId, setJoinId] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [isScanningQr, setIsScanningQr] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim() || !joinPin.trim())
      return showToast('Enter Room ID and 4-digit PIN', 'error');
    utils.haptic('medium');
    onJoin(joinId.trim().toLowerCase(), joinPin.trim());
  };

  const handleScannedRoomUrl = (scannedUrl: string) => {
    let sessionId: string | null = null;
    let pin: string | null = null;
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
      onJoin(sessionId, pin);
    } else {
      showToast('Invalid Room QR Code.', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="w-full flex flex-col flex-1 relative bg-page min-h-dvh z-50"
    >
      <QrScannerModal
        isOpen={isScanningQr}
        title="Scan Room QR"
        onClose={() => setIsScanningQr(false)}
        onScanSuccess={handleScannedRoomUrl}
      />

      <div className="absolute inset-0 bg-grid-pattern z-0" />

      {/* HEADER */}
      <div className="w-full h-16 flex items-center justify-between px-4 relative z-10 border-b border-border bg-surface/85 backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-full text-primary hover:bg-subtle transition-colors"
          aria-label="Back to Home"
        >
          <ChevronLeft size={26} />
        </button>
        <span className="font-bold text-main text-base tracking-tight">Join Live Room</span>
        <div className="w-8" />
      </div>

      <div className="flex flex-col flex-1 px-6 pt-8 pb-10 relative z-10 max-w-md mx-auto w-full">
        <form onSubmit={handleJoin} className="flex flex-col flex-1">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4 shadow-2xs">
              <Hash size={24} />
            </div>
            <h1 className="text-3xl font-extrabold text-main tracking-tight mb-1.5">
              Enter Room Details
            </h1>
            <p className="text-muted text-sm font-medium">
              Ask the table host for the Room ID and 4-digit PIN, or scan their Invite QR code.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              utils.haptic('light');
              setIsScanningQr(true);
            }}
            className="w-full h-12 mb-6 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode size={16} /> Scan Host&apos;s QR Code Instead
          </button>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                Room ID
              </label>
              <input
                type="text"
                autoFocus
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="e.g. kz2x9a"
                className="w-full h-13 bg-surface border border-border rounded-2xl px-4 text-base font-mono font-bold text-main lowercase shadow-2xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                4-Digit Room PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                  <KeyRound size={18} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value)}
                  placeholder="0000"
                  className="w-full h-13 bg-surface border border-border rounded-2xl pl-11 pr-4 text-xl font-mono font-bold tracking-[0.2em] text-main tabular-nums shadow-2xs"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-8 h-13 w-full premium-gradient-card text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
          >
            Enter Room <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
