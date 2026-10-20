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
  applyDiscount?: boolean;
  discountType?: 'none' | 'percentage' | 'flat';
  discountValue?: number;
  totalBase: number;
}

export interface IndividualBreakdown {
  memberId: string;
  memberName: string;
  subtotal: number;
  serviceCharge: number;
  totalOwed: number;
  items: { name: string; qtyString: string; cost: number }[];
}

export interface GlobalSummary {
  totalQty: number;
  rawSubTotal: number;
  itemDiscountAmount: number;
  preTaxDiscountAmount: number;
  postTaxDiscountAmount: number;
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

export interface GlobalLedgerRow {
  debtor_id: string | null;
  debtor_name: string;
  creditor_id: string | null;
  creditor_name: string;
  total_owed: number;
}

export interface NettedBalanceRow {
  counterpartyKey: string;
  counterpartyId: string | null;
  counterpartyName: string;
  selfName: string;
  direction: 'owed_to_me' | 'i_owe';
  netAmount: number;
  grossOwedToMe: number;
  grossIOwe: number;
  hasOpposing: boolean;
}

export interface SavedSquadMember {
  name: string;
  user_id: string | null;
}

export type SquadMember = SavedSquadMember;

export interface SavedSquad {
  id: string;
  name: string;
  members: SavedSquadMember[];
  createdAt?: string;
}

export interface FriendDossierStats {
  sharedSessionCount: number;
  favoriteVenue: string | null;
  recentSessions: {
    id: string;
    title: string;
    created_at: string;
  }[];
}

export interface CoDinerSuggestion {
  id: string;
  name: string;
  avatar_url: string | null;
  upi_id: string | null;
  sharedCount: number;
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

export interface DatabaseSession {
  id: string;
  name: string | null;
  venue_name: string | null;
  host_id: string | null;
  pin: string | null;
  status: 'draft' | 'locked' | 'archived';
  created_at: string;
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
