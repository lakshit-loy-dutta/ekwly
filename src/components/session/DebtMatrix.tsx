import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase';
import { utils, showToast } from '../../lib/utils';
import { generatePDF } from '../../lib/pdf';
import {
  exportBentoReceiptImage,
  exportPersonalNudgeImage,
  type CreditorQrEntry,
} from '../../lib/bentoReceipt';
import type { CalculationResult } from '../../lib/types';
import type { DBMember } from '../../lib/useSession';
import { useSessionContext } from '../../lib/SessionContext';
import BottomSheet from '../ui/BottomSheet';
import {
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  Share2,
  Download,
  Smartphone,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';

interface Props {
  isHost: boolean;
  sessionStatus: 'draft' | 'locked' | 'archived';
  ledger: any[];
  members: DBMember[];
  calculationResult: CalculationResult;
  venueName: string;
  receiptTitle: string;
  onFinalize: () => void;
  onUnlock: () => void;
  onToggleSettle: (id: string, currentStatus: boolean) => void;
}

export default function DebtMatrix(props: Props) {
  const [upiMap, setUpiMap] = useState<Record<string, string>>({});
  const [verifiedUpiKeys, setVerifiedUpiKeys] = useState<Record<string, boolean>>({});
  const [editingUpiForKey, setEditingUpiForKey] = useState<string | null>(null);
  const [tempUpiInput, setTempUpiInput] = useState('');
  const [activeQrTransfer, setActiveQrTransfer] = useState<{
    upiUri: string;
    creditorName: string;
    debtorName: string;
    amount: number;
    upiId: string;
  } | null>(null);

  const { items, formattedClaims, taxPresets, sessionRules } = useSessionContext();
  const pdfDetails = {
    items,
    members: props.members,
    formattedClaims,
    taxPresets,
    sessionRules,
  };

  const multiCreditorQrRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const personalNudgeQrRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const fetchCreditorUpis = async () => {
      const creditorIds = Array.from(
        new Set(props.ledger.map((l) => l.creditor_id).filter(Boolean))
      );
      if (creditorIds.length === 0) return;

      const { data } = await supabase.from('profiles').select('id, upi_id').in('id', creditorIds);

      if (data) {
        const nextMap: Record<string, string> = {};
        const nextVerified: Record<string, boolean> = {};
        data.forEach((row: any) => {
          if (row.upi_id) {
            nextMap[row.id] = row.upi_id;
            nextVerified[row.id] = true;
          }
        });
        setUpiMap((prev) => ({ ...prev, ...nextMap }));
        setVerifiedUpiKeys((prev) => ({ ...prev, ...nextVerified }));
      }
    };
    fetchCreditorUpis();
  }, [props.ledger]);

  const getCreditorKey = (row: any) => row.creditor_id || `fallback:${row.creditor_name}`;

  const handleSaveManualUpi = async (row: any) => {
    const key = getCreditorKey(row);
    const cleaned = tempUpiInput.trim();
    if (!cleaned || !cleaned.includes('@')) {
      return showToast('Enter a valid UPI ID (e.g. name@okaxis)', 'error');
    }
    utils.haptic('light');
    setUpiMap((prev) => ({ ...prev, [key]: cleaned }));
    setEditingUpiForKey(null);
    setTempUpiInput('');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user && row.creditor_id === session.user.id) {
      await supabase.from('profiles').update({ upi_id: cleaned }).eq('id', session.user.id);
      setVerifiedUpiKeys((prev) => ({ ...prev, [key]: true }));
      showToast('Saved UPI ID to your profile!', 'success');
    } else {
      showToast('UPI ID attached for this session!', 'success');
    }
  };

  // Collect every unique creditor who is still owed money and has a UPI ID
  const uniqueUnsettledCreditors = (() => {
    const map = new Map<
      string,
      { key: string; creditorName: string; upiId: string; totalReceivable: number }
    >();
    props.ledger.forEach((row) => {
      if (row.settled) return;
      const key = getCreditorKey(row);
      const upi = upiMap[key];
      if (!upi) return;
      const existing = map.get(key);
      if (existing) {
        existing.totalReceivable = utils.round2(existing.totalReceivable + Number(row.amount || 0));
      } else {
        map.set(key, {
          key,
          creditorName: row.creditor_name,
          upiId: upi,
          totalReceivable: utils.round2(Number(row.amount || 0)),
        });
      }
    });
    return Array.from(map.values());
  })();

  const handleShareFullReceiptImage = () => {
    utils.haptic('medium');
    const creditorQrList: CreditorQrEntry[] = uniqueUnsettledCreditors.map((c) => ({
      creditorName: c.creditorName,
      upiId: c.upiId,
      totalReceivable: c.totalReceivable,
      qrSvgElement: multiCreditorQrRefs.current[c.key]?.querySelector('svg') || null,
    }));

    exportBentoReceiptImage({
      calculationResult: props.calculationResult,
      venueName: props.venueName,
      receiptTitle: props.receiptTitle,
      ledger: props.ledger,
      creditorQrList,
      mode: 'share',
    });
  };

  const breakdowns = Object.values(props.calculationResult.individualBreakdowns);
  const settledCount = props.ledger.filter((l) => l.settled).length;

  return (
    <div className="w-full flex flex-col gap-4 pb-8 px-4">
      {/* Hidden QR SVGs for Multi-Creditor Receipt Image & 1-on-1 Nudge Cards */}
      <div className="hidden" aria-hidden="true">
        {uniqueUnsettledCreditors.map((c) => {
          const uri = `upi://pay?pa=${encodeURIComponent(c.upiId)}&pn=${encodeURIComponent(
            c.creditorName
          )}&cu=INR`;
          return (
            <div
              key={c.key}
              ref={(el) => {
                multiCreditorQrRefs.current[c.key] = el;
              }}
            >
              <QRCode value={uri} size={200} />
            </div>
          );
        })}

        {props.ledger.map((row) => {
          const key = getCreditorKey(row);
          const upi = upiMap[key];
          if (!upi) return null;
          const exactUri = utils.buildUpiUrl({
            upiId: upi,
            payeeName: row.creditor_name,
            amount: Number(row.amount),
            note: props.venueName || props.receiptTitle || 'Ekwly Split',
          });
          return (
            <div
              key={row.id}
              ref={(el) => {
                personalNudgeQrRefs.current[row.id] = el;
              }}
            >
              <QRCode value={exactUri} size={200} />
            </div>
          );
        })}
      </div>

      {/* HOST-SCREEN DYNAMIC UPI QR MODAL */}
      <BottomSheet
        isOpen={!!activeQrTransfer}
        onClose={() => setActiveQrTransfer(null)}
        title="Scan to Settle via UPI"
      >
        {activeQrTransfer && (
          <div className="flex flex-col items-center text-center pb-4">
            <p className="text-xs sm:text-sm text-muted mb-5">
              Have <strong className="text-main">{activeQrTransfer.debtorName}</strong> scan this QR
              with Google Pay, PhonePe, or Paytm to pay{' '}
              <strong className="text-main">{activeQrTransfer.creditorName}</strong>.
            </p>
            <div className="bg-white p-5 rounded-3xl shadow-md border border-border mb-4">
              <QRCode value={activeQrTransfer.upiUri} size={210} />
            </div>
            <span className="text-2xl font-extrabold text-primary tabular-nums">
              {utils.formatMoney(activeQrTransfer.amount)}
            </span>
            <span className="text-xs font-mono text-muted mt-1">{activeQrTransfer.upiId}</span>
          </div>
        )}
      </BottomSheet>

      {/* SECTION 1: INDIVIDUAL SHARES SUMMARY */}
      <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">
            Individual Consumption Shares ({breakdowns.length})
          </h3>
          <span className="text-xs font-mono font-bold text-primary tabular-nums">
            Total: {utils.formatMoney(props.calculationResult.globalSummary.grandTotal)}
          </span>
        </div>

        <div className="bg-page/90 border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {breakdowns.map((b) => (
            <div key={b.memberId} className="p-3.5 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-main truncate">{b.memberName}</span>
                <span className="text-xs text-muted tabular-nums">
                  {b.items.length} {b.items.length === 1 ? 'item' : 'items'}
                  {b.serviceCharge > 0 ? ` • S.C.: ${utils.formatMoney(b.serviceCharge)}` : ''}
                </span>
              </div>
              <span className="font-mono font-extrabold text-base text-primary tabular-nums shrink-0">
                {utils.formatMoney(b.totalOwed)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: LOCKED COLLECTION TRAY OR DRAFT FINALIZE CTA */}
      {props.sessionStatus === 'locked' ? (
        <div className="glass-card rounded-3xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-emerald-500" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-main">
                Settlement Plan ({settledCount}/{props.ledger.length} Paid)
              </span>
            </div>
            {props.isHost && (
              <button
                type="button"
                onClick={props.onUnlock}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Unlock size={13} /> Unlock to Edit Bill
              </button>
            )}
          </div>

          {props.ledger.length === 0 ? (
            <div className="p-6 bg-page border border-border rounded-2xl text-center text-xs sm:text-sm text-muted font-medium">
              Everyone is already even—no transfers required!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {props.ledger.map((row) => {
                const cKey = getCreditorKey(row);
                const creditorUpi = upiMap[cKey];
                const isVerifiedUpi = Boolean(verifiedUpiKeys[cKey]);
                const amountNum = Number(row.amount || 0);

                const upiUri = creditorUpi
                  ? utils.buildUpiUrl({
                      upiId: creditorUpi,
                      payeeName: row.creditor_name,
                      amount: amountNum,
                      note: props.venueName || props.receiptTitle || 'Ekwly Split',
                    })
                  : '';

                const whatsappUrl = utils.buildWhatsAppReminderUrl({
                  debtorName: row.debtor_name,
                  creditorName: row.creditor_name,
                  amount: amountNum,
                  venueName: props.venueName || props.receiptTitle,
                  upiId: creditorUpi,
                });

                const debtorMember = props.members.find(
                  (m) =>
                    (row.debtor_id && m.user_id === row.debtor_id) ||
                    m.name.toLowerCase() === String(row.debtor_name || '').toLowerCase()
                );
                const debtorBreakdown = debtorMember
                  ? props.calculationResult.individualBreakdowns[debtorMember.id]
                  : null;

                return (
                  <div
                    key={row.id}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 transition-colors ${
                      row.settled
                        ? 'bg-emerald-500/8 border-emerald-500/30'
                        : 'bg-page/90 border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap text-sm font-bold text-main">
                          <span>{row.debtor_name}</span>
                          <span className="text-xs text-muted font-normal">pays</span>
                          <span>{row.creditor_name}</span>
                        </div>

                        {creditorUpi ? (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-xs font-mono text-muted truncate">
                              UPI: {creditorUpi}
                            </span>
                            {isVerifiedUpi && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[0.6rem] font-extrabold uppercase">
                                <ShieldCheck size={10} /> Verified
                              </span>
                            )}
                          </div>
                        ) : (
                          !row.settled && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUpiForKey(cKey);
                                setTempUpiInput('');
                              }}
                              className="text-xs font-bold text-primary hover:underline self-start mt-1"
                            >
                              + Link {row.creditor_name}&apos;s UPI ID for 1-Tap Pay &amp; QR
                            </button>
                          )
                        )}
                      </div>

                      <span className="text-lg font-mono font-extrabold text-main tabular-nums shrink-0">
                        {utils.formatMoney(amountNum)}
                      </span>
                    </div>

                    {editingUpiForKey === cKey && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={tempUpiInput}
                          onChange={(e) => setTempUpiInput(e.target.value)}
                          placeholder="e.g. rahul@okicici"
                          className="flex-1 h-10 bg-surface border border-border rounded-xl px-3 text-xs font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveManualUpi(row)}
                          className="h-10 px-3.5 bg-primary text-white rounded-xl font-bold text-xs"
                        >
                          Save UPI
                        </button>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                      {!row.settled && creditorUpi && (
                        <>
                          <a
                            href={upiUri}
                            className="h-9 px-3 bg-primary text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                          >
                            <Smartphone size={14} /> UPI App
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveQrTransfer({
                                upiUri,
                                creditorName: row.creditor_name,
                                debtorName: row.debtor_name,
                                amount: amountNum,
                                upiId: creditorUpi,
                              })
                            }
                            className="h-9 px-3 bg-surface text-main border border-border rounded-xl font-bold text-xs flex items-center gap-1.5"
                          >
                            <QrCode size={14} className="text-primary" /> Show QR
                          </button>
                        </>
                      )}

                      {!row.settled && (
                        <>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-9 px-3 bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 rounded-xl font-bold text-xs flex items-center gap-1.5"
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              utils.haptic('light');
                              const qrSvg =
                                personalNudgeQrRefs.current[row.id]?.querySelector('svg') || null;
                              exportPersonalNudgeImage({
                                debtorName: row.debtor_name,
                                creditorName: row.creditor_name,
                                amount: amountNum,
                                venueName: props.venueName || props.receiptTitle,
                                upiId: creditorUpi,
                                memberBreakdown: debtorBreakdown,
                                qrSvgElement: qrSvg,
                                whatsappTextUrl: whatsappUrl,
                              });
                            }}
                            className="h-9 px-3 bg-primary/12 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-bold text-xs flex items-center gap-1.5"
                            title="Share personalized receipt ticket with pre-filled QR for this person"
                          >
                            <ImageIcon size={14} /> Nudge Card
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => props.onToggleSettle(row.id, row.settled)}
                        className={`ml-auto h-9 px-3.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-colors ${
                          row.settled
                            ? 'bg-emerald-500 text-white'
                            : 'bg-surface border border-border text-main hover:border-emerald-500/50'
                        }`}
                      >
                        {row.settled ? (
                          <>
                            <CheckCircle2 size={14} /> Paid
                          </>
                        ) : (
                          <>
                            <Clock size={14} className="text-amber-500" /> Mark Paid
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Share Receipt Image & PDF Export Actions */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleShareFullReceiptImage}
              className="min-h-12 w-full premium-gradient-card text-white rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
              <Sparkles size={16} /> Share Receipt Image (With QR)
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  generatePDF(
                    props.calculationResult,
                    props.venueName,
                    props.ledger,
                    props.receiptTitle,
                    'download',
                    upiMap,
                    pdfDetails
                  )
                }
                className="min-h-11 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Download size={15} className="text-primary" /> Download PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  generatePDF(
                    props.calculationResult,
                    props.venueName,
                    props.ledger,
                    props.receiptTitle,
                    'share',
                    upiMap,
                    pdfDetails
                  )
                }
                className="min-h-11 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 size={15} className="text-primary" /> Share PDF
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* DRAFT STATE: LOCK & GENERATE SETTLEMENT PLAN */
        <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
          {props.isHost ? (
            <button
              type="button"
              onClick={props.onFinalize}
              className="min-h-13 w-full premium-gradient-card text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-transform"
            >
              <Lock size={17} /> Lock Bill &amp; Generate Settlement Plan
            </button>
          ) : (
            <div className="p-4 bg-page border border-border rounded-2xl text-center text-xs text-muted font-semibold">
              Waiting for the Host to lock the bill and generate final settlements...
            </div>
          )}

          <button
            type="button"
            onClick={handleShareFullReceiptImage}
            className="min-h-11 w-full bg-primary/12 hover:bg-primary/20 text-primary border border-primary/25 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles size={15} /> Share Receipt Image Preview
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() =>
                generatePDF(
                  props.calculationResult,
                  props.venueName,
                  props.ledger,
                  props.receiptTitle,
                  'download',
                  upiMap,
                  pdfDetails
                )
              }
              className="min-h-11 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Download size={15} className="text-primary" /> Download PDF
            </button>
            <button
              type="button"
              onClick={() =>
                generatePDF(
                  props.calculationResult,
                  props.venueName,
                  props.ledger,
                  props.receiptTitle,
                  'share',
                  upiMap,
                  pdfDetails
                )
              }
              className="min-h-11 bg-page hover:bg-subtle text-main border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 size={15} className="text-primary" /> Share PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
