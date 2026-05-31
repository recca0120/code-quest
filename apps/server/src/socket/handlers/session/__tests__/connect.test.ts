import type {
  SessionJoinResponse,
  SessionLaunchResponse,
  SessionResumeResponse,
} from '@code-quest/schemas';
import { z } from 'zod';

const messageContentSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string() })),
});

type LaunchOk = Extract<SessionLaunchResponse, { ok: true }>;
type JoinOk = Extract<SessionJoinResponse, { ok: true }>;
type ResumeOk = Extract<SessionResumeResponse, { ok: true }>;

import { type FakeClaude, segments as s } from '@code-quest/test-kit';
import { logger } from '../../../../logger.ts';
import type { RawEventService } from '../../../../services/raw-event-service.ts';
import type { SessionStore } from '../../../../services/session-store.ts';
import {
  createFakeServer,
  createFakeSummoner,
  createTestContainer,
  getChannelManager,
  setupSession,
} from '../../../../test/index.ts';
import { TYPES } from '../../../../types.ts';

async function upsertSession(
  store: SessionStore,
  { id, channelId, cwd }: { id: string; channelId: string; cwd: string },
) {
  await store.upsert({
    id,
    channelId,
    cwd,
    provider: 'claude',
    command: 'claude',
    args: '[]',
    projectRoot: '/test/project',
    mode: 'interactive',
    role: 'chat',
    createdAt: new Date().toISOString(),
  });
}

function historyEventNames(claude: FakeClaude): string[] {
  const batches = claude.receivedEvents('session:history') as Array<{
    events: Array<{ name: string }>;
  }>;
  if (!batches.length) return [];
  return batches[0]!.events.map((e) => e.name);
}

