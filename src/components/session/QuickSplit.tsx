import { SplitSquareVertical } from 'lucide-react';
import type { BillItem } from '../../lib/types';
import type { DBMember } from '../../lib/useSession';

interface Props {
  items: BillItem[];
  members: DBMember[];
  qsItemId: string;
  setQsItemId: (val: string) => void;
  qsSelectedMembers: string[];
  toggleQsMember: (id: string) => void;
  handleApplyQuickSplit: () => void;
}

export default function QuickSplit(props: Props) {
  return (
    <div className="w-full bg-surface border-b border-border px-4 py-6 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <SplitSquareVertical size={20} className="text-primary" />
        <h3 className="text-[1rem] font-bold text-main tracking-tight">Quick Split</h3>
      </div>

      <div className="flex flex-col gap-7">
        {/* 1. Item Selection (Horizontal Tap Targets instead of Dropdown) */}
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-widest mb-3 block">
            1. Tap Item to Split
          </label>
          <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar -mx-4 px-4 snap-x">
            {props.items.map((item) => {
              const isSelected = props.qsItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => props.setQsItemId(item.id)}
                  className={`shrink-0 px-4 py-3 rounded-xl border text-sm font-semibold transition-all snap-start ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md scale-105'
                      : 'bg-page text-muted border-border active:border-primary/50'
                  }`}
                >
                  {item.name} <span className="opacity-75 text-xs ml-1 font-bold">x{item.qty}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Member Selection (Chip Grid) */}
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-widest mb-3 block">
            2. Tap Members to Share
          </label>
          <div className="flex flex-wrap gap-2.5">
            {props.members.map((m) => {
              const isActive = props.qsSelectedMembers.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-page text-muted border-border active:border-primary/50'
                  }`}
                  onClick={() => props.toggleQsMember(m.id)}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply Action */}
        <button
          type="button"
          disabled={!props.qsItemId || props.qsSelectedMembers.length === 0}
          className="h-12 mt-2 w-full bg-main disabled:bg-border disabled:text-muted active:bg-main/80 text-surface rounded-xl font-bold text-[0.95rem] transition-colors shadow-sm"
          onClick={props.handleApplyQuickSplit}
        >
          Apply Even Split
        </button>
      </div>
    </div>
  );
}
