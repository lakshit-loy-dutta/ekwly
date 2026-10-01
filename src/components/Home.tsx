import { useState, useEffect } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/utils';
import { Plus, QrCode, Clock, ChevronRight, Receipt, Loader2 } from 'lucide-react';

interface Props {
  onStartNew: () => void;
  onJoinSession: (sessionId: string) => void;
  user: any;
}

export default function Home({ onStartNew, onJoinSession, user }: Props) {
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || user.is_anonymous) {
        setIsLoading(false);
        return;
      }

      // Fetch sessions hosted by this user
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentSessions(data);
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, [user]);

  const startScan = async () => {
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') {
        showToast('Camera permission denied', 'error');
        return;
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const scannedUrl = barcodes[0].displayValue;
        let sessionId = null;
        try {
          const url = new URL(scannedUrl);
          sessionId = url.searchParams.get('s');
        } catch {
          sessionId = scannedUrl.includes('?s=')
            ? scannedUrl.split('?s=')[1]
            : scannedUrl.split('/').pop();
        }

        if (sessionId) {
          onJoinSession(sessionId);
        } else {
          showToast('Invalid Ekwly QR Code', 'error');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Error launching scanner', 'error');
    }
  };

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page">
      {/* Header Greeting */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-main tracking-tight">
          {user?.user_metadata?.full_name
            ? `Welcome, ${user.user_metadata.full_name.split(' ')[0]}`
            : 'Dashboard'}
        </h2>
        <p className="text-muted text-sm mt-1">Manage your splits and settle debts.</p>
      </div>

      {user?.is_anonymous && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6 flex flex-col gap-1">
          <h4 className="text-warning-700 font-bold text-sm">Guest Mode Active</h4>
          <p className="text-warning-700/80 text-xs font-medium">
            Sign in from the profile menu to permanently save your session history and ledger.
          </p>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={onStartNew}
          className="bg-primary active:bg-primary-hover text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-stripe transition-colors h-28"
        >
          <Plus size={28} strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">New Session</span>
        </button>

        <button
          onClick={startScan}
          className="bg-surface active:bg-subtle text-main border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm transition-colors h-28"
        >
          <QrCode size={28} className="text-primary" strokeWidth={2.5} />
          <span className="font-semibold text-[0.95rem]">Scan QR</span>
        </button>
      </div>

      {/* Recent Sessions */}
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
                onClick={() => onJoinSession(session.id)}
                className="bg-surface border border-border hover:border-primary/50 active:bg-subtle rounded-xl p-4 flex items-center justify-between text-left transition-all shadow-sm"
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
                <ChevronRight size={20} className="text-muted opacity-50" />
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
    </div>
  );
}
