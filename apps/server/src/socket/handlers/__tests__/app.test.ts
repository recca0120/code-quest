/* biome-ignore-all lint/suspicious/noExplicitAny: test file uses type assertions */
import { segments as s } from '@code-quest/test-kit';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../../../test/index.ts';
import { TYPES } from '../../../types.ts';

describe('ChatHandler > connection', () => {
  it('init returns settings and sessions in one response', async () => {
    const claude = createFakeSummoner().claude();

    const result = await claude.send<{
      settings: Record<string, unknown>;
      sessions: Array<{ channelId: string; state: string }>;
      activeChannelId?: string;
    }>('app:init');

    expect(result.settings).toMatchObject({});
    expect(result.sessions).toEqual(expect.any(Array));
  });

  it('init includes capabilities.worktree from Git', async () => {
    const claude = createFakeSummoner().claude();

    const result = await claude.send<{
      capabilities?: { worktree: boolean };
    }>('app:init');

    // FakeGit.capabilities.worktree === true
    expect(result.capabilities?.worktree).toBe(true);
  });

  it('app:config returns providerConfig from adapter', async () => {
    const claude = createFakeSummoner().claude();

    const result = await claude.send<{
      providerConfig: { brand: { name: string; company: string } };
    }>('app:config', { channelId: '' });

    expect(result.providerConfig).toBeDefined();
    expect(result.providerConfig.brand.name).toBe('Claude');
    expect(result.providerConfig.brand.company).toBe('Anthropic');
  });

  it('app:config returns defaultModels from providerConfig before any session launch', async () => {
    const claude = createFakeSummoner().claude();

    const result = await claude.send<{
      providerConfig: { defaultModels: Array<{ value: string }> };
      models?: Array<{ value: string }>;
    }>('app:config', { channelId: '' });

    expect(result.providerConfig.defaultModels).toBeDefined();
    expect(result.providerConfig.defaultModels.length).toBeGreaterThan(0);
    expect(result.providerConfig.defaultModels[0]!.value).toBe('default');
  });

  it('session launch caches models and app:config returns them', async () => {
    const claude = createFakeSummoner().claude();
    const models = [{ value: 'default' }, { value: 'haiku' }];

    // app:config before launch — no cachedModels
    const before = await claude.send<{ models?: unknown[] }>('app:config', { channelId: '' });
    expect(before.models).toBeUndefined();

    await claude.initialize(s.init('sess-1'), s.controlResponse('init', { models }));

    // app:config after launch — cachedModels from CLI initialize response
    const after = await claude.send<{ models?: unknown[] }>('app:config', { channelId: '' });
    expect(after.models).toBeDefined();
    expect(after.models).toEqual(models);
  });

  it('app:init returns fallback when settingsStore throws', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const settingsStore = container.get<{
      getMany: (...args: unknown[]) => Promise<Record<string, unknown>>;
    }>(TYPES.SettingsStore);
    settingsStore.getMany = () => Promise.reject(new Error('DB error'));

    const result = await claude.send<{
      settings: Record<string, unknown>;
      sessions: unknown[];
    }>('app:init');

    expect(result.settings).toEqual({});
    expect(result.sessions).toEqual(expect.any(Array));
  });

  it('app:config returns providerConfig when settingsStore throws', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const settingsStore = container.get<{
      get: (...args: unknown[]) => Promise<unknown>;
    }>(TYPES.SettingsStore);
    settingsStore.get = () => Promise.reject(new Error('DB error'));

    const result = await claude.send<{
      providerConfig: { brand: { name: string } };
    }>('app:config', { channelId: '' });

    expect(result.providerConfig).toBeDefined();
    expect(result.providerConfig.brand.name).toBe('Claude');
  });
});
