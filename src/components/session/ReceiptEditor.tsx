import type { BillItem, TaxPreset } from "../../lib/types";
import { utils } from "../../lib/utils";
import { Edit2, Trash2, ChevronDown } from "lucide-react";

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

export default function ReceiptEditor(props: Props) {
	return (
		<div className="w-full flex flex-col">
			<div className="bg-surface border-y border-border px-4 py-5 flex flex-col gap-4">
				<input
					type="text"
					value={props.newItemName}
					onChange={(e) => props.setNewItemName(e.target.value)}
					placeholder="Item Name (e.g. Spicy Tuna Roll)"
					className="text-lg font-medium border-0 border-b border-border rounded-none shadow-none px-0 pb-2 focus:ring-0 focus:border-primary h-auto bg-transparent"
				/>

				<div className="flex gap-4">
					<div className="flex-1">
						<label className="text-[0.7rem] font-bold text-muted uppercase tracking-wide mb-1 block">
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
					<div className="flex-1">
						<label className="text-[0.7rem] font-bold text-muted uppercase tracking-wide mb-1 block">
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
				</div>

				<div className="flex flex-col gap-4 pt-2">
					<div className="flex items-center justify-between">
						<div className="relative flex-1 max-w-[200px]">
							<select
								className="w-full h-10 py-0 pl-3 pr-8 text-sm bg-subtle border border-border rounded-lg appearance-none font-medium text-main focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
								<ChevronDown size={16} />
							</div>
						</div>
						<button
							type="button"
							className="h-10 px-6 bg-primary text-white rounded-lg font-medium text-sm ml-4 shadow-sm"
							onClick={props.handleSaveItem}>
							{props.editingItemId ? "Update Item" : "Add Item"}
						</button>
					</div>

					{props.serviceChargeRate > 0 && (
						<label className="flex items-center gap-3 cursor-pointer bg-page p-3 rounded-lg border border-border">
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
							<span className="text-sm font-medium text-main">
								Apply Global Service Charge to this item
							</span>
						</label>
					)}
				</div>
			</div>

			<div className="px-4 py-3">
				<h3 className="text-xs font-bold text-muted uppercase tracking-widest">
					Added Items ({props.items.length})
				</h3>
			</div>

			<div className="bg-surface border-y border-border divide-y divide-border">
				{props.items.length === 0 ? (
					<div className="p-8 text-center text-muted text-sm">
						No items added yet.
					</div>
				) : (
					props.items.map((item) => {
						const itemTaxAmount = item.totalBase * item.taxRate;
						const itemSC = item.applySC
							? item.totalBase * props.serviceChargeRate
							: 0;
						const finalItemTotal =
							item.totalBase + itemTaxAmount + itemSC;
						const taxPreset = props.taxPresets.find(
							(t) => t.id === item.taxPresetId,
						);
						const taxName = taxPreset
							? `${taxPreset.name} (${taxPreset.rate}%)`
							: "Custom Tax";

						return (
							<div
								key={item.id}
								className="flex items-center justify-between p-4">
								<div className="flex flex-col min-w-0 pr-4">
									<div className="flex items-center gap-2">
										<span className="font-semibold text-main text-[0.95rem] truncate">
											{item.name}
										</span>
										<span className="text-[0.7rem] font-bold text-muted bg-page px-1.5 py-0.5 rounded border border-border flex-shrink-0">
											x{item.qty}
										</span>
									</div>
									<div className="flex items-center gap-2 text-xs text-muted mt-1 truncate">
										<span>
											{utils.formatMoney(item.unitPrice)}
										</span>
										<span>•</span>
										<span className="truncate">
											{taxName}
										</span>
										{item.applySC &&
											props.serviceChargeRate > 0 && (
												<>
													<span>•</span>
													<span className="text-primary font-bold">
														+ S.C.
													</span>
												</>
											)}
									</div>
								</div>

								<div className="flex items-center gap-4 flex-shrink-0">
									<span className="font-bold text-main">
										{utils.formatMoney(finalItemTotal)}
									</span>
									<div className="flex items-center gap-3 border-l border-border pl-3">
										<button
											onClick={() =>
												props.handleEditItem(item.id)
											}
											className="text-muted active:text-primary">
											<Edit2 size={18} />
										</button>
										<button
											onClick={() =>
												props.handleRemoveItem(item.id)
											}
											className="text-muted active:text-danger">
											<Trash2 size={18} />
										</button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
