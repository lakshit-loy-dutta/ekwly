import { useState, useEffect, useRef, useMemo } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { showToast, utils } from '../lib/utils';
import type { GlobalLedgerRow, NettedBalanceRow } from '../lib/types';
import { splitwiseCsv, type SplitwiseParseResult } from '../lib/splitwiseCsv';
import { exportPersonalNudgeImage } from '../lib/bentoReceipt';
import BottomSheet from './ui/BottomSheet';
import ConfirmSheet from './ui/ConfirmSheet';
import BrandLoader from './ui/BrandLoader';
import AnimatedNumber from './ui/AnimatedNumber';
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
  Smartphone,
  QrCode,
  ArrowLeftRight,
  Image as ImageIcon,
} from 'lucide-react';

interface CachedLedgerData {
  rawOwedToMe: GlobalLedgerRow[];
  rawIOwe: GlobalLedgerRow[];
  creditorUpiMap: Record<string, string>;
  myUpiId: string | null;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
}

export default function Ledger({ user }: Props) {
  const cacheKey = `ledger_${user?.id || 'guest'}`;
  const cached = swrCache.get<CachedLedgerData>(cacheKey);

  const [rawOwedToMe, setRawOwedToMe] = useState<GlobalLedgerRow[]>(cached?.rawOwedToMe || []);
  const [rawIOwe, setRawIOwe] = useState<GlobalLedgerRow[]>(cached?.rawIOwe || []);
  const [creditorUpiMap, setCreditorUpiMap] = useState<Record<string, string>>(
    cached?.creditorUpiMap || {}
  );
  const [myUpiId, setMyUpiId] = useState<string | null>(cached?.myUpiId || null);
  const [isLoading, setIsLoading] = useState(!cached);

  const [pendingSettle, setPendingSettle] = useState<NettedBalanceRow | null>(null);
  const [activeQrRow, setActiveQrRow] = useState<NettedBalanceRow | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nudgeQrRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [parsedCsv, setParsedCsv] = useState<SplitwiseParseResult | null>(null);
  const [selectedSelfName, setSelectedSelfName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  const settleBothDirectionsInDB = async (row: NettedBalanceRow, currentUserId: string) => {
    const tasks: PromiseLike<any>[] = [];

    let qCreditor = supabase
      .from('ledger')
      .update({ settled: true })
      .eq('settled', false)
      .eq('creditor_id', currentUserId);

    if (row.counterpartyId) {
      qCreditor = qCreditor.eq('debtor_id', row.counterpartyId);
    } else {
      qCreditor = qCreditor
        .is('debtor_id', null)
        .ilike('debtor_fallback_name', row.counterpartyName);
    }
    tasks.push(qCreditor);

    let qDebtor = supabase
      .from('ledger')
      .update({ settled: true })
      .eq('settled', false)
      .eq('debtor_id', currentUserId);

    if (row.counterpartyId) {
      qDebtor = qDebtor.eq('creditor_id', row.counterpartyId);
    } else {
      qDebtor = qDebtor
        .is('creditor_id', null)
        .ilike('creditor_fallback_name', row.counterpartyName);
    }
    tasks.push(qDebtor);

    await Promise.all(tasks);
  };

  const fetchLedger = async () => {
    if (!user || user.is_anonymous) {
      setIsLoading(false);
      return;
    }

    const [creditorRes, debtorRes, myProfileRes] = await Promise.all([
      supabase.from('global_ledger').select('*').eq('creditor_id', user.id),
      supabase.from('global_ledger').select('*').eq('debtor_id', user.id),
      supabase.from('profiles').select('upi_id').eq('id', user.id).maybeSingle(),
    ]);

    const owedRows = (creditorRes.data || []) as GlobalLedgerRow[];
    const oweRows = (debtorRes.data || []) as GlobalLedgerRow[];
    const resolvedMyUpi = myProfileRes.data?.upi_id || null;

    setRawOwedToMe(owedRows);
    setRawIOwe(oweRows);
    setMyUpiId(resolvedMyUpi);

    const creditorIds = Array.from(
      new Set(oweRows.map((r) => r.creditor_id).filter((id): id is string => Boolean(id)))
    );
    const upiMap: Record<string, string> = {};
    if (creditorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, upi_id')
        .in('id', creditorIds);
      profiles?.forEach((p) => {
        if (p.upi_id) upiMap[p.id] = p.upi_id;
      });
      setCreditorUpiMap(upiMap);
    }

    swrCache.set<CachedLedgerData>(cacheKey, {
      rawOwedToMe: owedRows,
      rawIOwe: oweRows,
      creditorUpiMap: upiMap,
      myUpiId: resolvedMyUpi,
    });

    setIsLoading(false);
  };

  useEffect(() => {
    fetchLedger();
  }, [user, cacheKey]);

  const netted = useMemo(
    () => utils.netBilateralBalances(rawOwedToMe, rawIOwe),
    [rawOwedToMe, rawIOwe]
  );

  // Automatically settle mutually offset ₹0.00 bilateral balances
  useEffect(() => {
    if (!user || netted.zeroedCounterparties.length === 0) return;
    const clearZeroed = async () => {
      for (const zeroRow of netted.zeroedCounterparties) {
        await settleBothDirectionsInDB(zeroRow, user.id);
      }
      swrCache.invalidate('home_');
      showToast('Equal opposing balances were automatically netted & settled!', 'success');
      fetchLedger();
    };
    clearZeroed();
  }, [netted.zeroedCounterparties, user]);

  const executeSettleUp = async () => {
    if (!pendingSettle || !user) return;
    try {
      await settleBothDirectionsInDB(pendingSettle, user.id);
      swrCache.invalidate('home_');
      swrCache.invalidate('analytics_');
      showToast(`Settled up with ${pendingSettle.counterpartyName}!`, 'success');
      setPendingSettle(null);
      fetchLedger();
    } catch {
      showToast('Failed to settle debt.', 'error');
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

      swrCache.invalidate('home_');
      showToast(`Imported ${debts.length} balances from Splitwise!`, 'success');
      setParsedCsv(null);
      fetchLedger();
    } catch (err: any) {
      showToast(err.message || 'Failed to import balances.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return <BrandLoader label="Syncing Ledger..." fullScreen />;
  }

  const previewDebts =
    parsedCsv && selectedSelfName
      ? splitwiseCsv.extractUserDebts(parsedCsv.netBalances, selectedSelfName)
      : [];

  const qrPayeeUpi =
    activeQrRow?.direction === 'owed_to_me'
      ? myUpiId
      : activeQrRow?.counterpartyId
        ? creditorUpiMap[activeQrRow.counterpartyId]
        : null;

  const qrPayeeName =
    activeQrRow?.direction === 'owed_to_me'
      ? activeQrRow.selfName
      : activeQrRow?.counterpartyName || 'Creditor';

  const qrUri =
    activeQrRow && qrPayeeUpi
      ? utils.buildUpiUrl({
          upiId: qrPayeeUpi,
          payeeName: qrPayeeName,
          amount: activeQrRow.netAmount,
          note: 'Ekwly Net Settlement',
        })
      : '';

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-28">
      {/* Hidden Pre-Rendered UPI QR SVGs for 1-on-1 Skeuomorphic Nudge Cards */}
      <div className="hidden" aria-hidden="true">
        {myUpiId &&
          netted.netOwedToMe.map((entry) => {
            const exactUri = utils.buildUpiUrl({
              upiId: myUpiId,
              payeeName: entry.selfName || user?.user_metadata?.full_name || 'Host',
              amount: entry.netAmount,
              note: 'Ekwly Net Settlement',
            });
            return (
              <div
                key={entry.counterpartyKey}
                ref={(el) => {
                  nudgeQrRefs.current[entry.counterpartyKey] = el;
                }}
              >
                <QRCode value={exactUri} size={200} />
              </div>
            );
          })}
      </div>

      <ConfirmSheet
        isOpen={!!pendingSettle}
        onClose={() => setPendingSettle(null)}
        onConfirm={executeSettleUp}
        title="Settle Net Balance?"
        description={
          pendingSettle
            ? `Mark your consolidated balance of ${utils.formatMoney(pendingSettle.netAmount)} with ${pendingSettle.counterpartyName} as settled?`
            : ''
        }
        confirmLabel="Mark Settled"
        variant="success"
      />

      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <Wallet size={28} />
        </div>
        <h2 className="text-2xl font-bold text-main tracking-tight">Global Ledger</h2>
        <p className="text-muted text-sm font-medium">
          Bilaterally netted balances across all sessions
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 glass-card rounded-2xl p-4 flex flex-col items-center text-center">
          <ArrowDownLeft size={20} className="text-success mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            Net Owed to You
          </span>
          <span className="text-lg font-extrabold text-main tabular-nums">
            <AnimatedNumber value={netted.totalOwedToMe} />
          </span>
        </div>
        <div className="flex-1 glass-card rounded-2xl p-4 flex flex-col items-center text-center">
          <ArrowUpRight size={20} className="text-danger mb-1" />
          <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest mb-0.5">
            Net You Owe
          </span>
          <span className="text-lg font-extrabold text-main tabular-nums">
            <AnimatedNumber value={netted.totalIOwe} />
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
        className="w-full h-11 mb-6 glass-card hover:bg-subtle active:scale-[0.99] text-main rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
      >
        <Upload size={15} className="text-primary" /> Import Splitwise CSV
      </button>

      {/* OWED TO YOU SECTION */}
      <div className="px-1 py-3 mt-1">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Owed To You ({netted.netOwedToMe.length})
        </h3>
      </div>
      <div className="glass-card rounded-2xl divide-y divide-border overflow-hidden flex flex-col mb-6">
        {netted.netOwedToMe.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted font-medium">
            No pending incoming payments.
          </div>
        ) : (
          netted.netOwedToMe.map((entry) => {
            const whatsappUrl = utils.buildWhatsAppReminderUrl({
              debtorName: entry.counterpartyName,
              creditorName: entry.selfName || 'me',
              amount: entry.netAmount,
              upiId: myUpiId,
              isReminder: true,
            });

            return (
              <div
                key={entry.counterpartyKey}
                className="flex flex-col p-4 hover:bg-subtle/40 transition-colors gap-3"
              >
                {/* Row 1: Full Counterparty Name + Clear Net Amount */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0 border border-primary/20">
                      <User size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-main text-base truncate">
                        {entry.counterpartyName}
                      </span>
                      {entry.hasOpposing ? (
                        <span className="text-[0.65rem] font-bold text-muted inline-flex items-center gap-1 tabular-nums">
                          <ArrowLeftRight size={10} className="text-primary" /> Net of +
                          {utils.formatMoney(entry.grossOwedToMe)} / -
                          {utils.formatMoney(entry.grossIOwe)}
                        </span>
                      ) : (
                        <span className="text-[0.7rem] text-muted font-medium">Owes you</span>
                      )}
                    </div>
                  </div>

                  <span className="text-base font-extrabold text-success tabular-nums shrink-0">
                    +{utils.formatMoney(entry.netAmount)}
                  </span>
                </div>

                {/* Row 2: Uncramped Action Pills (Show QR, WhatsApp Nudge, 1-on-1 Nudge Card, Settle) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                  {myUpiId && (
                    <button
                      type="button"
                      onClick={() => {
                        utils.haptic('light');
                        setActiveQrRow(entry);
                      }}
                      className="flex-1 min-w-22 h-9 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <QrCode size={14} /> Show QR
                    </button>
                  )}

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-22 h-9 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageCircle size={14} /> Nudge
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      utils.haptic('light');
                      const qrSvg =
                        nudgeQrRefs.current[entry.counterpartyKey]?.querySelector('svg') || null;
                      exportPersonalNudgeImage({
                        debtorName: entry.counterpartyName,
                        creditorName: entry.selfName || user?.user_metadata?.full_name || 'Me',
                        amount: entry.netAmount,
                        venueName: 'Consolidated Net Balance',
                        upiId: myUpiId,
                        qrSvgElement: qrSvg,
                        whatsappTextUrl: whatsappUrl,
                      });
                    }}
                    className="flex-1 min-w-26 h-9 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    title="Share personalized skeuomorphic receipt ticket with pre-filled QR"
                  >
                    <ImageIcon size={14} /> Nudge Card
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSettle(entry)}
                    className="flex-1 min-w-22 h-9 px-3.5 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={14} /> Settle
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* YOU OWE SECTION */}
      <div className="px-1 py-3 mt-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          You Owe Others ({netted.netIOwe.length})
        </h3>
      </div>
      <div className="glass-card rounded-2xl divide-y divide-border overflow-hidden flex flex-col">
        {netted.netIOwe.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted font-medium">
            You are completely debt-free.
          </div>
        ) : (
          netted.netIOwe.map((entry) => {
            const creditorUpi = entry.counterpartyId
              ? creditorUpiMap[entry.counterpartyId]
              : undefined;
            const upiLink = creditorUpi
              ? utils.buildUpiUrl({
                  upiId: creditorUpi,
                  payeeName: entry.counterpartyName,
                  amount: entry.netAmount,
                  note: 'Ekwly Net Settlement',
                })
              : null;

            return (
              <div
                key={entry.counterpartyKey}
                className="flex flex-col p-4 hover:bg-subtle/40 transition-colors gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center font-bold overflow-hidden shrink-0 border border-danger/20">
                      <User size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-main text-base truncate">
                        {entry.counterpartyName}
                      </span>
                      {entry.hasOpposing ? (
                        <span className="text-[0.65rem] font-bold text-muted inline-flex items-center gap-1 tabular-nums">
                          <ArrowLeftRight size={10} className="text-primary" /> Net of -
                          {utils.formatMoney(entry.grossIOwe)} / +
                          {utils.formatMoney(entry.grossOwedToMe)}
                        </span>
                      ) : (
                        <span className="text-[0.7rem] text-muted font-medium">You owe</span>
                      )}
                    </div>
                  </div>

                  <span className="text-base font-extrabold text-danger tabular-nums shrink-0">
                    -{utils.formatMoney(entry.netAmount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  {upiLink && (
                    <>
                      <a
                        href={upiLink}
                        onClick={() => utils.haptic('light')}
                        className="flex-1 h-9 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Smartphone size={14} /> Pay UPI
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          utils.haptic('light');
                          setActiveQrRow(entry);
                        }}
                        className="h-9 px-3 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        title="Scan Creditor UPI QR"
                      >
                        <QrCode size={14} /> QR
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingSettle(entry)}
                    className="flex-1 h-9 px-3.5 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={14} /> Mark Paid
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* UPI QR MODAL FOR GLOBAL LEDGER */}
      <BottomSheet
        isOpen={!!activeQrRow}
        onClose={() => setActiveQrRow(null)}
        title="Net Settlement UPI QR"
      >
        {activeQrRow && qrPayeeUpi && (
          <div className="flex flex-col items-center gap-4 pb-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                {activeQrRow.direction === 'owed_to_me'
                  ? `${activeQrRow.counterpartyName} pays you`
                  : `You pay ${activeQrRow.counterpartyName}`}
              </p>
              <p className="text-3xl font-extrabold text-primary tabular-nums mt-1">
                {utils.formatMoney(activeQrRow.netAmount)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-md border border-border">
              <QRCode value={qrUri} size={210} />
            </div>
            <p className="text-xs font-mono font-bold text-muted">{qrPayeeUpi}</p>
          </div>
        )}
      </BottomSheet>

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
