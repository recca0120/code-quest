import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SocketProvider } from '@/contexts/SocketContext.tsx';
import type { TypedSocket } from '@/socket/client.ts';
import { RemoteStatusBanner } from '../RemoteStatusBanner.tsx';

type RemoteStatusHandler = (payload: { connected: boolean }) => void;

function makeSocket() {
  let handler: RemoteStatusHandler | null = null;
  const socket = {
    on: (_event: string, fn: RemoteStatusHandler) => {
      handler = fn;
      return socket;
    },
    off: () => socket,
  } as unknown as TypedSocket;
  return {
    socket,
    disconnect: () => act(() => handler?.({ connected: false })),
    reconnect: () => act(() => handler?.({ connected: true })),
  };
}

function renderBanner(socket: TypedSocket) {
  return render(
    <SocketProvider socket={socket}>
      <RemoteStatusBanner />
    </SocketProvider>,
  );
}

describe('RemoteStatusBanner', () => {
  it('renders nothing while summoner is connected', () => {
    const { socket } = makeSocket();
    renderBanner(socket);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows banner when summoner disconnects', () => {
    const { socket, disconnect } = makeSocket();
    renderBanner(socket);
    disconnect();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('banner contains an offline message', () => {
    const { socket, disconnect } = makeSocket();
    renderBanner(socket);
    disconnect();
    expect(screen.getByRole('alert').textContent).toMatch(/offline|disconnected|not connected/i);
  });

  it('banner disappears when summoner reconnects', () => {
    const { socket, disconnect, reconnect } = makeSocket();
    renderBanner(socket);
    disconnect();
    reconnect();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
