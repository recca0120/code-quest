import { createTestContainer } from '@code-quest/server/test';
import { segments as s } from '@code-quest/test-kit';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from '@/components/chat/conversation/MessageList';
import { createFakeSummoner } from '@/test/fake-summoner';
import { joinChannel, setupClientWindows } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';

type Summoner = ReturnType<typeof createFakeSummoner>;

async function renderAndJoinB(
  summoner: ReturnType<typeof createFakeSummoner>,
  channelId: string,
): Promise<void> {
  await renderWithChannel(<MessageList />, { summoner, channelId, skipInit: true });
  await joinChannel(summoner, channelId);
}

async function setupLive() {
  const summoner = createFakeSummoner();
  const claude = summoner.claude();
  const channelId = crypto.randomUUID();
  await claude.initialize({ launch: { channelId } }, s.init('cli-session'));
  await renderWithChannel(<MessageList />, { summoner, channelId, skipInit: true });
  await act(async () => {
    await new Promise<void>((r) => queueMicrotask(r));
  });
  return { claude, summoner, channelId };
}

/**
 * Emit a sub-agent (local_agent) turn: agent tool_use → task lifecycle → tool_result → result.
 * Based on DB session 513938c2, toolu_01GcsJkEtLH54zSAGDbcBsQM (6 progress events → completed).
 */
async function emitAgentTurn(claude: ReturnType<Summoner['claude']>) {
  await claude.emitSegment(s.agent('toolu_agent1', 'Replace design tokens in remaining files'));
  await claude.emitSegment(
    s.taskStarted('toolu_agent1', 'Replace design tokens', { taskType: 'local_agent' }),
  );
  await claude.emitSegment(
    s.taskProgress('fake-task-1', {
      toolUseId: 'toolu_agent1',
      description: 'Editing src/components/HeroText.astro',
      lastToolName: 'Edit',
    }),
  );
  await claude.emitSegment(
    s.taskProgress('fake-task-1', {
      toolUseId: 'toolu_agent1',
      description: 'Editing src/pages/account/index.astro',
      lastToolName: 'Edit',
    }),
  );
  await claude.emitSegment(
    s.taskProgress('fake-task-1', {
      toolUseId: 'toolu_agent1',
      description: 'Final cleanup',
      lastToolName: 'Edit',
    }),
  );
  await claude.emitSegment(
    s.taskNotification('fake-task-1', { toolUseId: 'toolu_agent1', status: 'completed' }),
  );
  await claude.emitSegment(s.toolResult('toolu_agent1', 'All design tokens replaced'));
  await claude.emitSegment(s.result());
}

/**
 * Emit a local_bash turn: bash tool_use → task started → task completed → tool_result → result.
 * Based on DB session 513938c2, seq 906-907 (vitest run).
 */
async function emitBashTurn(claude: ReturnType<Summoner['claude']>) {
  await claude.emitSegment(
    s.assistant({
      toolUse: {
        id: 'toolu_bash1',
        name: 'Bash',
        input: { command: 'npx vitest run 2>&1 | tail -15' },
      },
    }),
  );
  await claude.emitSegment(
    s.taskStarted('toolu_bash1', 'npx vitest run', { taskType: 'local_bash' }),
  );
  await claude.emitSegment(
    s.taskNotification('fake-task-2', { toolUseId: 'toolu_bash1', status: 'completed' }),
  );
  await claude.emitSegment(s.toolResult('toolu_bash1', '728 tests passed'));
  await claude.emitSegment(s.result());
}

/**
 * Emit a full radix-tab conversation: agent turn → bash turn → text-only turn → result.
 * Modelled on DB session 513938c2, seq 852–942.
 */
async function emitFullConversation(claude: ReturnType<Summoner['claude']>) {
  // Sub-agent turn
  await claude.emitSegment(s.agent('toolu_agent1', 'Replace design tokens in remaining files'));
  await claude.emitSegment(
    s.taskStarted('toolu_agent1', 'Replace design tokens', { taskType: 'local_agent' }),
  );
  await claude.emitSegment(
    s.taskProgress('fake-task-1', {
      toolUseId: 'toolu_agent1',
      description: 'Editing src/components/HeroText.astro',
      lastToolName: 'Edit',
    }),
  );
  await claude.emitSegment(
    s.taskNotification('fake-task-1', { toolUseId: 'toolu_agent1', status: 'completed' }),
  );
  await claude.emitSegment(s.toolResult('toolu_agent1', 'All design tokens replaced'));

  // Text-only assistant turn
  await claude.emitSegment(s.assistant('Design tokens 已全部完成！728 tests 全過。'));

  await claude.emitSegment(s.result());
}

