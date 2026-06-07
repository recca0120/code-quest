import { segments as s } from '@code-quest/test-kit';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';
import { useChannelMessages } from '@/contexts/channel/ChannelMessagesContext';
import { type GroupId, useMessageVisibility } from '@/contexts/channel/MessageVisibilityContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { emitAssistantTurn, SendButton } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';
import { MessageList } from '../MessageList.tsx';

// Helper: toggle a group via the context from inside a rendered component
function ToggleGroup({ group }: { group: GroupId }) {
  const { toggleGroup } = useMessageVisibility();
  return (
    <button type="button" onClick={() => toggleGroup(group)}>
      toggle-{group}
    </button>
  );
}

function OpenPaletteButton() {
  const { openPalette } = useCommandPalette();
  return (
    <button type="button" onClick={() => openPalette({ tab: 'all' })}>
      open-palette
    </button>
  );
}

async function setup(props?: { searchQuery?: string }) {
  const summoner = createFakeSummoner();
  const claude = summoner.claude();
  const channelId = crypto.randomUUID();

  // Pre-create session on server so session:join succeeds during render
  await claude.initialize({ launch: { channelId } }, s.init('cli-session'));

  const result = await renderWithChannel(
    <>
      <SendButton message="Hello" />
      <MessageList {...props} />
    </>,
    { summoner, channelId, skipInit: true },
  );
  // Flush join ACK microtask so isConnecting becomes false before assertions
  await act(async () => {
    await new Promise<void>((r) => queueMicrotask(r));
  });
  return result;
}

/** Populate basic messages: user "Hello" + assistant "Hi there" + error "Oops" */
async function setupWithMessages(props?: { searchQuery?: string }) {
  const ctx = await setup(props);
  // User message
  await userEvent.click(screen.getByText('TriggerSend'));
  // Assistant message
  await act(async () => {
    await ctx.claude.emitSegment(s.assistant('Hi there'));
    await ctx.claude.emitSegment(s.resultError());
  });
  return ctx;
}

describe('scroll button visibility', () => {
  it('hides scroll button when not scrolled up', async () => {
    await setupWithMessages();
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).not.toBeInTheDocument();
  });

  it('scroll-to-bottom button is outside the scroll container (not inside overflow-y-auto)', async () => {
    await setupWithMessages();
    // Force show the button by simulating scroll state
    // The button should be a sibling of (or ancestor of) the scroll container,
    // not a descendant of it
    const messageList = screen.getByLabelText('message-list');
    const scrollContainer = screen.getByLabelText('message-list-scroll');
    // message-list is the outer positioning parent
    // message-list-scroll is the inner scroll container
    // button should NOT be inside message-list-scroll
    expect(messageList).toBeInTheDocument();
    expect(scrollContainer).toBeInTheDocument();
    expect(messageList).toContainElement(scrollContainer);
    // scroll container should NOT contain the button (button is sibling)
    expect(scrollContainer).not.toContainElement(
      scrollContainer.querySelector('[aria-label="Scroll to bottom"]'),
    );
  });
});

