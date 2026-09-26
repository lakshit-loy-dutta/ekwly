import { SplitSquareVertical, ChevronDown } from "lucide-react";
import type { BillItem } from "../../lib/types";
import type { DBMember } from "../../lib/useSession";

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
		<div className="w-full bg-surface border-b border-border px-4 py-5 mb-4 shadow-sm">
			<div className="flex items-center gap-2 mb-4">
				<SplitSquareVertical size={18} className="text-primary" />
				<h3 className="text-[0.95rem] font-bold text-main tracking-tight">Quick Split Action</h3>
			</div>

			<div className="flex flex-col gap-5">
				<div>
					<label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">
						1. Select Item
					</label>
					<div className="relative">
						<select
							className="w-full h-11 pl-3 pr-8 text-[0.95rem] bg-page border border-border rounded-xl appearance-none font-medium text-main focus:ring-2 focus:ring-primary/20 focus:border-primary"
							value={props.qsItemId}
							onChange={(e) => props.setQsItemId(e.target.value)}>
							<option value="" disabled>
								Select an item...
							</option>
							{props.items.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} (Qty: {item.qty})
								</option>
							))}
						</select>
						<div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted">
							<ChevronDown size={18} />
						</div>
					</div>
				</div>

				<div>
					<label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">
						2. Tap Members to Share
					</label>
					<div className="flex flex-wrap gap-2">
						{props.members.map((m) => {
							const isActive = props.qsSelectedMembers.includes(m.id);
							return (
								<button
									key={m.id}
									type="button"
									className={`px-4 py-2 rounded-full text-[0.95rem] font-medium transition-colors border ${isActive ? "bg-primary text-white border-primary shadow-sm" : "bg-page text-main border-border"}`}
									onClick={() => props.toggleQsMember(m.id)}>
									{m.name}
								</button>
							);
						})}
					</div>
				</div>

				<button
					type="button"
					className="h-11 mt-1 w-full bg-main active:bg-main/80 text-surface rounded-xl font-medium text-[0.95rem] transition-colors shadow-sm"
					onClick={props.handleApplyQuickSplit}>
					Apply Even Split
				</button>
			</div>
		</div>
	);
}
