import type { PersistedLayout } from '@code-quest/schemas';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../../test/index.ts';
import { TYPES } from '../../types.ts';
import { LayoutStore } from '../layout-store.ts';

const VALID_LAYOUT: PersistedLayout = {
  tabs: [
    {
      id: 'tab-1',
      paneRoot: { type: 'leaf', id: 'pane-1', content: { type: 'session', cwd: '/repo' } },
    },
  ],
  activeTabId: 'tab-1',
};

describe('LayoutStore', () => {
  it('get returns null when not set', () => {
    const store = new LayoutStore();
    expect(store.get('summoner-1')).toBeNull();
  });

  it('set then get returns the same layout', () => {
    const store = new LayoutStore();
    store.set('summoner-1', VALID_LAYOUT);
    expect(store.get('summoner-1')).toEqual(VALID_LAYOUT);
  });

  it('different summoners do not share layouts', () => {
    const store = new LayoutStore();
    store.set('summoner-1', VALID_LAYOUT);
    expect(store.get('summoner-2')).toBeNull();
  });
});

describe('layout:save handler', () => {
  it('saves layout to store on valid payload', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    await claude.send('layout:save', VALID_LAYOUT);

    expect(layoutStore.get('default')).toEqual(VALID_LAYOUT);
  });

  it('broadcasts layout:sync to other sockets (not sender)', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude1 = createFakeSummoner(server).claude();
    const claude2 = createFakeSummoner(server).claude();

    const received: unknown[] = [];
    claude2.on('layout:sync', (payload) => received.push(payload));

    await claude1.send('layout:save', VALID_LAYOUT);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(VALID_LAYOUT);
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

  it('ignores invalid payload — does not save or broadcast', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude1 = createFakeSummoner(server).claude();
    const claude2 = createFakeSummoner(server).claude();
    const layoutStore = container.get<LayoutStore>(TYPES.LayoutStore);

    const received: unknown[] = [];
    claude2.on('layout:sync', (payload) => received.push(payload));

    await claude1.send('layout:save', { invalid: true });

    expect(layoutStore.get('default')).toBeNull();
    expect(received).toHaveLength(0);
  });
});

describe('app:init ACK — layout field', () => {
  it('returns layout: null when no layout saved', async () => {
    const claude = createFakeSummoner().claude();
    const result = await claude.send<{ layout: unknown }>('app:init');
    expect(result.layout).toBeNull();
  });

  it('returns saved layout when available', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();

    await claude.send('layout:save', VALID_LAYOUT);
    const result = await claude.send<{ layout: PersistedLayout | null }>('app:init');

    expect(result.layout).toEqual(VALID_LAYOUT);
  });
});
