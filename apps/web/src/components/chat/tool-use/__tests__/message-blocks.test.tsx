import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from '@/components/chat/renderers/MarkdownContent';
import { HookResponseContent, HookStartedContent } from '@/components/chat/tool-use/HookBlocks';
import {
  CompactBoundaryContent,
  ControlResponseContent,
  DocumentContent,
  ErrorContent,
  ImageContent,
  InterruptContent,
  RedactedThinkingContent,
  ResultContent,
  SlashCommandResultContent,
  StreamlinedToolSummaryContent,
} from '@/components/chat/tool-use/SystemBlocks';
import { TaskBadge } from '@/components/chat/tool-use/TaskBadge';
import { ToolResultBlock } from '@/components/chat/tool-use/ToolResultBlock';
import { ToolUseBlock } from '@/components/chat/tool-use/ToolUseBlock';
import { getToolIcon, ToolUseHeader } from '@/components/chat/tool-use/ToolUseHeader';
import { CollapsibleBlock } from '@/components/chat/ui/CollapsibleBlock';
import { Expandable } from '@/components/chat/ui/Expandable';
import { AGENT_TOOLS, getToolHeaderInfo } from '@/utils/tool-utils';

function WrappedToolUseBlock({
  toolName,
  input = {},
  result,
  defaultOpen,
  task,
}: {
  toolName: string;
  input?: Record<string, unknown>;
  result?: { content?: string; is_error?: boolean };
  defaultOpen?: boolean;
  task?: {
    toolUseId: string;
    taskType: 'local_agent' | 'local_bash' | 'subagent';
    status: 'running' | 'completed' | 'failed' | 'stopped';
    description: string;
    progressText?: string;
    lastToolName?: string;
  };
}) {
  const headerInfo = getToolHeaderInfo(toolName, input);
  const taskType = task?.taskType;
  const detail = task?.description && !headerInfo.detail ? task.description : headerInfo.detail;
  const header = (
    <ToolUseHeader
      icon={getToolIcon(toolName)}
      name={headerInfo.name}
      detail={detail}
      range={headerInfo.range}
      badge={
        AGENT_TOOLS.has(toolName) || taskType ? (
          <TaskBadge toolName={toolName} input={input} task={task} />
        ) : undefined
      }
    />
  );
  return (
    <CollapsibleBlock header={header} defaultOpen={defaultOpen ?? false}>
      <ToolUseBlock toolName={toolName} input={input} result={result} taskType={taskType} />
    </CollapsibleBlock>
  );
}

