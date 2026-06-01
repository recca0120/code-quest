import type {
  ForkConversationResponse,
  GetSessionResponse,
  TeleportSessionResponse,
} from '@code-quest/schemas';
import { segments as s } from '@code-quest/test-kit';
import type { RawEventStore } from '../../../../services/raw-event-store.ts';
import type { SessionStore } from '../../../../services/session-store.ts';
import {
  createFakeServer,
  createFakeSummoner,
  createTestContainer,
  getChannelManager,
  setupSession,
} from '../../../../test/index.ts';
import { TYPES } from '../../../../types.ts';

type TeleportOk = Extract<TeleportSessionResponse, { ok: true }>;
type ForkOk = Extract<ForkConversationResponse, { ok: true }>;
type GetSessionOk = Extract<GetSessionResponse, { ok: true }>;

describe('ChatHandler > session', () => {
  describe('session forking', () => {
    it('forked session persist includes parentId and is fire-and-forget', async () => {
      const { container, claude, channelId } = await setupSession();

      let persistResolved = false;
      const persistedArgs: unknown[][] = [];
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const realPersist = sessionStore.upsert.bind(sessionStore);
      sessionStore.upsert = async (...args: [Parameters<typeof realPersist>[0]]) => {
        persistedArgs.push(args);

        const result = await realPersist(...args);
        persistResolved = true;
        return result;
      };

      let forkCustomCreatedFiredBeforePersist = false;
      claude.on('session:created', ({ channelId: id }: { channelId: string }) => {
        if (id === 'fork-1') forkCustomCreatedFiredBeforePersist = !persistResolved;
      });

      await claude.send('session:fork', {
        forkedFromChannelId: channelId,
        resumeSessionAt: 'msg-1',
        newChannelId: 'fork-1',
      });

      expect(forkCustomCreatedFiredBeforePersist).toBe(true);

      const forkPersist = persistedArgs.find(
        ([p]) => (p as Record<string, unknown>).channelId === 'fork-1',
      );
      expect(forkPersist).toBeDefined();
      expect((forkPersist![0] as Record<string, unknown>).parentId).toBe(channelId);
    });

    it('forked session parentId !== newChannelId', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('session:fork', {
        forkedFromChannelId: channelId,
        resumeSessionAt: 'msg-1',
        newChannelId: 'fork-verify',
      });

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const forked = await vi.waitFor(async () => {
        const row = await sessionStore.getByChannelId('fork-verify');
        expect(row).toBeDefined();
        return row!;
      });
      expect(forked.parentId).toBe(channelId);
      expect(forked.parentId).not.toBe('fork-verify');
    });

    it('fork_conversation emits session:created exactly once', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('session:fork', {
        forkedFromChannelId: channelId,
        resumeSessionAt: 'msg-1',
        newChannelId: 'fork-once',
      });

      const forkCreated = claude
        .receivedEvents('session:created')
        .filter((e) => e.channelId === 'fork-once');
      expect(forkCreated).toHaveLength(1);
    });

    it('session:created broadcast carries parent cwd (so client tab opens)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await sessionStore.upsert({
        id: 'sess-fork-cwd',
        channelId: 'ch-fork-parent',
        provider: 'claude',
        command: 'claude',
        args: '[]',
        projectRoot: '/test/project',
        mode: 'interactive',
        role: 'chat',
        cwd: '/tmp/parent-with-cwd',
        createdAt: new Date().toISOString(),
      });

      const forkClaude = summoner.claude();
      forkClaude.prepareInit(s.init('__unused__'));

      await summoner.send('session:fork', {
        forkedFromChannelId: 'ch-fork-parent',
        newChannelId: 'ch-fork-broadcast',
      });

      const events = forkClaude
        .receivedEvents('session:created')
        .filter((e) => e.channelId === 'ch-fork-broadcast');
      expect(events).toHaveLength(1);
      expect(events[0]!.cwd).toBe('/tmp/parent-with-cwd');
    });
  });
});

