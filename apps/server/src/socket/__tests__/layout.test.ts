import type { PersistedLayout } from '@code-quest/schemas';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../../test/index.ts';
import { TYPES } from '../../types.ts';
import type { ChannelManager } from '../channel-manager.ts';
import { InMemoryLayoutStore, type LayoutStore } from '../layout-store.ts';

function summonerKeyOf(container: ReturnType<typeof createTestContainer>): string {
  return container.get<ChannelManager>(TYPES.ChannelManager).provider;
}

const VALID_LAYOUT: PersistedLayout = {
  version: 2,
  tabs: [
    {
      id: 'tab-1',
      paneRoot: {
        type: 'leaf',
        id: 'pane-1',
        content: { type: 'session', channelId: null, cwd: '/repo' },
      },
    },
  ],
  activeTabId: 'tab-1',
};

describe('LayoutStore', () => {
  it('get returns null when not set', async () => {
    const store = new InMemoryLayoutStore();
    expect(await store.get('summoner-1')).toBeNull();
  });

  it('set returns a monotonically increasing rev; get returns layout with rev', async () => {
    const store = new InMemoryLayoutStore();
    expect(await store.set('summoner-1', VALID_LAYOUT)).toBe(1);
    expect(await store.set('summoner-1', VALID_LAYOUT)).toBe(2);
    expect(await store.get('summoner-1')).toEqual({ layout: VALID_LAYOUT, rev: 2 });
  });

  it('different summoners do not share layouts or revs', async () => {
    const store = new InMemoryLayoutStore();
    await store.set('summoner-1', VALID_LAYOUT);
    expect(await store.get('summoner-2')).toBeNull();
    expect(await store.set('summoner-2', VALID_LAYOUT)).toBe(1);
  });
});

describe('layout:save handler — ack + rev (9.1 / 13.7)', () => {
  it('saves layout and acks { ok: true, rev } with monotonically increasing rev', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    const ack1 = await claude.send<{ ok: boolean; rev: number }>('layout:save', VALID_LAYOUT);
    expect(ack1).toEqual({ ok: true, rev: 1 });

    const ack2 = await claude.send<{ ok: boolean; rev: number }>('layout:save', VALID_LAYOUT);
    expect(ack2).toEqual({ ok: true, rev: 2 });

    expect(await layoutStore.get(summonerKeyOf(container))).toEqual({
      layout: VALID_LAYOUT,
      rev: 2,
    });
  });

  it('broadcasts layout:sync with rev to other sockets (not sender)', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude1 = createFakeSummoner(server).claude();
    const claude2 = createFakeSummoner(server).claude();

    const received: unknown[] = [];
    claude2.on('layout:sync', (payload) => received.push(payload));

    await claude1.send('layout:save', VALID_LAYOUT);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ ...VALID_LAYOUT, rev: 1 });
  });

  it('does not send layout:sync back to the sender', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();

    const received: unknown[] = [];
    claude.on('layout:sync', (payload) => received.push(payload));

    await claude.send('layout:save', VALID_LAYOUT);

    expect(received).toHaveLength(0);
  });

  it('acks { ok: false } on invalid payload — does not save or broadcast', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude1 = createFakeSummoner(server).claude();
    const claude2 = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    const received: unknown[] = [];
    claude2.on('layout:sync', (payload) => received.push(payload));

    const ack = await claude1.send<{ ok: boolean }>('layout:save', { invalid: true });

    expect(ack.ok).toBe(false);
    expect(await layoutStore.get(summonerKeyOf(container))).toBeNull();
    expect(received).toHaveLength(0);
  });

  it('dedupes duplicate channelIds before storing/broadcasting (11.6)', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    const dupLayout: PersistedLayout = {
      version: 2,
      tabs: [
        {
          id: 't1',
          paneRoot: {
            type: 'split',
            id: 's',
            direction: 'h',
            ratio: 0.5,
            first: {
              type: 'leaf',
              id: 'p1',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
            second: {
              type: 'leaf',
              id: 'p2',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
          },
        },
      ],
      activeTabId: 't1',
    };

    const claude2 = createFakeSummoner(server).claude();
    const received: unknown[] = [];
    claude2.on('layout:sync', (payload) => received.push(payload));

    await claude.send('layout:save', dupLayout);

    // storing 半邊
    const stored = await layoutStore.get(summonerKeyOf(container));
    const root = stored?.layout.tabs[0]?.paneRoot;
    if (root?.type !== 'split') throw new Error('expected split');
    expect(root.second).toMatchObject({
      content: { type: 'session', channelId: null, cwd: '/a' },
    });

    // broadcast 半邊——sync payload 也必須是 deduped 的（重構成分開處理時的守門）
    expect(received).toHaveLength(1);
    const syncRoot = (received[0] as PersistedLayout).tabs[0]?.paneRoot;
    if (syncRoot?.type !== 'split') throw new Error('expected split in sync payload');
    expect(syncRoot.second).toMatchObject({
      content: { type: 'session', channelId: null, cwd: '/a' },
    });
  });

  it('rejects unversioned (v1) writes — stale clients must not downgrade stored data (13.8)', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    await claude.send('layout:save', VALID_LAYOUT);
    const { version: _v, ...v1Payload } = VALID_LAYOUT;
    const ack = await claude.send<{ ok: boolean }>('layout:save', v1Payload);

    expect(ack.ok).toBe(false);
    expect(await layoutStore.get(summonerKeyOf(container))).toEqual({
      layout: VALID_LAYOUT,
      rev: 1,
    });
  });
});

