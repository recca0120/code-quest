import type { SessionJoinResponse } from '@code-quest/schemas';
import { segments as s } from '@code-quest/test-kit';
import type { RawEventStore } from '../../services/raw-event-store.ts';
import {
  createFakeServer,
  createFakeSummoner,
  createTestContainer,
  getChannelManager,
  setupSession,
} from '../../test/index.ts';
import { TYPES } from '../../types.ts';

describe('ChannelManager', () => {
  describe('create', () => {
    it('spawns runner, initializes, and stores channel', async () => {
      const { channelId, claude } = await setupSession('test-session-001');
      // Channel exists — init event was received and channel is stored
      expect(channelId).toBeTruthy();
      const initEvents = claude.receivedEvents('session:init');
      expect(initEvents.length).toBeGreaterThan(0);
      expect(initEvents[0]!.channelId).toBe(channelId);
    });

    it('creates multiple channels', async () => {
      const claude = createFakeSummoner().claude();

      const ch1 = await claude.initialize({ launch: { channelId: 'ch-1' } });
      const ch2 = await claude.initialize({ launch: { channelId: 'ch-2' } });

      expect(ch1).toBe('ch-1');
      expect(ch2).toBe('ch-2');
    });
  });

  describe('join', () => {
    it('returns channel and events for existing channel', async () => {
      const { claude, channelId } = await setupSession('test-session-001');

      const joinResult = await claude.send<SessionJoinResponse>('session:join', { channelId });

      expect(joinResult.ok).toBe(true);
      if (joinResult.ok) {
        expect(joinResult.data.channelId).toBe(channelId);
      }
    });

    it('returns error for unknown channel', async () => {
      const { claude } = await setupSession('test-session-001');

      const joinResult = await claude.send<SessionJoinResponse>('session:join', {
        channelId: 'nonexistent',
      });

      expect(joinResult.ok).toBe(false);
      if (!joinResult.ok) {
        expect(joinResult.error).toBeDefined();
      }
    });

    it('session:init emitted to joining socket contains model when channel is already alive', async () => {
      // Most common case: same server, second window joins an alive channel.
      // The session:init sent to the socket must include the model.
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner1 = createFakeSummoner(server);
      const claude1 = summoner1.claude();
      const channelId = await claude1.initialize(
        s.init('sess-alive-model', { model: 'claude-opus-4-6' }),
      );

      const summoner2 = createFakeSummoner(server);
      await summoner2.send<SessionJoinResponse>('session:join', { channelId });

      const initEvents = summoner2.receivedEvents('session:init');
      expect(initEvents.length).toBeGreaterThan(0);
      expect(initEvents[0].model).toBe('claude-opus-4-6');
    });

    it('session:init emitted to joining socket contains model when channel has exited', async () => {
      // Server restart scenario: channel not in memory, must restore from DB.
      // The session:init emitted to the new socket must still carry the correct model.
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner1 = createFakeSummoner(server);
      const claude1 = summoner1.claude();
      const channelId = await claude1.initialize(
        s.init('sess-exited-model', { model: 'claude-opus-4-6' }),
      );

      // Simulate channel exit
      claude1.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      // New summoner joins — channel must be lazily resumed from DB
      const summoner2 = createFakeSummoner(server);
      await summoner2.send<SessionJoinResponse>('session:join', { channelId });
      await new Promise<void>((r) => queueMicrotask(r));

      const initEvents = summoner2.receivedEvents('session:init');
      expect(initEvents.length).toBeGreaterThan(0);
      expect(initEvents[0].model).toBe('claude-opus-4-6');
    });
  });

  describe('destroy', () => {
    it('removes channel after destroy', async () => {
      const { claude, channelId } = await setupSession('test-session-001');

      await claude.send('session:close', { channelId });

      expect(claude.handle.signal.aborted).toBe(true);
    });

    it('session:closed fires after destroy', async () => {
      const { claude } = await setupSession('test-session-001');

      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      expect(claude.receivedEvents('session:closed').length).toBeGreaterThan(0);
    });
  });

  describe('getAllChannelIds', () => {
    it('session:states includes active channels', async () => {
      const claude = createFakeSummoner().claude();

      await claude.initialize({ launch: { channelId: 'ch-1' } });

      const statesEvents = claude.receivedEvents('session:states');
      expect(statesEvents.length).toBeGreaterThan(0);
      const sessions = statesEvents[0]!.sessions;
      expect(sessions.some((s: { channelId: string }) => s.channelId === 'ch-1')).toBe(true);
    });
  });

  describe('findByRequestId', () => {
    it('finds channel with pending control request', async () => {
      const { claude, channelId } = await setupSession('test-session-001');

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: {} } }),
      );
      await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Read', {}));

      const permEvents = claude.receivedEvents('control:permission');
      expect(permEvents.length).toBeGreaterThan(0);
      expect(permEvents[0]!.requestId).toBe('req-1');
    });
  });

  describe('raw event recording', () => {
    it('records stdin and stdout events', async () => {
      const { claude, channelId } = await setupSession('test-session-001');

      await claude.send('chat:send', { channelId, message: 'hello' });
      await claude.emitSegment(s.assistant('hi there'));
      await claude.emitSegment(s.result());

      // stdin: user message was sent to Claude
      expect(claude.received('user').length).toBeGreaterThan(0);
      // stdout: assistant message was received from Claude
      expect(claude.receivedEvents('message:assistant').length).toBeGreaterThan(0);
    });
  });

  describe('session state broadcasting', () => {
    it('broadcasts session:states on state change', async () => {
      const claude = createFakeSummoner().claude();

      await claude.initialize({ launch: { channelId: 'ch-1' } });

      const statesEvents = claude.receivedEvents('session:states');
      expect(statesEvents.length).toBeGreaterThan(0);
      const sessions = statesEvents[0]!.sessions;
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('session:states includes cwd', async () => {
      const claude = createFakeSummoner().claude();

      await claude.initialize({ launch: { channelId: 'ch-1', cwd: '/test/project' } });

      const statesEvents = claude.receivedEvents('session:states');
      expect(statesEvents.length).toBeGreaterThan(0);
      expect(statesEvents[0]!.sessions[0]!.cwd).toBe('/test/project');
    });
  });

  describe('getAliveSessionIds', () => {
    it('returns sessionIds of non-exited channels that have a sessionId', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      await summoner.claude().initialize(s.init('sess-alive'));

      const mgr = getChannelManager(container);
      expect(mgr.getAliveSessionIds()).toContain('sess-alive');
    });

    it('excludes sessionIds of exited channels', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      await claude.initialize(s.init('sess-zombie'));
      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      const mgr = getChannelManager(container);
      expect(mgr.getAliveSessionIds()).not.toContain('sess-zombie');
    });
  });

  describe('findAliveBySessionId', () => {
    it('returns the alive channel whose sessionId matches', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      await claude.initialize(s.init('sess-target'));

      const mgr = getChannelManager(container);
      const found = mgr.findAliveBySessionId('sess-target');

      expect(found).toBeDefined();
      expect(found?.sessionId).toBe('sess-target');
    });

    it('returns undefined when no alive channel matches', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      await createFakeSummoner(server).claude().initialize(s.init('sess-other'));

      const mgr = getChannelManager(container);
      expect(mgr.findAliveBySessionId('sess-missing')).toBeUndefined();
    });

    it('ignores exited channels', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      await claude.initialize(s.init('sess-zombie'));
      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      const mgr = getChannelManager(container);
      expect(mgr.findAliveBySessionId('sess-zombie')).toBeUndefined();
    });
  });

  describe('alive channels', () => {
    it('excludes exited channels from alive list', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      const channelId = await claude.initialize({ launch: { channelId: 'ch-exit' } });

      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      const mgr = getChannelManager(container);
      const channel = mgr.get(channelId);
      expect(channel?.exited).toBe(true);
    });
  });

  describe('duplicate channelId', () => {
    it('rejects launch with same channelId while channel is still alive', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      await claude.initialize({ launch: { channelId: 'ch-dup' } });

      const secondClaude = createFakeSummoner(server).claude();
      await expect(secondClaude.initialize({ launch: { channelId: 'ch-dup' } })).rejects.toThrow();
    });

    it('allows reuse of channelId after channel has exited', async () => {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const claude = createFakeSummoner(server).claude();
      await claude.initialize({ launch: { channelId: 'ch-reuse' } });

      claude.handle.abort();
      await new Promise<void>((r) => queueMicrotask(r));

      const secondClaude = createFakeSummoner(server).claude();
      const channelId = await secondClaude.initialize({ launch: { channelId: 'ch-reuse' } });
      expect(channelId).toBe('ch-reuse');
    });
  });

  describe('raw event persistence', () => {
    it('persists raw events to rawEventService', async () => {
      const { container, claude, channelId } = await setupSession('test-session-001');

      await claude.send('chat:send', { channelId, message: 'persist-test' });
      await claude.emitSegment(s.assistant('reply'));
      await claude.emitSegment(s.result());

      const rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
      const events = await rawEventService.getBySession('test-session-001');
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
