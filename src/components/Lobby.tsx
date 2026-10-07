import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Sparkles, KeyRound, Hash, ArrowRight } from 'lucide-react';
import { showToast } from '../lib/utils';

interface Props {
  initialMode: 'create' | 'join';
  onClose: () => void;
  onLaunch: (name: string, pin: string) => void;
  onJoin: (id: string, pin: string) => void;
}

export default function Lobby({ initialMode, onClose, onLaunch, onJoin }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>(initialMode);

  // Create State
  const [sessionName, setSessionName] = useState('');
  const [createPin, setCreatePin] = useState('');

  // Join State
  const [joinId, setJoinId] = useState('');
  const [joinPin, setJoinPin] = useState('');

  useEffect(() => {
    // Auto-generate a random 4-digit PIN for new rooms
    if (mode === 'create' && !createPin) {
      setCreatePin(Math.floor(1000 + Math.random() * 9000).toString());
    }
  }, [mode]);

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPin || createPin.length < 4) return showToast('PIN must be 4 digits', 'error');
    onLaunch(sessionName.trim(), createPin);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim() || !joinPin.trim()) return showToast('Enter ID and PIN', 'error');
    onJoin(joinId.trim().toLowerCase(), joinPin.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full flex flex-col flex-1 relative bg-page min-h-dvh z-50"
    >
      {/* GLOBAL TEXTURE */}
      <div className="absolute inset-0 bg-grid-pattern z-0"></div>

      {/* CUSTOM HEADER */}
      <div className="w-full h-16 flex items-center justify-between px-4 relative z-10">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full text-muted hover:bg-subtle hover:text-main transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="flex bg-surface border border-border rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'create' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
          >
            Host
          </button>
          <button
            onClick={() => setMode('join')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'join' ? 'bg-main text-surface shadow-sm' : 'text-muted hover:text-main'}`}
          >
            Join
          </button>
        </div>
        <div className="w-8"></div> {/* Spacer for centering */}
      </div>

      <div className="flex flex-col flex-1 px-6 pt-8 pb-12 relative z-10 max-w-md mx-auto w-full">
        {mode === 'create' ? (
          <motion.form
            key="create"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleLaunch}
            className="flex flex-col flex-1"
          >
            <div className="mb-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 border border-primary/20">
                <Sparkles size={28} />
              </div>
              <h1 className="text-4xl font-extrabold text-main tracking-tight mb-2">New Room</h1>
              <p className="text-muted font-medium">Create a workspace to split your bill.</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                  Room Name (Optional)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Friday Beers"
                  className="w-full h-14 bg-surface/80 backdrop-blur-md border border-border rounded-2xl px-4 text-lg font-bold text-main focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all placeholder:font-medium placeholder:text-muted/50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                  Access PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={createPin}
                    onChange={(e) => setCreatePin(e.target.value)}
                    className="w-full h-14 bg-surface/80 backdrop-blur-md border border-border rounded-2xl pl-12 pr-4 text-xl font-mono font-bold tracking-[0.2em] text-main focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                    required
                  />
                </div>
                <p className="text-[0.75rem] text-muted pl-1 font-medium mt-1">
                  Friends will need this PIN to join the room.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="mt-auto h-14 w-full premium-gradient-card text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Launch Workspace <ArrowRight size={20} />
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="join"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleJoin}
            className="flex flex-col flex-1"
          >
            <div className="mb-10">
              <div className="w-14 h-14 rounded-2xl bg-surface border border-border text-main flex items-center justify-center mb-5 shadow-sm">
                <Hash size={28} />
              </div>
              <h1 className="text-4xl font-extrabold text-main tracking-tight mb-2">Join Room</h1>
              <p className="text-muted font-medium">Enter the details provided by the host.</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                  Room ID
                </label>
                <input
                  type="text"
                  autoFocus
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="e.g. kz2x9a"
                  className="w-full h-14 bg-surface/80 backdrop-blur-md border border-border rounded-2xl px-4 text-lg font-bold text-main focus:ring-2 focus:ring-main/10 focus:border-main shadow-sm transition-all lowercase"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">
                  4-Digit PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted">
                    <KeyRound size={20} />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value)}
                    placeholder="0000"
                    className="w-full h-14 bg-surface/80 backdrop-blur-md border border-border rounded-2xl pl-12 pr-4 text-xl font-mono font-bold tracking-[0.2em] text-main focus:ring-2 focus:ring-main/10 focus:border-main shadow-sm transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-auto h-14 w-full bg-main active:bg-main/90 text-surface rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md"
            >
              Enter Room <ArrowRight size={20} />
            </button>
          </motion.form>
        )}
      </div>
    </motion.div>
  );
}
