/* biome-ignore-all lint/suspicious/noExplicitAny: test file uses type assertions */

import type { SessionJoinResponse } from '@code-quest/schemas';
import { type FakeClaude, segments as s } from '@code-quest/test-kit';
import type { RawEventStore } from '../../../services/raw-event-store.ts';
import { createFakeServer, createFakeSummoner, setupSession } from '../../../test/index.ts';
import { TYPES } from '../../../types.ts';

type JoinOk = Extract<SessionJoinResponse, { ok: true }>;

async function setupLive() {
  return setupSession('task-live-sess');
}

async function setupHistory() {
  return setupSession('task-history-sess');
}

function historyEventNames(claude: FakeClaude): string[] {
  const batches = claude.receivedEvents('session:history') as Array<{
    events: Array<{ name: string }>;
  }>;
  if (!batches.length) return [];
  return batches[0]!.events.map((e) => e.name);
}

function historyEvents(claude: FakeClaude): Array<{ name: string; payload: unknown }> {
  const batches = claude.receivedEvents('session:history') as Array<{
    events: Array<{ name: string; payload: unknown }>;
  }>;
  if (!batches.length) return [];
  return batches[0]!.events;
}

describe('ChatHandler > message', () => {
  it('second window receives user message from emitToOthers', async () => {
    const server = createFakeServer();
    const windowA = createFakeSummoner(server);
    const windowB = createFakeSummoner(server);

    const channelId = await windowA.claude().initialize();
    await windowB.send('session:join', { channelId });

    await windowA.send('chat:send', { channelId, message: 'hello from A' });

    const socket2UserEvents = windowB.receivedEvents('message:user');
    expect(socket2UserEvents.length).toBeGreaterThan(0);
    expect(socket2UserEvents[0].content[0]).toMatchObject({
      type: 'text',
      text: 'hello from A',
    });
  });

  it('sender does not receive own user message via emitToOthers', async () => {
    const server = createFakeServer();
    const windowA = createFakeSummoner(server);
    const windowB = createFakeSummoner(server);

    const channelId = await windowA.claude().initialize();
    await windowB.send('session:join', { channelId });

    await windowA.send('chat:send', { channelId, message: 'hello from A' });

    // Sender should NOT receive message:user from emitToOthers
    expect(
      windowA.receivedEvents('message:user').filter((e) => {
        const first = e.content?.[0];
        return first?.type === 'text' && first.text === 'hello from A';
      }).length,
    ).toBe(0);
  });

  it('sends message and receives assistant text via chat:event', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'hi' });
    await claude.emitSegment(s.assistant('Hello!'));
    await claude.emitSegment(s.result());

    const events = claude.receivedEvents('message:assistant');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.content[0]).toMatchObject({ type: 'text', text: 'Hello!' });
  });

  it('forwards tool_use and tool_result events through control_request flow', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'read file' });

    claude.emitSegment(
      s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: { file_path: '/tmp/x' } } }),
    );
    await claude.emitSegment(
      s.controlRequest('req-1', 'can_use_tool', 'Read', { file_path: '/tmp/x' }),
    );

    expect(claude.receivedEvents('control:permission').length).toBeGreaterThan(0);

    await claude.send('chat:respond', {
      channelId,
      requestId: 'req-1',
      response: { behavior: 'allow', updatedInput: {} },
    });

    await claude.emitSegment(s.toolResult('toolu_1', 'file content'));
    await claude.emitSegment(s.assistant('Done'));
    await claude.emitSegment(s.result());

    expect(claude.receivedEvents('message:user').length).toBeGreaterThan(0);
    const texts = claude
      .receivedEvents('message:assistant')
      .map((e) => {
        const first = e.content?.[0];
        return first?.type === 'text' ? first.text : undefined;
      })
      .filter(Boolean);
    expect(texts).toContain('Done');
    expect(claude.receivedEvents('message:result').length).toBeGreaterThan(0);
  });

  it('emits stream:text for streamlined_text', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'go' });
    await claude.emitSegment(s.streamlinedText('fast mode text'));

    const textEvents = claude.receivedEvents('stream:text');
    expect(textEvents.length).toBeGreaterThan(0);
    expect(textEvents[0]!.text).toBe('fast mode text');
  });

  it('persists raw events to store', async () => {
    const { container, claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'hello' });

    await claude.emitSegment(s.assistant('ok'));
    await claude.emitSegment(s.result());

    const rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
    const stored = await rawEventService.getBySession('cli-sess');
    expect(stored.length).toBeGreaterThan(0);
  });

  it('silently ignores send_message for unknown session', async () => {
    const claude = createFakeSummoner().claude();

    await claude.send('chat:send', { channelId: 'unknown', message: 'hi' });

    // No error — test passes if we reach here
  });

  describe('chat:stop_task', () => {
    it('sends stop_task control_request to CLI', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:stop_task', { channelId, taskId: 'task-1' });

      expect(
        claude.received('control_request').some((r) => r.request.subtype === 'stop_task'),
      ).toBe(true);
    });
  });

  it('silently ignores control_response for unknown requestId', async () => {
    const claude = createFakeSummoner().claude();

    await claude.send('chat:respond', {
      requestId: 'req-1',
      response: { behavior: 'allow', updatedInput: {} },
    });

    // No error — test passes if we reach here
  });

  it('first chat:cancel sends interrupt, second chat:cancel aborts', async () => {
    const { claude, channelId } = await setupSession();

    // First cancel → interrupt (sends interrupt JSON via stdin)
    await claude.send('chat:cancel', { channelId });

    const afterFirst = claude.received().filter((r) => JSON.stringify(r).includes('"interrupt"'));
    expect(afterFirst.length).toBeGreaterThan(0);

    // Second cancel → abort
    await claude.send('chat:cancel', { channelId });

    expect(claude.handle.signal.aborted).toBe(true);
  });

  it('after session returns to idle, next cancel is graceful interrupt (not force abort)', async () => {
    const { claude, channelId } = await setupSession();

    // Turn 1: send message
    await claude.send('chat:send', { channelId, message: 'go' });

    await claude.emitSegment(s.assistant('turn1'));
    await claude.emitSegment(s.result());

    // Turn 2: cancel should be graceful (not abort) since session returned to idle
    await claude.send('chat:send', { channelId, message: 'go again' });

    await claude.send('chat:cancel', { channelId });

    expect(claude.handle.signal.aborted).toBe(false);
  });

  it('interrupts a session', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:cancel', { channelId });

    const received = claude.received();
    expect(received.some((r) => JSON.stringify(r).includes('"interrupt"'))).toBe(true);
  });

  it('cancel_request C→S calls respondToControlRequest with deny to unblock CLI', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'go' });

    claude.emitSegment(
      s.assistant({ toolUse: { id: 'toolu_cancel', name: 'Bash', input: { command: 'ls' } } }),
    );
    await claude.emitSegment(
      s.controlRequest('req-cancel-test', 'can_use_tool', 'Bash', { command: 'ls' }),
    );

    await claude.send('chat:cancel_request', { targetRequestId: 'req-cancel-test' });

    const received = claude.received();
    expect(
      received.some(
        (r) =>
          JSON.stringify(r).includes('req-cancel-test') && JSON.stringify(r).includes('"deny"'),
      ),
    ).toBe(true);
  });

  it('cancel_request C→S is received by server without error', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'go' });
    await claude.emitSegment(
      s.assistant({ toolUse: { id: 'toolu_c', name: 'Bash', input: { command: 'ls' } } }),
    );
    await claude.emitSegment(
      s.controlRequest('req-cancel-cs', 'can_use_tool', 'Bash', { command: 'ls' }),
    );

    await claude.send('chat:cancel_request', { targetRequestId: 'req-cancel-cs' });

    // No crash = success
  });

  describe('task events — local_agent / local_bash', () => {
    describe('live', () => {
      it('emits task:started when Agent tool spawns a local_agent', async () => {
        const { claude, channelId } = await setupLive();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(s.assistant('Starting sub-agent.'));
        await claude.emitSegment(
          s.agent('toolu_agent_a', 'Process files', {
            subagentType: 'general-purpose',
            prompt: 'Process all files in the project.',
          }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_agent_a', 'Process files', { taskType: 'local_agent' }),
        );

        const events = claude.receivedEvents('task:started');
        expect(events.length).toBe(1);
        expect(events[0]).toMatchObject({
          channelId,
          description: 'Process files',
          taskType: 'local_agent',
        });
      });

      it('emits task:progress during subagent execution', async () => {
        const { claude, channelId } = await setupLive();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(
          s.agent('toolu_agent_b', 'Process files', { subagentType: 'general-purpose' }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_agent_b', 'Process files', { taskType: 'local_agent' }),
        );

        const taskId = 'fake-task-1';
        await claude.emitSegment(
          s.taskProgress(taskId, {
            toolUseId: 'toolu_agent_b',
            description: 'Reading foo.ts',
            lastToolName: 'Read',
          }),
        );
        await claude.emitSegment(
          s.taskProgress(taskId, {
            toolUseId: 'toolu_agent_b',
            description: 'Editing foo.ts',
            lastToolName: 'Edit',
          }),
        );

        const events = claude.receivedEvents('task:progress');
        expect(events.length).toBe(2);
        expect(events[0]).toMatchObject({ channelId, description: 'Reading foo.ts' });
        expect(events[1]).toMatchObject({ channelId, description: 'Editing foo.ts' });
      });

      it('emits task:notification with completed status when subagent finishes', async () => {
        const { claude, channelId } = await setupLive();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(
          s.agent('toolu_agent_c', 'Process files', { subagentType: 'general-purpose' }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_agent_c', 'Process files', { taskType: 'local_agent' }),
        );

        const taskId = 'fake-task-1';
        await claude.emitSegment(
          s.taskNotification(taskId, {
            toolUseId: 'toolu_agent_c',
            status: 'completed',
            summary: 'Process files',
          }),
        );

        const events = claude.receivedEvents('task:notification');
        expect(events.length).toBe(1);
        expect(events[0]).toMatchObject({ channelId, status: 'completed' });
      });

      it('full flow: user → assistant → local_agent → task lifecycle → result', async () => {
        const { claude, channelId } = await setupLive();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(s.assistant('Starting sub-agent.'));
        await claude.emitSegment(
          s.agent('toolu_agent_d', 'Process files', {
            subagentType: 'general-purpose',
            prompt: 'Process all files.',
          }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_agent_d', 'Process files', { taskType: 'local_agent' }),
        );

        const taskId = 'fake-task-1';
        await claude.emitSegment(
          s.taskProgress(taskId, {
            toolUseId: 'toolu_agent_d',
            description: 'Reading foo.ts',
            lastToolName: 'Read',
          }),
        );
        await claude.emitSegment(
          s.taskProgress(taskId, {
            toolUseId: 'toolu_agent_d',
            description: 'Editing foo.ts',
            lastToolName: 'Edit',
          }),
        );
        await claude.emitSegment(
          s.taskNotification(taskId, {
            toolUseId: 'toolu_agent_d',
            status: 'completed',
            summary: 'Process files',
          }),
        );
        await claude.emitSegment(s.toolResult('toolu_agent_d', 'Done.'));
        await claude.emitSegment(s.assistant('All done.'));
        await claude.emitSegment(s.result());

        expect(claude.receivedEvents('message:assistant').length).toBeGreaterThan(0);
        expect(claude.receivedEvents('task:started').length).toBe(1);
        expect(claude.receivedEvents('task:progress').length).toBe(2);
        expect(claude.receivedEvents('task:notification').length).toBe(1);
        expect(claude.receivedEvents('message:result').length).toBe(1);
      });
    });

    describe('history', () => {
      it('task:started and task:notification appear in session:history after join', async () => {
        const { claude, channelId } = await setupHistory();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(s.assistant('Starting sub-agent.'));
        await claude.emitSegment(
          s.agent('toolu_agent_e', 'Process files', {
            subagentType: 'general-purpose',
            prompt: 'Process all files.',
          }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_agent_e', 'Process files', { taskType: 'local_agent' }),
        );

        const taskId = 'fake-task-1';
        await claude.emitSegment(
          s.taskProgress(taskId, {
            toolUseId: 'toolu_agent_e',
            description: 'Reading foo.ts',
            lastToolName: 'Read',
          }),
        );
        await claude.emitSegment(
          s.taskNotification(taskId, {
            toolUseId: 'toolu_agent_e',
            status: 'completed',
            summary: 'Process files',
          }),
        );
        await claude.emitSegment(s.toolResult('toolu_agent_e', 'Done.'));
        await claude.emitSegment(s.assistant('All done.'));
        await claude.emitSegment(s.result());

        await claude.send<JoinOk>('session:join', { channelId });

        const names = historyEventNames(claude);
        expect(names).toContain('message:user');
        expect(names).toContain('message:assistant');
        expect(names).toContain('task:started');
        expect(names).toContain('task:notification');
        expect(names).toContain('message:result');
      });

      it('task:started preserves taskType and description in history', async () => {
        const { claude, channelId } = await setupHistory();

        await claude.send('chat:send', { channelId, message: 'run a task' });
        await claude.emitSegment(
          s.agent('toolu_h1', 'Process files', { subagentType: 'general-purpose' }),
        );
        await claude.emitSegment(
          s.taskStarted('toolu_h1', 'Process files', { taskType: 'local_agent' }),
        );
        await claude.emitSegment(
          s.taskNotification('fake-task-1', {
            toolUseId: 'toolu_h1',
            status: 'completed',
            summary: 'Process files',
          }),
        );
        await claude.emitSegment(s.toolResult('toolu_h1', 'done'));
        await claude.emitSegment(s.assistant('Done.'));
        await claude.emitSegment(s.result());

        await claude.send<JoinOk>('session:join', { channelId });

        const events = historyEvents(claude);
        const taskStartedEvent = events.find((e) => e.name === 'task:started');
        expect(taskStartedEvent).toBeDefined();
        expect(taskStartedEvent!.payload).toMatchObject({
          description: 'Process files',
          taskType: 'local_agent',
        });
      });
    });
  });
});
