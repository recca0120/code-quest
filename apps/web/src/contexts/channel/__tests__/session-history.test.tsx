import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { segments as s } from '@code-quest/test-kit';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from '@/components/chat/conversation/MessageList';
import { createFakeSummoner } from '@/test/fake-summoner';
import { joinChannel, setupClientWindows } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';

async function renderAndJoinB(
  summoner: ReturnType<typeof createFakeSummoner>,
  channelId: string,
): Promise<void> {
  await renderWithChannel(<MessageList />, { summoner, channelId, skipInit: true });
  await joinChannel(summoner, channelId);
}

describe('session:history multi-batch (historyBatchSize=2)', () => {
  it('B sees all messages when history spans multiple batches', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows(
      createTestContainer({ historyBatchSize: 2 }),
    );

    await windowA.send('chat:send', { channelId, message: 'msg 1' });
    await windowA.claude().emitSegment(s.assistant('reply 1'));
    await windowA.claude().emitSegment(s.result());
    await windowA.send('chat:send', { channelId, message: 'msg 2' });
    await windowA.claude().emitSegment(s.assistant('reply 2'));
    await windowA.claude().emitSegment(s.result());

    await renderAndJoinB(windowB, channelId);

    expect(screen.getByText('msg 1')).toBeInTheDocument();
    expect(screen.getByText('reply 1')).toBeInTheDocument();
    expect(screen.getByText('msg 2')).toBeInTheDocument();
    expect(screen.getByText('reply 2')).toBeInTheDocument();
  });
});

describe('session:history client rendering (A sends, B joins)', () => {
  it('B sees A conversation after join', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'hello from A' });
    await windowA.claude().emitSegment(s.assistant('reply from CLI'));
    await windowA.claude().emitSegment(s.result());

    await renderAndJoinB(windowB, channelId);

    expect(screen.getByText('hello from A')).toBeInTheDocument();
    expect(screen.getByText('reply from CLI')).toBeInTheDocument();
  });

  it('B sees error banner when A hit rate limit', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'go' });
    await windowA
      .claude()
      .emitSegment(s.resultWithError("You've hit your limit · resets 10:10am (Asia/Taipei)"));

    await renderAndJoinB(windowB, channelId);

    const banner = screen.getByText("You've hit your limit · resets 10:10am (Asia/Taipei)");
    expect(banner).toBeInTheDocument();
    expect(banner.closest('[data-type="error"]')).toBeInTheDocument();
    expect(document.querySelector('[data-type="result"]')).not.toBeInTheDocument();
  });

  it('control:permission does not appear in B messages', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'go' });
    await windowA
      .claude()
      .emitSegment(s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: {} } }));
    await windowA.claude().emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Bash', {}));

    await renderAndJoinB(windowB, channelId);

    expect(document.querySelector('[data-type="permission"]')).not.toBeInTheDocument();
  });

  it('B sees neither Running nor Done badge after A completed a local_agent task', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'verify' });
    await windowA.claude().emitSegment(s.agent('toolu_agent', 'Verify tokens'));
    await windowA
      .claude()
      .emitSegment(s.taskStarted('toolu_agent', 'Verify tokens', { taskType: 'local_agent' }));
    await windowA.claude().emitSegment(
      s.taskProgress('task-1', {
        toolUseId: 'toolu_agent',
        description: 'Reading files',
        lastToolName: 'Read',
      }),
    );
    await windowA
      .claude()
      .emitSegment(s.taskNotification('task-1', { toolUseId: 'toolu_agent', status: 'completed' }));
    await windowA.claude().emitSegment(s.toolResult('toolu_agent', 'All correct'));
    await windowA.claude().emitSegment(s.result());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('B sees task not Running even without task_notification (auto-complete from tool_result)', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'verify' });
    await windowA.claude().emitSegment(s.agent('toolu_agent', 'Verify tokens'));
    await windowA
      .claude()
      .emitSegment(s.taskStarted('toolu_agent', 'Verify tokens', { taskType: 'local_agent' }));
    // NO task_notification — tool_result should auto-complete
    await windowA.claude().emitSegment(s.toolResult('toolu_agent', 'All correct'));
    await windowA.claude().emitSegment(s.result());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });
});

describe('isConnecting state', () => {
  it('shows SpinnerVerb before join completes, then hides it', async () => {
    const { windowB, channelId } = await setupClientWindows();
    const held = windowB.holdEmit('session:join');

    await renderWithChannel(<MessageList />, { summoner: windowB, channelId, skipInit: true });

    expect(screen.getByLabelText('spinner-verb')).toBeInTheDocument();

    await act(() => held.release());

    await waitFor(() => {
      expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
    });
  });

  it('shows SpinnerVerb while joining, hides after history loads', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows(
      createTestContainer({ historyBatchSize: 1 }),
    );

    await windowA.send('chat:send', { channelId, message: 'msg 1' });
    await windowA.claude().emitSegment(s.assistant('reply 1'));
    await windowA.claude().emitSegment(s.result());
    await windowA.send('chat:send', { channelId, message: 'msg 2' });
    await windowA.claude().emitSegment(s.assistant('reply 2'));
    await windowA.claude().emitSegment(s.result());

    const held = windowB.holdEmit('session:join');

    await renderWithChannel(<MessageList />, { summoner: windowB, channelId, skipInit: true });

    expect(screen.getByLabelText('spinner-verb')).toBeInTheDocument();

    await act(() => held.release());

    await waitFor(() => {
      expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
      expect(screen.getByText('msg 1')).toBeInTheDocument();
      expect(screen.getByText('msg 2')).toBeInTheDocument();
    });
  });

  it('shows empty state (not SpinnerVerb) for new session after join', async () => {
    const server = createFakeServer();
    const summoner = createFakeSummoner(server);
    const channelId = await summoner.claude().initialize(s.init('cli-sess'));

    // renderWithChannel flushes join ACK → ChannelProvider transitions to connected
    await renderWithChannel(<MessageList />, { summoner, channelId, skipInit: true });

    // New session with no history → empty state, no SpinnerVerb
    expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
    expect(screen.getByText('Code Quest')).toBeInTheDocument();
  });
});
