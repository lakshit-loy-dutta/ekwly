import { useState, useEffect } from 'react';
import { utils } from '../../lib/utils';
import type { DBMember } from '../../lib/useSession';
import { AlertCircle } from 'lucide-react';

interface Props {
  isHost: boolean;
  members: DBMember[];
  grandTotal: number;
  handleUpdatePayment: (memberId: string, amount: string) => void;
}

// Mobile-First Input Shield: Prevents DB broadcasts from erasing decimals mid-keystroke
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
  }, [m.paid_amount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    onChange(e.target.value);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={!isHost}
      value={localVal}
      onChange={handleChange}
      placeholder="0.00"
      className="w-full h-11 bg-page border border-border rounded-lg pl-9! pr-3 font-semibold text-main focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-75"
    />
  );
}

export default function Payments(props: Props) {
  const totalPaid = props.members.reduce((sum, m) => sum + (m.paid_amount || 0), 0);
  const remaining = props.grandTotal - totalPaid;

  const isBalanced = Math.abs(remaining) <= 0.05;
  const isOverpaid = remaining < -0.05;

  return (
    <div className="w-full flex flex-col pb-8">
      <div className="bg-primary px-4 py-8 text-white flex flex-col items-center justify-center text-center shadow-sm">
        <h3 className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">
          Total Bill
        </h3>
        <div className="text-4xl font-bold mb-4">{utils.formatMoney(props.grandTotal)}</div>
        <div
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${isBalanced ? 'bg-success/20 text-success-light' : isOverpaid ? 'bg-danger/20 text-danger-light' : 'bg-white/10'}`}
        >
          {!isBalanced && <AlertCircle size={16} />}
          {isBalanced
            ? 'Bill is fully covered'
            : isOverpaid
              ? `Overpaid by ${utils.formatMoney(Math.abs(remaining))}`
              : `${utils.formatMoney(remaining)} remaining`}
        </div>
      </div>

      <div className="px-4 py-3 mt-4">
        <h3 className="text-xs font-bold text-muted uppercase tracking-widest">
          Who Paid The Restaurant?
        </h3>
      </div>

      <div className="bg-surface border-y border-border divide-y divide-border">
        {props.members.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between">
            <span className="font-bold text-main text-[1.05rem] truncate pr-4">{m.name}</span>
            <div className="relative w-32 shrink-0">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted font-bold text-[0.95rem]">
                ₹
              </div>
              <PaymentInput
                m={m}
                isHost={props.isHost}
                onChange={(val) => props.handleUpdatePayment(m.id, val)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
