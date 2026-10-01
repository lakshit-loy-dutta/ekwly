import type { CalculationResult } from "../../lib/types";
import { utils } from "../../lib/utils";
import { DownloadCloud } from "lucide-react";

interface Props {
	calculationResult: CalculationResult;
	receiptTitle: string;
	setReceiptTitle: (val: string) => void;
	handleExportPDF: () => void;
}

export default function DebtMatrix(props: Props) {
	return (
		<div className="w-full flex flex-col">
			<div className="px-4 py-2">
				<h3 className="text-xs font-bold text-muted uppercase tracking-widest">
					Master Bill Summary
				</h3>
			</div>

			<div className="bg-surface border-y border-border px-4 py-3 flex flex-col divide-y divide-border/50">
				<div className="flex justify-between py-2.5 text-[0.95rem]">
					<span className="text-muted">Total Items</span>
					<span className="font-semibold text-main">
						{props.calculationResult.globalSummary.totalQty.toFixed(2).replace(/\.00$/, "")}
					</span>
				</div>

				{/* Pre-Tax Discount Rendering */}
				{props.calculationResult.globalSummary.discountAmount > 0 &&
					props.calculationResult.globalSummary.discountMode === "pre-tax" && (
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

				{/* Post-Tax Discount Rendering */}
				{props.calculationResult.globalSummary.discountAmount > 0 &&
					props.calculationResult.globalSummary.discountMode === "post-tax" && (
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
			<div className="px-4 py-3 mt-4">
				<h3 className="text-xs font-bold text-muted uppercase tracking-widest">Individual Debt</h3>
			</div>

			<div className="flex flex-col gap-6">
				{Object.entries(props.calculationResult.individualBreakdowns).map(
					([person, b]) =>
						b.totalOwed > 0 && (
							<div key={person} className="bg-surface border-y border-border flex flex-col">
								<div className="px-4 py-3 border-b border-border bg-page/50">
									<h3 className="font-bold text-main text-base">{person}</h3>
								</div>
								<div className="flex flex-col divide-y divide-border/50 px-4">
									{b.items.map((i, idx) => (
										<div key={idx} className="flex justify-between py-3 text-[0.95rem]">
											<span className="text-muted">
												{i.name}{" "}
												<span className="text-xs font-bold ml-1 bg-page px-1 rounded border border-border">
													x{i.qtyString}
												</span>
											</span>
											<span className="font-semibold text-main">{utils.formatMoney(i.cost)}</span>
										</div>
									))}
									{b.serviceCharge > 0 && (
										<div className="flex justify-between py-3 text-[0.95rem]">
											<span className="text-muted">Service Charge</span>
											<span className="font-semibold text-main">
												{utils.formatMoney(b.serviceCharge)}
											</span>
										</div>
									)}
								</div>
								<div className="px-4 py-4 border-t border-border flex justify-between items-center bg-primary/5">
									<span className="font-bold text-primary text-[0.95rem] uppercase tracking-wider">
										Owes
									</span>
									<span className="font-bold text-primary text-xl">
										{utils.formatMoney(b.totalOwed)}
									</span>
								</div>
							</div>
						)
				)}
			</div>

			{/* PDF Export Action Block */}
			<div className="px-4 mt-8 mb-8">
				<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-4">
					<input
						type="text"
						value={props.receiptTitle}
						onChange={(e) => props.setReceiptTitle(e.target.value)}
						placeholder="Document Title (e.g. Friday Dinner)"
						className="w-full h-11 px-3 text-sm bg-page border border-border rounded-lg"
					/>
					<button
						type="button"
						className="h-11 w-full bg-subtle active:bg-border text-main border border-border rounded-lg font-medium text-[0.95rem] flex items-center justify-center gap-2 transition-colors"
						onClick={props.handleExportPDF}>
						<DownloadCloud size={20} />
						Export to PDF
					</button>
				</div>
			</div>
		</div>
	);
}
