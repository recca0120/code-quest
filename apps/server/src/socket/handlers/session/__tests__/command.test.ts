/* biome-ignore-all lint/suspicious/noExplicitAny: test file uses type assertions */

import type { Ack, SessionListResponse } from '@code-quest/schemas';
import { segments as s } from '@code-quest/test-kit';
import type { RawEventStore } from '../../../../services/raw-event-store.ts';
import {
  createFakeServer,
  createFakeSummoner,
  createTestContainer,
  setupSession,
} from '../../../../test/index.ts';
import { TYPES } from '../../../../types.ts';

type UpdateStateResp = Ack;
type SessionListOk = Extract<SessionListResponse, { ok: true }>;

describe('ChatHandler > session', () => {
  describe('session:close', () => {
    it('close_channel terminates session immediately', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('session:close', { channelId });

      expect(claude.handle.signal.aborted).toBe(true);
    });

    it('emits chat:exit on process close', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'done' });
      await claude.emitSegment(s.assistant('bye'));
      await claude.emitSegment(s.result());
      await claude.send('session:close', { channelId });
      await new Promise<void>((r) => queueMicrotask(r));

      const closedEvents = claude.receivedEvents('session:closed');
      expect(closedEvents.length).toBeGreaterThan(0);
      expect(closedEvents[0]!.channelId).toBe(channelId);
    });

    it('kills a session', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('session:close', { channelId });

      expect(claude.handle.signal.aborted).toBe(true);
    });
  });

  describe('chat:cancel_request broadcast', () => {
    it('chat:cancel_request fires when permission is responded', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'read file' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: { file_path: '/tmp/x' } } }),
      );
      await claude.emitSegment(
        s.controlRequest('req-perm', 'can_use_tool', 'Read', { file_path: '/tmp/x' }),
      );

      await claude.send('chat:respond', {
        requestId: 'req-perm',
        response: { behavior: 'allow', updatedInput: {} },
      });

      const cancelEvents = claude.receivedEvents('chat:cancel_request');
      expect(cancelEvents.length).toBeGreaterThan(0);
      expect(cancelEvents[0]!.targetRequestId).toBe('req-perm');
    });
  });

  describe('session:list isActive', () => {
    it('session:list returns isActive=true for sessions with live process', async () => {
      const { claude, channelId } = await setupSession();

      const result = (await claude.send<SessionListResponse>('session:list', {})) as SessionListOk;

      expect(result.ok).toBe(true);
      const session = result.data.sessions.find((s: any) => s.channelId === channelId);
      expect(session).toBeDefined();
      expect(session!.isActive).toBe(true);
    });
  });
});

describe('session:update_state', () => {
  it('should broadcast state change to all sockets', async () => {
    const { claude, channelId } = await setupSession();

    const result = await claude.send<UpdateStateResp>('session:update_state', {
      channelId,
      title: 'New Title',
    });

    expect(result.ok).toBe(true);
    const matched = claude
      .receivedEvents('session:states')
      .flatMap((e) => e.sessions ?? [])
      .find((sc: any) => sc.channelId === channelId && sc.title === 'New Title');
    expect(matched).toBeDefined();
  });

  it('should broadcast state and title together', async () => {
    const { claude, channelId } = await setupSession();

    const result = await claude.send<UpdateStateResp>('session:update_state', {
      channelId,
      title: 'Busy Tab',
      state: 'busy',
    });

    expect(result.ok).toBe(true);
    const matched = claude
      .receivedEvents('session:states')
      .flatMap((e) => e.sessions ?? [])
      .find(
        (sc: any) => sc.channelId === channelId && sc.state === 'busy' && sc.title === 'Busy Tab',
      );
    expect(matched).toBeDefined();
  });

  it('should return error for invalid payload', async () => {
    const claude = createFakeSummoner().claude();

    const result = await claude.send<UpdateStateResp>('session:update_state', {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeDefined();
  });
});

describe('session:delete', () => {
  it('deletes raw events and deltas when session is deleted', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const claude = createFakeSummoner(server).claude();
    const channelId = await claude.initialize(s.init('sess-to-delete'));

    await claude.send('chat:send', { channelId, message: 'hello' });
    await claude.emitSegment(s.assistant('reply'));
    await claude.emitSegment(s.result());

    const rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
    const eventsBefore = await rawEventService.getBySession('sess-to-delete');
    expect(eventsBefore.length).toBeGreaterThan(0);

    const result = await claude.send<Ack>('session:delete', { channelId });
    expect(result.ok).toBe(true);

    const eventsAfter = await rawEventService.getBySession('sess-to-delete');
    expect(eventsAfter.length).toBe(0);
  });
});

describe('session_states_update enrichment', () => {
  it('should include system.init config fields in session_states_update after init', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'hello' });
    await claude.emitSegment(s.assistant('hi'));
    await claude.emitSegment(s.result());

    const sessions = claude.receivedEvents('session:states').flatMap((e) => e.sessions ?? []);
    const busyEntry = sessions.find((sc: any) => sc.channelId === channelId && sc.state === 'busy');
    expect(busyEntry).toBeDefined();
    expect(busyEntry!.channelId).toBe(channelId);
  });

  it('should not include config fields before system.init', async () => {
    const claude = createFakeSummoner().claude();

    await claude.initialize(s.init('cli-sess'));

    const sessions = claude.receivedEvents('session:states').flatMap((e) => e.sessions ?? []);
    expect(sessions.length).toBeGreaterThan(0);
    for (const sc of sessions) {
      expect(sc.channelId).toBeDefined();
      expect(sc.state).toBeDefined();
    }
  });

  it('should clear config cache on session exit', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'hello' });
    await claude.emitSegment(s.result());
    await claude.send('session:close', { channelId });
    await new Promise<void>((r) => queueMicrotask(r));

    const sessions = claude.receivedEvents('session:states').flatMap((e) => e.sessions ?? []);
    const exitedState = sessions.find(
      (sc: any) => sc.channelId === channelId && sc.state === 'exited',
    );
    expect(exitedState).toBeDefined();
  });
});
