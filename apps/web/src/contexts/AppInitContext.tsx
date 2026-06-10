import { EVENTS, type InitResponse, initResponseSchema } from '@code-quest/schemas';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSocket } from './SocketContext.tsx';

type InitSubscriber = (data: InitResponse) => void;

interface AppConfigState {
  /** Feature flags derived from server `app:init` — e.g., whether git
   *  worktree operations are available. */
  capabilities: { worktree: boolean };
  /** Server-side default launch options echoed on `app:init` (model,
   *  permissionMode, …). Compose toolbar reads/merges these. */
  initOptions: Record<string, unknown>;
}

interface AppConfigActions {
  setInitOptions: (opts: Record<string, unknown>) => void;
  subscribeInit: (cb: InitSubscriber) => () => void;
}

export const AppConfigStateContext: React.Context<AppConfigState | null> =
  createContext<AppConfigState | null>(null);
export const AppConfigActionsContext: React.Context<AppConfigActions | null> =
  createContext<AppConfigActions | null>(null);

export function useAppConfigState(): AppConfigState {
  const ctx = useContext(AppConfigStateContext);
  if (!ctx) throw new Error('useAppConfigState must be used within AppConfigProvider');
  return ctx;
}

export function useAppConfigActions(): AppConfigActions {
  const ctx = useContext(AppConfigActionsContext);
  if (!ctx) throw new Error('useAppConfigActions must be used within AppConfigProvider');
  return ctx;
}

/** Convenience: `{ capabilities, initOptions, setInitOptions }` in one call. */
export function useAppConfig(): AppConfigState & AppConfigActions {
  return { ...useAppConfigState(), ...useAppConfigActions() };
}

export function AppConfigProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { socket } = useSocket();
  const [capabilities, setCapabilities] = useState<{ worktree: boolean }>({ worktree: false });
  const [initOptions, setInitOptions] = useState<Record<string, unknown>>({});

  const subscribersRef = useRef(new Set<InitSubscriber>());
  const lastInitRef = useRef<InitResponse | null>(null);

  const subscribeInit = useCallback((cb: InitSubscriber) => {
    subscribersRef.current.add(cb);
    if (lastInitRef.current) cb(lastInitRef.current);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    let pending = false;
    const fetchInit = () => {
      if (pending) return;
      pending = true;
      socket.emit(EVENTS.app.init, (raw) => {
        pending = false;
        const parsed = initResponseSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn('[AppConfigContext] initResponseSchema parse failed', parsed.error);
          return;
        }
        lastInitRef.current = parsed.data;
        if (parsed.data.capabilities) setCapabilities(parsed.data.capabilities);
        if (parsed.data.settings && Object.keys(parsed.data.settings).length > 0) {
          setInitOptions(parsed.data.settings);
        }
        for (const sub of subscribersRef.current) sub(parsed.data);
      });
    };
    const resetPending = () => {
      pending = false;
    };
    socket.on('connect', fetchInit);
    socket.on('disconnect', resetPending);
    if (socket.connected) fetchInit();
    return () => {
      socket.off('connect', fetchInit);
      socket.off('disconnect', resetPending);
    };
  }, [socket]);

  // Keep the replay snapshot's layout fresh: a TabProvider remounted later
  // (last project removed then re-added) replays lastInitRef — without this,
  // it would apply the stale connect-time layout over a newer synced one and
  // the debounced save would persist the rollback.
  useEffect(() => {
    const onLayoutSync = (payload: unknown) => {
      if (!lastInitRef.current) return;
      lastInitRef.current = { ...lastInitRef.current, layout: payload };
    };
    socket.on(EVENTS.layout.sync, onLayoutSync);
    return () => {
      socket.off(EVENTS.layout.sync, onLayoutSync);
    };
  }, [socket]);

  const [actions] = useState<AppConfigActions>(() => ({
    setInitOptions,
    subscribeInit,
  }));

  return (
    <AppConfigStateContext.Provider value={{ capabilities, initOptions }}>
      <AppConfigActionsContext.Provider value={actions}>
        {children}
      </AppConfigActionsContext.Provider>
    </AppConfigStateContext.Provider>
  );
}
