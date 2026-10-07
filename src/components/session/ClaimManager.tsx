import { useState, useEffect } from 'react';
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

// 🚀 OPTIMIZATION: Localized Input with 400ms Debounce to prevent DB spam
function ClaimInput({
  initialValue,
  memberId,
  itemId,
  onSave,
}: {
  initialValue: string;
  memberId: string;
  itemId: string;
  onSave: (mId: string, iId: string, val: string) => void;
}) {
  const [localVal, setLocalVal] = useState(initialValue);

  // Sync with global state if it changes externally (e.g. Quick Split)
  useEffect(() => {
    setLocalVal(initialValue);
  }, [initialValue]);

  // The Debounce Engine
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== initialValue) onSave(memberId, itemId, localVal);
    }, 400);
    return () => clearTimeout(timer);
  }, [localVal, initialValue, memberId, itemId, onSave]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className="w-24! h-11! shrink-0 text-center text-base font-medium bg-page border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      placeholder="0"
    />
  );
}

export default function ClaimManager(props: Props) {
  return (
    <div className="w-full flex flex-col pb-6">
      <SectionHeader
        title="Claim Items"
        helpText="Use 'Quick Split' above for shared appetizers, or type fractions manually (e.g., '1/2', '1/3', '0.5'). The tracker turns green when an item is mathematically fully claimed."
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-300 ${statusClasses}`}
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
                    className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-subtle transition-colors"
                  >
                    <span
                      className="flex-1 min-w-0 text-[0.95rem] font-medium text-main truncate pr-2"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <ClaimInput
                      initialValue={props.claims[member.id]?.[item.id] || ''}
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