describe('MessageList', () => {
  it('renders all messages', async () => {
    await setupWithMessages();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/Hi there/)).toBeInTheDocument();
  });

  it('renders unknown type messages (registers type so message passes visibility filter)', async () => {
    function AddUnknown() {
      const { addSystemMessage } = useChannelMessages();
      return (
        <button
          type="button"
          onClick={() => addSystemMessage('future_event_xyz', 'custom content')}
        >
          add-unknown
        </button>
      );
    }
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = crypto.randomUUID();
    await claude.initialize({ launch: { channelId } }, s.init('cli-session'));
    await renderWithChannel(
      <>
        <AddUnknown />
        <MessageList />
      </>,
      { summoner, channelId, skipInit: true },
    );
    await userEvent.click(screen.getByText('add-unknown'));
    expect(screen.getByText('custom content')).toBeInTheDocument();
  });

  it('renders empty state with welcome text when no messages', async () => {
    await setup();
    await waitFor(() => {
      expect(screen.getByText(/how can i help/i)).toBeInTheDocument();
    });
  });

  it('renders user and assistant messages without avatar badges', async () => {
    await setupWithMessages();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/Hi there/)).toBeInTheDocument();
  });

  it('renders consecutive same-role messages without role labels', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('First'));
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.assistant('Second'));
      await claude.emitSegment(s.result());
    });
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders message-list container with messages', async () => {
    await setupWithMessages();
    const list = screen.getByLabelText('message-list');
    expect(list).toBeInTheDocument();
    expect(list.textContent).toContain('Hello');
  });

  it('nests child messages under their parent tool_use', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('Starting'));
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.assistant('Sub output', { parentToolUseId: 'toolu_1' }));
      await claude.emitSegment(s.assistant('Done'));
      await claude.emitSegment(s.result());
    });
    expect(screen.getByText('Starting')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    // Agent tool_use renders directly (solo); CollapsibleBlock header has the description
    await user.click(screen.getByText('Explore project'));
    expect(screen.getByText('Sub output')).toBeInTheDocument();
    expect(screen.getByText(/1 subagent message/)).toBeInTheDocument();
  });

  it('groups consecutive tool_use from separate turns into one chip', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'tu1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.toolResult('tu1', 'file1.ts'));
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'tu2', name: 'Bash', input: { command: 'pwd' } } }),
      );
      await claude.emitSegment(s.toolResult('tu2', '/src'));
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'tu3', name: 'Bash', input: { command: 'cat' } } }),
      );
      await claude.emitSegment(s.toolResult('tu3', 'content'));
      await claude.emitSegment(s.result());
    });
    // should show ONE chip "Bash ×3", not three separate chips
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('×3')).toBeInTheDocument();
  });

  it('shows all messages when searchQuery is empty', async () => {
    await setupWithMessages({ searchQuery: '' });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/Hi there/)).toBeInTheDocument();
  });

  it('filters messages by searchQuery', async () => {
    await setupWithMessages({ searchQuery: 'Hello' });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryByText(/Hi there/)).not.toBeInTheDocument();
  });

  it('shows correct count for multiple subagent messages', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Analyse files'));
      await claude.emitSegment(s.assistant('Child 1', { parentToolUseId: 'toolu_1' }));
      await claude.emitSegment(s.assistant('Child 2', { parentToolUseId: 'toolu_1' }));
      await claude.emitSegment(s.result());
    });
    await user.click(screen.getByText('Analyse files'));
    expect(screen.getByText(/2 subagent messages/)).toBeInTheDocument();
  });

  it('shows stop button in subagent header', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Analyse files'));
      await claude.emitSegment(s.assistant('Sub output', { parentToolUseId: 'toolu_1' }));
    });
    await user.click(screen.getByText('Analyse files'));
    expect(screen.getByTitle('Stop subagent')).toBeInTheDocument();
  });

  it('stop subagent button remains visible after click', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Analyse files'));
      await claude.emitSegment(s.assistant('Child', { parentToolUseId: 'toolu_1' }));
    });
    await user.click(screen.getByText('Analyse files'));
    await user.click(screen.getByTitle('Stop subagent'));
    expect(screen.getByTitle('Stop subagent')).toBeInTheDocument();
  });

  it('renders Read tool_result array content as code (not "[object Object]")', async () => {
    const { claude } = await setup();
    // Build a raw tool_result segment with array content (as real extension sends)
    const arrayToolResult = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_read_1',
            content: [
              { type: 'text', text: 'import React from "react";\nexport function Foo() {}' },
            ],
          },
        ],
      },
      parent_tool_use_id: null,
      uuid: 'fake-read-result-1',
    });
    await act(async () => {
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 'toolu_read_1', name: 'Read', input: { file_path: '/Foo.tsx' } },
        }),
      );
      await claude.emitSegment(arrayToolResult);
    });
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    // SyntaxHighlighter splits tokens — check via container textContent
    expect(document.body.textContent).toContain('import');
    expect(document.body.textContent).toContain('React');
  });

  it('hidden tool_use (TodoWrite in debug group, off by default) also hides its merged tool_result', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_todo_1', name: 'TodoWrite', input: { todos: [] } } }),
      );
      await claude.emitSegment(
        s.toolResult(
          'toolu_todo_1',
          'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress.',
        ),
      );
    });
    // Debug group (tool_use:TodoWrite) is off by default.
    // The TodoWrite block itself must not render; there must be no orphan
    // "Result" collapsible left behind that exposes its merged content.
    expect(screen.queryByText('TodoWrite')).not.toBeInTheDocument();
    const resultButtons = screen
      .queryAllByRole('button')
      .filter((el) => el.textContent?.startsWith('✓'));
    expect(resultButtons).toHaveLength(0);
    // Even when a stray Result button exists, the merged body stays hidden —
    // guard against someone re-expanding via click exposing the text.
    const maybeResult = screen.queryByText('Result');
    if (maybeResult) await user.click(maybeResult);
    expect(screen.queryByText(/Todos have been modified successfully/)).not.toBeInTheDocument();
  });

  it('visible tool_use still merges its tool_result (regression)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_grep_1', name: 'Grep', input: { pattern: 'foo' } } }),
      );
      await claude.emitSegment(s.toolResult('toolu_grep_1', 'match found'));
    });
    expect(screen.getByText(/match found/)).toBeInTheDocument();
  });

  it('renders tool_result merged into tool_use collapsible with diff', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 'toolu_edit_1', name: 'Edit', input: { file_path: '/file.txt' } },
        }),
      );
      await claude.emitSegment(
        s.toolResult('toolu_edit_1', '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new'),
      );
    });
    expect(screen.getByText('-old')).toBeInTheDocument();
    expect(screen.getByText('+new')).toBeInTheDocument();
  });
});

