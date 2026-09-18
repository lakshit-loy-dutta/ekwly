import { useState } from "react";
import type {
	TaxPreset,
	BillItem,
	IndividualBreakdown,
	GlobalSummary,
	CalculationResult,
} from "../lib/types";
import { utils, showToast } from "../lib/utils";
import { exportToPDF } from "../lib/pdf";

// Section Components
import TaxConfig from "./sections/TaxConfig";
import LineItems from "./sections/LineItems";
import Participants from "./sections/Participants";
import QuickSplit from "./sections/QuickSplit";
import ConsumptionSplitter from "./sections/ConsumptionSplitter";
import FinalSettlement from "./sections/FinalSettlement";

export default function SettlementEngine() {
	// --- 1. CORE STATE ---
	const [items, setItems] = useState<BillItem[]>([]);
	const [people, setPeople] = useState<string[]>([]);
	const [assignments, setAssignments] = useState<
		Record<string, Record<string, string>>
	>({});

	const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
	const [scTaxPresetId, setScTaxPresetId] = useState<string>("none");
	const [isScApplicable, setIsScApplicable] = useState<boolean>(false);
	const handleToggleSc = (checked: boolean) => {
		setIsScApplicable(checked);
		if (!checked) {
			setServiceChargeRate(0);
			setScTaxPresetId("none");
			// Optionally reset item-level toggles here, but mathematically rate=0 handles it
		}
	};
	const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([
		{ id: "tx-1", name: "Food GST", rate: 5, split: true },
		{ id: "tx-2", name: "Alcohol VAT", rate: 6, split: false },
		{ id: "tx-3", name: "Tobacco Cess", rate: 40, split: false },
		{ id: "tx-4", name: "Exempt", rate: 0, split: false },
	]);

	const [calculationResult, setCalculationResult] =
		useState<CalculationResult | null>(null);
	const [receiptTitle, setReceiptTitle] = useState<string>("");

	// --- 2. FORM STATES ---
	const [newTaxName, setNewTaxName] = useState<string>("");
	const [newTaxRate, setNewTaxRate] = useState<string>("");
	const [newTaxSplit, setNewTaxSplit] = useState<boolean>(true);

	const [newItemName, setNewItemName] = useState<string>("");
	const [newItemQty, setNewItemQty] = useState<number>(1);
	const [newItemPrice, setNewItemPrice] = useState<string>("");
	const [newItemTaxId, setNewItemTaxId] = useState<string>("tx-1");
	const [newItemApplySC, setNewItemApplySC] = useState<boolean>(true);
	const [editingItemId, setEditingItemId] = useState<string | null>(null);

	const [newPersonName, setNewPersonName] = useState<string>("");

	const [qsItemId, setQsItemId] = useState<string>("");
	const [qsSelectedPeople, setQsSelectedPeople] = useState<string[]>([]);

	// --- 3. ACTION HANDLERS ---
	const handleAddTaxPreset = () => {
		const rate = parseFloat(newTaxRate);
		if (!newTaxName.trim())
			return showToast("Preset name is required.", "error");
		if (isNaN(rate) || rate < 0)
			return showToast("Valid tax rate is required.", "error");
		setTaxPresets([
			...taxPresets,
			{
				id: utils.generateId(),
				name: newTaxName.trim(),
				rate,
				split: newTaxSplit,
			},
		]);
		setNewTaxName("");
		setNewTaxRate("");
		setNewTaxSplit(true);
		showToast(`Added ${newTaxName.trim()} preset.`, "success");
	};

	const handleRemoveTaxPreset = (id: string) => {
		if (taxPresets.length <= 1)
			return showToast("You must have at least one tax preset.", "error");
		setTaxPresets(taxPresets.filter((t) => t.id !== id));
		if (scTaxPresetId === id) setScTaxPresetId("none");
	};

	const handleSaveItem = () => {
		const priceParsed = parseFloat(newItemPrice);
		if (
			!newItemName.trim() ||
			newItemQty <= 0 ||
			isNaN(priceParsed) ||
			priceParsed < 0
		) {
			return showToast(
				"Please fill in all item fields correctly.",
				"error",
			);
		}

		const preset = taxPresets.find((t) => t.id === newItemTaxId);
		const taxRate = preset ? preset.rate / 100 : 0;
		const totalBase = newItemQty * priceParsed;

		if (editingItemId) {
			setItems(
				items.map((item) =>
					item.id === editingItemId
						? {
								...item,
								name: newItemName.trim(),
								qty: newItemQty,
								unitPrice: priceParsed,
								taxRate,
								taxPresetId: newItemTaxId,
								applySC: newItemApplySC,
								totalBase,
							}
						: item,
				),
			);
			setEditingItemId(null);
			showToast(`${newItemName.trim()} updated successfully.`, "success");
		} else {
			const newItem: BillItem = {
				id: utils.generateId(),
				name: newItemName.trim(),
				qty: newItemQty,
				unitPrice: priceParsed,
				taxRate,
				taxPresetId: newItemTaxId,
				applySC: newItemApplySC,
				totalBase,
			};
			setItems([...items, newItem]);
			if (!qsItemId) setQsItemId(newItem.id);
			showToast(`${newItem.name} added to bill.`, "success");
		}

		setNewItemName("");
		setNewItemQty(1);
		setNewItemPrice("");
	};

	const handleEditItem = (id: string) => {
		const item = items.find((i) => i.id === id);
		if (!item) return;
		setNewItemName(item.name);
		setNewItemQty(item.qty);
		setNewItemPrice(item.unitPrice.toString());
		setNewItemTaxId(item.taxPresetId);
		setNewItemApplySC(item.applySC);
		setEditingItemId(id);
		document
			.getElementById("items-section")
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const handleRemoveItem = (id: string) => {
		setItems(items.filter((item) => item.id !== id));
		if (qsItemId === id) setQsItemId("");
	};

	const handleAddPerson = () => {
		const name = newPersonName.trim();
		if (!name)
			return showToast("Participant name cannot be empty.", "error");
		if (people.includes(name))
			return showToast("Name must be unique.", "error");
		setPeople([...people, name]);
		setAssignments((prev) => ({ ...prev, [name]: {} }));
		setNewPersonName("");
	};

	const handleRemovePerson = (name: string) => {
		setPeople(people.filter((p) => p !== name));
		setQsSelectedPeople(qsSelectedPeople.filter((p) => p !== name));
		const newAssign = { ...assignments };
		delete newAssign[name];
		setAssignments(newAssign);
	};

	const handleUpdateShare = (
		person: string,
		itemId: string,
		value: string,
	) => {
		setAssignments((prev) => ({
			...prev,
			[person]: { ...prev[person], [itemId]: value.trim() },
		}));
	};

	const toggleQsPerson = (name: string) => {
		setQsSelectedPeople((prev) =>
			prev.includes(name)
				? prev.filter((p) => p !== name)
				: [...prev, name],
		);
	};

	const handleApplyQuickSplit = () => {
		const item = items.find((i) => i.id === qsItemId);
		if (!item) return;
		if (qsSelectedPeople.length === 0)
			return showToast("Select at least one participant.", "error");
		const fractionString = utils.getFractionString(
			item.qty,
			qsSelectedPeople.length,
		);
		setAssignments((prev) => {
			const newAssign = { ...prev };
			people.forEach((p) => {
				newAssign[p] = { ...newAssign[p], [item.id]: "" };
			});
			qsSelectedPeople.forEach((p) => {
				newAssign[p][item.id] = fractionString;
			});
			return newAssign;
		});
		setQsSelectedPeople([]);
		showToast(
			`Divided ${item.name} evenly among ${qsSelectedPeople.length} people.`,
			"success",
		);
	};

	const handleCalculateSplit = () => {
		if (items.length === 0 || people.length === 0)
			return showToast(
				"Need items and participants to calculate.",
				"error",
			);
		let warnings: string[] = [];
		items.forEach((item) => {
			let claimed = 0;
			people.forEach(
				(p) => (claimed += utils.parseQty(assignments[p]?.[item.id])),
			);
			let diff = utils.round2(item.qty - claimed);
			if (diff > 0.01)
				warnings.push(`'${item.name}' has ${diff} unassigned.`);
			if (diff < -0.01)
				warnings.push(
					`'${item.name}' is over-assigned by ${Math.abs(diff)}.`,
				);
		});
		if (warnings.length > 0) {
			const proceed = confirm(
				"Math Warning:\n" +
					warnings.join("\n") +
					"\n\nDo you want to force calculation anyway?",
			);
			if (!proceed) return;
		}

		let globalSummary: GlobalSummary = {
			totalQty: 0,
			subTotal: 0,
			taxBreakdown: {},
			serviceCharge: 0,
			grandTotal: 0,
		};
		const scTaxPreset = taxPresets.find((t) => t.id === scTaxPresetId);

		const addTaxToBreakdown = (
			preset: TaxPreset | undefined,
			amount: number,
			fallbackName: string,
		) => {
			if (amount <= 0) return;
			if (preset) {
				if (preset.split) {
					const names = utils.getSplitNames(preset.name);
					globalSummary.taxBreakdown[names.cgst] =
						(globalSummary.taxBreakdown[names.cgst] || 0) +
						amount / 2;
					globalSummary.taxBreakdown[names.sgst] =
						(globalSummary.taxBreakdown[names.sgst] || 0) +
						amount / 2;
				} else {
					globalSummary.taxBreakdown[preset.name] =
						(globalSummary.taxBreakdown[preset.name] || 0) + amount;
				}
			} else {
				globalSummary.taxBreakdown[fallbackName] =
					(globalSummary.taxBreakdown[fallbackName] || 0) + amount;
			}
		};

		items.forEach((item) => {
			const itemTaxAmount = item.totalBase * item.taxRate;
			const itemSC = item.applySC
				? item.totalBase * serviceChargeRate
				: 0;
			const itemSCTaxAmount =
				scTaxPreset && itemSC > 0
					? itemSC * (scTaxPreset.rate / 100)
					: 0;
			globalSummary.totalQty += item.qty;
			globalSummary.subTotal += item.totalBase;
			globalSummary.serviceCharge += itemSC;
			addTaxToBreakdown(
				taxPresets.find((t) => t.id === item.taxPresetId),
				itemTaxAmount,
				"Other Tax",
			);
			addTaxToBreakdown(scTaxPreset, itemSCTaxAmount, "S.C. Tax");
		});

		const individualBreakdowns: Record<string, IndividualBreakdown> = {};
		let calcGrandTotal = 0;

		people.forEach((person) => {
			let subtotal = 0;
			let totalScAmount = 0;
			let consumedItems: {
				name: string;
				qtyString: string;
				cost: number;
			}[] = [];
			items.forEach((item) => {
				const consumedQtyString = assignments[person]?.[item.id] || "";
				const consumedQty = utils.parseQty(consumedQtyString);
				if (consumedQty > 0) {
					const proportion = consumedQty / item.qty;
					const baseShare = proportion * item.totalBase;
					const itemTaxShare = baseShare * item.taxRate;
					const scShare = item.applySC
						? proportion * (item.totalBase * serviceChargeRate)
						: 0;
					const scTaxShare =
						scTaxPreset && scShare > 0
							? scShare * (scTaxPreset.rate / 100)
							: 0;

					const finalCostShare = baseShare + itemTaxShare;
					const finalScBurden = scShare + scTaxShare;
					subtotal += finalCostShare;
					totalScAmount += finalScBurden;
					consumedItems.push({
						name: item.name,
						qtyString: consumedQtyString || consumedQty.toString(),
						cost: finalCostShare,
					});
				}
			});
			const totalOwed = subtotal + totalScAmount;
			calcGrandTotal += totalOwed;
			individualBreakdowns[person] = {
				subtotal,
				serviceCharge: totalScAmount,
				totalOwed,
				items: consumedItems,
			};
		});

		globalSummary.grandTotal = calcGrandTotal;
		setCalculationResult({ individualBreakdowns, globalSummary });
		showToast("Calculation complete! Scroll down to view.", "success");
		setTimeout(() => {
			document
				.getElementById("results")
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, 100);
	};

	// --- 4. RENDER ---
	return (
		<div className="flex flex-col gap-6">
			<TaxConfig
				isScApplicable={isScApplicable}
				handleToggleSc={handleToggleSc}
				serviceChargeRate={serviceChargeRate}
				setServiceChargeRate={setServiceChargeRate}
				scTaxPresetId={scTaxPresetId}
				setScTaxPresetId={setScTaxPresetId}
				taxPresets={taxPresets}
				handleAddTaxPreset={handleAddTaxPreset}
				handleRemoveTaxPreset={handleRemoveTaxPreset}
				newTaxName={newTaxName}
				setNewTaxName={setNewTaxName}
				newTaxRate={newTaxRate}
				setNewTaxRate={setNewTaxRate}
				newTaxSplit={newTaxSplit}
				setNewTaxSplit={setNewTaxSplit}
			/>

			<LineItems
				items={items}
				taxPresets={taxPresets}
				serviceChargeRate={serviceChargeRate}
				scTaxPresetId={scTaxPresetId}
				newItemName={newItemName}
				setNewItemName={setNewItemName}
				newItemQty={newItemQty}
				setNewItemQty={setNewItemQty}
				newItemPrice={newItemPrice}
				setNewItemPrice={setNewItemPrice}
				newItemTaxId={newItemTaxId}
				setNewItemTaxId={setNewItemTaxId}
				newItemApplySC={newItemApplySC}
				setNewItemApplySC={setNewItemApplySC}
				editingItemId={editingItemId}
				handleSaveItem={handleSaveItem}
				handleEditItem={handleEditItem}
				handleRemoveItem={handleRemoveItem}
			/>

			<Participants
				people={people}
				newPersonName={newPersonName}
				setNewPersonName={setNewPersonName}
				handleAddPerson={handleAddPerson}
				handleRemovePerson={handleRemovePerson}
			/>

			{items.length > 0 && people.length > 0 && (
				<QuickSplit
					items={items}
					people={people}
					qsItemId={qsItemId}
					setQsItemId={setQsItemId}
					qsSelectedPeople={qsSelectedPeople}
					toggleQsPerson={toggleQsPerson}
					handleApplyQuickSplit={handleApplyQuickSplit}
				/>
			)}

			<ConsumptionSplitter
				items={items}
				people={people}
				assignments={assignments}
				handleUpdateShare={handleUpdateShare}
				handleCalculateSplit={handleCalculateSplit}
			/>

			{calculationResult && (
				<FinalSettlement
					calculationResult={calculationResult}
					receiptTitle={receiptTitle}
					setReceiptTitle={setReceiptTitle}
					handleExportPDF={() =>
						exportToPDF(
							calculationResult,
							receiptTitle,
							items,
							taxPresets,
							scTaxPresetId,
							serviceChargeRate,
						)
					}
				/>
			)}
		</div>
	);
}