describe('session:teleport', () => {
  it('should create session with resume from remote session ID', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    await claude.initialize(s.init('cli-sess'));

    const result = (await claude.send<TeleportSessionResponse>('session:teleport', {
      remoteChannelId: 'remote-123',
      newChannelId: 'client-teleport-1',
    })) as TeleportOk;

    expect(result.ok).toBe(true);
    expect(result.data.channelId).toBe('client-teleport-1');
    const mgr = getChannelManager(container);
    expect(mgr.get(result.data.channelId)).toBeDefined();
  });

  it('should attempt git checkout if branch provided', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    await claude.initialize(s.init('cli-sess'));

    const result = await claude.send<TeleportSessionResponse>('session:teleport', {
      remoteChannelId: 'remote-123',
      branch: 'feature/x',
      newChannelId: 'client-teleport-2',
    });

    expect(result.ok).toBe(true);
  });

  it('should succeed even if git checkout fails', async () => {
    const summoner = createFakeSummoner();
    summoner.git()!.setCheckoutError(new Error('checkout failed'));
    const claude = summoner.claude();
    await claude.initialize(s.init('cli-sess'));

    const result = (await claude.send<TeleportSessionResponse>('session:teleport', {
      remoteChannelId: 'remote-123',
      branch: 'feature/x',
      newChannelId: 'client-teleport-3',
    })) as TeleportOk;

    expect(result.ok).toBe(true);
    expect(result.data.channelId).toBeDefined();
    expect(result.data.branchCheckoutFailed).toBe(true);
    expect(result.data.branch).toBe('feature/x');
  });

  it('should return events from parent session history', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'hello' });

    await claude.emitSegment(s.assistant('original'));
    await claude.emitSegment(s.result());

    const result = (await claude.send<TeleportSessionResponse>('session:teleport', {
      remoteChannelId: channelId,
      newChannelId: 'client-teleport-4',
    })) as TeleportOk;

    expect(result.ok).toBe(true);
    expect(result.data.events).toBeDefined();
    expect(result.data.events.length).toBeGreaterThan(0);
  });
});

describe('session:fork argv + sessionId + clone (fix-fork-resume-sessionid)', () => {
  it('spawn argv contains --resume <parentSid> --fork-session --session-id <newUuid>', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);
    const claude = summoner.claude();
    const parentChannelId = await claude.initialize(s.init('sess-parent'));

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__unused__'));

    await summoner.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: parentChannelId,
      newChannelId: 'ch-fork-1',
    });

    const lastSpawn = forkClaude.provider.spawnCalls.at(-1);
    expect(lastSpawn).toBeDefined();
    const args = lastSpawn?.args ?? [];

    const resumeIdx = args.indexOf('--resume');
    expect(resumeIdx).toBeGreaterThanOrEqual(0);
    expect(args[resumeIdx + 1]).toBe('sess-parent');

    expect(args).toContain('--fork-session');

    const sidIdx = args.indexOf('--session-id');
    expect(sidIdx).toBeGreaterThanOrEqual(0);
    const newSid = args[sidIdx + 1];
    expect(newSid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(newSid).not.toBe('sess-parent');
  });

  it('spawns with parent cwd recovered from sessionStore (dead parent channel)', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);

    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await sessionStore.upsert({
      id: 'sess-cwd-parent',
      channelId: 'ch-dead-parent',
      provider: 'claude',
      command: 'claude',
      args: '[]',
      projectRoot: '/test/project',
      mode: 'interactive',
      role: 'chat',
      cwd: '/tmp/parent-proj',
      createdAt: new Date().toISOString(),
    });

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__unused__'));

    await summoner.send('session:fork', {
      forkedFromChannelId: 'ch-dead-parent',
      newChannelId: 'ch-fork-cwd',
    });

    const lastSpawn = forkClaude.provider.spawnCalls.at(-1);
    expect(lastSpawn?.options?.cwd).toBe('/tmp/parent-proj');

    const args = lastSpawn?.args ?? [];
    const resumeIdx = args.indexOf('--resume');
    expect(args[resumeIdx + 1]).toBe('sess-cwd-parent');
  });

  it('clones parent rawEventService rows under the new sessionId', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);

    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await sessionStore.upsert({
      id: 'sess-clone-parent',
      channelId: 'ch-clone-parent',
      provider: 'claude',
      command: 'claude',
      args: '[]',
      projectRoot: '/test/project',
      mode: 'interactive',
      role: 'chat',
      cwd: '/tmp',
      createdAt: new Date().toISOString(),
    });

    const rawStore = container.get<RawEventStore>(TYPES.RawEventStore);
    await rawStore.appendEvent({
      timestamp: Date.now(),
      sessionId: 'sess-clone-parent',
      direction: 'in',
      raw: 'raw-A',
    });
    await rawStore.appendEvent({
      timestamp: Date.now() + 1,
      sessionId: 'sess-clone-parent',
      direction: 'out',
      raw: 'raw-B',
    });

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__unused__'));

    await summoner.send('session:fork', {
      forkedFromChannelId: 'ch-clone-parent',
      newChannelId: 'ch-fork-clone',
    });

    const lastSpawn = forkClaude.provider.spawnCalls.at(-1);
    const args = lastSpawn?.args ?? [];
    const sidIdx = args.indexOf('--session-id');
    const newSid = args[sidIdx + 1];

    const cloned = await rawStore.getBySession(newSid!);
    const rawValues = cloned.map((r) => r.raw);
    expect(rawValues).toContain('raw-A');
    expect(rawValues).toContain('raw-B');
    const aIdx = rawValues.indexOf('raw-A');
    const bIdx = rawValues.indexOf('raw-B');
    expect(aIdx).toBeLessThan(bIdx);
  });
});

