export interface TaxPreset {
	id: string;
	name: string;
	rate: number;
	split: boolean;
}

export interface BillItem {
	id: string;
	name: string;
	qty: number;
	unitPrice: number;
	taxRate: number;
	taxPresetId: string;
	applySC: boolean;
	totalBase: number;
}

export interface IndividualBreakdown {
	subtotal: number;
	serviceCharge: number;
	totalOwed: number;
	items: { name: string; qtyString: string; cost: number }[];
}

export interface GlobalSummary {
	totalQty: number;
	subTotal: number;
	taxBreakdown: Record<string, number>;
	serviceCharge: number;
	grandTotal: number;
}

export interface CalculationResult {
	individualBreakdowns: Record<string, IndividualBreakdown>;
	globalSummary: GlobalSummary;
}
