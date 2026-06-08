import { createContext, useContext } from 'react';

interface SessionManagerContextValue {
  open: () => void;
}

export const SessionManagerContext: React.Context<SessionManagerContextValue> =
  createContext<SessionManagerContextValue>({ open: () => {} });

export function useSessionManager(): SessionManagerContextValue {
  return useContext(SessionManagerContext);
}
