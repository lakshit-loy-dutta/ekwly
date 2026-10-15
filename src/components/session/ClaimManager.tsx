import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { BillItem } from '../../lib/types';
import { utils } from '../../lib/utils';
import type { DBMember } from '../../lib/useSession';
import SectionHeader from '../ui/SectionHeader';

interface Props {
  items: BillItem[];
  members: DBMember[];
  claims: Record<string, Record<string, string>>;
  handleUpdateClaim: (memberId: string, itemId: string, value: string) => void;
}

const FRACTION_PILLS = [
  { label: 'Clear', value: '' },
  { label: '1/4', value: '1/4' },
  { label: '1/3', value: '1/3' },
  { label: '1/2', value: '1/2' },
  { label: '1', value: '1' },
];

function ClaimInput({
  initialValue,
  maxQty,
  memberId,
  itemId,
  onSave,
}: {
  initialValue: string;
  maxQty: number;
  memberId: string;
  itemId: string;
  onSave: (mId: string, iId: string, val: string) => void;
}) {
  const [localVal, setLocalVal] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setLocalVal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== initialValue) onSave(memberId, itemId, localVal);
    }, 350);
    return () => clearTimeout(timer);
  }, [localVal, initialValue, memberId, itemId, onSave]);

  const adjustQty = (delta: number) => {
    const current = utils.parseQty(localVal);
    const next = Math.max(0, utils.round2(current + delta));
    const nextStr = next === 0 ? '' : next.toString();
    setLocalVal(nextStr);
    onSave(memberId, itemId, nextStr);
  };

  const applyPill = (val: string) => {
    setLocalVal(val);
    onSave(memberId, itemId, val);
    setIsFocused(false);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => adjustQty(-1)}
          className="w-8 h-9 rounded-lg bg-page border border-border text-muted hover:text-main active:scale-90 flex items-center justify-center transition-all"
          aria-label="Decrease quantity"
        >
          <Minus size={14} />
        </button>
        <input
          type="text"
          inputMode="text"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 180)}
          className="w-20! h-9! shrink-0 text-center text-sm font-bold tabular-nums bg-page border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          placeholder="0"
        />
        <button
          type="button"
          onClick={() => adjustQty(1)}
          className="w-8 h-9 rounded-lg bg-page border border-border text-muted hover:text-main active:scale-90 flex items-center justify-center transition-all"
          aria-label="Increase quantity"
        >
          <Plus size={14} />
        </button>
      </div>

      {isFocused && (
        <div className="flex items-center gap-1 bg-page border border-border rounded-lg p-1 shadow-sm">
          {FRACTION_PILLS.map((pill) => (
            <button
              key={pill.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyPill(pill.value)}
              className={`px-2 py-1 text-[0.7rem] font-bold rounded transition-colors ${
                localVal === pill.value
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-main active:bg-subtle'
              }`}
            >
              {pill.label}
            </button>
          ))}
          {maxQty > 1 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyPill(maxQty.toString())}
              className="px-2 py-1 text-[0.7rem] font-bold rounded text-primary hover:bg-primary/10 transition-colors"
            >
              All ({maxQty})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClaimManager(props: Props) {
  return (
    <div className="w-full flex flex-col pb-6">
      <SectionHeader
        title="Claim Items"
        helpText="Use 'Quick Split' above for shared appetizers, tap the input to pick a quick fraction ('1/4', '1/3', '1/2'), or use the +/- buttons. The tracker turns green when an item is fully claimed."
      />

      {props.items.length > 0 && props.members.length > 0 && (
        <div className="w-full overflow-x-auto whitespace-nowrap px-4 py-3 bg-page no-scrollbar border-b border-border flex gap-2">
          {props.items.map((item) => {
            let claimed = 0;
            props.members.forEach(
              (m) => (claimed += utils.parseQty(props.claims[m.id]?.[item.id]))
            );
            let remaining = utils.round2(item.qty - claimed);

            let statusClasses = 'bg-amber-500/15 border-amber-500 text-amber-700';
            let icon = <circle cx="12" cy="12" r="10" />;

            if (Math.abs(remaining) < 0.01) {
              statusClasses = 'bg-emerald-500/15 border-emerald-500 text-emerald-700 shadow-sm';
              remaining = 0;
              icon = (
                <>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </>
              );
            } else if (remaining < 0) {
              statusClasses = 'bg-rose-500/15 border-rose-500 text-rose-700 shadow-sm';
              icon = (
                <>
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              );
            }

            return (
              <div
                key={item.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold tabular-nums transition-all duration-300 ${statusClasses}`}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  {icon}
                </svg>
                {item.name}: {remaining} left
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-6 mt-4">
        {props.members.length === 0 || props.items.length === 0 ? (
          <div className="text-center text-muted p-8 text-sm font-medium">
            Add items and members in the previous steps to begin claiming.
          </div>
        ) : (
          props.members.map((member) => (
            <div key={member.id} className="flex flex-col">
              <div className="px-4 py-2">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest">
                  {member.name}
                </h3>
              </div>
              <div className="bg-surface border-y border-border divide-y divide-border">
                {props.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-subtle transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-2 pt-1.5">
                      <span
                        className="text-[0.95rem] font-medium text-main truncate"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="text-xs text-muted tabular-nums">Total Qty: {item.qty}</span>
                    </div>
                    <ClaimInput
                      initialValue={props.claims[member.id]?.[item.id] || ''}
                      maxQty={item.qty}
                      memberId={member.id}
                      itemId={item.id}
                      onSave={props.handleUpdateClaim}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
