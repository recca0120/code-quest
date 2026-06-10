import type { PersistedLayout } from '@code-quest/schemas';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../../test/index.ts';
import { TYPES } from '../../types.ts';
import type { ChannelManager } from '../channel-manager.ts';
import { LayoutStore } from '../layout-store.ts';

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
  it('get returns null when not set', () => {
    const store = new LayoutStore();
    expect(store.get('summoner-1')).toBeNull();
  });

  it('set returns a monotonically increasing rev; get returns layout with rev', () => {
    const store = new LayoutStore();
    expect(store.set('summoner-1', VALID_LAYOUT)).toBe(1);
    expect(store.set('summoner-1', VALID_LAYOUT)).toBe(2);
    expect(store.get('summoner-1')).toEqual({ layout: VALID_LAYOUT, rev: 2 });
  });

  it('different summoners do not share layouts or revs', () => {
    const store = new LayoutStore();
    store.set('summoner-1', VALID_LAYOUT);
    expect(store.get('summoner-2')).toBeNull();
    expect(store.set('summoner-2', VALID_LAYOUT)).toBe(1);
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

    expect(layoutStore.get(summonerKeyOf(container))).toEqual({ layout: VALID_LAYOUT, rev: 2 });
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
    expect(layoutStore.get(summonerKeyOf(container))).toBeNull();
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

    await claude.send('layout:save', dupLayout);

    const stored = layoutStore.get(summonerKeyOf(container));
    const root = stored?.layout.tabs[0]?.paneRoot;
    if (root?.type !== 'split') throw new Error('expected split');
    expect(root.second).toMatchObject({
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
    expect(layoutStore.get(summonerKeyOf(container))).toEqual({ layout: VALID_LAYOUT, rev: 1 });
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