describe('MessageList — task lifecycle', () => {
  it('shows Running badge when task_started fires', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
    });
    const runningElements = screen.getAllByText(/Running/);
    expect(runningElements.length).toBeGreaterThan(0);
  });

  it('does not crash when task_started has no toolUseId match', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('unknown-id', 'Some task'));
    });
    // Task badge should not show "Running" — the "Running..." inside tool body is separate
    const badges = screen.queryAllByText(/Running$/);
    expect(badges).toHaveLength(0);
  });

  it('shows Running badge with progress detail on task_progress', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskProgress('task-1', {
          toolUseId: 'toolu_1',
          description: 'Reading main.ts',
          lastToolName: 'Read',
        }),
      );
    });
    expect(screen.getByText(/Running · Reading main.ts/)).toBeInTheDocument();
  });

  it('does not show Done badge on task_notification completed (timeline handles done state)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskNotification('task-1', {
          toolUseId: 'toolu_1',
          status: 'completed',
          summary: 'Found 3 issues',
        }),
      );
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('does not show Done badge when no summary provided (timeline handles done state)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskNotification('task-1', { toolUseId: 'toolu_1', status: 'completed' }),
      );
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('does not show Failed badge on task_notification failed (timeline handles status)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskNotification('task-1', { toolUseId: 'toolu_1', status: 'failed' }),
      );
    });
    expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
  });

  it('ignores task_notification when status is absent (no badge change)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskNotification('task-1', { toolUseId: 'toolu_1', status: null }),
      );
    });
    // status undefined → should not flip to Done; Running badge should remain
    const runningElements = screen.getAllByText(/Running/);
    expect(runningElements.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('shows model in subagent children header', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.assistant('Child output', { parentToolUseId: 'toolu_1' }));
      await claude.emitSegment(s.result());
    });
    await user.click(screen.getByText('Explore project'));
    expect(screen.getByText('claude-opus-4-6')).toBeInTheDocument();
  });

  it('does not show token count badge on task completion (timeline handles done state)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project'));
      await claude.emitSegment(s.taskStarted('toolu_1', 'Explore project'));
      await claude.emitSegment(
        s.taskNotification('task-1', {
          toolUseId: 'toolu_1',
          status: 'completed',
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
      );
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('shows Running badge for local_bash task on Bash tool_use', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'grep foo' } } }),
      );
      await claude.emitSegment(s.taskStarted('toolu_1', 'Run grep', { taskType: 'local_bash' }));
    });
    const badges = screen.getAllByText(/Running/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('local_bash: tool_result auto-completes taskStatus (no badge shown, timeline dot handles status)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'grep foo' } } }),
      );
      await claude.emitSegment(s.taskStarted('toolu_1', 'Run grep', { taskType: 'local_bash' }));
      await claude.emitSegment(s.toolResult('toolu_1', 'match found'));
    });
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Running$/)).not.toBeInTheDocument();
  });

  it('shows subagent badge in task header when subagent_type is provided', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_1', 'Explore project', { subagentType: 'Explore' }));
      await claude.emitSegment(s.result());
    });
    expect(screen.getByText('subagent')).toBeInTheDocument();
  });
});

