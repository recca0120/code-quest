import { useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext.tsx';

export function RemoteStatusBanner(): React.JSX.Element | null {
  const { socket } = useSocket();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    function handler({ connected: c }: { connected: boolean }) {
      setConnected(c);
    }
    socket.on('remote:status', handler);
    return () => {
      socket.off('remote:status', handler);
    };
  }, [socket]);

  if (connected) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 px-4 py-1.5 bg-warning/15 border-b border-warning/30 text-warning text-xs font-medium shrink-0"
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
      Summoner offline — file watching paused
    </div>
  );
}
