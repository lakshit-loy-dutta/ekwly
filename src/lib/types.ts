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
  rawSubTotal: number;
  discountAmount: number;
  discountMode: 'pre-tax' | 'post-tax';
  subTotal: number;
  taxBreakdown: Record<string, number>;
  serviceCharge: number;
  roundOff: number;
  grandTotal: number;
}

export interface CalculationResult {
  individualBreakdowns: Record<string, IndividualBreakdown>;
  globalSummary: GlobalSummary;
}

export interface Transaction {
  creditor_id: string | null;
  creditor_name: string;
  debtor_id: string | null;
  debtor_name: string;
  amount: number;
}

export interface DatabaseVenue {
  id: string;
  name: string;
  service_charge_rate: number;
  tax_presets: TaxPreset[];
}

export interface DatabaseItem {
  name: string;
  price: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  upi_id: string | null;
  email: string | null;
  ai_scans_used: number;
  last_scan_reset: string;
  pro_expires_at: string | null;
}
