import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import type { TypedSocket } from '../socket/client.ts';

interface SocketContextValue {
  socket: TypedSocket;
}

export const SocketContext: React.Context<SocketContextValue | null> =
  createContext<SocketContextValue | null>(null);

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}

export function SocketProvider({
  socket,
  children,
}: {
  socket: TypedSocket;
  children: ReactNode;
}): React.JSX.Element {
  // Connection lifecycle lives with the socket object, not in any domain
  // provider. This effect runs AFTER children effects on the mounting render,
  // so consumers' 'connect' listeners (app:init etc.) are attached first.
  useEffect(() => {
    const onConnectError = (err: Error) => {
      toast.error(`Connection error: ${err.message}`);
    };
    socket.on('connect_error', onConnectError);
    socket.connect();
    return () => {
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}