describe('MessageList — local_bash / local_agent real protocol sequence', () => {
  it('local_bash: text + Bash tool_use with task badge shows in one timeline', async () => {
    const { claude } = await setup();
    await act(async () => {
      // AI says text + starts a Bash tool
      await claude.emitSegment(s.textDelta('Refactoring done. Let me verify tests:'));
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 'toolu_bash', name: 'Bash', input: { command: 'vitest run' } },
        }),
      );
      await claude.emitSegment(s.messageStop());
      // task_started marks it as local_bash
      await claude.emitSegment(
        s.taskStarted('toolu_bash', 'Run tests', { taskType: 'local_bash' }),
      );
      // tool_result arrives
      await claude.emitSegment(s.toolResult('toolu_bash', 'Tests 22 passed'));
    });

    // Text "Refactoring done" should render
    expect(screen.getByText(/Refactoring done/)).toBeInTheDocument();
    // Bash tool_use should render with command visible
    expect(screen.getAllByText(/vitest run/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tests 22 passed/).length).toBeGreaterThan(0);
    // local_bash: no Done badge (timeline dot handles status)
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('local_agent: sub-agent messages nest under parent tool_use, not mixed into main', async () => {
    const { claude } = await setup();
    await act(async () => {
      // AI says text + starts an Agent tool
      await claude.emitSegment(s.textDelta('Let me analyze.'));
      await claude.emitSegment(s.agent('toolu_agent', 'Analyze code'));
      await claude.emitSegment(s.messageStop());
      await claude.emitSegment(s.taskStarted('toolu_agent', 'Analyze code'));
      // Sub-agent does work (child messages with parentToolUseId)
      await claude.emitSegment(s.assistant('Found 3 issues', { parentToolUseId: 'toolu_agent' }));
      await claude.emitSegment(s.toolResult('toolu_agent', 'Analysis complete'));
    });

    // Main text should render
    expect(screen.getByText(/Let me analyze/)).toBeInTheDocument();
    // Agent tool_use header should be visible (may appear multiple times: header + task_started)
    expect(screen.getAllByText('Analyze code').length).toBeGreaterThan(0);
    // Sub-agent child message should be nested (visible inside SubagentChildren)
    expect(screen.getByText(/1 subagent message/)).toBeInTheDocument();
    // Sub-agent's text is rendered inside the nested section
    expect(screen.getByText(/Found 3 issues/)).toBeInTheDocument();
    // Done is handled by timeline, not by task badge
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });

  it('replay: local_agent task shows Done after history completes (not stuck on Running)', async () => {
    const { claude } = await setup();
    await act(async () => {
      // Replay sequence: agent tool_use → task_started → progress × 2 → notification(completed)
      await claude.emitSegment(s.agent('toolu_agent', 'Verify tokens'));
      await claude.emitSegment(
        s.taskStarted('toolu_agent', 'Verify tokens', { taskType: 'local_agent' }),
      );
      await claude.emitSegment(
        s.taskProgress('task-1', {
          toolUseId: 'toolu_agent',
          description: 'Reading Footer.astro',
          lastToolName: 'Read',
        }),
      );
      await claude.emitSegment(
        s.taskProgress('task-1', {
          toolUseId: 'toolu_agent',
          description: 'Reading Header.astro',
          lastToolName: 'Read',
        }),
      );
      await claude.emitSegment(
        s.taskNotification('task-1', { toolUseId: 'toolu_agent', status: 'completed' }),
      );
      await claude.emitSegment(s.toolResult('toolu_agent', 'All tokens correct'));
      await claude.emitSegment(s.result());
    });

    // Should NOT show Running (task completed); Done is handled by timeline
    expect(screen.queryByText(/Running/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
  });
});