describe('session:fork pass-through + reject + ack (fix-fork-resume-sessionid)', () => {
  it('forwards resumeSessionAt to CLI argv as --resume-session-at', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);

    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await sessionStore.upsert({
      id: 'sess-at-parent',
      channelId: 'ch-at-parent',
      provider: 'claude',
      command: 'claude',
      args: '[]',
      projectRoot: '/test/project',
      mode: 'interactive',
      role: 'chat',
      cwd: '/tmp',
      createdAt: new Date().toISOString(),
    });

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__unused__'));

    await summoner.send('session:fork', {
      forkedFromChannelId: 'ch-at-parent',
      resumeSessionAt: 'msg-42',
      newChannelId: 'ch-fork-at',
    });

    const lastSpawn = forkClaude.provider.spawnCalls.at(-1);
    const args = lastSpawn?.args ?? [];
    const idx = args.indexOf('--resume-session-at');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('msg-42');
  });

  it('rejects when parent has live channel sessionId but no sessionStore row', async () => {
    // Case A: alive channel pre-set sessionId (e.g. fork mid-launch) but DB row
    // not yet persisted. Without a row we have no cwd, so CLI would silently fail
    // to find the JSONL. handleFork must reject early.
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);
    const claude = summoner.claude();
    const parentChannelId = await claude.initialize(s.init('sess-no-row'));

    // Wipe the auto-created sessionStore row so resolveSessionId still hits the
    // live channel (returns 'sess-no-row') but getById returns null.
    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await sessionStore.delete('sess-no-row');

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__never_used__'));
    const beforeSpawnCount = forkClaude.provider.spawnCalls.length;

    const result = await summoner.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: parentChannelId,
      newChannelId: 'ch-fork-norow',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/parent session not found/i);
    expect(forkClaude.provider.spawnCalls.length).toBe(beforeSpawnCount);
  });

  it('rejects unknown parent without spawning', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);

    const claudeForSpy = summoner.claude();
    claudeForSpy.prepareInit(s.init('__never_used__'));
    const beforeSpawnCount = claudeForSpy.provider.spawnCalls.length;

    const result = await summoner.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: 'ch-missing',
      newChannelId: 'ch-fork-missing',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/parent session not found/i);
    expect(claudeForSpy.provider.spawnCalls.length).toBe(beforeSpawnCount);
  });

  it('ack shape: success without events field', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);

    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await sessionStore.upsert({
      id: 'sess-ack-parent',
      channelId: 'ch-ack-parent',
      provider: 'claude',
      command: 'claude',
      args: '[]',
      projectRoot: '/test/project',
      mode: 'interactive',
      role: 'chat',
      cwd: '/tmp',
      createdAt: new Date().toISOString(),
    });

    const forkClaude = summoner.claude();
    forkClaude.prepareInit(s.init('__unused__'));

    const result = (await summoner.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: 'ch-ack-parent',
      newChannelId: 'ch-fork-ack',
    })) as ForkOk;

    expect(result.ok).toBe(true);
    expect(result.data.channelId).toBe('ch-fork-ack');
    expect(result.data.parentChannelId).toBe('ch-ack-parent');
    expect((result.data as Record<string, unknown>).events).toBeUndefined();
  });
});

describe('chat:fork enhanced', () => {
  it('should store parentId on forked session in session store', async () => {
    const { claude, channelId } = await setupSession();

    const forkResult = (await claude.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: channelId,
      resumeSessionAt: 'msg-1',
      newChannelId: 'client-fork-1',
    })) as ForkOk;
    // persist is fire-and-forget in handler — wait for it
    await new Promise<void>((r) => queueMicrotask(r));

    expect((forkResult as { error?: unknown }).error).toBeUndefined();
    expect(forkResult.ok).toBe(true);
    expect(forkResult.data.channelId).toBe('client-fork-1');

    const getResult = (await claude.send<GetSessionResponse>('session:get', {
      channelId: forkResult.data.channelId,
    })) as GetSessionOk;

    expect(getResult.ok).toBe(true);
    expect(getResult.data.session).toBeDefined();
    expect(getResult.data.session.parentId).toBe(channelId);
  });

  it('should include parentChannelId in fork response', async () => {
    const { claude, channelId } = await setupSession();

    const forkResult = (await claude.send<ForkConversationResponse>('session:fork', {
      forkedFromChannelId: channelId,
      resumeSessionAt: 'msg-1',
      newChannelId: 'client-fork-2',
    })) as ForkOk;

    expect(forkResult.ok).toBe(true);
    expect(forkResult.data.parentChannelId).toBe(channelId);
  });
});
