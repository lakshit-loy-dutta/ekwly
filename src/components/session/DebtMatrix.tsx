import type { CalculationResult } from '../../lib/types';
import { utils } from '../../lib/utils';
import { DownloadCloud, LockKeyhole } from 'lucide-react';

interface Props {
  calculationResult: CalculationResult;
  receiptTitle: string;
  setReceiptTitle: (val: string) => void;
  sessionStatus: 'draft' | 'locked' | 'archived';
  ledger: any[];
  isHost: boolean;
  handleLockSession: () => void;
  handleToggleSettled: (id: string, current: boolean) => void;
  handleExportPDF: () => void;
}

export default function DebtMatrix(props: Props) {
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
          <p className="text-primary-light/80 text-sm mb-6">
            Session is locked. Waiting on payments.
          </p>
          <div className="text-4xl font-bold mb-3">
            {utils.formatMoney(totalCollected)}{' '}
            <span className="text-xl text-primary-light/60">
              / {utils.formatMoney(totalExpected)}
            </span>
          </div>
          <div className="w-full max-w-xs bg-black/20 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-success h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="px-4 py-3 mt-4">
          <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Debtors</h3>
        </div>

        <div className="bg-surface border-y border-border divide-y divide-border">
          {props.ledger.length === 0 && (
            <div className="p-8 text-center text-sm text-muted">No one owes money.</div>
          )}
          {props.ledger.map((l) => (
            <div key={l.id} className="p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-main text-[1.05rem]">{l.debtor_name}</span>
                <span className="text-muted text-sm font-medium">
                  {utils.formatMoney(l.amount)}
                </span>
              </div>

              {props.isHost ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${l.settled ? 'text-success' : 'text-muted'}`}
                  >
                    {l.settled ? 'Paid' : 'Unpaid'}
                  </span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={l.settled}
                      onChange={() => props.handleToggleSettled(l.id, l.settled)}
                    />
                    <span className="slider"></span>
                  </div>
                </label>
              ) : (
                <div
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${l.settled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-700'}`}
                >
                  {l.settled ? 'Paid' : 'Unpaid'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 mt-8">
          <button
            type="button"
            className="h-12 w-full bg-surface active:bg-subtle text-main border border-border rounded-xl font-medium text-[0.95rem] flex items-center justify-center gap-2 transition-colors shadow-sm"
            onClick={props.handleExportPDF}
          >
            <DownloadCloud size={20} className="text-primary" /> Download Receipt
          </button>
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

      {props.isHost && (
        <div className="px-4 mt-8">
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
            <h3 className="text-sm font-bold text-main">Finalize Ledger</h3>
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