describe('app:init ACK — layout field carries rev', () => {
  it('returns layout: null when no layout saved', async () => {
    const claude = createFakeSummoner().claude();
    const result = await claude.send<{ layout: unknown }>('app:init');
    expect(result.layout).toBeNull();
  });

  it('returns saved layout with rev when available', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();

    await claude.send('layout:save', VALID_LAYOUT);
    const result = await claude.send<{ layout: (PersistedLayout & { rev: number }) | null }>(
      'app:init',
    );

    expect(result.layout).toEqual({ ...VALID_LAYOUT, rev: 1 });
  });
});

describe('per-summoner isolation — structural invariant guard (14.4)', () => {
  it('a save on summoner X never reaches summoner Y (separate servers)', async () => {
    // 目前架構：一個 server 進程＝一個 summoner（emitter 作用域即隔離邊界）。
    // 此測試把該不變量釘成契約——未來若多 summoner 共用 emitter，
    // 這條會失敗並要求 broadcast 改 scoped。
    const serverX = createFakeServer(createTestContainer());
    const serverY = createFakeServer(createTestContainer());
    const x = createFakeSummoner(serverX).claude();
    const y = createFakeSummoner(serverY).claude();

    const received: unknown[] = [];
    y.on('layout:sync', (payload) => received.push(payload));

    await x.send('layout:save', VALID_LAYOUT);

    expect(received).toHaveLength(0);
  });
});

describe('concurrent saves — rev atomicity (14.7)', () => {
  it('two clients saving concurrently get distinct, strictly increasing revs', async () => {
    // Map 的同步 read-modify-write 讓 rev 配發天然原子；落盤改 async 後，
    // 交錯讀寫可能配發重複 rev（echo guard 失效）。此測試是該行為的鎖。
    const container = createTestContainer();
    const server = createFakeServer(container);
    const c1 = createFakeSummoner(server).claude();
    const c2 = createFakeSummoner(server).claude();

    const [ack1, ack2] = await Promise.all([
      c1.send<{ ok: boolean; rev: number }>('layout:save', VALID_LAYOUT),
      c2.send<{ ok: boolean; rev: number }>('layout:save', VALID_LAYOUT),
    ]);

    expect(ack1.ok).toBe(true);
    expect(ack2.ok).toBe(true);
    expect(ack1.rev).not.toBe(ack2.rev);
    expect([ack1.rev, ack2.rev].sort()).toEqual([1, 2]);
  });
});