describe('MessageList streaming', () => {
  it('shows statusText via SpinnerVerb when processing', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.status({ status: 'Compacting' }));
    });
    const verb = screen.getByLabelText('spinner-verb');
    expect(verb.textContent).toContain('Compacting');
  });

  it('shows random verb when statusText is null', async () => {
    await setupWithMessages();
    // After result, not processing — no spinner
    expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
  });

  it('does not show spinner when not processing', async () => {
    await setup();
    expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
  });

  // ── Streaming pipeline ──

  it('text_delta accumulates and renders', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.textDelta('Hello'));
      await claude.emitSegment(s.textDelta(' world'));
    });

    expect(await screen.findByText(/Hello world/)).toBeInTheDocument();
  });

  it('thinking_delta accumulates and renders', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.thinkingDelta('Let me'));
      await claude.emitSegment(s.thinkingDelta(' think about this'));
    });

    // ThinkingBlock collapses by default — expand to verify content
    const trigger = await screen.findByRole('button', { name: /thinking/i });
    await userEvent.click(trigger);
    expect(await screen.findByText(/Let me think about this/)).toBeInTheDocument();
  });

  it('message_end finalizes streaming, next delta starts new message', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.textDelta('First message'));
      await claude.emitSegment(s.messageStop());
      await claude.emitSegment(s.textDelta('Second message'));
      await claude.emitSegment(s.messageStop());
    });
    await emitAssistantTurn(claude, 'Second message');

    expect(await screen.findByText(/First message/)).toBeInTheDocument();
    expect(screen.queryAllByText(/Second message/).length).toBeGreaterThan(0);
  });

  it('thinking_delta shows "Thinking..." while streaming', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.thinkingDelta('Let me'));
      await claude.emitSegment(s.thinkingDelta(' think'));
    });

    const allThinking = screen.queryAllByText('Thinking...');
    if (allThinking.length !== 1) {
      console.log('[DEBUG] Found', allThinking.length, 'elements with "Thinking..."');
      console.log('[DEBUG] DOM:', document.body.innerHTML);
    }
    expect(await screen.findByText('Thinking...')).toBeInTheDocument();
  });

  it('thinking shows "Thought for Xs" after result arrives', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.thinkingDelta('Let me think'));
      await claude.emitSegment(s.thinking('Let me think'));
      await claude.emitSegment(s.assistant('answer'));
      await claude.emitSegment(s.result({ durationMs: 3000 }));
    });

    expect(await screen.findByText('Thought for 3s')).toBeInTheDocument();
  });

  it('thinking_delta followed by thinking does not duplicate', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.thinkingDelta('Let me'));
      await claude.emitSegment(s.thinkingDelta(' think...'));
      await claude.emitSegment(s.thinking('Let me think...'));
    });
    await emitAssistantTurn(claude, 'ok');

    // Expand ThinkingBlock — Radix Collapsible removes content from DOM when closed
    const trigger = screen.getByRole('button', { name: /thought for/i });
    await userEvent.click(trigger);
    const thinkElements = screen.queryAllByText(/Let me think\.\.\./);
    expect(thinkElements).toHaveLength(1);
  });

  it('assistant replay after text_delta does not duplicate', async () => {
    const { claude } = await setup();
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.textDelta('hello'));
      await claude.emitSegment(s.textDelta(' world'));
      await claude.emitSegment(s.assistant('hello world'));
      await claude.emitSegment(s.messageStop());
      await claude.emitSegment(s.result());
    });

    const matches = screen.queryAllByText(/hello world/);
    expect(matches).toHaveLength(1);
  });
});

