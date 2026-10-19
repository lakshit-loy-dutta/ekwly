import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import type { CalculationResult } from '../../lib/types';
import { utils, showToast } from '../../lib/utils';
import {
  DownloadCloud,
  LockKeyhole,
  Unlock,
  Home,
  Smartphone,
  MessageCircle,
  QrCode,
  CheckCircle2,
  Copy,
  CreditCard,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToggleSwitch from '../ui/ToggleSwitch';
import SectionHeader from '../ui/SectionHeader';
import BottomSheet from '../ui/BottomSheet';

interface Props {
  calculationResult: CalculationResult;
  receiptTitle: string;
  setReceiptTitle: (val: string) => void;
  sessionStatus: 'draft' | 'locked' | 'archived';
  ledger: any[];
  isHost: boolean;
  currentUserId: string | null;
  handleLockSession: () => void;
  handleToggleSettled: (id: string, current: boolean) => void;
  handleExportPDF: () => void;
  handleUnlockSession: () => void;
  handleGoHome: () => void;
  venueName: string;
}

export default function DebtMatrix(props: Props) {
  const [upiMap, setUpiMap] = useState<Record<string, string>>({});
  const [activeQrLedgerRow, setActiveQrLedgerRow] = useState<any | null>(null);
  const [inlineUpiInput, setInlineUpiInput] = useState('');
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  useEffect(() => {
    const fetchUpis = async () => {
      if (props.sessionStatus !== 'locked' || props.ledger.length === 0) return;

      const creditorIds = Array.from(
        new Set(props.ledger.map((l) => l.creditor_id).filter(Boolean))
      );
      if (creditorIds.length === 0) return;

      const { data } = await supabase.from('profiles').select('id, upi_id').in('id', creditorIds);
      const map: Record<string, string> = {};
      data?.forEach((p) => {
        if (p.upi_id) map[p.id] = p.upi_id;
      });
      setUpiMap(map);
    };

    fetchUpis();
  }, [props.sessionStatus, props.ledger]);

  const handleSaveInlineUpi = async (creditorId: string) => {
    const trimmed = inlineUpiInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return showToast('Enter a valid UPI ID (e.g. name@okaxis)', 'error');
    }
    setIsSavingUpi(true);
    try {
      if (creditorId === props.currentUserId) {
        await supabase
          .from('profiles')
          .update({ upi_id: trimmed, updated_at: new Date().toISOString() })
          .eq('id', creditorId);
      }
      setUpiMap((prev) => ({ ...prev, [creditorId]: trimmed }));
      setInlineUpiInput('');
      showToast('UPI ID linked for instant QR!', 'success');
    } catch {
      showToast('Could not save UPI ID.', 'error');
    } finally {
      setIsSavingUpi(false);
    }
  };

  // --- LOCKED STATE: COLLECTION TRAY ---
  if (props.sessionStatus === 'locked') {
    const totalExpected = props.ledger.reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCollected = props.ledger
      .filter((l) => l.settled)
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const progress = totalExpected === 0 ? 0 : (totalCollected / totalExpected) * 100;

    const qrCreditorKey = activeQrLedgerRow
      ? activeQrLedgerRow.creditor_id || `fallback:${activeQrLedgerRow.creditor_name}`
      : '';
    const activeQrUpi = qrCreditorKey ? upiMap[qrCreditorKey] : null;
    const activeQrUri =
      activeQrLedgerRow && activeQrUpi
        ? utils.buildUpiUrl({
            upiId: activeQrUpi,
            payeeName: activeQrLedgerRow.creditor_name,
            amount: Number(activeQrLedgerRow.amount),
            note: props.venueName ? `Ekwly: ${props.venueName}` : 'Ekwly Split',
          })
        : '';

    return (
      <div className="w-full flex flex-col pb-10">
        {/* COLLECTION TRAY HERO BENTO CARD */}
        <div className="mx-4 mt-3 premium-gradient-card rounded-3xl p-6 text-white flex flex-col items-center justify-center text-center shadow-sm">
          <h2 className="text-xl font-extrabold tracking-tight mb-1">Collection Tray</h2>
          <p className="text-white/80 text-xs font-medium mb-5">
            Room is locked • Scan UPI QR or tap to settle
          </p>
          <div className="text-3xl sm:text-4xl font-extrabold mb-3 tabular-nums tracking-tight">
            {utils.formatMoney(totalCollected)}{' '}
            <span className="text-lg text-white/65 font-bold">
              / {utils.formatMoney(totalExpected)}
            </span>
          </div>
          <div className="w-full max-w-xs bg-black/25 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-success h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <SectionHeader
          title="Settlements"
          helpText="Tap 'Show UPI QR' so friends at the table can scan your screen with GPay, PhonePe, or Paytm, or send a 1-tap WhatsApp payment link."
        />

        <div className="mx-4 bg-surface border border-border rounded-2xl divide-y divide-border/60 shadow-sm overflow-hidden">
          {props.ledger.length === 0 && (
            <div className="p-8 text-center text-sm text-muted font-medium">
              Everyone is settled! No pending payments.
            </div>
          )}

          {props.ledger.map((l) => {
            const creditorKey = l.creditor_id || `fallback:${l.creditor_name}`;
            const creditorUpi = upiMap[creditorKey] || null;
            const amICreditor = Boolean(l.creditor_id && l.creditor_id === props.currentUserId);
            const upiDeepLink = creditorUpi
              ? utils.buildUpiUrl({
                  upiId: creditorUpi,
                  payeeName: l.creditor_name,
                  amount: Number(l.amount),
                  note: props.venueName ? `Ekwly: ${props.venueName}` : 'Ekwly Split',
                })
              : null;

            return (
              <div key={l.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-main text-[0.95rem] truncate">
                      {l.debtor_name}{' '}
                      <span className="text-muted text-xs font-medium mx-1">owes</span>{' '}
                      {l.creditor_name}
                    </span>
                    <span className="text-primary text-base font-extrabold tabular-nums mt-0.5">
                      {utils.formatMoney(Number(l.amount))}
                    </span>
                  </div>

                  {props.isHost || amICreditor ? (
                    <label className="flex items-center gap-2.5 cursor-pointer shrink-0">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          l.settled ? 'text-success' : 'text-muted'
                        }`}
                      >
                        {l.settled ? 'Paid' : 'Unpaid'}
                      </span>
                      <ToggleSwitch
                        checked={l.settled}
                        onChange={() => props.handleToggleSettled(l.id, l.settled)}
                      />
                    </label>
                  ) : (
                    <div
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 ${
                        l.settled ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning-700'
                      }`}
                    >
                      {l.settled ? 'Paid' : 'Unpaid'}
                    </div>
                  )}
                </div>

                {/* ACTION BAR FOR UNSETTLED DEBTS */}
                {!l.settled && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* 1. NATIVE UPI DEEP LINK (For Debtors on Mobile) */}
                    {upiDeepLink && !amICreditor && (
                      <a
                        href={upiDeepLink}
                        onClick={() => utils.haptic('light')}
                        className="flex-1 min-w-36 h-10 px-3 bg-primary text-white hover:bg-primary-hover active:scale-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Smartphone size={15} /> Pay via UPI App
                      </a>
                    )}

                    {/* 2. HOST / TABLE DYNAMIC UPI QR MODAL BUTTON */}
                    {(creditorUpi || props.isHost || amICreditor) && (
                      <button
                        type="button"
                        onClick={() => {
                          utils.haptic('light');
                          setActiveQrLedgerRow(l);
                        }}
                        className="flex-1 min-w-32 h-10 px-3 bg-primary/10 hover:bg-primary/20 active:scale-95 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <QrCode size={15} /> Show UPI QR
                      </button>
                    )}

                    {/* 3. 1-TAP WHATSAPP NUDGE FOR HOST / CREDITOR */}
                    {(props.isHost || amICreditor) && (
                      <a
                        href={utils.buildWhatsAppReminderUrl({
                          debtorName: l.debtor_name,
                          creditorName: l.creditor_name,
                          amount: Number(l.amount),
                          venueName: props.venueName,
                          upiId: creditorUpi,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-36 h-10 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-600 border border-emerald-500/25 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <MessageCircle size={15} /> WhatsApp Nudge
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="h-12 w-full bg-surface active:bg-subtle text-main border border-border rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            onClick={props.handleExportPDF}
          >
            <DownloadCloud size={18} className="text-primary" /> Share / Download PDF Receipt
          </button>

          <button
            type="button"
            className="h-12 w-full bg-surface active:bg-subtle text-main border border-border rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            onClick={props.handleGoHome}
          >
            <Home size={18} className="text-muted" /> Return to Dashboard
          </button>

          {props.isHost && (
            <button
              type="button"
              className="h-12 w-full bg-surface active:bg-danger/10 text-danger border border-border rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm mt-2"
              onClick={props.handleUnlockSession}
            >
              <Unlock size={18} /> Unlock & Edit Bill
            </button>
          )}
        </div>

        {/* HOST-SIDE DYNAMIC UPI QR MODAL */}
        <BottomSheet
          isOpen={!!activeQrLedgerRow}
          onClose={() => setActiveQrLedgerRow(null)}
          title="Scan to Pay via UPI"
        >
          {activeQrLedgerRow && (
            <div className="flex flex-col items-center gap-4 pb-4">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">
                  {activeQrLedgerRow.debtor_name} pays {activeQrLedgerRow.creditor_name}
                </p>
                <p className="text-3xl font-extrabold text-primary tabular-nums mt-1">
                  {utils.formatMoney(Number(activeQrLedgerRow.amount))}
                </p>
                {props.venueName && (
                  <p className="text-xs text-muted font-medium mt-0.5">{props.venueName}</p>
                )}
              </div>

              {activeQrUpi ? (
                <>
                  <div className="bg-white p-5 rounded-3xl shadow-md border border-border">
                    <QRCode value={activeQrUri} size={210} />
                  </div>

                  <div className="w-full bg-page border border-border rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                        Creditor UPI ID
                      </span>
                      <span className="text-sm font-mono font-bold text-main truncate">
                        {activeQrUpi}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeQrUpi);
                        showToast('UPI ID copied!', 'success');
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors shrink-0"
                      title="Copy UPI ID"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  {(props.isHost || activeQrLedgerRow.creditor_id === props.currentUserId) &&
                    !activeQrLedgerRow.settled && (
                      <button
                        type="button"
                        onClick={() => {
                          utils.haptic('medium');
                          props.handleToggleSettled(
                            activeQrLedgerRow.id,
                            activeQrLedgerRow.settled
                          );
                          setActiveQrLedgerRow(null);
                          showToast(`Marked ${activeQrLedgerRow.debtor_name} as paid!`, 'success');
                        }}
                        className="w-full h-12 bg-success hover:bg-success-dark active:scale-95 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <CheckCircle2 size={18} /> Payment Received — Mark Paid
                      </button>
                    )}
                </>
              ) : (
                <div className="w-full bg-page border border-border rounded-2xl p-4 flex flex-col gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <CreditCard size={20} />
                  </div>
                  <p className="text-sm font-bold text-main">
                    No UPI ID linked for {activeQrLedgerRow.creditor_name}
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    Enter {activeQrLedgerRow.creditor_name}&apos;s UPI ID (VPA) below to generate an
                    instant scan-to-pay QR code for this bill.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineUpiInput}
                      onChange={(e) => setInlineUpiInput(e.target.value)}
                      placeholder="e.g. name@okhdfcbank"
                      className="flex-1 h-11 bg-surface border border-border rounded-xl px-3 text-sm font-semibold lowercase"
                    />
                    <button
                      type="button"
                      disabled={isSavingUpi}
                      onClick={() => handleSaveInlineUpi(qrCreditorKey)}
                      className="h-11 px-4 bg-primary text-white rounded-xl font-bold text-xs shrink-0"
                    >
                      Generate QR
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </BottomSheet>
      </div>
    );
  }

  // --- DRAFT STATE: MATH SUMMARY & INDIVIDUAL SHARES ---
  const gs = props.calculationResult.globalSummary;
  const computedGrossTotal =
    gs.subTotal + gs.serviceCharge + Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full flex flex-col pb-10">
      <div className="px-4 py-2 mt-1">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Master Bill Summary
        </h3>
      </div>

      <div className="mx-4 bg-surface border border-border rounded-2xl px-4 py-3 flex flex-col divide-y divide-border/60 shadow-sm">
        <div className="flex justify-between py-2.5 text-sm">
          <span className="text-muted">Total Items</span>
          <span className="font-semibold text-main tabular-nums">
            {gs.totalQty.toFixed(2).replace(/\.00$/, '')}
          </span>
        </div>

        {gs.discountAmount > 0 && gs.discountMode === 'pre-tax' && (
          <>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted">Raw Subtotal</span>
              <span className="font-semibold text-main tabular-nums">
                {utils.formatMoney(gs.rawSubTotal)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 text-sm text-success">
              <span className="font-medium">Restaurant Discount (Pre-Tax)</span>
              <span className="font-bold tabular-nums">
                - {utils.formatMoney(gs.discountAmount)}
              </span>
            </div>
          </>
        )}

        <div className="flex justify-between py-2.5 text-sm">
          <span className="text-muted">Base Subtotal</span>
          <span className="font-semibold text-main tabular-nums">
            {utils.formatMoney(gs.subTotal)}
          </span>
        </div>

        {Object.entries(gs.taxBreakdown).map(
          ([taxName, amount]) =>
            amount > 0 && (
              <div key={taxName} className="flex justify-between py-2.5 text-sm">
                <span className="text-muted">{taxName}</span>
                <span className="font-semibold text-main tabular-nums">
                  {utils.formatMoney(amount)}
                </span>
              </div>
            )
        )}

        {gs.serviceCharge > 0 && (
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-muted">Service Charge</span>
            <span className="font-semibold text-main tabular-nums">
              {utils.formatMoney(gs.serviceCharge)}
            </span>
          </div>
        )}

        {gs.discountAmount > 0 && gs.discountMode === 'post-tax' && (
          <>
            <div className="flex justify-between py-2.5 text-sm">
              <span className="text-muted">Gross Total</span>
              <span className="font-semibold text-main tabular-nums">
                {utils.formatMoney(computedGrossTotal)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 text-sm text-success">
              <span className="font-medium">Platform Discount (Post-Tax)</span>
              <span className="font-bold tabular-nums">
                - {utils.formatMoney(gs.discountAmount)}
              </span>
            </div>
          </>
        )}

        {gs.roundOff !== 0 && (
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-muted">POS Round Off</span>
            <span className="font-semibold text-main tabular-nums">
              {gs.roundOff > 0 ? '+' : ''}
              {utils.formatMoney(gs.roundOff)}
            </span>
          </div>
        )}

        <div className="flex justify-between py-3.5 items-baseline">
          <span className="font-extrabold text-main text-base">Grand Total</span>
          <span className="font-extrabold text-primary text-xl tabular-nums">
            {utils.formatMoney(gs.grandTotal)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 mt-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Individual Breakdown
        </h3>
      </div>

      <div className="flex flex-col gap-3 px-4">
        {Object.entries(props.calculationResult.individualBreakdowns).map(
          ([personKey, b]) =>
            b.totalOwed > 0 && (
              <div
                key={personKey}
                className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm"
              >
                <div className="px-4 py-3 border-b border-border bg-page/50 flex items-center justify-between">
                  <h3 className="font-bold text-main text-sm">{b.memberName || personKey}</h3>
                  <span className="text-xs font-bold text-muted tabular-nums">
                    {b.items.length} {b.items.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border/50 px-4">
                  {b.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between py-2.5 text-sm">
                      <span className="text-muted truncate pr-2">
                        {i.name}{' '}
                        <span className="text-xs font-bold ml-1 bg-page px-1.5 py-0.5 rounded border border-border tabular-nums">
                          x{i.qtyString}
                        </span>
                      </span>
                      <span className="font-semibold text-main tabular-nums shrink-0">
                        {utils.formatMoney(i.cost)}
                      </span>
                    </div>
                  ))}
                  {b.serviceCharge > 0 && (
                    <div className="flex justify-between py-2.5 text-sm">
                      <span className="text-muted">Service Charge (inc. Tax)</span>
                      <span className="font-semibold text-main tabular-nums">
                        {utils.formatMoney(b.serviceCharge)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-primary/5">
                  <span className="font-bold text-primary text-xs uppercase tracking-wider">
                    Final Share
                  </span>
                  <span className="font-extrabold text-primary text-lg tabular-nums">
                    {utils.formatMoney(b.totalOwed)}
                  </span>
                </div>
              </div>
            )
        )}
      </div>

      {props.isHost && (
        <div className="px-4 mt-6">
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
              Finalize & Collect
            </h3>
            <input
              type="text"
              value={props.receiptTitle}
              onChange={(e) => props.setReceiptTitle(e.target.value)}
              placeholder={
                props.venueName
                  ? `${props.venueName} Receipt`
                  : 'Receipt Title (e.g. Dinner at Toit)'
              }
              className="w-full h-11 bg-page border border-border rounded-xl px-3.5 font-semibold text-sm"
            />
            <button
              type="button"
              className="h-12 w-full bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
              onClick={props.handleLockSession}
            >
              <LockKeyhole size={18} /> Lock Room & Generate UPI Links
            </button>
            <button
              type="button"
              className="h-11 w-full bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              onClick={props.handleExportPDF}
            >
              <DownloadCloud size={16} className="text-primary" /> Export Draft PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
