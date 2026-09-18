import type { CalculationResult } from "../../lib/types";
import { utils } from "../../lib/utils";

interface Props {
	calculationResult: CalculationResult;
	receiptTitle: string;
	setReceiptTitle: (val: string) => void;
	handleExportPDF: () => void;
}

export default function FinalSettlement(props: Props) {
	return (
		<section
			className="rounded-2xl p-6 md:p-8 bg-surface shadow-stripe border border-border"
			id="results">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h2 className="text-xl font-semibold tracking-tight text-main">
						Final Settlement
					</h2>
					<p className="text-sm text-muted mt-1">
						Review the totals and export your receipt.
					</p>
				</div>
				<span className="bg-subtle text-muted text-xs font-semibold px-3 py-1 rounded-full border border-border">
					Step 5 of 5
				</span>
			</div>

			<div className="bg-subtle border border-border rounded-xl p-6 mb-8 shadow-sm">
				<h3 className="text-primary flex items-center gap-2 font-semibold mb-6">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
						<line x1="16" y1="13" x2="8" y2="13" />
						<line x1="16" y1="17" x2="8" y2="17" />
						<polyline points="10 9 9 9 8 9" />
					</svg>
					Master Bill Summary
				</h3>
				<div className="flex flex-col gap-3">
					<div className="flex justify-between text-sm">
						<span className="text-muted">Total Items (Qty)</span>
						<span className="font-semibold text-main">
							{props.calculationResult.globalSummary.totalQty
								.toFixed(2)
								.replace(/\.00$/, "")}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted">Base Subtotal</span>
						<span className="font-semibold text-main">
							{utils.formatMoney(
								props.calculationResult.globalSummary.subTotal,
							)}
						</span>
					</div>
					{Object.entries(
						props.calculationResult.globalSummary.taxBreakdown,
					).map(
						([taxName, amount]) =>
							amount > 0 && (
								<div
									key={taxName}
									className="flex justify-between text-sm">
									<span className="text-muted">
										Total {taxName}
									</span>
									<span className="font-semibold text-main">
										{utils.formatMoney(amount)}
									</span>
								</div>
							),
					)}
					{props.calculationResult.globalSummary.serviceCharge >
						0 && (
						<div className="flex justify-between text-sm">
							<span className="text-muted">
								Total Service Charge
							</span>
							<span className="font-semibold text-main">
								{utils.formatMoney(
									props.calculationResult.globalSummary
										.serviceCharge,
								)}
							</span>
						</div>
					)}
					<div className="flex justify-between pt-4 mt-2 border-t border-border">
						<span className="font-bold text-main text-lg">
							Grand Total
						</span>
						<span className="font-bold text-primary text-lg">
							{utils.formatMoney(
								props.calculationResult.globalSummary
									.grandTotal,
							)}
						</span>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{Object.entries(
					props.calculationResult.individualBreakdowns,
				).map(
					([person, b]) =>
						b.totalOwed > 0 && (
							<div
								key={person}
								className="flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
								<div className="bg-subtle px-4 py-3 border-b border-border">
									<h3 className="font-semibold text-primary m-0">
										{person}
									</h3>
								</div>
								<div className="p-4 flex flex-col gap-3 flex-grow">
									{b.items.map((i, idx) => (
										<div
											key={idx}
											className="flex justify-between text-sm">
											<span className="text-muted">
												{i.name}{" "}
												<span className="text-xs opacity-70">
													x{i.qtyString}
												</span>
											</span>
											<span className="font-semibold text-main">
												{utils.formatMoney(i.cost)}
											</span>
										</div>
									))}
									{b.serviceCharge > 0 && (
										<div className="flex justify-between text-sm pt-3 mt-auto border-t border-border">
											<span className="text-muted">
												Service Charge
											</span>
											<span className="font-semibold text-main">
												{utils.formatMoney(
													b.serviceCharge,
												)}
											</span>
										</div>
									)}
								</div>
								<div className="bg-subtle px-4 py-4 border-t border-border flex justify-between items-center">
									<span className="font-medium text-muted text-sm">
										Owes
									</span>
									<span className="font-bold text-main text-lg">
										{utils.formatMoney(b.totalOwed)}
									</span>
								</div>
							</div>
						),
				)}
			</div>

			<div className="mt-8 rounded-xl bg-subtle p-6 border border-border flex flex-col md:flex-row md:items-end gap-4 shadow-sm">
				<div className="flex-1 flex flex-col gap-1.5">
					<label className="text-sm font-medium text-main">
						Document Title (Optional)
					</label>
					<input
						type="text"
						value={props.receiptTitle}
						onChange={(e) => props.setReceiptTitle(e.target.value)}
						placeholder="e.g., Friday Dinner at Taj"
					/>
				</div>
				<button
					type="button"
					className="h-[44px] px-6 bg-surface hover:bg-subtle text-main border border-border rounded-md shadow-sm flex items-center justify-center gap-2 font-medium text-sm transition-colors"
					onClick={props.handleExportPDF}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" x2="12" y1="15" y2="3" />
					</svg>
					Export PDF
				</button>
			</div>
		</section>
	);
}
