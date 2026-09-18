import type { BillItem } from "../../lib/types";

interface Props {
	items: BillItem[];
	people: string[];
	qsItemId: string;
	setQsItemId: (val: string) => void;
	qsSelectedPeople: string[];
	toggleQsPerson: (name: string) => void;
	handleApplyQuickSplit: () => void;
}

export default function QuickSplit(props: Props) {
	return (
		<section className="rounded-2xl p-6 md:p-8 bg-subtle border border-border">
			<div className="flex items-center gap-3 mb-6">
				<span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5">
						<path d="m13 2-2 2.5h3L11 12" />
						<path d="M21 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				</span>
				<div>
					<h2 className="text-lg font-semibold tracking-tight text-main">
						Quick Split
					</h2>
					<p className="text-sm text-muted">
						Select an item and tap the participants who shared it to
						divide equally.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 md:gap-6 md:items-end p-5 bg-surface rounded-xl border border-border shadow-sm">
				<div className="flex flex-col gap-1.5">
					<label className="text-sm font-medium text-main">
						1. Select Item
					</label>
					<div className="relative">
						<select
							className="pl-3 pr-8 appearance-none"
							value={props.qsItemId}
							onChange={(e) => props.setQsItemId(e.target.value)}>
							<option value="" disabled>
								Select...
							</option>
							{props.items.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} (Qty: {item.qty})
								</option>
							))}
						</select>
						<div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-muted">
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round">
								<path d="m6 9 6 6 6-6" />
							</svg>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className="text-sm font-medium text-main">
						2. Select Participants
					</label>
					<div className="flex flex-wrap gap-2 pt-1.5">
						{props.people.map((p) => {
							const isActive = props.qsSelectedPeople.includes(p);
							return (
								<button
									key={p}
									type="button"
									className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border shadow-sm ${isActive ? "bg-primary text-white border-primary" : "bg-surface text-main border-border hover:border-primary"}`}
									onClick={() => props.toggleQsPerson(p)}>
									{p}
								</button>
							);
						})}
					</div>
				</div>

				<div>
					<button
						type="button"
						className="h-[44px] w-full md:w-auto px-6 bg-primary hover:bg-primary-hover text-white rounded-md shadow-sm font-medium text-sm transition-colors"
						onClick={props.handleApplyQuickSplit}>
						Apply Split
					</button>
				</div>
			</div>
		</section>
	);
}