describe('ChatHandler > session', () => {
  describe('session creation', () => {
    it('creates a session and emits chat:created', async () => {
      const { container, channelId } = await setupSession();

      expect(channelId).toBeDefined();
      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)).toBeDefined();
    });

    it('prepareInit + external launch completes init without calling initialize()', async () => {
      const claude = createFakeSummoner().claude();
      claude.prepareInit(s.init('prep-sess'));

      // External launch (simulates UI "New tab" click)
      const launchResult = await claude.send<LaunchOk>('session:launch', {
        channelId: 'ch-prep',
      });
      const channelId = launchResult.data.channelId;

      expect(channelId).toBeDefined();
    });

    it('session:launch with cwd passes cwd to CLI spawn options', async () => {
      const claude = createFakeSummoner().claude();
      claude.prepareInit(s.init('cwd-sess'));

      await claude.send<LaunchOk>('session:launch', {
        channelId: 'ch-cwd',
        cwd: '/projects/my-app',
      });

      const lastSpawn = claude.provider.spawnCalls[claude.provider.spawnCalls.length - 1];
      expect(lastSpawn!.options?.cwd).toBe('/projects/my-app');
    });

    it('session:init with worktree cwd sets channel.worktree', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const worktreeCwd = '/repo/.claude/worktrees/my-feature';
      claude.prepareInit(s.init('wt-sess'));

      const result = await claude.send<LaunchOk>('session:launch', {
        channelId: 'ch-wt',
        cwd: worktreeCwd,
      });
      const channelId = result.data.channelId;

      const mgr = getChannelManager(container);
      const channel = mgr.get(channelId ?? 'ch-wt');
      expect(channel?.worktree).toEqual({ name: 'my-feature', path: worktreeCwd });
    });

    it('session record is written to DB with session_id set (from system/init, not started)', async () => {
      const { container, channelId } = await setupSession();

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const record = await sessionStore.getByChannelId(channelId);
      expect(record).not.toBeNull();
      expect(record!.id).toBe('cli-sess');
    });

    it('session record args reflect the actual spawn args (not a static base)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      claude.prepareInit(s.init('args-sess'));

      await claude.send<LaunchOk>('session:launch', {
        channelId: 'ch-args',
        launchOptions: { thinking: 'adaptive', thinkingDisplay: 'summarized' },
      });

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const row = await vi.waitFor(async () => {
        const r = await sessionStore.getById('args-sess');
        expect(r).toBeDefined();
        return r!;
      });
      const args: string[] = JSON.parse(row.args);
      expect(args).toContain('--thinking');
      expect(args[args.indexOf('--thinking') + 1]).toBe('adaptive');
      expect(args).toContain('--thinking-display');
      expect(args[args.indexOf('--thinking-display') + 1]).toBe('summarized');
    });

    it('persists projectRoot on session record (from gitService.getProjectRoot)', async () => {
      const { FakeGit } = await import('@code-quest/test-kit');
      const fakeGit = new FakeGit();
      fakeGit.setProjectRoot('/repo');
      const container = createTestContainer({ gitService: fakeGit });
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const channelId = await claude.initialize(
        { launch: { cwd: '/repo/.claude/worktrees/feat-a' } },
        s.init('pr-sess'),
      );

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const record = await sessionStore.getByChannelId(channelId);
      expect(record?.projectRoot).toBe('/repo');
    });

    it('sessionStore.upsert is fire-and-forget: custom:created fires without awaiting persist', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();

      let persistResolved = false;
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const realPersist = sessionStore.upsert.bind(sessionStore);
      sessionStore.upsert = async (...args: [Parameters<typeof realPersist>[0]]) => {
        const result = await realPersist(...args);
        persistResolved = true;
        return result;
      };

      let customCreatedFiredBeforePersist = false;
      claude.on('session:created', () => {
        customCreatedFiredBeforePersist = !persistResolved;
      });

      await claude.initialize(s.init('persist-test'));

      expect(customCreatedFiredBeforePersist).toBe(true);
    });

    it('emits chat:created AFTER initialize completes with promoted session ID', async () => {
      const claude = createFakeSummoner().claude();

      const channelId = await claude.initialize(s.init('promoted-sess'));

      const createdEvents = claude.receivedEvents('session:created');
      expect(createdEvents.length).toBeGreaterThan(0);
      expect(createdEvents[0]!.channelId).toBe(channelId);
    });

    it('creates session with default init when no initOptions', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const channelId = await claude.initialize();

      expect(channelId).toBeDefined();
      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)).toBeDefined();
    });

    it('launch emits exactly one session:init with final metaCache', async () => {
      const claude = createFakeSummoner().claude();

      const channelId = await claude.initialize(
        s.init('cli-sess', {
          model: 'claude-sonnet-4-6',
          slashCommands: ['commit', 'review'],
        }),
      );

      const initEvents = claude.receivedEvents('session:init');
      // Only 1 session:init — from launch handler (Channel.emit suppressed for session:init)
      expect(initEvents.length).toBe(1);
      expect(initEvents[0]!.channelId).toBe(channelId);
      expect(initEvents[0]!.model).toBe('claude-sonnet-4-6');
      expect(initEvents[0]!.slashCommands).toEqual(['commit', 'review']);
    });

    it('chat:create callback includes slashCommands from initialize response', async () => {
      const claude = createFakeSummoner().claude();
      claude.initialize(s.init('cli-sess', { slashCommands: ['commit', 'review', 'debug'] }));

      const result = await claude.send<LaunchOk>('session:launch', {
        channelId: 'test-slash-cmds',
      });

      expect(result.data.channelId).toBeDefined();
      expect(result.data.slashCommands).toEqual(['commit', 'review', 'debug']);
    });

    it('chat:create callback includes models and account from initialize response', async () => {
      const models = [
        {
          value: 'default',
          displayName: 'Default',
          supportsEffort: true,
          supportedEffortLevels: ['low', 'high'],
        },
        { value: 'haiku', displayName: 'Haiku' },
      ];
      const account = { email: 'test@example.com', subscriptionType: 'Claude Max' };
      const claude = createFakeSummoner().claude();
      claude.initialize(s.init('cli-sess'), s.controlResponse('init', { models, account }));

      const result = await claude.send<LaunchOk>('session:launch', {
        channelId: 'test-models-acct',
      });

      expect(result.data.models).toEqual(models);
      expect(result.data.account).toEqual(account);
    });

    it('session:launch emits app:models when initialize response has models', async () => {
      const models = [
        { value: 'default', displayName: 'Default' },
        { value: 'haiku', displayName: 'Haiku' },
      ];
      const claude = createFakeSummoner().claude();

      await claude.initialize(s.init('cli-sess'), s.controlResponse('init', { models }));

      const modelEvents = claude.receivedEvents('app:models');
      expect(modelEvents.length).toBeGreaterThan(0);
      expect(modelEvents[0]!.models).toEqual(models);
    });

    it('session:join emits app:models to joining socket when cachedModels available', async () => {
      const models = [
        { value: 'default', displayName: 'Default' },
        { value: 'haiku', displayName: 'Haiku' },
      ];
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA
        .claude()
        .initialize(s.init('cli-sess'), s.controlResponse('init', { models }));

      await windowB.send('session:join', { channelId });

      const modelEvents = windowB.receivedEvents('app:models');
      expect(modelEvents.length).toBeGreaterThan(0);
      expect(modelEvents[0].models).toEqual(models);
    });
  });

  describe('session:join', () => {
    it('emits session:init to joining socket with full config from metaCache', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(
        s.init('cli-sess', {
          model: 'claude-sonnet-4-6',
          tools: ['Read', 'Write', 'Bash'],
          permissionMode: 'default',
          fastModeState: 'off',
          mcpServers: [{ name: 'github', status: 'connected' }],
          slashCommands: ['commit', 'review'],
        }),
      );

      await windowB.send('session:join', { channelId });

      const initEvents = windowB.receivedEvents('session:init');
      expect(initEvents.length).toBeGreaterThan(0);
      const event = initEvents[0];
      expect(event.channelId).toBe(channelId);
      expect(event.model).toBe('claude-sonnet-4-6');
      expect(event.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(event.permissionMode).toBe('default');
      expect(event.fastModeState).toBe('off');
      expect(event.mcpServers).toEqual([{ name: 'github', status: 'connected' }]);
      expect(event.slashCommands).toEqual(['commit', 'review']);
    });

    it('joins an existing session and receives state + cwd', async () => {
      const { claude, channelId } = await setupSession();

      const result = await claude.send<JoinOk>('session:join', { channelId });

      expect(result.data.channelId).toBe(channelId);
      expect(result.data.state).toBe('idle');
      expect(result.data.cwd).toEqual(expect.any(String));
    });

    it('join returns busy state when session is streaming', async () => {
      const { claude, channelId } = await setupSession();

      // Send a message to make session busy (no result yet = still streaming)
      await claude.send('chat:send', { channelId, message: 'hello' });

      const result = await claude.send<JoinOk>('session:join', {
        channelId,
      });

      expect(result.data.state).toBe('busy');
    });

    it('returns error for non-existent session', async () => {
      const { claude } = await setupSession();

      const result = await claude.send<SessionJoinResponse>('session:join', {
        channelId: 'nonexistent',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Session not found');
    });

    it('resumes CLI with stored session_id when no live process exists', async () => {
      const { container, claude, channelId } = await setupSession();

      // Verify session was persisted with sessionId
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const record = await sessionStore.getByChannelId(channelId);
      expect(record?.id).toBe('cli-sess');

      // Kill the process
      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      // Rejoin — should resume with stored sessionId
      const result = await claude.send<JoinOk>('session:join', {
        channelId,
      });

      expect(result.ok).toBe(true);
      expect(result.data.channelId).toBe(channelId);
    });

    it('falls back to error when no live process and no DB record', async () => {
      const { claude } = await setupSession();

      const unknownChannelId = crypto.randomUUID();
      const result = await claude.send<SessionJoinResponse>('session:join', {
        channelId: unknownChannelId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Session not found');
    });

    it('emits session:history event before callback after join', async () => {
      const { claude, channelId } = await setupSession();

      // Send message + receive reply (stored in raw_events)
      await claude.send('chat:send', { channelId, message: 'hi' });
      await claude.emitSegment(s.assistant('hello world'));
      await claude.emitSegment(s.result());

      // Join same session — should get session:history socket event
      await claude.send<JoinOk>('session:join', { channelId });

      const names = historyEventNames(claude);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('message:assistant');
    });

    it('session:history contains user message after join', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'hi' });
      await claude.emitSegment(s.assistant('hello world'));
      await claude.emitSegment(s.result());

      await claude.send<JoinOk>('session:join', { channelId });

      const names = historyEventNames(claude);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('message:user');

      const historyBatch = claude.receivedEvents('session:history')[0]!;
      const userMessage = historyBatch.events.find(
        (e: { name: string }) => e.name === 'message:user',
      );
      const { content } = messageContentSchema.parse(userMessage?.payload);
      expect(content).toEqual([{ type: 'text', text: 'hi' }]);
    });

    it('session:history preserves user→assistant order after join', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'today?' });
      await claude.emitSegment(s.assistant('Tuesday'));
      await claude.emitSegment(s.result());

      await claude.send<JoinOk>('session:join', { channelId });

      const names = historyEventNames(claude);
      const userIdx = names.indexOf('message:user');
      const assistantIdx = names.indexOf('message:assistant');
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(assistantIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeLessThan(assistantIdx);
    });

    it('does not duplicate user message in history when CLI echoes it back', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'hello' });

      // CLI echoes the user message back through stdout (real CLI behavior)
      await claude.emitSegment(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          uuid: 'msg-echo',
        }),
      );

      await claude.emitSegment(s.assistant('hi there'));
      await claude.emitSegment(s.result());

      // Verify raw_event_store has both stdin and stdout records
      const rawStore = container.get<RawEventService>(TYPES.RawEventService);
      const mgr = getChannelManager(container);
      const channel = mgr.get(channelId)!;
      const rawEvents = await rawStore.getBySession(channel.sessionId!);
      const userRawEntries = rawEvents.filter((e) => {
        try {
          const obj = JSON.parse(e.raw.trim());
          return obj?.type === 'user';
        } catch {
          return false;
        }
      });
      // stdin + stdout echo = 2 raw events for one "hello"
      expect(userRawEntries.length).toBe(2);
      expect(userRawEntries.map((e) => e.direction).sort()).toEqual(['in', 'out']);

      // But session:history should deduplicate to exactly 1
      await claude.send<JoinOk>('session:join', { channelId });

      const historyBatch = claude.receivedEvents('session:history');
      expect(historyBatch.length).toBeGreaterThan(0);
      const userTextEvents = historyBatch[0]!.events.filter(
        (e: { name: string; payload: unknown }) => {
          if (e.name !== 'message:user') return false;
          const parsed = messageContentSchema.safeParse(e.payload);
          return (
            parsed.success &&
            parsed.data.content.some((b) => b.type === 'text' && b.text === 'hello')
          );
        },
      );
      expect(userTextEvents.length).toBe(1);
    });

    it('session:history contains only session:init when session has no user messages', async () => {
      const { claude, channelId } = await setupSession();
      // No sendMessage — only session_init in raw_events

      const result = await claude.send<JoinOk>('session:join', { channelId });

      expect(result.ok).toBe(true);
      const historyBatch = claude.receivedEvents('session:history');
      expect(historyBatch.length).toBeGreaterThan(0);
      expect(
        historyBatch[0]!.events.every((e: { name: string }) => e.name === 'session:init'),
      ).toBe(true);
    });

    it('session:history excludes transient stream events', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'hi' });
      await claude.emitSegment(s.messageStart());
      await claude.emitSegment(s.contentBlockStart(0, 'text'));
      await claude.emitSegment(s.textDelta('hello'));
      await claude.emitSegment(s.assistant('hello'));
      await claude.emitSegment(s.contentBlockStop(0));
      await claude.emitSegment(s.messageDelta());
      await claude.emitSegment(s.messageStop());
      await claude.emitSegment(s.result());

      await claude.send<JoinOk>('session:join', { channelId });

      const names = historyEventNames(claude);
      const streamTransient = names.filter((n) =>
        [
          'stream:chunk',
          'stream:block_start',
          'stream:block_stop',
          'stream:end',
          'stream:message_start',
          'stream:message_delta',
        ].includes(n),
      );
      expect(streamTransient).toEqual([]);
      expect(names).toContain('message:assistant');
    });

    it('chat:join callback returns the provided channelId (not internal CLI ID)', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'client-join-uuid';
      await claude.initialize(s.init('cli-sess'), { launch: { channelId: clientId } });

      const joinResult = await claude.send<JoinOk>('session:join', {
        channelId: clientId,
      });

      expect(joinResult.data.channelId).toBe(clientId);
    });
  });

  describe('session:created broadcast', () => {
    it('session:created fires on launch', async () => {
      const claude = createFakeSummoner().claude();

      const channelId = await claude.initialize();

      const createdEvents = claude.receivedEvents('session:created');
      expect(createdEvents.length).toBeGreaterThan(0);
      expect(createdEvents[0]!.channelId).toBe(channelId);
      expect(createdEvents[0]!.cwd).toEqual(expect.any(String));
    });
  });

  describe('session persist timing', () => {
    it('session record has sessionId immediately after launch', async () => {
      const { container, channelId } = await setupSession();
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await vi.waitFor(async () => {
        const record = await sessionStore.getByChannelId(channelId);
        expect(record).toBeDefined();
        expect(record!.id).toBeTruthy();
      });
    });

    it('session:created is NOT blocked when session:init has no sessionId', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);

      // session:init without sessionId (simulates delayed sessionId)
      const initWithoutSessionId = JSON.stringify({
        type: 'init',
        session_id: '',
      });
      const controlResp = JSON.stringify({
        type: 'control_response',
        response: { subtype: 'success', request_id: '' },
      });

      const channelId = crypto.randomUUID();
      await windowA
        .claude()
        .initialize({ launch: { channelId } }, initWithoutSessionId, controlResp);

      // session:created should fire even without sessionId
      await vi.waitFor(() => {
        const createdEvents = windowB.receivedEvents('session:created');
        expect(createdEvents.some((e) => e.channelId === channelId)).toBe(true);
      });
    });

    it('persist happens when session:init arrives with sessionId', async () => {
      const { container, channelId } = await setupSession();
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);

      // session:init already arrived during setup() — persist should have happened
      const record = await sessionStore.getByChannelId(channelId);
      expect(record).toBeDefined();
      expect(record!.id).toBe('cli-sess');
    });

    it('session:created is broadcast to second socket after launch', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      await windowA.claude().initialize(s.init('cli-sess'));

      // Launch a second session — windowB should receive session:created
      const newChannelId = crypto.randomUUID();
      await windowA.send('session:launch', { channelId: newChannelId });

      await vi.waitFor(() => {
        const createdEvents = windowB.receivedEvents('session:created');
        expect(createdEvents.some((e) => e.channelId === newChannelId)).toBe(true);
      });
    });
  });

  it('session:launch succeeds when initResult.response is undefined', async () => {
    const claude = createFakeSummoner().claude();
    // control_response without a nested response field (response.response is undefined)
    const controlResp = JSON.stringify({
      type: 'control_response',
      response: { subtype: 'success', request_id: '__PLACEHOLDER__' },
    });
    const channelId = await claude.initialize(s.init('sess-no-resp'), controlResp);

    expect(channelId).toBeTruthy();
    expect(channelId).not.toBe('');
  });

  describe('session:launch error logging', () => {
    it('logs error when session:launch fails', async () => {
      // NOTE: This test uses vi.spyOn(logger) because the error is swallowed internally
      // (session:launch catches and logs, not returning an error response to the client).
      // There is no observable socket event or response payload to assert on instead —
      // the only observable output is the logger call. Kept as-is intentionally.
      const claude = createFakeSummoner().claude();
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

      // Send invalid payload to trigger catch — missing required init segments
      await claude.send('session:launch', null);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to create session',
      );
      errorSpy.mockRestore();
    });
  });

  describe('session persistence', () => {
    it('session persists after socket disconnect (no grace kill)', async () => {
      const { claude } = await setupSession();

      claude.disconnect();
      await new Promise<void>((r) => queueMicrotask(r));

      // Process should still be alive (not killed on disconnect)
      expect(claude.handle.signal.aborted).toBe(false);
    });

    it('raw events are persisted to DB after session is created (no FK error)', async () => {
      const { container } = await setupSession();

      const rawEventService = container.get<RawEventService>(TYPES.RawEventService);
      const events = await rawEventService.getBySession('cli-sess');
      expect(events.length).toBeGreaterThan(0);
    });

    it('records each stdin message exactly once in raw event store', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'hello' });

      const rawEventService = container.get<RawEventService>(TYPES.RawEventService);
      const events = await rawEventService.getBySession('cli-sess');
      const stdinHellos = events.filter(
        (e) =>
          e.direction === 'in' && e.raw.includes('"hello"') && !e.raw.includes('control_request'),
      );
      expect(stdinHellos.length).toBe(1);
    });
  });

  describe('multi-socket', () => {
    it('session persists after socket disconnect (no kill)', async () => {
      const { claude } = await setupSession();

      claude.disconnect();
      await new Promise<void>((r) => queueMicrotask(r));

      expect(claude.handle.signal.aborted).toBe(false);
    });

    it('second client joins and receives user message via session:history', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'first msg' });
      await claude.emitSegment(s.assistant('reply'));
      await claude.emitSegment(s.result());

      const result = await claude.send<JoinOk>('session:join', { channelId });

      expect(result.ok).toBe(true);
      const names = historyEventNames(claude);
      expect(names).toContain('message:user');
    });
  });

  describe('multi-socket (A + B browsers)', () => {
    it('second socket joins same session and receives events', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      // B joins A's session
      await windowB.send('session:join', { channelId });

      // A sends message → CLI replies → both sockets receive
      await windowA.send('chat:send', { channelId, message: 'hello from A' });
      await windowA.claude().emitSegment(s.assistant('broadcast reply'));
      await windowA.claude().emitSegment(s.result());

      await vi.waitFor(() => {
        const bEvents = windowB.receivedEvents('message:assistant');
        expect(bEvents.length).toBeGreaterThan(0);
        expect(bEvents[0].channelId).toBe(channelId);
      });
    });

    it('window B receives only expected events when A sends a message (no cancel)', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      await windowB.send('session:join', { channelId });

      await windowA.send('chat:send', { channelId, message: 'hello' });
      await windowA.claude().emitSegment(s.assistant('hi'));
      await windowA.claude().emitSegment(s.result());

      // Wait for the assistant broadcast to reach windowB so any cancel
      // events scheduled earlier would have flushed too.
      await vi.waitFor(() => {
        expect(windowB.receivedEvents('message:assistant').length).toBeGreaterThan(0);
      });

      expect(windowB.receivedEvents('chat:cancel_request')).toHaveLength(0);
      expect(windowB.receivedEvents('control:cancel')).toHaveLength(0);
    });

    it('window B does NOT receive chat:cancel_request when A sends a message', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      await windowB.send('session:join', { channelId });

      // A sends message — should NOT trigger cancel_request on B
      await windowA.send('chat:send', { channelId, message: 'hello' });
      await windowA.claude().emitSegment(s.assistant('hi'));
      await windowA.claude().emitSegment(s.result());

      await vi.waitFor(() => {
        expect(windowB.receivedEvents('message:assistant').length).toBeGreaterThan(0);
      });
      expect(windowB.receivedEvents('chat:cancel_request')).toHaveLength(0);
    });

    it('window B receives chat:cancel_request when window A responds to permission', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      await windowB.send('session:join', { channelId });

      await windowA.send('chat:send', { channelId, message: 'go' });
      await windowA
        .claude()
        .emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: { file_path: '/tmp/x' } } }),
        );
      await windowA
        .claude()
        .emitSegment(s.controlRequest('req-ab', 'can_use_tool', 'Read', { file_path: '/tmp/x' }));

      // A responds → B gets chat:cancel_request
      await windowA.send('chat:respond', {
        requestId: 'req-ab',
        response: { behavior: 'allow', updatedInput: {} },
      });

      await vi.waitFor(() => {
        const bCancelEvents = windowB.receivedEvents('chat:cancel_request');
        expect(bCancelEvents.length).toBeGreaterThan(0);
        expect(bCancelEvents[0].targetRequestId).toBe('req-ab');
      });
    });

    // NOTE: "old socket does not receive events after disconnect" requires FakeSocket
    // to trigger server-side disconnect handler (socket.on('disconnect')). Currently
    // FakeSocket.disconnect() only sets connected=false locally. Deferred until FakeSocket
    // supports server-side disconnect notification.
  });

  describe('resume cross-window sync', () => {
    it('session:join lazy resume does NOT broadcast session:created', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      // Create history then kill process
      await windowA.send('chat:send', { channelId, message: 'hello' });
      await windowA.claude().emitSegment(s.assistant('world'));
      await windowA.claude().emitSegment(s.result());
      windowA.claude().handle.abort();
      // abort is a synchronous signal flip; server-side channel cleanup runs
      // via `for await` loop end + emit('exit') with no observable client
      // signal — keep a small wait for that to settle.
      await new Promise<void>((r) => setTimeout(r, 50));

      // windowB joins (triggers lazy resume)
      await windowB.send('session:join', { channelId });

      // Lazy resume should NOT broadcast session:created — session already exists.
      // The initial windowA.claude().initialize broadcasts session:created to all
      // sockets (including windowB); resume should NOT add another.
      const createdEvents = windowB.receivedEvents('session:created');
      const resumeCreatedEvents = createdEvents.filter((e) => e.channelId === channelId);
      expect(resumeCreatedEvents.length).toBeLessThanOrEqual(1);
    });
  });

  describe('close tab cross-window sync', () => {
    it('session:close broadcasts session:dead to all sockets', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      // socketA closes session
      await windowA.send('session:close', { channelId });

      await vi.waitFor(() => {
        const deadEvents = windowB.receivedEvents('session:dead');
        expect(deadEvents.length).toBeGreaterThan(0);
        expect(deadEvents[0].channelId).toBe(channelId);
      });
    });
  });

  describe('unified chat:create', () => {
    it('chat:create with channelId uses it as externalId for events', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'unified-client-uuid';

      const channelId = await claude.initialize(s.init('cli-sess'), {
        launch: { channelId: clientId },
      });
      expect(channelId).toBe(clientId);

      await claude.send('chat:send', { channelId: clientId, message: 'hello' });

      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(s.result());

      const events = claude.receivedEvents('message:assistant');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every((e) => e.channelId === clientId)).toBe(true);
    });

    it('chat:create with channelId emits chat:created with clientId', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'created-push-uuid';
      const createdPromise = new Promise<{ channelId: string }>((resolve) => {
        claude.on('session:created', resolve);
      });

      await claude.initialize(s.init('cli-sess'), { launch: { channelId: clientId } });
      const created = await createdPromise;

      expect(created.channelId).toBe(clientId);
    });

    it('chat:create with channelId + initialPrompt sends the prompt automatically', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'prompt-uuid';

      await claude.initialize(s.init('cli-sess'), {
        launch: { channelId: clientId, initialPrompt: 'do something' },
      });

      await claude.emitSegment(s.assistant('got it'));
      await claude.emitSegment(s.result());

      const events = claude.receivedEvents('message:assistant');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(
        events.some((e) => {
          const first = e.content?.[0];
          return first?.type === 'text' && first.text === 'got it';
        }),
      ).toBe(true);
    });

    it('chat:create with no params creates a new session (backward compat)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const channelId = await claude.initialize(s.init('cli-sess'), {
        launch: { channelId: 'test-no-params-compat' },
      });

      expect(channelId).toBeDefined();
      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)).toBeDefined();
    });
  });

  describe('chat:create with client-provided channelId', () => {
    it('uses client channelId for all chat:event emissions', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'stable-client-uuid';

      await claude.initialize(s.init('cli-sess'), { launch: { channelId: clientId } });

      await claude.send('chat:send', { channelId: clientId, message: 'hello' });

      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(s.result());

      const events = claude.receivedEvents('message:assistant');
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => e.channelId === clientId)).toBe(true);
    });

    it('chat:create callback returns the same clientId', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'my-client-uuid';
      const channelId = await claude.initialize(s.init('cli-sess'), {
        launch: { channelId: clientId },
      });

      expect(channelId).toBe(clientId);
    });

    it('chat:created push uses client channelId', async () => {
      const claude = createFakeSummoner().claude();
      const clientId = 'client-uuid-for-created';
      const createdPromise = new Promise<{ channelId: string }>((resolve) => {
        claude.on('session:created', resolve);
      });

      await claude.initialize(s.init('cli-sess'), { launch: { channelId: clientId } });
      const created = await createdPromise;

      expect(created.channelId).toBe(clientId);
    });

    it('rawEventService stores entries keyed by CLI session_id (not channelId)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      claude.initialize(s.init('cli-sess'));

      const clientId = 'canonical-client-uuid-raw';
      await claude.send('session:launch', { channelId: clientId });

      await claude.send('chat:send', { channelId: clientId, message: 'hello' });

      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(s.result());

      const rawEventService = container.get<RawEventService>(TYPES.RawEventService);
      const events = await rawEventService.getBySession('cli-sess');
      expect(events.length).toBeGreaterThan(0);
    });

    it('getRunner(clientId) returns the session after chat:create', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const clientId = 'direct-lookup-uuid';
      await claude.initialize(s.init('cli-sess'), { launch: { channelId: clientId } });

      const mgr = getChannelManager(container);
      expect(mgr.get(clientId)).toBeDefined();
    });
  });

  describe('chat:create with initOptions', () => {
    it('creates session with initOptions containing systemPrompt', async () => {
      const claude = createFakeSummoner().claude();

      const channelId = await claude.initialize(s.init('cli-sess'), {
        launch: { initOptions: { systemPrompt: 'test' } },
      });

      const initEvents = claude.receivedEvents('session:init');
      expect(channelId).toBeDefined();
      expect(initEvents.length).toBeGreaterThan(0);
    });
  });

  describe('session:launch', () => {
    it('returns slashCommands from initialize response', async () => {
      const claude = createFakeSummoner().claude();
      claude.initialize(s.init('fake-sess', { slashCommands: ['/help', '/clear'] }));

      const result = await claude.send<LaunchOk>('session:launch', {
        channelId: crypto.randomUUID(),
      });

      expect(result.data.slashCommands).toEqual(['/help', '/clear']);
    });

    it('creates a new session and returns channelId', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const channelId = await claude.initialize(s.init('cli-sess'));

      expect(channelId).toBeDefined();
      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)).toBeDefined();
    });

    it('sends initialPrompt if provided', async () => {
      const claude = createFakeSummoner().claude();

      const channelId = await claude.initialize(s.init('cli-sess'), {
        launch: { initialPrompt: 'hello world' },
      });

      await claude.emitSegment(s.assistant('response to prompt'));
      await claude.emitSegment(s.result());

      const events = claude.receivedEvents('message:assistant');
      expect(channelId).toBeDefined();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('session:resume reuse path', () => {
    it('returns existing channelId without spawning when sessionId has alive channel', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      const aliveChannelId = await claude.initialize(s.init('sess-target'));

      const result = await summoner.send<ResumeOk>('session:resume', {
        sessionId: 'sess-target',
      });

      expect(result.ok).toBe(true);
      expect(result.data.channelId).toBe(aliveChannelId);
    });
  });

  describe('session:resume dead path', () => {
    it('marks row dead and join fails when spawn fails with No conversation found', async () => {
      // With createEager, resume ack fires immediately (before CLI init).
      // CLI failure is surfaced via session:join failing (readyPromise rejects).
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      // No prepareInit — CLI won't auto-respond, simulating spawn failure

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'dead-resume-sess',
        channelId: 'ch-old',
        cwd: '/tmp/dead-resume',
      });

      // Resume ack comes immediately (tab appears)
      const resumeResult = await summoner.send<SessionResumeResponse>('session:resume', {
        sessionId: 'dead-resume-sess',
      });
      expect(resumeResult.ok).toBe(true);
      if (!resumeResult.ok) return;
      const newChannelId = resumeResult.data.channelId;

      // Trigger CLI failure
      await vi.waitFor(() => {
        expect(claude.provider.spawnCalls.length).toBeGreaterThan(0);
      });
      await claude.emitSegment(
        s.resultResumeNotFound({
          errors: ['No conversation found with session ID: dead-resume-sess'],
        }),
      );
      claude.handle.abort();

      // Join should fail because readyPromise rejects when CLI init fails
      const joinResult = await summoner.send<SessionJoinResponse>('session:join', {
        channelId: newChannelId,
      });
      expect(joinResult.ok).toBe(false);

      // Session must be marked dead
      await vi.waitFor(async () => {
        const record = await sessionStore.getById('dead-resume-sess');
        expect(record?.status).toBe('dead');
      });
    });
  });

  describe('session:resume spawn path', () => {
    it('spawns runner with --resume <sessionId>, persists row, returns new channelId', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      claude.prepareInit(s.init('sess-fresh'));

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-fresh',
        channelId: 'ch-prev',
        cwd: '/tmp/sess-fresh',
      });

      const result = await summoner.send<ResumeOk>('session:resume', {
        sessionId: 'sess-fresh',
      });

      expect(result.ok).toBe(true);
      expect(result.data.channelId).toBeTruthy();
      expect(result.data.channelId).not.toBe('sess-fresh');

      const lastSpawn = claude.provider.spawnCalls.at(-1);
      expect(lastSpawn).toBeDefined();
      const args = lastSpawn?.args ?? [];
      const resumeIdx = args.indexOf('--resume');
      expect(resumeIdx).toBeGreaterThanOrEqual(0);
      expect(args[resumeIdx + 1]).toBe('sess-fresh');

      await vi.waitFor(async () => {
        const row = await sessionStore.getById('sess-fresh');
        expect(row).toBeDefined();
        expect(row!.channelId).toBe(result.data.channelId);
      });
    });

    it('spawns child process with the historical row cwd (CLI JSONL lookup)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      claude.prepareInit(s.init('sess-with-cwd'));

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-with-cwd',
        channelId: 'ch-orig',
        cwd: '/tmp/some-project',
      });

      await summoner.send<ResumeOk>('session:resume', {
        sessionId: 'sess-with-cwd',
      });

      const lastSpawn = claude.provider.spawnCalls.at(-1);
      expect(lastSpawn?.options?.cwd).toBe('/tmp/some-project');
    });

    it('resumed channel persists slashCommands from initialize response (so session:join meta surfaces them)', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      // Simulate real CLI resume: system/init emission carries NO slash_commands
      // (the real CLI fixture has some baked in, so we strip them). Commands
      // arrive only via the initialize control_response. This forces
      // handleResume to capture them via applyInitResponseAndBroadcast.
      const initNoSlash = (() => {
        const obj = JSON.parse(s.init('sess-resume-slash'));
        delete obj.slash_commands;
        return JSON.stringify(obj);
      })();
      claude.prepareInit(
        initNoSlash,
        s.controlResponse('init', {
          commands: [{ name: 'commit' }, { name: 'review' }, { name: 'help' }],
        }),
      );

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-resume-slash',
        channelId: 'ch-prev',
        cwd: '/tmp/resume-slash',
      });

      const resumed = await summoner.send<ResumeOk>('session:resume', {
        sessionId: 'sess-resume-slash',
      });
      expect(resumed.ok).toBe(true);
      const newChannelId = resumed.data.channelId;

      const joined = await summoner.send<JoinOk>('session:join', { channelId: newChannelId });
      expect(joined.ok).toBe(true);
      expect(joined.data.meta.slashCommands).toEqual(['commit', 'review', 'help']);
    });

    it('session:created fires before CLI init completes (tab appears immediately)', async () => {
      // Regression: session:created was delayed until sendRequest('session:initialize') resolved.
      // Fix: createEager spawns + returns immediately; session:created fires before CLI responds.
      const container = createTestContainer();
      const server = createFakeServer(container);
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const _claude = windowA.claude();
      // No prepareInit — CLI won't auto-respond, simulating slow spawn

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-slow',
        channelId: 'ch-prev',
        cwd: '/tmp/sess-slow',
      });

      // Start resume — do NOT await; CLI hasn't responded yet
      const resumePromise = windowA.send<ResumeOk>('session:resume', { sessionId: 'sess-slow' });

      // session:created must arrive at windowB BEFORE CLI responds
      await vi.waitFor(() => {
        const created = windowB.receivedEvents('session:created');
        expect(created.some((e) => e.channelId !== 'ch-prev')).toBe(true);
      });

      // Ack must also arrive before CLI responds
      const result = await resumePromise;
      expect(result.ok).toBe(true);
    });

    it('session:join waits for CLI init before replaying history', async () => {
      // After createEager, join must not replay history until readyPromise resolves.
      const container = createTestContainer();
      const server = createFakeServer(container);
      const windowA = createFakeSummoner(server);
      const claude = windowA.claude();
      // No prepareInit — CLI won't auto-respond

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-join-wait',
        channelId: 'ch-prev2',
        cwd: '/tmp/sess-join-wait',
      });

      // Ack arrives before CLI init (createEager fires callback immediately after spawn)
      const resumeResult = await windowA.send<ResumeOk>('session:resume', {
        sessionId: 'sess-join-wait',
      });
      expect(resumeResult.ok).toBe(true);

      // Attempt join — should be pending until CLI responds
      let joinResolved = false;
      const joinPromise = windowA.send<JoinOk>('session:join', {
        channelId: resumeResult.data.channelId,
      });
      joinPromise.then(() => {
        joinResolved = true;
      });

      // Join should NOT resolve yet (CLI still hasn't responded)
      await new Promise<void>((r) => setTimeout(r, 50));
      expect(joinResolved).toBe(false);

      // CLI responds with control_response — resolves readyPromise → join can complete
      const reqId = claude.lastInitRequestId!;
      claude.handle.emit(s.controlResponse(reqId));

      await vi.waitFor(() => expect(joinResolved).toBe(true));
      const joined = await joinPromise;
      expect(joined.ok).toBe(true);
    });

    it('join ack contains slashCommands even when CLI init completes after resume ack', async () => {
      // Regression: readyPromise resolved before applyInitResponseAndBroadcast ran,
      // so handleJoin read an empty metaCache.slashCommands. Fix: override readyPromise
      // with the full chain after broadcast+ack.
      const container = createTestContainer();
      const server = createFakeServer(container);
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const claude = windowA.claude();
      // No prepareInit — CLI won't auto-respond, simulating slow spawn

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-slash-timing',
        channelId: 'ch-prev',
        cwd: '/tmp/sess-slash-timing',
      });

      // Resume acks before CLI init
      const resumed = await windowA.send<ResumeOk>('session:resume', {
        sessionId: 'sess-slash-timing',
      });
      expect(resumed.ok).toBe(true);
      const newChannelId = resumed.data.channelId;

      // windowB starts join — should wait on readyPromise (CLI still pending)
      let joinResolved = false;
      const joinPromise = windowB.send<JoinOk>('session:join', { channelId: newChannelId });
      joinPromise.then(() => {
        joinResolved = true;
      });

      await new Promise<void>((r) => setTimeout(r, 50));
      expect(joinResolved).toBe(false);

      // CLI responds with slashCommands in initialize response
      const reqId = claude.lastInitRequestId!;
      claude.handle.emit(
        s.controlResponse(reqId, { commands: [{ name: 'commit' }, { name: 'fix' }] }),
      );

      await vi.waitFor(() => expect(joinResolved).toBe(true));
      const joined = await joinPromise;
      expect(joined.ok).toBe(true);
      expect(joined.data.meta.slashCommands).toEqual(['commit', 'fix']);
    });

    it('multiple clients joining concurrently all wait for readyPromise and complete', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const windowC = createFakeSummoner(server);
      const claude = windowA.claude();

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-concurrent',
        channelId: 'ch-prev-conc',
        cwd: '/tmp/sess-concurrent',
      });

      const resumed = await windowA.send<ResumeOk>('session:resume', {
        sessionId: 'sess-concurrent',
      });
      expect(resumed.ok).toBe(true);
      const newChannelId = resumed.data.channelId;

      // B and C join concurrently while CLI is still pending
      const joinB = windowB.send<JoinOk>('session:join', { channelId: newChannelId });
      const joinC = windowC.send<JoinOk>('session:join', { channelId: newChannelId });

      // CLI responds
      const reqId = claude.lastInitRequestId!;
      claude.handle.emit(s.controlResponse(reqId));

      const [b, c] = await Promise.all([joinB, joinC]);
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(true);
    });

    it('resuming client receives session:created for the new channelId', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const windowA = createFakeSummoner(server);
      const claude = windowA.claude();

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      await upsertSession(sessionStore, {
        id: 'sess-self-notify',
        channelId: 'ch-old',
        cwd: '/tmp/sess-self-notify',
      });

      const resumed = await windowA.send<ResumeOk>('session:resume', {
        sessionId: 'sess-self-notify',
      });
      expect(resumed.ok).toBe(true);
      const newChannelId = resumed.data.channelId;

      const created = windowA.receivedEvents('session:created');
      expect(created.some((e) => e.channelId === newChannelId)).toBe(true);

      // Cleanup: let CLI respond so readyPromise doesn't leak
      claude.handle.emit(s.controlResponse(claude.lastInitRequestId!));
    });
  });

  describe('session:history two-client (A + B)', () => {
    type WindowASetup = (
      windowA: ReturnType<typeof createFakeSummoner>,
      channelId: string,
    ) => Promise<void>;

    async function setupTwoWindows(setupA: WindowASetup) {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const windowB = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));
      await setupA(windowA, channelId);
      await windowB.send<JoinOk>('session:join', { channelId });
      const historyNames = windowB
        .receivedEvents('session:history')
        .flatMap((b) => b.events.map((e: { name: string }) => e.name));
      return { windowA, windowB, channelId, historyNames };
    }

    it('B receives conversation history when joining after A', async () => {
      const { historyNames } = await setupTwoWindows(async (windowA, channelId) => {
        await windowA.send('chat:send', { channelId, message: 'hello from A' });
        await windowA.claude().emitSegment(s.assistant('reply from CLI'));
        await windowA.claude().emitSegment(s.result());
      });

      expect(historyNames).toContain('message:user');
      expect(historyNames).toContain('message:assistant');
      expect(historyNames).toContain('message:result');
    });

    it('session:history does not contain control:permission (denylist)', async () => {
      const { historyNames } = await setupTwoWindows(async (windowA, channelId) => {
        await windowA.send('chat:send', { channelId, message: 'go' });
        await windowA
          .claude()
          .emitSegment(s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: {} } }));
        await windowA.claude().emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Bash', {}));
      });

      expect(historyNames).not.toContain('control:permission');
    });

    it('B receives pending control:permission directly (not via session:history)', async () => {
      const { windowB, historyNames } = await setupTwoWindows(async (windowA, channelId) => {
        await windowA.send('chat:send', { channelId, message: 'go' });
        await windowA
          .claude()
          .emitSegment(s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: {} } }));
        await windowA.claude().emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Bash', {}));
      });

      await vi.waitFor(() => {
        expect(windowB.receivedEvents('control:permission').length).toBeGreaterThan(0);
      });
      expect(historyNames).not.toContain('control:permission');
    });
  });
});
