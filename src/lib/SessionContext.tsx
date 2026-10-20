import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSession } from './useSession';
import { mathEngine } from './mathEngine';
import type { CalculationResult } from './types';

type SessionData = ReturnType<typeof useSession> & {
  isHost: boolean;
  formattedClaims: Record<string, Record<string, string>>;
  liveCalculation: CalculationResult;
};

const SessionContext = createContext<SessionData | null>(null);

export function SessionProvider({
  sessionId,
  isHost,
  children,
}: {
  sessionId: string | null;
  isHost: boolean;
  children: ReactNode;
}) {
  const session = useSession(sessionId);

  const verifiedIsHost =
    session.hostId && session.currentUserId ? session.hostId === session.currentUserId : isHost;

  const formattedClaims = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    session.members.forEach((m) => {
      map[m.id] = {};
    });
    session.claims.forEach((c) => {
      if (!map[c.member_id]) map[c.member_id] = {};
      map[c.member_id][c.item_id] = c.value;
    });
    return map;
  }, [session.claims, session.members]);

  const liveCalculation = useMemo(() => {
    return mathEngine.generateSplit({
      items: session.items,
      members: session.members,
      formattedClaims,
      discountType: session.sessionRules.discountType,
      discountMode: session.sessionRules.discountMode,
      discountValue: session.sessionRules.discountValue,
      postTaxDiscountType: session.sessionRules.postTaxDiscountType,
      postTaxDiscountValue: session.sessionRules.postTaxDiscountValue,
      taxPresets: session.taxPresets,
      scTaxPresetId: session.sessionRules.scTaxPresetId,
      serviceChargeRate: session.sessionRules.serviceChargeRate,
    });
  }, [session.items, session.members, formattedClaims, session.sessionRules, session.taxPresets]);

  return (
    <SessionContext.Provider
      value={{
        ...session,
        isHost: verifiedIsHost,
        formattedClaims,
        liveCalculation,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
