import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useSession } from './useSession';

type SessionData = ReturnType<typeof useSession> & { isHost: boolean };

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

  return (
    <SessionContext.Provider value={{ ...session, isHost }}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
