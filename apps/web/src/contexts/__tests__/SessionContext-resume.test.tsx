import { segments as s } from '@code-quest/test-kit';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TypedSocket } from '@/socket/client';
import { createFakeSummoner } from '@/test/fake-summoner';
import { AppConfigProvider } from '../AppInitContext.tsx';
import { SessionProvider, useSession } from '../SessionContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

function wrap(socket: TypedSocket) {
  return ({ children }: { children: ReactNode }) => (
    <SocketProvider socket={socket}>
      <AppConfigProvider>
        <SessionProvider>{children}</SessionProvider>
      </AppConfigProvider>
    </SocketProvider>
  );
}

describe('SessionContext.resume', () => {
  it('emits session:resume and resolves with channelId on success', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = await claude.initialize(s.init('sess-target'));

    const { result } = renderHook(() => useSession(), { wrapper: wrap(summoner.socket) });

    await expect(result.current.resume('sess-target')).resolves.toEqual({ channelId });
  });

  it('rejects with the server error message when ack returns { ok: false, error }', async () => {
    const summoner = createFakeSummoner();
    const { result } = renderHook(() => useSession(), { wrapper: wrap(summoner.socket) });

    await expect(result.current.resume('sess-unknown')).rejects.toThrow(/session row has no cwd/);
  });

  // Narrow stub: the real server never emits a non-object ack, so this
  // contract-violation path can only be exercised by bypassing the server.
  it('rejects with "Invalid response" when ack fails sessionResumeResponseSchema', async () => {
    const emit = vi.fn((_event: string, _payload: unknown, cb?: (raw: unknown) => void) => {
      cb?.('not-an-object');
    });
    const socket = {
      emit,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      connected: false,
    } as unknown as TypedSocket;

    const { result } = renderHook(() => useSession(), { wrapper: wrap(socket) });

    await expect(result.current.resume('sid-X')).rejects.toThrow('Invalid response');
  });
});
