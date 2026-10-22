import { useState, useEffect } from 'react';
import { utils } from '../../lib/utils';
import type { DBMember } from '../../lib/useSession';
import { AlertCircle, CheckCircle2, Sparkles, RotateCcw } from 'lucide-react';

interface Props {
  isHost: boolean;
  members: DBMember[];
  grandTotal: number;
  handleUpdatePayment: (memberId: string, amount: string) => void;
}

function PaymentInput({
  m,
  isHost,
  onChange,
}: {
  m: DBMember;
  isHost: boolean;
  onChange: (val: string) => void;
}) {
  const [localVal, setLocalVal] = useState(m.paid_amount ? m.paid_amount.toString() : '');

  useEffect(() => {
    const parsedLocal = parseFloat(localVal) || 0;
    if (Math.abs(parsedLocal - (m.paid_amount || 0)) > 0.01) {
      setLocalVal(m.paid_amount ? m.paid_amount.toString() : '');
    }
  }, [m.paid_amount, localVal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="relative w-32 shrink-0">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-sm">
        ₹
      </div>
      <input
        type="number"
        inputMode="decimal"
        disabled={!isHost}
        value={localVal}
        onChange={handleChange}
        placeholder="0.00"
        className="w-full h-10 bg-page border border-border rounded-xl pl-7 pr-3 font-extrabold text-sm text-main tabular-nums disabled:opacity-75"
      />
    </div>
  );
}

export default function Payments(props: Props) {
  const totalPaid = utils.round2(props.members.reduce((sum, m) => sum + (m.paid_amount || 0), 0));
  const remaining = utils.round2(props.grandTotal - totalPaid);

  const isBalanced = Math.abs(remaining) <= 0.05;
  const isOverpaid = remaining < -0.05;

  const handleFillRemainingForMember = (member: DBMember) => {
    if (!props.isHost) return;
    utils.haptic('light');
    const nextAmount = Math.max(0, utils.round2((member.paid_amount || 0) + remaining));
    props.handleUpdatePayment(member.id, nextAmount.toString());
  };

  const handleSplitCashierEvenly = () => {
    if (!props.isHost || props.members.length === 0) return;
    utils.haptic('medium');
    const baseShare = Math.floor((props.grandTotal / props.members.length) * 100) / 100;
    let allocated = 0;
    props.members.forEach((m, idx) => {
      if (idx === props.members.length - 1) {
        const lastShare = utils.round2(props.grandTotal - allocated);
        props.handleUpdatePayment(m.id, lastShare.toString());
      } else {
        allocated = utils.round2(allocated + baseShare);
        props.handleUpdatePayment(m.id, baseShare.toString());
      }
    });
  };

  const handleClearAllPayments = () => {
    if (!props.isHost) return;
    utils.haptic('light');
    props.members.forEach((m) => props.handleUpdatePayment(m.id, '0'));
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* BENTO TOTAL & REMAINING BALANCE HERO CARD */}
      <div className="premium-gradient-card rounded-2xl p-5 text-white flex flex-col items-center text-center shadow-sm">
        <span className="text-white/80 text-[0.65rem] font-bold uppercase tracking-widest mb-1">
          Total Restaurant Bill
        </span>
        <div className="text-3xl font-extrabold tabular-nums tracking-tight mb-3">
          {utils.formatMoney(props.grandTotal)}
        </div>
        <div
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 tabular-nums ${
            isBalanced
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/30'
              : isOverpaid
                ? 'bg-rose-500/25 text-rose-200 border border-rose-400/30'
                : 'bg-white/15 text-white'
          }`}
        >
          {isBalanced ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {isBalanced
            ? 'Cashier bill is 100% covered'
            : isOverpaid
              ? `Overpaid by ${utils.formatMoney(Math.abs(remaining))}`
              : `${utils.formatMoney(remaining)} left to assign`}
        </div>
      </div>

      {/* QUICK MULTI-PAYER HELPERS */}
      {props.isHost && props.members.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSplitCashierEvenly}
            className="flex-1 h-9 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles size={13} /> Paid Equally by All
          </button>
          <button
            type="button"
            onClick={handleClearAllPayments}
            className="h-9 px-3 rounded-xl bg-page hover:bg-subtle text-muted hover:text-main border border-border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      )}

      {/* BENTO MEMBER PAYMENT LIST WITH 1-TAP "+ FILL REMAINING" PILLS */}
      <div className="bg-page border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {props.members.map((m) => {
          const canFillRemainder = props.isHost && remaining > 0.05;
          return (
            <div key={m.id} className="p-3.5 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-bold text-main text-sm truncate">{m.name}</span>
                {canFillRemainder && (
                  <button
                    type="button"
                    onClick={() => handleFillRemainingForMember(m)}
                    className="mt-1 self-start px-2 py-0.5 rounded-md bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/25 text-[0.65rem] font-extrabold tabular-nums transition-colors"
                  >
                    + Fill {utils.formatMoney(remaining)}
                  </button>
                )}
              </div>

              <PaymentInput
                m={m}
                isHost={props.isHost}
                onChange={(val) => props.handleUpdatePayment(m.id, val)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
