import { segments as s } from '@code-quest/test-kit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SendButton } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';
import type { Message } from '@/types/ui';
import { MessageList } from '../MessageList.tsx';
import { NodeContent } from '../NodeContent.tsx';

// ── Direct-render base fixture ──
// Used only for tests that cannot be migrated to renderWithChannel + MessageList:
//   - Tests that exercise showAvatar prop (NodeContent-internal prop)
//   - Tests for pending_action / action_result (no segment builder)
//   - Tests for attachments (no segment builder)
//   - Tests for content_block_start / unknown_delta / raw_event (no segment builder)
//   - Tests for hook_diagnostics (no segment builder)
//   - Tests for result stats (s.result() doesn't support inputTokens/outputTokens/numTurns)
const base: Omit<Message, 'type' | 'content' | 'meta'> = {
  id: '1',
  role: 'assistant',
  timestamp: Date.now(),
};

// ── Setup helper ──
async function setup() {
  const ctx = await renderWithChannel(
    <>
      <SendButton message="Hello" />
      <MessageList />
    </>,
  );
  return ctx;
}

describe('NodeContent', () => {
  it('renders text message with markdown', async () => {
    const { container, claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('Hello **world**'));
    });
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeInTheDocument();
  });

  // NOTE: showAvatar is a NodeContent-internal prop not controllable via MessageList.
  // Kept as direct render.
  it('renders assistant message without avatar badge', () => {
    render(<NodeContent message={{ ...base, type: 'text', content: 'Hi' }} showAvatar />);
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });

  // NOTE: showAvatar is a NodeContent-internal prop not controllable via MessageList.
  // Kept as direct render.
  it('renders user message as inline pill', () => {
    render(
      <NodeContent message={{ ...base, role: 'user', type: 'text', content: 'Hi' }} showAvatar />,
    );
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    expect(screen.getByText('Hi').closest('[data-role="user"]')).toBeInTheDocument();
  });

  // NOTE: showAvatar is a NodeContent-internal prop not controllable via MessageList.
  // Kept as direct render.
  it('renders message content regardless of showAvatar', () => {
    render(<NodeContent message={{ ...base, type: 'text', content: 'Hi' }} showAvatar={false} />);
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });

  it('user text renders plain (no markdown parsing)', async () => {
    const { container } = await renderWithChannel(
      <>
        <SendButton message="**not bold** 1. a 2. b" />
        <MessageList />
      </>,
    );
    await userEvent.click(screen.getByText('TriggerSend'));
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('[data-role="user"] ol')).toBeNull();
    expect(container.textContent).toContain('**not bold** 1. a 2. b');
  });

  it('user typed input (renderAs: plain) renders as raw text without markdown parsing', async () => {
    const { claude } = await renderWithChannel(
      <>
        <SendButton message="**not bold**" />
        <MessageList />
      </>,
    );
    await userEvent.click(screen.getByText('TriggerSend'));
    await act(async () => {
      await claude.emitSegment(s.user('**not bold**'));
    });
    expect(screen.getByText('**not bold**')).toBeInTheDocument();
    expect(document.querySelector('[data-role="user"] strong')).toBeNull();
  });

  it('user skill-body (renderAs: markdown) parses markdown into HTML', async () => {
    const { claude } = await renderWithChannel(<MessageList />);
    await act(async () => {
      await claude.emitSegment(s.skill('**bold content**'));
    });
    expect(document.querySelector('[data-role="user"] strong')).not.toBeNull();
  });

  it('user message with parent_tool_use_id renders as markdown (not plain)', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'user',
          type: 'text',
          content: '**bold subagent**',
          renderAs: 'markdown',
          parentToolUseId: 'toolu_sub1',
        }}
      />,
    );
    expect(document.querySelector('[data-role="user"] strong')).not.toBeNull();
    expect(screen.queryByText('**bold subagent**')).toBeNull();
  });

  it('assistant text message has a copy button that copies the text content', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('Hello **world**'));
    });
    const btn = screen.queryByLabelText('message-copy');
    expect(btn).not.toBeNull();
    if (btn) await user.click(btn as HTMLElement);
    expect(String(writeText.mock.calls[0]![0])).toContain('Hello');
  });

  it('assistant copy uses raw message.content (not DOM textContent)', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const content = 'line one\n\n**bold** line';
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant(content));
    });
    const btn = screen.queryByLabelText('message-copy');
    if (btn) await user.click(btn as HTMLElement);
    expect(writeText).toHaveBeenCalledWith(content);
  });

  it('user text message does NOT render a separate copy button (available via actions menu)', async () => {
    await renderWithChannel(
      <>
        <SendButton message="hi" />
        <MessageList />
      </>,
    );
    await userEvent.click(screen.getByText('TriggerSend'));
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('system error message does NOT render a message-level copy button', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.error('Something broke'));
    });
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('tool_use message does NOT render a message-level copy button', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Bash', input: { command: 'ls' } } }),
      );
    });
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('thinking message has no copy button (Copy is not meaningful for thoughts)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking('reasoning...'));
    });
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('empty-body thinking message renders nothing at all', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking(''));
    });
    // No wrapper, no copy button, nothing.
    expect(container.querySelector('[data-role="assistant"]')).toBeNull();
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('non-empty thinking still renders its block (happy path)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking('Hmm, let me see'));
    });
    // ThinkingBlock summary label shows either "Thinking" or "Thought for Ns"
    expect(screen.getByText(/Thinking|Thought for/)).toBeInTheDocument();
  });

  it('local_agent tool_result content renders as markdown', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.agent('toolu_agent1', 'Do something'));
      await claude.emitSegment(
        s.taskStarted('toolu_agent1', 'Do something', { taskType: 'local_agent' }),
      );
      await claude.emitSegment(
        s.taskNotification('task-1', { toolUseId: 'toolu_agent1', status: 'completed' }),
      );
      await claude.emitSegment(s.toolResult('toolu_agent1', '**bold** result'));
      await claude.emitSegment(s.result());
    });
    expect(screen.getByRole('strong')).toBeInTheDocument();
  });

  it('tool_result message does NOT render a message-level copy button', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', 'output'));
    });
    expect(screen.queryByLabelText('message-copy')).toBeNull();
  });

  it('assistant text renders markdown', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('**bold**'));
    });
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders code blocks in text messages', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(s.assistant('```js\nconsole.log("hi")\n```'));
    });
    expect(container.textContent).toContain('console');
    expect(container.querySelector('[class*="language-js"]')).toBeInTheDocument();
  });

  it('renders thinking message as collapsible with label', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking('Let me think...'));
    });
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('expands thinking message on click', async () => {
    const user = userEvent.setup();
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking('Let me think...'));
    });
    await user.click(screen.getByText(/thinking/i));
    expect(screen.getByText('Let me think...')).toBeInTheDocument();
  });

  it('renders thinking content as markdown', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(s.thinking('This is **bold** thinking'));
    });
    // Expand ThinkingBlock — Radix Collapsible removes content from DOM when closed
    await userEvent.click(screen.getByText(/thinking/i));
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders tool_use as collapsible with tool name', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'bash', input: { command: 'ls -la' } } }),
      );
    });
    expect(screen.getByText(/bash/i)).toBeInTheDocument();
  });

  it('last turn tool_use is expanded by default (shows input)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'bash', input: { command: 'ls -la' } } }),
      );
    });
    expect(screen.getByText(/ls -la/)).toBeInTheDocument();
  });

  it('Skill tool output renders as markdown (last turn open by default)', async () => {
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 't1', name: 'Skill', input: { skill: 'opsx:propose' } },
        }),
      );
      await claude.emitSegment(s.toolResult('t1', 'Hi **world**\n\n- a\n- b'));
    });
    expect(container.querySelector('strong')?.textContent).toBe('world');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('Skill tool without result shows skill id and running indicator', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({
          toolUse: { id: 't1', name: 'Skill', input: { skill: 'opsx:propose' } },
        }),
      );
    });
    expect(screen.getByText(/opsx:propose/)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  // NOTE: In MessageList mode tool_result is merged into tool_use; the standalone
  // ToolResultBlock "Result" collapsible label only exists when rendering ChatMessage directly.
  it('renders tool_result as collapsible', () => {
    render(
      <NodeContent
        message={{
          ...base,
          type: 'tool_result',
          content: 'file.txt\nREADME.md',
          toolId: 't1',
          name: 'bash',
        }}
      />,
    );
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });

  it('renders error message (not collapsed)', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.error('Something broke'));
    });
    const el = screen.getByText('Something broke');
    expect(el).toBeInTheDocument();
    expect(el.closest('[data-type="error"]')).toBeInTheDocument();
  });

  // NOTE: pending_action has no segment builder. Kept as direct render.
  it('renders pending_action message', () => {
    render(
      <NodeContent
        message={{
          ...base,
          type: 'pending_action',
          content: 'bash',
          requestId: 'r1',
          input: { command: 'rm -rf /' },
        }}
      />,
    );
    expect(screen.getByText(/bash/i)).toBeInTheDocument();
    expect(screen.getByText(/tool approval/i)).toBeInTheDocument();
  });

  it('renders streamlined_text as text with fast-mode indicator', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.streamlinedText('streamed output here'));
    });
    expect(screen.getByText('streamed output here')).toBeInTheDocument();
    expect(screen.getByText('fast mode')).toBeInTheDocument();
  });

  it('renders streamlined_tool_use_summary as collapsible', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.streamlinedToolUseSummary('Read file.txt → ok'));
    });
    expect(screen.getByText(/tool summary/i)).toBeInTheDocument();
  });

  it('renders compact_boundary as visual separator', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.compactBoundary());
    });
    expect(screen.getByText(/compressed/i)).toBeInTheDocument();
  });

  it('renders tool_use with partialInput preview', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.contentBlockStart(0, 'tool_use', { toolId: 't1', toolName: 'Write' }),
      );
      await claude.emitSegment(s.inputJsonDelta('{"file_path":"src/m', { index: 0 }));
    });
    expect(screen.getByText(/src\/m/)).toBeInTheDocument();
  });

  // NOTE: action_result has no segment builder. Kept as direct render.
  it('renders action_result with approved styling', () => {
    render(
      <NodeContent
        message={{ ...base, role: 'user', type: 'action_result', content: 'Approved: Read' }}
      />,
    );
    expect(screen.getByText('✓ Approved: Read')).toBeInTheDocument();
  });

  it('renders action_result with allowed always styling', () => {
    render(
      <NodeContent
        message={{ ...base, role: 'user', type: 'action_result', content: 'Allowed Always: Read' }}
      />,
    );
    expect(screen.getByText('✓✓ Allowed Always: Read')).toBeInTheDocument();
  });

  it('renders action_result with denied styling', () => {
    render(
      <NodeContent
        message={{ ...base, role: 'user', type: 'action_result', content: 'Denied: Bash' }}
      />,
    );
    expect(screen.getByText('✗ Denied: Bash')).toBeInTheDocument();
  });

  it('renders action_result with denied and stopped styling', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'user',
          type: 'action_result',
          content: 'Denied & Stopped: Write',
        }}
      />,
    );
    expect(screen.getByText('⊘ Denied & Stopped: Write')).toBeInTheDocument();
  });

  it('renders action_result with cancelled styling', () => {
    render(
      <NodeContent
        message={{ ...base, role: 'user', type: 'action_result', content: 'Cancelled: Bash' }}
      />,
    );
    expect(screen.getByText('↩ Cancelled: Bash')).toBeInTheDocument();
  });

  // NOTE: s.result() builder doesn't support inputTokens/outputTokens/numTurns.
  // Kept as direct render.
  it('renders result stats inline', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'result',
          content: '',
          stats: {
            costUsd: 0.05,
            durationMs: 1234,
            inputTokens: 100,
            outputTokens: 50,
            numTurns: 3,
          },
        }}
      />,
    );
    expect(screen.getByText('$0.0500')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
    expect(screen.getByText('↑100')).toBeInTheDocument();
    expect(screen.getByText('↓50')).toBeInTheDocument();
    expect(screen.getByText('3 turns')).toBeInTheDocument();
  });

  // NOTE: s.result() builder doesn't support empty stats. Kept as direct render.
  it('renders result with no stats gracefully', () => {
    const { container } = render(
      <NodeContent message={{ ...base, role: 'system', type: 'result', content: '', stats: {} }} />,
    );
    expect(container.querySelector('[data-type="result"]')).toBeInTheDocument();
  });

  it('renders rate_limit_event message', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(s.rateLimitEvent({ status: 'limited', rateLimitType: 'requests' }));
    });
    expect(screen.getByText(/Rate limit: limited/)).toBeInTheDocument();
    expect(screen.getByText(/requests/)).toBeInTheDocument();
  });

  // NOTE: The handler sets content as "Rate limit: rejected" (not "You've hit your limit").
  // The original assertion checks a specific content string only testable via direct render.
  it('rate_limit rejected shows "You\'ve hit your limit" with reset time', () => {
    // resetsAt is Unix timestamp in seconds (from CLI raw event)
    const resetsAt = String(Math.floor(new Date('2026-05-04T10:10:00').getTime() / 1000));
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'rate_limit_event',
          content: "You've hit your limit",
          rateLimitInfo: { status: 'rejected', rateLimitType: 'five_hour', resetsAt },
        }}
      />,
    );
    expect(screen.getByText(/You've hit your limit/)).toBeInTheDocument();
    expect(screen.getByText(/resets/)).toBeInTheDocument();
  });

  // NOTE: The handler sets content as "Rate limit: allowed_warning" (not "Approaching rate limit").
  // Kept as direct render to preserve the original assertion.
  it('rate_limit allowed_warning shows warning text', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'rate_limit_event',
          content: 'Approaching rate limit',
          rateLimitInfo: { status: 'allowed_warning', rateLimitType: 'five_hour' },
        }}
      />,
    );
    expect(screen.getByText(/Approaching rate limit/)).toBeInTheDocument();
  });

  // NOTE: hook_started is in the Hooks group which is hidden by default in MessageList.
  // Kept as direct render.
  it('renders hook_started message', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'hook_started',
          content: 'PreToolUse:check',
          hookId: 'h1',
          hookEvent: 'PreToolUse',
        }}
      />,
    );
    expect(screen.getByText(/Running hook: PreToolUse:check/)).toBeInTheDocument();
  });

  it('renders hook_response message with output', async () => {
    const user = userEvent.setup();
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'hook_response',
          content: 'PreToolUse:check',
          hookId: 'h1',
          hookEvent: 'PreToolUse',
          output: 'hook output',
        }}
      />,
    );
    await user.click(screen.getByText(/Hook done: PreToolUse:check/));
    expect(screen.getByText('hook output')).toBeInTheDocument();
  });

  // NOTE: unknown_delta has no segment builder. Kept as direct render.
  it('renders unknown_delta as collapsible', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'unknown_delta',
          content: 'Unknown delta: future_delta',
          data: { deltaType: 'future_delta', foo: 'bar' },
        }}
      />,
    );
    expect(screen.getByText(/Unknown delta: future_delta/)).toBeInTheDocument();
  });

  // NOTE: raw_event has no segment builder. Kept as direct render.
  it('renders raw_event as collapsible', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'raw_event',
          content: 'Raw: some_type',
          data: { rawType: 'some_type', key: 'val' },
        }}
      />,
    );
    expect(screen.getByText(/Raw: some_type/)).toBeInTheDocument();
  });

  it('renders diff content with colored lines', async () => {
    const diffContent = [
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,3 +1,3 @@',
      '-old line',
      '+new line',
      ' same line',
      ' extra line',
    ].join('\n');
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Edit', input: { file_path: '/file.txt' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', diffContent));
    });
    const pre = container.querySelector('pre');
    expect(pre?.querySelector('[data-diff-type="added"]')?.textContent).toContain('+new line');
    expect(pre?.querySelector('[data-diff-type="removed"]')?.textContent).toContain('-old line');
    const headerLines = pre?.querySelectorAll('[data-diff-type="header"]');
    const hunkHeader = Array.from(headerLines ?? []).find((el) => el.textContent?.includes('@@'));
    expect(hunkHeader?.textContent).toContain('@@ -1,3 +1,3 @@');
  });

  it('renders diff with filename header', async () => {
    const diffContent = [
      '--- a/src/main.ts',
      '+++ b/src/main.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Edit', input: { file_path: '/src/main.ts' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', diffContent));
    });
    expect(screen.getByLabelText('diff-filename')).toHaveTextContent('src/main.ts');
  });

  it('renders diff with line numbers', async () => {
    const diffContent = ['@@ -10,1 +10,1 @@', '-old', '+new'].join('\n');
    const { claude, container } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Edit', input: { file_path: '/file.txt' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', diffContent));
    });
    // hunk starts at line 10, so we expect "  10" or similar line number text in the gutter
    expect(container.textContent).toMatch(/\s*10\s*/);
  });

  it('renders diff without --- +++ headers gracefully', async () => {
    const diffContent = ['@@ -1,2 +1,2 @@', '-old', '+new'].join('\n');
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Edit', input: { file_path: '/file.txt' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', diffContent));
    });
    expect(screen.queryByLabelText('diff-filename')).not.toBeInTheDocument();
  });

  it('renders ANSI colored output in tool_result', async () => {
    const ansiContent = 'normal \x1b[32mgreen text\x1b[0m end';
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', ansiContent));
    });
    const container = screen.getByLabelText('ansi-content');
    expect(container).toBeInTheDocument();
    // Should render green text with color styling, not raw escape codes
    expect(container.textContent).toContain('green text');
    expect(container.textContent).not.toContain('\x1b[');
    expect(container.querySelector('span[style]')).not.toBeNull();
  });

  it('renders plain tool_result without ANSI as plain pre', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', 'plain output text'));
    });
    expect(screen.queryByLabelText('ansi-content')).not.toBeInTheDocument();
    expect(screen.getByText('plain output text')).toBeInTheDocument();
  });

  it('renders ANSI with multiple colors', async () => {
    const ansiContent = '\x1b[31mred\x1b[0m \x1b[34mblue\x1b[0m';
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', ansiContent));
    });
    const container = screen.getByLabelText('ansi-content');
    expect(container.textContent).toContain('red');
    expect(container.textContent).toContain('blue');
  });

  // NOTE: content_block_start has no full segment builder that sets meta.blockType.
  // Kept as direct render.
  it('renders loading skeleton for content_block_start', () => {
    render(<NodeContent message={{ ...base, type: 'content_block_start', content: '' }} />);
    expect(screen.getByLabelText('block-placeholder')).toBeInTheDocument();
  });

  it('renders user messages with user role styling', async () => {
    await renderWithChannel(
      <>
        <SendButton message="Hi there" />
        <MessageList />
      </>,
    );
    await userEvent.click(screen.getByText('TriggerSend'));
    const el = screen.getByText('Hi there');
    expect(el.closest('[data-role="user"]')).toBeInTheDocument();
  });

  // NOTE: In MessageList mode, tool_result is merged into tool_use; "Result: bash" is the
  // ToolResultBlock label and only appears when rendering ChatMessage directly.
  // Feature 3: tool_result shows tool name
  it('renders tool_result with meta.name as label', () => {
    render(
      <NodeContent
        message={{
          ...base,
          type: 'tool_result',
          content: 'output',
          toolId: 't1',
          name: 'bash',
        }}
      />,
    );
    expect(screen.getByText(/Result: bash/)).toBeInTheDocument();
  });

  // NOTE: s.toolResult() always sets meta.name from the paired tool_use name.
  // Testing "without meta.name" requires direct render.
  it('renders tool_result without meta.name as generic Result', () => {
    render(
      <NodeContent message={{ ...base, type: 'tool_result', content: 'output', toolId: 't1' }} />,
    );
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  // Feature 4: content_block_start shows blockType — no segment builder. Kept as direct render.
  it('renders content_block_start with blockType label', () => {
    render(
      <NodeContent
        message={{
          ...base,
          type: 'content_block_start',
          content: '',
          blockType: 'tool_use',
        }}
      />,
    );
    expect(screen.getByText(/tool_use/)).toBeInTheDocument();
  });

  it('renders content_block_start without blockType as generic placeholder', () => {
    render(<NodeContent message={{ ...base, type: 'content_block_start', content: '' }} />);
    expect(screen.getByLabelText('block-placeholder')).toBeInTheDocument();
    expect(screen.queryByText(/tool_use|text|thinking/)).not.toBeInTheDocument();
  });

  // Feature 7: rate_limit overage display
  it('renders rate_limit_event with overage warning', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.rateLimitEvent({ status: 'limited', isUsingOverage: true, overageStatus: 'active' }),
      );
    });
    expect(screen.getByText(/overage/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  // NOTE: s.rateLimitEvent() template always includes overageStatus:'rejected' from the fixture.
  // Kept as direct render to test the "no overage" case cleanly.
  it('renders rate_limit_event without overage fields gracefully', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'rate_limit_event',
          content: 'Rate limit: limited',
          rateLimitInfo: { status: 'limited' },
        }}
      />,
    );
    expect(screen.getByText(/Rate limit: limited/)).toBeInTheDocument();
    expect(screen.queryByText(/overage/i)).not.toBeInTheDocument();
  });

  // Feature 10: task_started taskType badge
  // NOTE: s.taskStarted() doesn't support taskType. Kept as direct render.
  it('renders task_started with taskType badge', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'task_started',
          content: 'Running agent',
          taskType: 'local_agent',
        }}
      />,
    );
    expect(screen.getByText('local_agent')).toBeInTheDocument();
  });

  it('renders task_started without taskType badge', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'task_started',
          content: 'Running agent',
        }}
      />,
    );
    expect(screen.getByText('Running agent')).toBeInTheDocument();
    expect(screen.queryByText('local_agent')).not.toBeInTheDocument();
  });

  // NOTE: hook_diagnostics has no segment builder. Kept as direct render.
  it('renders hook_diagnostics type with warning styling', () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'hook_diagnostics',
          content: 'PreToolUse',
          diagnostics: 'some diagnostic info',
        }}
      />,
    );
    expect(screen.getByText(/Hook Diagnostics: PreToolUse/)).toBeInTheDocument();
    // Rendered as CollapsibleBlock with a button trigger (not <details>)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows diagnostics text inside collapsible details', async () => {
    const user = userEvent.setup();
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'hook_diagnostics',
          content: 'PreToolUse',
          diagnostics: 'detailed diagnostic output',
        }}
      />,
    );
    await user.click(screen.getByText(/Hook Diagnostics: PreToolUse/));
    expect(screen.getByText('detailed diagnostic output')).toBeInTheDocument();
  });

  it('falls back to content when no diagnostics in meta', async () => {
    render(
      <NodeContent
        message={{
          ...base,
          role: 'system',
          type: 'hook_diagnostics',
          content: 'fallback content',
        }}
      />,
    );
    expect(screen.getByText(/Hook Diagnostics: fallback content/)).toBeInTheDocument();
    // Expand the collapsible and check the pre shows the content fallback
    await userEvent.setup().click(screen.getByRole('button'));
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toBe('fallback content');
  });

  describe('selection attachment chips', () => {
    // NOTE: no segment builder supports attachments. Kept as direct render.
    it('renders chips when user message has attachments', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: 'Check this code',
            attachments: [{ filename: '/src/foo/bar.ts', startLine: 10, endLine: 25 }],
          }}
        />,
      );
      expect(screen.getByText('bar.ts:10-25')).toBeInTheDocument();
    });

    it('renders chip with only filename when no line range', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: 'Look at this',
            attachments: [{ filename: 'src/app.tsx' }],
          }}
        />,
      );
      expect(screen.getByText('app.tsx')).toBeInTheDocument();
    });

    it('renders multiple chips for multiple attachments', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: 'Compare these',
            attachments: [
              { filename: 'src/a.ts', startLine: 1 },
              { filename: 'src/b.ts', startLine: 5, endLine: 10 },
            ],
          }}
        />,
      );
      expect(screen.getByText('a.ts:1')).toBeInTheDocument();
      expect(screen.getByText('b.ts:5-10')).toBeInTheDocument();
    });

    it('does not render chips when attachments is absent', () => {
      render(
        <NodeContent
          message={{ ...base, role: 'user', type: 'text', content: 'No attachments' }}
        />,
      );
      // No attachment text visible
      expect(screen.queryByText(/\.ts/)).not.toBeInTheDocument();
    });

    it('does not render chips for assistant messages', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'assistant',
            type: 'text',
            content: 'Response',
            attachments: [{ filename: 'src/foo.ts' }],
          }}
        />,
      );
      expect(screen.queryByText('foo.ts')).not.toBeInTheDocument();
    });
  });

  describe('image attachments in content', () => {
    const PNG = 'data:image/png;base64,abc123';
    const PDF = 'data:application/pdf;base64,pdfdata';

    it('renders image attachment as <img> tag', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `look\n\n[Attachment: photo.png]\n${PNG}`,
          }}
        />,
      );
      expect(screen.getByRole('img', { name: 'photo.png' })).toHaveAttribute('src', PNG);
    });

    it('does not show raw base64 text for image attachment', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `look\n\n[Attachment: photo.png]\n${PNG}`,
          }}
        />,
      );
      expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();
    });

    it('renders non-image attachment as filename chip', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `look\n\n[Attachment: report.pdf]\n${PDF}`,
          }}
        />,
      );
      expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('renders mixed image and non-image attachments', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `text\n\n[Attachment: a.png]\n${PNG}\n\n[Attachment: b.pdf]\n${PDF}`,
          }}
        />,
      );
      expect(screen.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
      expect(screen.getByText(/b\.pdf/)).toBeInTheDocument();
    });

    it('clicking image opens preview modal', async () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `look\n\n[Attachment: photo.png]\n${PNG}`,
          }}
        />,
      );
      await userEvent.click(screen.getByRole('img', { name: 'photo.png' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('preserves user text alongside attachments', () => {
      render(
        <NodeContent
          message={{
            ...base,
            role: 'user',
            type: 'text',
            content: `check this out\n\n[Attachment: photo.png]\n${PNG}`,
          }}
        />,
      );
      expect(screen.getByText('check this out')).toBeInTheDocument();
    });
  });

  it('renders file paths in tool_result as clickable buttons', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't1', name: 'Grep', input: { pattern: 'foo' } } }),
      );
      await claude.emitSegment(s.toolResult('t1', 'Found /src/main.ts:42 in results'));
    });
    const btn = screen.getByTitle('Copy: /src/main.ts:42');
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/src/main.ts:42');
  });

  it('wraps text type message in Expandable', () => {
    render(<NodeContent message={{ ...base, type: 'text', content: 'Hello' }} />);
    expect(screen.getByLabelText('truncated-inner')).toBeInTheDocument();
  });

  it('does not wrap tool_use in Expandable', async () => {
    const { claude } = await setup();
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 't-exp', name: 'bash', input: { command: 'ls' } } }),
      );
    });
    expect(screen.queryByLabelText('truncated-inner')).not.toBeInTheDocument();
  });

  it('Expandable is expanded when isLastTurn={true} for text message', () => {
    render(<NodeContent message={{ ...base, type: 'text', content: 'Hello' }} isLastTurn={true} />);
    const inner = screen.getByLabelText('truncated-inner');
    expect(inner.style.maxHeight).toBe('');
  });

  it('Expandable is expanded even when isLastTurn={false} for text message (every completed turn shows answer)', () => {
    render(
      <NodeContent message={{ ...base, type: 'text', content: 'Hello' }} isLastTurn={false} />,
    );
    const inner = screen.getByLabelText('truncated-inner');
    expect(inner.style.maxHeight).toBe('');
  });
});
