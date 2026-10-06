import { useState, useEffect } from 'react';
import type { CalculationResult } from '../../lib/types';
import { utils } from '../../lib/utils';
import { DownloadCloud, LockKeyhole, Unlock, Home, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToggleSwitch from '../ui/ToggleSwitch';
import SectionHeader from '../ui/SectionHeader';

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

  useEffect(() => {
    const fetchUpis = async () => {
      if (props.sessionStatus !== 'locked' || props.ledger.length === 0) return;

      const creditorIds = props.ledger.map((l) => l.creditor_id).filter(Boolean);
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

  // --- LOCKED STATE: COLLECTION TRAY ---
  if (props.sessionStatus === 'locked') {
    const totalExpected = props.ledger.reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCollected = props.ledger
      .filter((l) => l.settled)
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const progress = totalExpected === 0 ? 0 : (totalCollected / totalExpected) * 100;

    return (
      <div className="w-full flex flex-col pb-8">
        <div className="bg-primary px-6 py-8 text-white flex flex-col items-center justify-center text-center shadow-stripe">
          <h2 className="text-2xl font-bold mb-2">Collection Tray</h2>
          <p className="text-white/80 text-sm mb-6">Session is locked. Waiting on payments.</p>
          <div className="text-4xl font-bold mb-3">
            {utils.formatMoney(totalCollected)}{' '}
            <span className="text-xl text-white/60">/ {utils.formatMoney(totalExpected)}</span>
          </div>
          <div className="w-full max-w-xs bg-black/20 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-success h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <SectionHeader
          title="Debtors"
          helpText="Toggle the switch to 'Paid' when someone sends you their share via UPI or cash. This instantly clears their debt in your Global Dashboard."
        />

        <div className="bg-surface border-y border-border divide-y divide-border">
          {props.ledger.length === 0 && (
            <div className="p-8 text-center text-sm text-muted">No one owes money.</div>
          )}

          {props.ledger.map((l) => {
            const creditorUpi = l.creditor_id ? upiMap[l.creditor_id] : null;
            const amICreditor = l.creditor_id === props.currentUserId;

            return (
              <div key={l.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-main text-[1.05rem]">
                      {l.debtor_name}{' '}
                      <span className="text-muted text-[0.85rem] font-medium mx-1">owes</span>{' '}
                      {l.creditor_name}
                    </span>
                    <span className="text-muted text-sm font-medium mt-0.5">
                      {utils.formatMoney(l.amount)}
                    </span>
                  </div>

                  {props.isHost || amICreditor ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${l.settled ? 'text-success' : 'text-muted'}`}
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
                      className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${l.settled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-700'}`}
                    >
                      {l.settled ? 'Paid' : 'Unpaid'}
                    </div>
                  )}
                </div>

                {/* THE PHASE 4 MAGIC: NATIVE UPI DEEP LINK */}
                {creditorUpi && !l.settled && !amICreditor && (
                  <a
                    href={`upi://pay?pa=${creditorUpi}&pn=${encodeURIComponent(l.creditor_name)}&am=${l.amount}&cu=INR`}
                    className="w-full h-11 bg-primary/10 active:bg-primary/20 text-primary border border-primary/20 rounded-xl font-bold text-[0.95rem] flex items-center justify-center gap-2 transition-colors mt-1"
                  >
                    <Smartphone size={18} /> Pay {utils.formatMoney(l.amount)} via UPI
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 mt-8 flex flex-col gap-3">
          <button
            type="button"
            className="h-12 w-full bg-surface active:bg-subtle text-main border border-border rounded-xl font-medium text-[0.95rem] flex items-center justify-center gap-2 transition-colors shadow-sm"
            onClick={props.handleExportPDF}
          >
            <DownloadCloud size={20} className="text-primary" /> Download Receipt
          </button>

          <button
            type="button"
            className="h-12 w-full bg-page active:bg-subtle text-main border border-border rounded-xl font-bold text-[0.95rem] flex items-center justify-center gap-2 transition-colors shadow-sm"
            onClick={props.handleGoHome}
          >
            <Home size={18} className="text-muted" /> Return to Dashboard
          </button>

          {props.isHost && (
            <button
              type="button"
              className="h-12 w-full bg-page active:bg-subtle text-danger border border-border rounded-xl font-bold text-[0.95rem] flex items-center justify-center gap-2 transition-colors shadow-sm mt-4"
              onClick={props.handleUnlockSession}
            >
              <Unlock size={18} /> Unlock & Edit Bill
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- DRAFT STATE: MATH SUMMARY ---
  return (
    <div className="w-full flex flex-col pb-8">
      <div className="px-4 py-2">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Master Bill Summary
        </h3>
      </div>
      <div className="bg-surface border-y border-border px-4 py-3 flex flex-col divide-y divide-border/50">
        <div className="flex justify-between py-2.5 text-[0.95rem]">
          <span className="text-muted">Total Items</span>
          <span className="font-semibold text-main">
            {props.calculationResult.globalSummary.totalQty.toFixed(2).replace(/\.00$/, '')}
          </span>
        </div>
        {props.calculationResult.globalSummary.discountAmount > 0 &&
          props.calculationResult.globalSummary.discountMode === 'pre-tax' && (
            <>
              <div className="flex justify-between py-2.5 text-[0.95rem]">
                <span className="text-muted">Raw Subtotal</span>
                <span className="font-semibold text-main">
                  {utils.formatMoney(props.calculationResult.globalSummary.rawSubTotal)}
                </span>
              </div>
              <div className="flex justify-between py-2.5 text-[0.95rem] text-success">
                <span className="font-medium">Restaurant Discount (Pre-Tax)</span>
                <span className="font-bold">
                  - {utils.formatMoney(props.calculationResult.globalSummary.discountAmount)}
                </span>
              </div>
            </>
          )}
        <div className="flex justify-between py-2.5 text-[0.95rem]">
          <span className="text-muted">Base Subtotal</span>
          <span className="font-semibold text-main">
            {utils.formatMoney(props.calculationResult.globalSummary.subTotal)}
          </span>
        </div>
        {Object.entries(props.calculationResult.globalSummary.taxBreakdown).map(
          ([taxName, amount]) =>
            amount > 0 && (
              <div key={taxName} className="flex justify-between py-2.5 text-[0.95rem]">
                <span className="text-muted">{taxName}</span>
                <span className="font-semibold text-main">{utils.formatMoney(amount)}</span>
              </div>
            )
        )}
        {props.calculationResult.globalSummary.serviceCharge > 0 && (
          <div className="flex justify-between py-2.5 text-[0.95rem]">
            <span className="text-muted">Service Charge</span>
            <span className="font-semibold text-main">
              {utils.formatMoney(props.calculationResult.globalSummary.serviceCharge)}
            </span>
          </div>
        )}
        {props.calculationResult.globalSummary.discountAmount > 0 &&
          props.calculationResult.globalSummary.discountMode === 'post-tax' && (
            <>
              <div className="flex justify-between py-2.5 text-[0.95rem] mt-1 border-t border-border/50">
                <span className="text-muted">Gross Total</span>
                <span className="font-semibold text-main">
                  {utils.formatMoney(
                    props.calculationResult.globalSummary.grandTotal +
                      props.calculationResult.globalSummary.discountAmount
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2.5 text-[0.95rem] text-success">
                <span className="font-medium">Platform Discount (Post-Tax)</span>
                <span className="font-bold">
                  - {utils.formatMoney(props.calculationResult.globalSummary.discountAmount)}
                </span>
              </div>
            </>
          )}
        <div className="flex justify-between py-4 mt-1 border-t border-border">
          <span className="font-bold text-main text-lg">Grand Total</span>
          <span className="font-bold text-primary text-lg">
            {utils.formatMoney(props.calculationResult.globalSummary.grandTotal)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Individual Debt</h3>
      </div>

      <div className="flex flex-col gap-6">
        {Object.entries(props.calculationResult.individualBreakdowns).map(
          ([person, b]) =>
            b.totalOwed > 0 && (
              <div key={person} className="bg-surface border-y border-border flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-page/50">
                  <h3 className="font-bold text-main text-base">{person}</h3>
                </div>
                <div className="flex flex-col divide-y divide-border/50 px-4">
                  {b.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between py-3 text-[0.95rem]">
                      <span className="text-muted">
                        {i.name}{' '}
                        <span className="text-xs font-bold ml-1 bg-page px-1 rounded border border-border">
                          x{i.qtyString}
                        </span>
                      </span>
                      <span className="font-semibold text-main">{utils.formatMoney(i.cost)}</span>
                    </div>
                  ))}
                  {b.serviceCharge > 0 && (
                    <div className="flex justify-between py-3 text-[0.95rem]">
                      <span className="text-muted">Service Charge</span>
                      <span className="font-semibold text-main">
                        {utils.formatMoney(b.serviceCharge)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-4 border-t border-border flex justify-between items-center bg-primary/5">
                  <span className="font-bold text-primary text-[0.95rem] uppercase tracking-wider">
                    Owes
                  </span>
                  <span className="font-bold text-primary text-xl">
                    {utils.formatMoney(b.totalOwed)}
                  </span>
                </div>
              </div>
            )
        )}
      </div>

      {props.isHost && (
        <div className="px-4 mt-8">
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
            <h3 className="text-sm font-bold text-main">Finalize Ledger</h3>
            <input
              type="text"
              value={props.receiptTitle}
              onChange={(e) => props.setReceiptTitle(e.target.value)}
              placeholder={
                props.venueName
                  ? `${props.venueName} Receipt`
                  : "Receipt Title (e.g. Dinner at Bob's)"
              }
              className="w-full h-11 bg-page border border-border rounded-lg px-3 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
            <button
              type="button"
              className="h-12 w-full bg-primary active:bg-primary-hover text-white rounded-lg font-bold text-[0.95rem] flex items-center justify-center gap-2 transition-colors shadow-sm"
              onClick={props.handleLockSession}
            >
              <LockKeyhole size={18} /> Lock Room & Request Payments
            </button>
            <button
              type="button"
              className="h-12 w-full bg-subtle active:bg-border text-main border border-border rounded-lg font-medium text-[0.95rem] flex items-center justify-center gap-2 transition-colors"
              onClick={props.handleExportPDF}
            >
              <DownloadCloud size={20} /> Export to PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
