import { useSessionSync } from './session/useSessionSync';
import { useSessionMutations } from './session/useSessionMutations';

export interface DBMember {
  id: string;
  session_id: string;
  name: string;
  user_id?: string | null;
  paid_amount: number;
}

export interface DBClaim {
  session_id: string;
  item_id: string;
  member_id: string;
  value: string;
}

export interface SessionRules {
  venueName: string;
  isScApplicable: boolean;
  serviceChargeRate: number;
  scTaxPresetId: string;
  discountType: 'none' | 'percentage' | 'flat';
  discountValue: string;
  discountMode: 'pre-tax' | 'post-tax';
  postTaxDiscountType?: 'none' | 'percentage' | 'flat';
  postTaxDiscountValue?: string;
}

export function useSession(sessionId: string | null) {
  const sync = useSessionSync(sessionId);
  const actions = useSessionMutations({
    sessionId,
    items: sync.items,
    members: sync.members,
    setSessionStatus: sync.setSessionStatus,
    setSessionRules: sync.setSessionRules,
    setTaxPresets: sync.setTaxPresets,
    setItems: sync.setItems,
    setMembers: sync.setMembers,
    setClaims: sync.setClaims,
    setLedger: sync.setLedger,
  });

  return {
    isLoading: sync.isLoading,
    isRealtimeActive: sync.isRealtimeActive,
    enableRealtime: sync.enableRealtime,
    sessionStatus: sync.sessionStatus,
    sessionRules: sync.sessionRules,
    taxPresets: sync.taxPresets,
    items: sync.items,
    members: sync.members,
    claims: sync.claims,
    ledger: sync.ledger,
    currentUserId: sync.currentUserId,
    hostId: sync.hostId,
    actions,
  };
}
