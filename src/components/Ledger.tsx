import { useState, useEffect, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast, utils } from '../lib/utils';
import { splitwiseCsv, type SplitwiseParseResult } from '../lib/splitwiseCsv';
import BottomSheet from './ui/BottomSheet';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  User,
  Loader2,
  MessageCircle,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';

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

export default function Ledger({ user }: Props) {
  const [owedToMe, setOwedToMe] = useState<LedgerEntry[]>([]);
  const [iOwe, setIOwe] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Splitwise CSV Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedCsv, setParsedCsv] = useState<SplitwiseParseResult | null>(null);
  const [selectedSelfName, setSelectedSelfName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  const fetchLedger = async () => {
    if (!user || user.is_anonymous) {
      setIsLoading(false);
      return;
    }

    const [creditorRes, debtorRes] = await Promise.all([
      supabase.from('global_ledger').select('*').eq('creditor_id', user.id),
      supabase.from('global_ledger').select('*').eq('debtor_id', user.id),
    ]);

    if (creditorRes.data) setOwedToMe(creditorRes.data);
    if (debtorRes.data) setIOwe(debtorRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLedger();
  }, [user]);

  const handleSettleUp = async (entry: LedgerEntry, amICreditor: boolean) => {
    const otherName = amICreditor ? entry.debtor_name : entry.creditor_name;
    if (!window.confirm(`Mark all pending debts with ${otherName} as settled?`)) return;

    let query = supabase.from('ledger').update({ settled: true }).eq('settled', false);

    if (amICreditor) {
      query = query.eq('creditor_id', user!.id);
      if (entry.debtor_id) query = query.eq('debtor_id', entry.debtor_id);
      else query = query.is('debtor_id', null).eq('debtor_fallback_name', entry.debtor_name);
    } else {
      query = query.eq('debtor_id', user!.id);
      if (entry.creditor_id) query = query.eq('creditor_id', entry.creditor_id);
      else query = query.is('creditor_id', null).eq('creditor_fallback_name', entry.creditor_name);
    }

    const { error } = await query;

    if (error) {
      showToast('Failed to settle debt.', 'error');
    } else {
      showToast(`Settled up with ${otherName}!`, 'success');
      fetchLedger();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = splitwiseCsv.parse(text);
      setParsedCsv(result);

      const userFirst = (user?.user_metadata?.full_name || '').split(' ')[0].toLowerCase();
      const autoMatch =
        result.people.find((p) => userFirst && p.toLowerCase().includes(userFirst)) ||
        result.people[0];
      setSelectedSelfName(autoMatch);
    } catch (err: any) {
      showToast(err.message || 'Could not parse Splitwise CSV.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!user || !parsedCsv || !selectedSelfName) return;
    const debts = splitwiseCsv.extractUserDebts(parsedCsv.netBalances, selectedSelfName);

    if (debts.length === 0) {
      showToast('No outstanding balances found for your name in this CSV.', 'default');
      setParsedCsv(null);
      return;
    }

    setIsImporting(true);
    try {
      const migrationSessionId =
        'sw-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const myDisplayName = user.user_metadata?.full_name || selectedSelfName;

      const { error: sessionErr } = await supabase.from('sessions').insert({
        id: migrationSessionId,
        name: 'Splitwise Import',
        venue_name: 'Splitwise CSV Migration',
        status: 'locked',
        pin: '0000',
        host_id: user.id,
      });
      if (sessionErr) throw sessionErr;

      const ledgerPayload = debts.map((d) =>
        d.direction === 'owed_to_me'
          ? {
              session_id: migrationSessionId,
              creditor_id: user.id,
              creditor_fallback_name: myDisplayName,
              debtor_id: null,
              debtor_fallback_name: d.counterpartyName,
              amount: d.amount,
              settled: false,
            }
          : {
              session_id: migrationSessionId,
              creditor_id: null,
              creditor_fallback_name: d.counterpartyName,
              debtor_id: user.id,
              debtor_fallback_name: myDisplayName,
              amount: d.amount,
              settled: false,
            }
      );

      const { error: ledgerErr } = await supabase.from('ledger').insert(ledgerPayload);
      if (ledgerErr) throw ledgerErr;

      showToast(`Imported ${debts.length} balances from Splitwise!`, 'success');
      setParsedCsv(null);
      fetchLedger();
    } catch (err: any) {
      showToast(err.message || 'Failed to import balances.', 'error');
    } finally {
      setIsImporting(false);
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
  const previewDebts =
    parsedCsv && selectedSelfName
      ? splitwiseCsv.extractUserDebts(parsedCsv.netBalances, selectedSelfName)
      : [];

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-24">
      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <Wallet size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Global Ledger</h2>
        <p className="text-muted text-sm font-medium">Your master balance across all sessions</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <ArrowDownLeft size={20} className="text-success mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            Owed to You
          </span>
          <span className="text-lg font-bold text-main tabular-nums">
            {utils.formatMoney(totalOwedToMe)}
          </span>
        </div>
        <div className="flex-1 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <ArrowUpRight size={20} className="text-danger mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            You Owe
          </span>
          <span className="text-lg font-bold text-main tabular-nums">
            {utils.formatMoney(totalIOwe)}
          </span>
        </div>
      </div>

      {/* SPLITWISE CSV IMPORTER TRIGGER */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-11 mb-6 bg-surface hover:bg-subtle active:scale-[0.99] text-main border border-border rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
      >
        <Upload size={15} className="text-primary" /> Import Splitwise CSV
      </button>

      {/* OWED TO YOU SECTION */}
      <div className="px-1 py-3 mt-1">
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
              className="flex items-center justify-between p-4 bg-surface hover:bg-subtle transition-colors gap-2"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                  <User size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-main text-[0.95rem] truncate">
                    {entry.debtor_name}
                  </span>
                  <span className="text-[0.8rem] font-bold text-success tabular-nums mt-0.5">
                    +{utils.formatMoney(Number(entry.total_owed))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={utils.buildWhatsAppReminderUrl({
                    debtorName: entry.debtor_name,
                    creditorName: entry.creditor_name || 'me',
                    amount: Number(entry.total_owed),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/25 rounded-lg font-bold text-xs flex items-center gap-1 transition-all"
                  title="Send WhatsApp Reminder"
                >
                  <MessageCircle size={15} /> Nudge
                </a>
                <button
                  onClick={() => handleSettleUp(entry, true)}
                  className="h-9 px-4 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={16} /> Settle
                </button>
              </div>
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
                  <span className="text-[0.8rem] font-bold text-danger tabular-nums mt-0.5">
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

      {/* SPLITWISE IMPORT PREVIEW BOTTOM SHEET */}
      <BottomSheet
        isOpen={!!parsedCsv}
        onClose={() => setParsedCsv(null)}
        title="Import Splitwise CSV"
      >
        {parsedCsv && (
          <div className="flex flex-col gap-5 pb-4">
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 p-3.5 rounded-xl">
              <FileSpreadsheet size={20} className="text-primary shrink-0" />
              <p className="text-xs text-muted leading-relaxed">
                Select which column in the Splitwise export represents <strong>you</strong>. Ekwly
                will import your net balances directly into your Global Ledger.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">
                Which member are you?
              </label>
              <select
                value={selectedSelfName}
                onChange={(e) => setSelectedSelfName(e.target.value)}
                className="w-full h-11 bg-page border border-border rounded-xl px-3 font-semibold text-main"
              >
                {parsedCsv.people.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted">
                Detected Balances ({previewDebts.length})
              </span>
              {previewDebts.length === 0 ? (
                <div className="p-4 bg-page border border-border rounded-xl text-center text-xs text-muted">
                  You are completely settled up in this CSV!
                </div>
              ) : (
                <div className="bg-page border border-border rounded-xl divide-y divide-border max-h-48 overflow-y-auto">
                  {previewDebts.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-semibold text-main truncate pr-2">
                        {d.direction === 'owed_to_me'
                          ? `${d.counterpartyName} owes you`
                          : `You owe ${d.counterpartyName}`}
                      </span>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          d.direction === 'owed_to_me' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {d.direction === 'owed_to_me' ? '+' : '-'}
                        {utils.formatMoney(d.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isImporting || previewDebts.length === 0}
              onClick={handleConfirmImport}
              className="w-full h-12 bg-primary active:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Import {previewDebts.length} Balances
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
