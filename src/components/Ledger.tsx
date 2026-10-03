import { useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import { Wallet, ArrowDownLeft, ArrowUpRight, CheckCircle2, User, Loader2 } from 'lucide-react';

interface LedgerEntry {
  debtor_id: string | null;
  debtor_name: string;
  creditor_id: string | null;
  creditor_name: string;
  total_owed: number;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
}

export default function Ledger({ user, onBack }: Props) {
  const [owedToMe, setOwedToMe] = useState<LedgerEntry[]>([]);
  const [iOwe, setIOwe] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLedger = async () => {
    if (!user || user.is_anonymous) return;

    // Fetch Aggregated Debts from the SQL View
    const { data: creditorData } = await supabase
      .from('global_ledger')
      .select('*')
      .eq('creditor_id', user.id);

    const { data: debtorData } = await supabase
      .from('global_ledger')
      .select('*')
      .eq('debtor_id', user.id);

    if (creditorData) setOwedToMe(creditorData);
    if (debtorData) setIOwe(debtorData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLedger();
  }, [user]);

  const handleSettleUp = async (entry: LedgerEntry, amICreditor: boolean) => {
    const otherName = amICreditor ? entry.debtor_name : entry.creditor_name;
    if (!window.confirm(`Mark all pending debts with ${otherName} as settled?`)) return;

    // Build the query to update the raw ledger table where settled = false
    let query = supabase.from('ledger').update({ settled: true }).eq('settled', false);

    if (amICreditor) {
      query = query.eq('creditor_id', user!.id);
      if (entry.debtor_id) query = query.eq('debtor_id', entry.debtor_id);
      else query = query.is('debtor_id', null).eq('debtor_name', entry.debtor_name);
    } else {
      query = query.eq('debtor_id', user!.id);
      if (entry.creditor_id) query = query.eq('creditor_id', entry.creditor_id);
      else query = query.is('creditor_id', null).eq('creditor_name', entry.creditor_name);
    }

    const { error } = await query;

    if (error) {
      showToast('Failed to settle debt.', 'error');
    } else {
      showToast(`Settled up with ${otherName}!`, 'success');
      fetchLedger(); // Refresh the UI
    }
  };

  if (isLoading)
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-primary opacity-50" size={32} />
      </div>
    );

  const totalOwedToMe = owedToMe.reduce((sum, row) => sum + Number(row.total_owed), 0);
  const totalIOwe = iOwe.reduce((sum, row) => sum + Number(row.total_owed), 0);

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-24">
      <div className="flex flex-col items-center mb-8 mt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <Wallet size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Global Ledger</h2>
        <p className="text-muted text-sm font-medium">Your master balance across all sessions</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <ArrowDownLeft size={20} className="text-success mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            Owed to You
          </span>
          <span className="text-lg font-bold text-main">{utils.formatMoney(totalOwedToMe)}</span>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <ArrowUpRight size={20} className="text-danger mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            You Owe
          </span>
          <span className="text-lg font-bold text-main">{utils.formatMoney(totalIOwe)}</span>
        </div>
      </div>

      {/* OWED TO YOU SECTION */}
      <div className="px-1 py-3 mt-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Owed To You</h3>
      </div>
      <div className="bg-surface border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden flex flex-col mb-6">
        {owedToMe.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted font-medium">
            No pending incoming payments.
          </div>
        ) : (
          owedToMe.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 bg-surface hover:bg-subtle transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                  <User size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-main text-[0.95rem] truncate">
                    {entry.debtor_name}
                  </span>
                  <span className="text-[0.8rem] font-bold text-success mt-0.5">
                    +{utils.formatMoney(Number(entry.total_owed))}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleSettleUp(entry, true)}
                className="h-9 px-4 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={16} /> Settle
              </button>
            </div>
          ))
        )}
      </div>

      {/* YOU OWE SECTION */}
      <div className="px-1 py-3 mt-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">You Owe Others</h3>
      </div>
      <div className="bg-surface border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden flex flex-col">
        {iOwe.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted font-medium">
            You are completely debt-free.
          </div>
        ) : (
          iOwe.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 bg-surface hover:bg-subtle transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center font-bold overflow-hidden shrink-0 border border-danger/20">
                  <User size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-main text-[0.95rem] truncate">
                    {entry.creditor_name}
                  </span>
                  <span className="text-[0.8rem] font-bold text-danger mt-0.5">
                    -{utils.formatMoney(Number(entry.total_owed))}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleSettleUp(entry, false)}
                className="h-9 px-4 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={16} /> Mark Paid
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
