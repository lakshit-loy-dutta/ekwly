import type { BillItem, TaxPreset } from "../../lib/types";
import { utils } from "../../lib/utils";

interface Props {
	items: BillItem[];
	taxPresets: TaxPreset[];
	serviceChargeRate: number;
	scTaxPresetId: string;
	newItemName: string;
	setNewItemName: (val: string) => void;
	newItemQty: number;
	setNewItemQty: (val: number) => void;
	newItemPrice: string;
	setNewItemPrice: (val: string) => void;
	newItemTaxId: string;
	setNewItemTaxId: (val: string) => void;
	newItemApplySC: boolean;
	setNewItemApplySC: (val: boolean) => void;
	editingItemId: string | null;
	handleSaveItem: () => void;
	handleEditItem: (id: string) => void;
	handleRemoveItem: (id: string) => void;
}

export default function LineItems(props: Props) {
	return (
		<section
			id="items-section"
			className="rounded-2xl p-6 md:p-8 bg-surface shadow-stripe border border-border">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold tracking-tight text-main">
						Add Receipt Items
					</h2>
					<p className="text-sm text-muted mt-1">
						Enter the items exactly as they appear on your bill.
					</p>
				</div>
				<span className="bg-subtle text-muted text-xs font-semibold px-3 py-1 rounded-full border border-border">
					Step 2 of 5
				</span>
			</div>

			<div className="p-5 bg-subtle rounded-xl border border-border mb-6">
				<div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
					<div className="md:col-span-5 flex flex-col gap-1.5">
						<label className="text-sm font-medium text-main">
							Item Name
						</label>
						<input
							type="text"
							value={props.newItemName}
							onChange={(e) =>
								props.setNewItemName(e.target.value)
							}
							placeholder="e.g., Spicy Tuna Roll"
						/>
					</div>

					<div className="md:col-span-2 flex flex-col gap-1.5">
						<label className="text-sm font-medium text-main">
							Qty
						</label>
						<input
							type="number"
							value={props.newItemQty}
							onChange={(e) =>
								props.setNewItemQty(parseFloat(e.target.value))
							}
							min="0.01"
							step="0.01"
						/>
					</div>

					<div className="md:col-span-3 flex flex-col gap-1.5">
						<label className="text-sm font-medium text-main">
							Price (₹)
						</label>
						<input
							type="number"
							value={props.newItemPrice}
							onChange={(e) =>
								props.setNewItemPrice(e.target.value)
							}
							placeholder="0.00"
							min="0"
							step="0.01"
						/>
					</div>

					<div className="md:col-span-2 flex gap-2">
						<button
							type="button"
							className="h-[44px] w-full bg-primary hover:bg-primary-hover text-white rounded-md shadow-sm flex items-center justify-center gap-2"
							onClick={props.handleSaveItem}>
							{props.editingItemId ? (
								<span className="font-medium text-sm">
									Update
								</span>
							) : (
								<>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5">
										<path d="M5 12h14" />
										<path d="M12 5v14" />
									</svg>{" "}
									<span className="font-medium text-sm">
										Add
									</span>
								</>
							)}
						</button>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-5 mt-4 pt-4 border-t border-border/50">
					<div className="flex items-center gap-3">
						<label className="text-sm font-medium text-muted">
							Tax:
						</label>
						<div className="relative">
							<select
								className="h-[36px] py-0 pl-3 pr-8 text-sm bg-surface border border-border rounded-md focus:ring-2 focus:ring-primary-light focus:border-primary shadow-sm appearance-none min-w-[140px]"
								value={props.newItemTaxId}
								onChange={(e) =>
									props.setNewItemTaxId(e.target.value)
								}>
								{props.taxPresets.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name} ({t.rate}%)
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

					{props.serviceChargeRate > 0 && (
						<>
							<div className="w-px h-5 bg-border hidden sm:block"></div>
							<label className="flex items-center gap-3 cursor-pointer">
								<span className="text-sm font-medium text-muted">
									Apply Service Charge
								</span>
								<div className="toggle-switch">
									<input
										type="checkbox"
										checked={props.newItemApplySC}
										onChange={(e) =>
											props.setNewItemApplySC(
												e.target.checked,
											)
										}
									/>
									<span className="slider"></span>
								</div>
							</label>
						</>
					)}
				</div>
			</div>

			<div className="flex flex-col">
				{props.items.length === 0 ? (
					<div className="text-center p-8 border-2 border-dashed border-border rounded-xl">
						<p className="text-muted text-sm">
							No items added to the bill yet.
						</p>
					</div>
				) : (
					props.items.map((item, index) => {
						const itemTaxAmount = item.totalBase * item.taxRate;
						const itemSC = item.applySC
							? item.totalBase * props.serviceChargeRate
							: 0;
						const scTaxPreset = props.taxPresets.find(
							(t) => t.id === props.scTaxPresetId,
						);
						const itemSCTaxAmount =
							scTaxPreset && itemSC > 0
								? itemSC * (scTaxPreset.rate / 100)
								: 0;
						const finalItemTotal =
							item.totalBase +
							itemTaxAmount +
							itemSC +
							itemSCTaxAmount;

						const itemPreset = props.taxPresets.find(
							(t) => t.id === item.taxPresetId,
						);
						const taxName = itemPreset
							? itemPreset.name
							: "Custom Tax";

						return (
							<div
								key={item.id}
								className={`flex items-center justify-between py-4 ${index !== props.items.length - 1 ? "border-b border-border" : ""}`}>
								<div className="flex flex-col gap-1.5">
									<div className="flex items-center gap-2">
										<span className="font-medium text-main">
											{item.name}
										</span>
										<span className="text-xs font-semibold text-muted bg-subtle px-2 py-0.5 rounded-md border border-border">
											x{item.qty}
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider">
										<span className="text-muted bg-subtle px-2 py-0.5 rounded border border-border/50">
											{utils.formatMoney(item.unitPrice)}{" "}
											ea
										</span>
										<span className="text-muted bg-subtle px-2 py-0.5 rounded border border-border/50">
											{taxName} (
											{(item.taxRate * 100)
												.toFixed(1)
												.replace(/\.0$/, "")}
											%)
										</span>
										{item.applySC &&
											props.serviceChargeRate > 0 && (
												<span className="text-primary bg-primary-light px-2 py-0.5 rounded border border-primary/20">
													+ S.C.
												</span>
											)}
									</div>
								</div>

								<div className="flex items-center gap-4">
									<span className="font-semibold text-main tracking-tight">
										{utils.formatMoney(finalItemTotal)}
									</span>
									<div className="flex items-center gap-1">
										<button
											type="button"
											className="p-2 text-muted hover:text-primary transition-colors rounded-md hover:bg-primary-light"
											onClick={() =>
												props.handleEditItem(item.id)
											}
											title="Edit">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2">
												<path d="M12 20h9" />
												<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
											</svg>
										</button>
										<button
											type="button"
											className="p-2 text-muted hover:text-danger transition-colors rounded-md hover:bg-danger-light"
											onClick={() =>
												props.handleRemoveItem(item.id)
											}
											title="Remove">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2">
												<path d="M3 6h18" />
												<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
												<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</section>
	);
}
