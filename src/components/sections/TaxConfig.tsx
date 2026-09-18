import type { TaxPreset } from "../../lib/types";

interface Props {
	isScApplicable: boolean;
	handleToggleSc: (val: boolean) => void;
	serviceChargeRate: number;
	setServiceChargeRate: (val: number) => void;
	scTaxPresetId: string;
	setScTaxPresetId: (val: string) => void;
	taxPresets: TaxPreset[];
	newTaxName: string;
	setNewTaxName: (val: string) => void;
	newTaxRate: string;
	setNewTaxRate: (val: string) => void;
	newTaxSplit: boolean;
	setNewTaxSplit: (val: boolean) => void;
	handleAddTaxPreset: () => void;
	handleRemoveTaxPreset: (id: string) => void;
}

export default function TaxConfig(props: Props) {
	return (
		<section className="rounded-2xl p-6 md:p-8 bg-surface shadow-stripe border border-border">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold tracking-tight text-main">
						Taxes & Fees
					</h2>
					<p className="text-sm text-muted mt-1">
						Configure global rates and service charges.
					</p>
				</div>
				<span className="bg-subtle text-muted text-xs font-semibold px-3 py-1 rounded-full border border-border">
					Step 1 of 5
				</span>
			</div>

			<div className="flex flex-col lg:flex-row gap-8 lg:items-start">
				{/* Service Charge Box */}
				<div className="w-full lg:w-56 shrink-0 flex flex-col p-4 bg-subtle rounded-xl border border-border">
					<label className="flex items-center gap-3 cursor-pointer">
						<div className="toggle-switch">
							<input
								type="checkbox"
								checked={props.isScApplicable}
								onChange={(e) =>
									props.handleToggleSc(e.target.checked)
								}
							/>
							<span className="slider"></span>
						</div>
						<span className="text-sm font-medium text-main">
							Service Charge
						</span>
					</label>

					{props.isScApplicable && (
						<div className="flex flex-col gap-4 mt-4 pt-4 border-t border-border">
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-main">
									Rate (%)
								</label>
								<input
									type="number"
									value={
										props.serviceChargeRate > 0
											? props.serviceChargeRate * 100
											: ""
									}
									placeholder="0"
									min="0"
									step="0.1"
									onChange={(e) =>
										props.setServiceChargeRate(
											(parseFloat(e.target.value) || 0) /
												100,
										)
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-main">
									Tax on S.C.
								</label>
								<div className="relative">
									<select
										className="pl-3 pr-8 appearance-none"
										value={props.scTaxPresetId}
										onChange={(e) =>
											props.setScTaxPresetId(
												e.target.value,
											)
										}>
										<option value="none">None</option>
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
						</div>
					)}
				</div>

				{/* Tax Presets Box */}
				<div className="flex-1 flex flex-col gap-6">
					<div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto_auto] gap-4 items-end bg-subtle p-4 rounded-xl border border-border">
						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-medium text-main">
								Add Tax Preset
							</label>
							<input
								type="text"
								value={props.newTaxName}
								onChange={(e) =>
									props.setNewTaxName(e.target.value)
								}
								placeholder="Name (e.g. Food GST)"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label className="text-sm font-medium text-main">
								Total (%)
							</label>
							<input
								type="number"
								value={props.newTaxRate}
								onChange={(e) =>
									props.setNewTaxRate(e.target.value)
								}
								placeholder="0"
								min="0"
								step="0.1"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label
								className="invisible pointer-events-none select-none text-xs"
								aria-hidden="true">
								Spacer
							</label>
							<label
								className="toggle-label"
								title="Splits percentage into CGST & SGST">
								<span className="font-medium text-sm text-main">
									Split
								</span>
								<div className="toggle-switch">
									<input
										type="checkbox"
										checked={props.newTaxSplit}
										onChange={(e) =>
											props.setNewTaxSplit(
												e.target.checked,
											)
										}
									/>
									<span className="slider"></span>
								</div>
							</label>
						</div>
						<div className="flex flex-col gap-1.5">
							<button
								type="button"
								className="h-[44px] px-6 bg-primary hover:bg-primary-hover text-white border border-transparent rounded-md shadow-sm font-medium text-sm transition-colors"
								onClick={props.handleAddTaxPreset}>
								Add
							</button>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-muted mb-3">
							Active Presets:
						</label>
						<div className="flex flex-wrap gap-2.5">
							{props.taxPresets.map((t) => (
								<div
									key={t.id}
									className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-full text-sm font-medium text-main shadow-sm">
									<span>
										{t.name}{" "}
										<span className="text-muted ml-1">
											({t.rate}%)
										</span>
									</span>
									{t.split && (
										<span className="bg-page text-muted px-1.5 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider">
											Split
										</span>
									)}
									<button
										type="button"
										className="text-muted hover:text-danger flex items-center justify-center p-0.5 rounded-full hover:bg-danger-light transition-colors"
										onClick={() =>
											props.handleRemoveTaxPreset(t.id)
										}>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.5">
											<path d="M18 6 6 18" />
											<path d="m6 6 12 12" />
										</svg>
									</button>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
