import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { AppConfigProvider, useAppConfigActions, useAppConfigState } from '../AppInitContext.tsx';
import { SessionProvider, useSession } from '../SessionContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

async function renderInAppInit(ui: ReactNode, summoner?: ReturnType<typeof createFakeSummoner>) {
  const s = summoner ?? createFakeSummoner();
  render(
    <SocketProvider socket={s.socket}>
      <AppConfigProvider>{ui}</AppConfigProvider>
    </SocketProvider>,
  );
  await act(async () => {});
  return s;
}

describe('AppInitContext', () => {
  it('exposes subscribeInit that calls back with init data', async () => {
    const cb = vi.fn();

    function Subscriber() {
      useAppConfigActions().subscribeInit(cb);
      return null;
    }

    await renderInAppInit(<Subscriber />);

    expect(cb).toHaveBeenCalled();
    expect(cb.mock.calls[0]![0]).toHaveProperty('sessions');
  });

  it('late subscriber receives already-fired init data immediately', async () => {
    let subscribeInit: ReturnType<typeof useAppConfigActions>['subscribeInit'];

    function Capture() {
      subscribeInit = useAppConfigActions().subscribeInit;
      return null;
    }

    await renderInAppInit(<Capture />);

    const lateCb = vi.fn();
    subscribeInit!(lateCb);

    expect(lateCb).toHaveBeenCalledTimes(1);
    expect(lateCb.mock.calls[0]![0]).toHaveProperty('sessions');
  });

  it('SessionProvider receives sessions via subscribeInit (no duplicate app:init)', async () => {
    function Probe() {
      const { sessions } = useSession();
      return <span>{sessions.length}</span>;
    }

    const summoner = await renderInAppInit(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(summoner.sentEvents('app:init')).toHaveLength(1);
  });

  it('sessionsMap provides O(1) lookup by channelId', async () => {
    let map: ReadonlyMap<string, unknown> | undefined;

    function Probe() {
      const ctx = useSession();
      map = ctx.sessionsMap;
      return null;
    }

    await renderInAppInit(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(map).toBeInstanceOf(Map);
    // app:init returns sessions from fake server — verify map is keyed by channelId
    for (const [key, value] of map!) {
      expect(typeof key).toBe('string');
      expect(value).toHaveProperty('channelId', key);
    }
  });

  it('subscribeInit belongs to actions, not state', () => {
    let state: ReturnType<typeof useAppConfigState>;
    let actions: ReturnType<typeof useAppConfigActions>;

    function Probe() {
      state = useAppConfigState();
      actions = useAppConfigActions();
      return null;
    }

    renderInAppInit(<Probe />);

    expect(state!).not.toHaveProperty('subscribeInit');
    expect(actions!).toHaveProperty('subscribeInit');
  });

  it('reconnect resets pending guard so app:init fires again', async () => {
    function Noop() {
      return null;
    }

    const summoner = await renderInAppInit(<Noop />);
    const initCount = () => summoner.sentEvents('app:init').length;

    // Initial connect fires app:init once
    expect(initCount()).toBe(1);

    // Disconnect + reconnect fires app:init again
    act(() => {
      summoner.disconnect();
    });
    await act(async () => {
      summoner.socket.connect();
    });
    expect(initCount()).toBe(2);

    // Second disconnect + reconnect also fires (pending guard reset on each disconnect)
    act(() => {
      summoner.disconnect();
    });
    await act(async () => {
      summoner.socket.connect();
    });
    expect(initCount()).toBe(3);
  });

  it('re-fetches app:init on reconnect', async () => {
    const cb = vi.fn();

    function Subscriber() {
      useAppConfigActions().subscribeInit(cb);
      return null;
    }

    const summoner = await renderInAppInit(<Subscriber />);
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => {
      summoner.disconnect();
    });
    await act(async () => {
      summoner.socket.connect();
    });

    expect(cb).toHaveBeenCalledTimes(2);
  });
});
