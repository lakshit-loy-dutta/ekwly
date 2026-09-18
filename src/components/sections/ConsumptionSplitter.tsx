import type { BillItem } from "../../lib/types";
import { utils } from "../../lib/utils";

interface Props {
	items: BillItem[];
	people: string[];
	assignments: Record<string, Record<string, string>>;
	handleUpdateShare: (person: string, itemId: string, value: string) => void;
	handleCalculateSplit: () => void;
}

export default function ConsumptionSplitter(props: Props) {
	return (
		<section className="rounded-2xl p-6 md:p-8 bg-surface shadow-stripe border border-border">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold tracking-tight text-main">
						Consumption Splitter
					</h2>
					<p className="text-sm text-muted mt-1">
						Allocate quantities. Use fractions (1/2) or decimals
						(0.5).
					</p>
				</div>
				<span className="bg-subtle text-muted text-xs font-semibold px-3 py-1 rounded-full border border-border">
					Step 4 of 5
				</span>
			</div>

			{props.items.length > 0 && props.people.length > 0 && (
				<div className="flex flex-wrap gap-3 p-4 bg-subtle rounded-xl border border-border mb-6">
					{props.items.map((item) => {
						let claimed = 0;
						props.people.forEach(
							(p) =>
								(claimed += utils.parseQty(
									props.assignments[p]?.[item.id],
								)),
						);
						let remaining = utils.round2(item.qty - claimed);

						// Fixed: Dark-mode responsive Tailwind colors instead of hardcoded hexes
						let statusClasses =
							"bg-amber-500/15 border-amber-500 border-l-4 text-amber-700 dark:text-amber-400";
						let icon = <circle cx="12" cy="12" r="10" />;

						if (Math.abs(remaining) < 0.01) {
							statusClasses =
								"bg-emerald-500/15 border-emerald-500 border-l-4 text-emerald-700 dark:text-emerald-400";
							remaining = 0;
							icon = (
								<>
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
									<polyline points="22 4 12 14.01 9 11.01" />
								</>
							);
						} else if (remaining < 0) {
							statusClasses =
								"bg-rose-500/15 border-rose-500 border-l-4 text-rose-700 dark:text-rose-400";
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
								className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium shadow-sm transition-colors ${statusClasses}`}>
								<svg
									width="14"
									height="14"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									viewBox="0 0 24 24">
									{icon}
								</svg>
								{item.name}: {remaining} / {item.qty} left
							</div>
						);
					})}
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{props.people.length === 0 || props.items.length === 0 ? (
					<div className="text-center text-muted p-8 border-2 border-dashed border-border rounded-xl col-span-full">
						Add items and participants to begin splitting.
					</div>
				) : (
					props.people.map((person) => (
						<div
							key={person}
							className="flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
							<div className="bg-subtle px-4 py-3 border-b border-border flex items-center gap-2">
								<svg
									className="text-muted"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2">
									<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
									<circle cx="12" cy="7" r="4" />
								</svg>
								<span className="font-semibold text-main">
									{person}
								</span>
							</div>
							<div className="p-2 flex flex-col">
								{props.items.map((item) => (
									<div
										key={item.id}
										className="flex items-center justify-between gap-3 p-2 hover:bg-subtle rounded-md transition-colors">
										{/* Fixed: flex-1 ensures the text takes available space, truncate prevents overflow */}
										<span
											className="flex-1 text-sm font-medium text-main truncate"
											title={item.name}>
											{item.name}
										</span>

										{/* Fixed: !w-20 !h-9 overrides the global CSS width:100% bug */}
										<input
											type="text"
											inputMode="decimal"
											className="!w-20 !h-9 !px-2 flex-shrink-0 text-center text-sm bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
											value={
												props.assignments[person]?.[
													item.id
												] || ""
											}
											onChange={(e) =>
												props.handleUpdateShare(
													person,
													item.id,
													e.target.value,
												)
											}
											placeholder="0"
										/>
									</div>
								))}
							</div>
						</div>
					))
				)}
			</div>

			{/* Fixed: Changed from neon green to Stripe Primary Blurple for consistency */}
			<button
				type="button"
				className="h-[48px] mt-8 w-full bg-primary hover:bg-primary-hover text-white rounded-xl shadow-sm flex items-center justify-center gap-2 font-medium text-[1.05rem] transition-colors"
				onClick={props.handleCalculateSplit}>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5">
					<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
					<path d="M14 2v4a2 2 0 0 0 2 2h4" />
					<path d="M3 15h6" />
					<path d="M3 18h6" />
					<path d="M14 15h.01" />
					<path d="M14 18h.01" />
					<path d="M18 15h.01" />
					<path d="M18 18h.01" />
				</svg>
				Calculate Fair Split
			</button>
		</section>
	);
}