describe('MessageList scrollToMessage highlight', () => {
  async function setupWithRef() {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = crypto.randomUUID();
    await claude.initialize({ launch: { channelId } }, s.init('cli-session'));
    const ref = createRef<React.ComponentRef<typeof MessageList>>();
    const ctx = await renderWithChannel(<MessageList ref={ref} />, {
      summoner,
      channelId,
      skipInit: true,
    });
    await act(async () => {
      await claude.emitSegment(s.assistant('Target message'));
      await claude.emitSegment(s.result());
    });
    return { ...ctx, ref };
  }

  it('adds spotlight-highlight on [data-type] element (not the outer wrapper)', async () => {
    const { ref } = await setupWithRef();
    const wrapper = document.querySelector('[data-message-id]') as HTMLElement;
    const messageEl = wrapper?.querySelector('[data-type]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(messageEl).toBeTruthy();

    act(() => {
      ref.current?.scrollToMessage(wrapper.dataset.messageId!);
    });

    expect(messageEl.dataset.highlighted).toBe('true');
    expect(wrapper.dataset.highlighted).toBeUndefined();
  });

  it('removes spotlight-highlight after animationend fires', async () => {
    const { ref } = await setupWithRef();
    const wrapper = document.querySelector('[data-message-id]') as HTMLElement;
    const messageEl = wrapper?.querySelector('[data-type]') as HTMLElement;

    act(() => {
      ref.current?.scrollToMessage(wrapper.dataset.messageId!);
    });
    expect(messageEl.dataset.highlighted).toBe('true');

    act(() => {
      messageEl.dispatchEvent(new Event('animationend', { bubbles: false }));
    });
    expect(messageEl.dataset.highlighted).toBeUndefined();
  });

  it('re-triggers animation when called twice on the same message', async () => {
    const { ref } = await setupWithRef();
    const wrapper = document.querySelector('[data-message-id]') as HTMLElement;
    const messageEl = wrapper?.querySelector('[data-type]') as HTMLElement;

    act(() => {
      ref.current?.scrollToMessage(wrapper.dataset.messageId!);
    });
    act(() => {
      messageEl.dispatchEvent(new Event('animationend', { bubbles: false }));
    });
    // highlighted removed; call again
    act(() => {
      ref.current?.scrollToMessage(wrapper.dataset.messageId!);
    });
    expect(messageEl.dataset.highlighted).toBe('true');
  });
});

describe('MessageList visibility filtering', () => {
  it('hides messages in hidden groups (hooks off by default)', async () => {
    const { claude } = await renderWithChannel(<MessageList />);
    await act(async () => {
      await claude.emitSegment(s.hookStarted('hook-1', 'my-hook', 'pre_tool_use'));
      await claude.emitSegment(s.result());
    });
    // hook_started is in Hooks group which is off by default
    expect(screen.queryByText(/hook-1/i)).not.toBeInTheDocument();
  });

  it('shows messages in visible groups (conversation on by default)', async () => {
    const { claude } = await renderWithChannel(<MessageList />);
    await act(async () => {
      await claude.emitSegment(s.assistant('Hello from assistant'));
      await claude.emitSegment(s.result());
    });
    expect(screen.getByText(/Hello from assistant/)).toBeInTheDocument();
  });

  it('toggleGroup off hides messages of that group', async () => {
    const user = userEvent.setup();
    const { claude } = await renderWithChannel(
      <>
        <ToggleGroup group="conversation" />
        <MessageList />
      </>,
    );
    await act(async () => {
      await claude.emitSegment(s.assistant('Visible text'));
      await claude.emitSegment(s.result());
    });
    expect(screen.getByText(/Visible text/)).toBeInTheDocument();

    await user.click(screen.getByText('toggle-conversation'));
    expect(screen.queryByText(/Visible text/)).not.toBeInTheDocument();
  });

  it('toggleGroup on shows previously hidden messages', async () => {
    const user = userEvent.setup();
    const { claude } = await renderWithChannel(
      <>
        <ToggleGroup group="hooks" />
        <MessageList />
      </>,
    );
    await act(async () => {
      await claude.emitSegment(s.hookStarted('hook-id-2', 'my-hook', 'pre_tool_use'));
      await claude.emitSegment(s.result());
    });
    // hooks off by default — hook message count should be 0 in rendered list
    const listBefore = screen.getByLabelText('message-list');
    const hookBefore = listBefore.querySelectorAll('[data-type="hook_started"]');
    expect(hookBefore).toHaveLength(0);

    // turn hooks on
    await user.click(screen.getByText('toggle-hooks'));
    const listAfter = screen.getByLabelText('message-list');
    const hookAfter = listAfter.querySelectorAll('[data-type="hook_started"]');
    expect(hookAfter.length).toBeGreaterThan(0);
  });
});

describe('MessageList — registerJumpTo', () => {
  it('jumpTo highlights the target message via spotlight-highlight', async () => {
    let capturedJumpTo: ((channelId: string, messageId: string) => void) | undefined;

    function PaletteCapture() {
      capturedJumpTo = useCommandPalette().jumpTo;
      return null;
    }

    const { claude, channelId } = await renderWithChannel(
      <>
        <MessageList />
        <PaletteCapture />
      </>,
    );
    await emitAssistantTurn(claude, 'jump target');
    const msgEl = await screen.findByText('jump target');
    const wrapper = msgEl.closest('[data-message-id]') as HTMLElement;
    const messageId = wrapper?.getAttribute('data-message-id') ?? 'x';

    act(() => {
      capturedJumpTo?.(channelId, messageId);
    });

    const bubble = (wrapper.querySelector('[data-type]') ?? wrapper) as HTMLElement;
    expect(bubble.dataset.highlighted).toBe('true');
  });
});

describe('MessageList — layout', () => {
  it('message content wrapper is present', async () => {
    await setupWithMessages();
    const wrapper = document.querySelector('[aria-label="message-content-wrapper"]');
    expect(wrapper).not.toBeNull();
  });
});

describe('MessageList — palette open blocks auto-scroll', () => {
  it('does not set scrollTop when palette is open and new content arrives', async () => {
    const { claude } = await renderWithChannel(
      <>
        <OpenPaletteButton />
        <MessageList />
      </>,
    );

    const scrollEl = screen.getByLabelText('message-list-scroll') as HTMLElement;

    // Track scrollTop assignments
    let scrollTopSetCount = 0;
    Object.defineProperty(scrollEl, 'scrollTop', {
      get: () => 0,
      set: () => {
        scrollTopSetCount++;
      },
      configurable: true,
    });

    // Open palette — this should freeze auto-scroll
    await userEvent.click(screen.getByText('open-palette'));
    const countAfterOpen = scrollTopSetCount;

    // New message arrives while palette is open
    await act(async () => {
      await claude.emitSegment(s.assistant('new message while palette open'));
    });

    expect(scrollTopSetCount).toBe(countAfterOpen);
  });
});

describe('MessageList — message rendering', () => {
  it('user skill-body text renders as markdown', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(s.skill('# Heading\n\n**bold** text'));
    });
    expect(container.querySelector('h1')?.textContent).toBe('Heading');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('result with is_error + no errors array shows error banner, not result divider', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.resultWithError("You've hit your limit · resets 11pm (Asia/Taipei)"),
      );
    });
    const el = screen.getByText("You've hit your limit · resets 11pm (Asia/Taipei)");
    expect(el).toBeInTheDocument();
    expect(el.closest('[data-type="error"]')).toBeInTheDocument();
    expect(document.querySelector('[data-type="result"]:not([data-role])')).not.toBeInTheDocument();
  });

  it('when assistant already streamed the error text, result.result does not add a duplicate error banner', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant("You've hit your limit · resets 11pm (Asia/Taipei)"));
      await claude.emitSegment(
        s.resultWithError("You've hit your limit · resets 11pm (Asia/Taipei)"),
      );
    });
    const all = screen.getAllByText("You've hit your limit · resets 11pm (Asia/Taipei)");
    expect(all).toHaveLength(1);
  });
});

describe('SpinnerVerb layout', () => {
  it('SpinnerVerb is inside the message-content-wrapper section', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { container } = await renderWithChannel(
      <>
        <SendButton message="go" />
        <MessageList />
      </>,
      { initSegment: s.init('sess') },
    );

    await act(async () => {});

    // Trigger processing state so SpinnerVerb renders
    await user.click(screen.getByText('TriggerSend'));

    const spinner = container.querySelector('[aria-label="spinner-verb"]');
    expect(spinner).toBeInTheDocument();

    const wrapper = container.querySelector('[aria-label="message-content-wrapper"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper!.contains(spinner)).toBe(true);
  });
});

describe('MessageList — resume connecting', () => {
  it('shows SpinnerVerb and hides messages while ChannelProvider is connecting (resume scenario)', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = await claude.initialize();
    summoner.holdEmit('session:join');

    await renderWithChannel(<MessageList />, { summoner, channelId, skipInit: true });

    expect(screen.getByLabelText('spinner-verb')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'message-content-wrapper' }),
    ).not.toBeInTheDocument();
  });
});