describe('tool-use', () => {
  describe('ToolUseBlock', () => {
    it.each([
      ['Bash', { command: 'ls' }],
      ['Read', { file_path: '/src/index.ts' }],
    ] as const)('%s tool header shows an SVG icon instead of emoji', (toolName, input) => {
      const { container } = render(<WrappedToolUseBlock toolName={toolName} input={input} />);
      const button = container.querySelector('button')!;
      expect(button.querySelector('svg')).toBeInTheDocument();
      expect(button.textContent).not.toContain('⚙');
    });

    it('renders tool_use with tool name', () => {
      render(<WrappedToolUseBlock toolName="Bash" input={{ command: 'ls -la' }} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    it('Bash IN/OUT are in a single combined block (one bg-code-block container)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <WrappedToolUseBlock
          toolName="Bash"
          input={{ command: 'ls' }}
          result={{ content: 'file.txt' }}
        />,
      );
      await user.click(screen.getByText('Bash'));
      const blocks = container.querySelectorAll('.bg-code-block');
      expect(blocks).toHaveLength(1);
    });

    it('copy icon is solid (title="Copy"), changes to check after click, reverts after timeout', async () => {
      const user = userEvent.setup({ delay: null });
      render(<WrappedToolUseBlock toolName="Bash" input={{ command: 'echo hi' }} defaultOpen />);
      const copyBtn = screen.getByTitle('Copy');
      expect(copyBtn).toBeInTheDocument();

      await user.click(copyBtn);
      expect(screen.getByTitle('Copied!')).toBeInTheDocument();
      expect(screen.queryByTitle('Copy')).not.toBeInTheDocument();
    });

    it('copy button uses heroicons svg, not emoji', async () => {
      render(<WrappedToolUseBlock toolName="Bash" input={{ command: 'echo hi' }} defaultOpen />);
      const copyBtn = screen.getByTitle('Copy');
      expect(copyBtn.querySelector('svg')).toBeInTheDocument();
      expect(copyBtn.textContent).not.toContain('📋');
    });

    it('Bash content wraps long lines (whitespace-pre-wrap)', async () => {
      const { container } = render(
        <WrappedToolUseBlock
          toolName="Bash"
          input={{ command: 'echo hi' }}
          result={{ content: 'hello world' }}
          defaultOpen
        />,
      );
      const pres = container.querySelectorAll('pre');
      for (const pre of pres) {
        expect(pre.className).toContain('whitespace-pre-wrap');
      }
    });

    it('copy button appears as overlay inside Copyable wrapper in IN row', async () => {
      render(<WrappedToolUseBlock toolName="Bash" input={{ command: 'echo hi' }} defaultOpen />);
      const copyBtn = screen.getByTitle('Copy');
      expect(copyBtn.closest('.group\\/copyable')).toBeInTheDocument();
    });

    it('renders IN label for bash tool input when expanded', async () => {
      render(<WrappedToolUseBlock toolName="Bash" input={{ command: 'echo hello' }} defaultOpen />);
      expect(screen.getByText('IN')).toBeInTheDocument();
    });

    it('renders IN/OUT labels for default tool with input and result when expanded', async () => {
      render(
        <WrappedToolUseBlock
          toolName="Grep"
          input={{ pattern: 'foo', path: '/src' }}
          result={{ content: 'found 3 matches' }}
          defaultOpen
        />,
      );
      expect(screen.getByText('IN')).toBeInTheDocument();
      expect(screen.getByText('OUT')).toBeInTheDocument();
    });

    it('default tool (Grep) IN/OUT share one bordered box, labels are inside', async () => {
      const { container } = render(
        <WrappedToolUseBlock
          toolName="Grep"
          input={{ pattern: 'foo', path: '/src' }}
          result={{ content: 'found 3 matches' }}
          defaultOpen
        />,
      );
      const boxes = container.querySelectorAll('.border.border-border.bg-code-block');
      expect(boxes).toHaveLength(1);
      const box = boxes[0];
      expect(box).toContainElement(screen.getByText('IN'));
      expect(box).toContainElement(screen.getByText('OUT'));
    });

    it('Read tool result renders with syntax highlighting (no plain pre.bg-code-block)', async () => {
      const { container } = render(
        <WrappedToolUseBlock
          toolName="Read"
          input={{ file_path: '/src/Foo.tsx' }}
          result={{ content: 'import React from "react";\nexport function Foo() {}' }}
          defaultOpen
        />,
      );
      expect(container.textContent).toContain('import');
      expect(container.textContent).toContain('React');
      expect(container.querySelector('pre.bg-code-block')).not.toBeInTheDocument();
    });

    it('renders TodoRead tool_use (visibility controlled by MessageVisibilityContext, not ToolUseBlock)', () => {
      const { container } = render(<WrappedToolUseBlock toolName="TodoRead" input={{}} />);
      expect(container.innerHTML).not.toBe('');
      expect(container.textContent).toContain('TodoRead');
    });
  });

  describe('ToolResultBlock', () => {
    it('renders tool_result with label', () => {
      render(<ToolResultBlock content="file contents here" toolId="tu-1" name="Read" />);
      expect(screen.getByText('Result: Read')).toBeInTheDocument();
    });

    it('ToolResultBlock header shows an SVG icon instead of emoji', () => {
      const { container } = render(
        <ToolResultBlock content="file contents here" toolId="tu-1" name="Read" />,
      );
      const button = container.querySelector('button')!;
      expect(button.querySelector('svg')).toBeInTheDocument();
      expect(button.textContent).not.toContain('✓');
    });
  });

  describe('SystemBlocks', () => {
    it('renders error message', () => {
      render(<ErrorContent content="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders result stats', () => {
      render(
        <ResultContent
          stats={{
            costUsd: 0.05,
            durationMs: 3000,
            inputTokens: 100,
            outputTokens: 50,
            numTurns: 1,
          }}
        />,
      );
      expect(screen.getByText('$0.0500')).toBeInTheDocument();
      expect(screen.getByText('1 turns')).toBeInTheDocument();
    });

    it('streamlined_tool_use_summary shows an SVG icon instead of emoji', () => {
      const { container } = render(<StreamlinedToolSummaryContent content="some summary" />);
      const button = container.querySelector('button')!;
      expect(button.querySelector('svg')).toBeInTheDocument();
      expect(button.textContent).not.toContain('⚡');
    });

    it('renders compact boundary', () => {
      render(<CompactBoundaryContent />);
      expect(screen.getByText('Context was compressed')).toBeInTheDocument();
    });

    it('renders control response with approved style', () => {
      render(<ControlResponseContent content="Approved: Bash" />);
      expect(screen.getByText(/Approved: Bash/)).toBeInTheDocument();
    });

    it('SlashCommandResultContent replaces "Set model to " prefix with "Switched to "', () => {
      render(<SlashCommandResultContent content="Set model to claude-opus-4" />);
      expect(screen.getByText('Switched to claude-opus-4')).toBeInTheDocument();
      expect(screen.queryByText(/Set model to/)).not.toBeInTheDocument();
    });

    it('SlashCommandResultContent renders other single-line content unchanged', () => {
      render(<SlashCommandResultContent content="Done" />);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('HookBlocks', () => {
    it('renders hook_started', () => {
      render(<HookStartedContent content="pre-commit" />);
      expect(screen.getByText(/Running hook: pre-commit/)).toBeInTheDocument();
    });

    it('hook_started shows an SVG icon instead of emoji', () => {
      const { container } = render(<HookStartedContent content="pre-commit" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.textContent).not.toContain('⚙');
    });

    it('hook_response shows an SVG icon instead of emoji', () => {
      const { container } = render(<HookResponseContent content="pre-commit" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.textContent).not.toContain('🔗');
    });
  });

  describe('Other blocks', () => {
    it('renders text with markdown', () => {
      render(
        <Expandable>
          <MarkdownContent content="Hello **world**" />
        </Expandable>,
      );
      expect(screen.getByText('world')).toBeInTheDocument();
    });

    it('renders interrupt', () => {
      render(<InterruptContent />);
      expect(screen.getByText('Interrupted by user')).toBeInTheDocument();
    });
  });

  describe('Content block types', () => {
    it('renders image content block with base64 src', () => {
      render(<ImageContent source={{ type: 'base64', media_type: 'image/png', data: 'iVBOR' }} />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toContain('data:image/png;base64,iVBOR');
    });

    it('renders document content block with download button', () => {
      render(
        <DocumentContent
          content=""
          title="report.pdf"
          source={{ type: 'base64', media_type: 'application/pdf', data: 'JVBER' }}
        />,
      );
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    it('renders redacted_thinking as placeholder', () => {
      render(<RedactedThinkingContent />);
      expect(screen.getByText(/thinking.*redacted/i)).toBeInTheDocument();
    });

    it('renders tool_result with array content extracting text', async () => {
      const user = userEvent.setup();
      render(
        <ToolResultBlock
          content=""
          toolId="tu-1"
          name="Read"
          contentBlocks={[
            { type: 'text', text: 'file contents here' },
            { type: 'tool_reference', tool_name: 'Read' },
          ]}
        />,
      );
      await user.click(screen.getByText(/Result: Read/));
      expect(screen.getByText(/file contents here/)).toBeInTheDocument();
    });
  });

  describe('Task/Agent tool badge', () => {
    it('renders no badge when Task tool has no status and no subagent_type', () => {
      const { container } = render(<WrappedToolUseBlock toolName="Task" input={{}} />);
      expect(container.querySelector('.font-mono')).not.toBeInTheDocument();
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('renders running badge when taskStatus is running', () => {
      render(
        <WrappedToolUseBlock
          toolName="Task"
          input={{}}
          task={{
            toolUseId: 'tu-task',
            taskType: 'local_agent' as const,
            status: 'running',
            description: '',
          }}
        />,
      );
      expect(screen.getByText(/Running/)).toBeInTheDocument();
    });

    it('does not show Done badge when taskStatus is completed (timeline handles done state)', () => {
      render(
        <WrappedToolUseBlock
          toolName="Task"
          input={{}}
          task={{
            toolUseId: 'tu-task',
            taskType: 'local_agent' as const,
            status: 'completed',
            description: '',
          }}
        />,
      );
      expect(screen.queryByText(/Done/)).not.toBeInTheDocument();
    });

    it('renders subagent chip when subagent_type is provided even without taskStatus', () => {
      render(<WrappedToolUseBlock toolName="Task" input={{ subagent_type: 'general-purpose' }} />);
      expect(screen.getByText('subagent')).toBeInTheDocument();
    });
  });
});