describe('radix-tab conversation: live path', () => {
  it('local_bash does not show Done badge (timeline dot handles status)', async () => {
    const { claude } = await setupLive();
    await act(() => emitBashTurn(claude));

    await waitFor(() => {
      expect(screen.getAllByText(/npx vitest run/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('completed Bash tool_use has green dot (not orange pulse)', async () => {
    const { claude } = await setupLive();
    await act(() => emitBashTurn(claude));

    await waitFor(() => {
      expect(screen.getAllByText(/npx vitest run/).length).toBeGreaterThan(0);
    });
    const bashItem = screen.getAllByText(/npx vitest run/)[0]!.closest('[data-message-id]');
    expect(bashItem).toBeInTheDocument();
    const dot = bashItem?.querySelector('[class*="bg-success"]');
    expect(dot).toBeInTheDocument();
    expect(bashItem?.querySelector('[class*="animate-pulse"]')).toBeNull();
  });

  it('Bash header shows truncated command when no description', async () => {
    const { claude } = await setupLive();
    const longCommand =
      'cd /Users/user/WebstormProjects/ganyuanbuy/apps/teasaren && npx vitest run 2>&1 | grep "Tests" && npx vitest run 2>&1 | grep "Tests"';
    await act(async () => {
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 'toolu_long', name: 'Bash', input: { command: longCommand } },
        }),
      );
      await claude.emitSegment(
        s.taskStarted('toolu_long', longCommand, { taskType: 'local_bash' }),
      );
      await claude.emitSegment(
        s.taskNotification('fake-task-x', { toolUseId: 'toolu_long', status: 'completed' }),
      );
      await claude.emitSegment(s.toolResult('toolu_long', 'Tests 222 passed'));
      await claude.emitSegment(s.result());
    });

    expect(screen.queryByText(longCommand)).not.toBeInTheDocument();
    expect(screen.getAllByText(/npx vitest run/).length).toBeGreaterThan(0);
  });

  it('Bash command renders with syntax highlighting', async () => {
    const { claude } = await setupLive();
    await act(() => emitBashTurn(claude));

    const matches = screen.getAllByText(/npx vitest run/);
    const highlighted = matches.find((el) => el.closest('[class*="language-"]'));
    expect(highlighted).toBeDefined();
  });

  it('does not show "Running..." after task completes', async () => {
    const { claude } = await setupLive();
    await act(() => emitAgentTurn(claude));

    await waitFor(() => {
      expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });

  it('text-only assistant turn has no orange pulsing dot', async () => {
    const { claude } = await setupLive();
    await act(() => emitFullConversation(claude));

    await waitFor(() => {
      expect(screen.getByText(/Design tokens/)).toBeInTheDocument();
    });

    const textMsg = screen.getByText(/Design tokens/).closest('[data-message-id]');
    expect(textMsg).toBeInTheDocument();
    const dot = textMsg?.querySelector('[class*="animate-pulse"]');
    expect(dot).toBeNull();
  });
});

describe('radix-tab conversation: history path (A sends, B joins)', () => {
  it('B does not see Running after sub-agent task completes in history', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'verify' });
    await emitAgentTurn(windowA.claude());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });

  it('B local_bash does not show Done badge from history (timeline dot handles status)', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'run tests' });
    await emitBashTurn(windowA.claude());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.getAllByText(/npx vitest run/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('B text-only assistant turn has no orange pulsing dot from history', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows();

    await windowA.send('chat:send', { channelId, message: 'check' });
    await emitFullConversation(windowA.claude());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.getByText(/Design tokens/)).toBeInTheDocument();
    });

    const textMsg = screen.getByText(/Design tokens/).closest('[data-message-id]');
    expect(textMsg).toBeInTheDocument();
    const dot = textMsg?.querySelector('[class*="animate-pulse"]');
    expect(dot).toBeNull();
  });

  it('B history with batching produces same result', async () => {
    const { windowA, windowB, channelId } = await setupClientWindows(
      createTestContainer({ historyBatchSize: 2 }),
    );

    await windowA.send('chat:send', { channelId, message: 'check' });
    await emitFullConversation(windowA.claude());

    await renderAndJoinB(windowB, channelId);

    await waitFor(() => {
      expect(screen.getByText(/Design tokens/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });
});
