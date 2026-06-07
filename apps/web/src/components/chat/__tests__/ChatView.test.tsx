import { segments as s } from '@code-quest/test-kit';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { btwSignal } from '@/features/btw/btw-feature';
import { COMPOSE_PLACEHOLDER, emitAssistantTurn } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';
import { ChatView } from '../ChatView.tsx';

afterEach(() => {
  btwSignal.setState({ open: false, question: '', answer: null, loading: false, error: null });
});

describe('ChatView header bar', () => {
  it('ResumeButton (clock icon) renders inside the chat-breadcrumb header bar, not below it', async () => {
    const { container } = await renderWithChannel(<ChatView />);
    const breadcrumb = container.querySelector('header[aria-label="chat-breadcrumb"]');
    expect(breadcrumb).toBeTruthy();
    const clockBtn = within(breadcrumb as HTMLElement).getByTitle('Session history');
    expect(clockBtn).toBeInTheDocument();
  });
});

describe('ChatSession overlay placement', () => {
  it('SideQuestionDialog is not inside the message list area', async () => {
    const { container } = await renderWithChannel(<ChatView />);
    act(() => {
      btwSignal.setState({
        open: true,
        question: 'test question',
        answer: null,
        loading: true,
        error: null,
      });
    });
    const dialog = await screen.findByRole('dialog');
    const messageSection = container.querySelector('section[aria-label="message-content-wrapper"]');
    expect(messageSection).toBeTruthy();
    expect(messageSection!.contains(dialog)).toBe(false);
  });

  it('SessionHistoryPopover dialog is not inside the message content area', async () => {
    const user = userEvent.setup();
    const { container } = await renderWithChannel(<ChatView />);
    await user.click(screen.getByTitle('Session history'));
    const dialog = await screen.findByRole('dialog');
    const messageSection = container.querySelector('section[aria-label="message-content-wrapper"]');
    expect(messageSection!.contains(dialog)).toBe(false);
  });
});

describe('ChatSession', () => {
  it('renders input and message list', async () => {
    await renderWithChannel(<ChatView />);
    expect(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByTitle('Send')).toBeInTheDocument();
  });

  it('sends message — message appears in UI', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<ChatView />);
    const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
    await user.type(textarea, 'test message');
    await user.click(screen.getByTitle('Send'));
    expect(screen.getByText('test message')).toBeInTheDocument();
    expect(screen.getByTitle('Stop')).toBeInTheDocument();
  });

  it('displays messages from pipeline', async () => {
    const { claude } = await renderWithChannel(<ChatView />);
    const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
    await userEvent.type(textarea, 'Hello{Enter}');
    await emitAssistantTurn(claude, 'Hi back');
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/Hi back/)).toBeInTheDocument();
  });

  it('shows control request banner when pending', async () => {
    const { claude } = await renderWithChannel(<ChatView />);
    const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
    await userEvent.type(textarea, 'go{Enter}');
    await act(async () => {
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(s.controlRequestBash('r1', { command: 'ls' }));
    });
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders HeaderBar', async () => {
    await renderWithChannel(<ChatView />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('keeps input enabled when processing', async () => {
    await renderWithChannel(<ChatView />);
    expect(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER)).toBeEnabled();
  });

  it('shows Stop button when processing', async () => {
    await renderWithChannel(<ChatView />);
    const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
    await userEvent.type(textarea, 'go{Enter}');
    expect(screen.getByTitle('Stop')).toBeInTheDocument();
  });

  it('shows session title in HeaderBar when title is set', async () => {
    await renderWithChannel(<ChatView title="Fix the login bug" />);
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
  });

  it('does not render TabBar', async () => {
    await renderWithChannel(<ChatView />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows Session history button in HeaderBar', async () => {
    await renderWithChannel(<ChatView />);
    expect(screen.getByTitle('Session history')).toBeInTheDocument();
  });

  it('clicking Session history button opens resume overlay', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<ChatView />);
    await user.click(screen.getByTitle('Session history'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  describe('control flow pipeline', () => {
    it('tool_use interrupts streaming — text after tool_result still renders', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(s.textDelta('Before tool'));
        await claude.emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: {} } }),
        );
        await claude.emitSegment(s.messageStop());
        await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Read', {}));
      });

      const yesButton = await screen.findByText('Yes');
      await userEvent.click(yesButton);

      await act(async () => {
        await claude.emitSegment(s.toolResult('toolu_1', 'file content'));
      });
      await emitAssistantTurn(claude, 'After tool');

      expect(await screen.findByText(/Before tool/)).toBeInTheDocument();
      expect(await screen.findByText(/After tool/)).toBeInTheDocument();
    });

    it('tool_result flows through pipeline (verified via received)', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: {} } }),
        );
        await claude.emitSegment(s.controlRequest('r1', 'can_use_tool', 'Read', {}));
      });

      const yesButton = await screen.findByText('Yes');
      await userEvent.click(yesButton);

      await act(async () => {
        await claude.emitSegment(s.toolResult('toolu_1', 'file contents'));
      });
      await emitAssistantTurn(claude, 'Done');

      expect(await screen.findByText(/Done/)).toBeInTheDocument();
      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });

    it('elicitation control_request renders dialog', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestElicitation('elic-1', { message: 'Please confirm' }),
        );
      });

      expect(screen.queryAllByText(/confirm/i).length).toBeGreaterThan(0);
    });

    it('chat:cancel_request silently removes pending control banner', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'bash', input: {} } }),
        );
        await claude.emitSegment(s.controlRequest('r1', 'can_use_tool', 'bash', {}));
      });

      expect(screen.getByText('Yes')).toBeInTheDocument();

      await act(async () => {
        await claude.emitSegment(s.controlCancelRequest('r1'));
        await claude.emitSegment(s.result());
      });

      expect(screen.queryByText('Yes')).not.toBeInTheDocument();
      expect(screen.queryAllByText(/Cancelled/i)).toHaveLength(0);
    });

    it('notification error shows message in UI', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestShowNotification('notif-1', {
            message: 'Something went wrong',
            severity: 'error',
          }),
        );
      });

      expect(screen.queryAllByText(/Something went wrong|error/i).length).toBeGreaterThan(0);
    });

    it('notification warning shows message in UI', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestShowNotification('notif-2', {
            message: 'Be careful',
            severity: 'warning',
          }),
        );
      });

      expect(screen.queryAllByText(/Be careful|warning/i).length).toBeGreaterThan(0);
    });

    it('notification with buttons shows in UI', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestShowNotification('notif-3', {
            message: 'Retry?',
            severity: 'info',
            buttons: ['Retry'],
          }),
        );
      });

      expect(screen.queryAllByText(/Retry/i).length).toBeGreaterThan(0);
    });

    it('open_diff control_request does not crash the component', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await emitAssistantTurn(claude);
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestOpenDiff('diff-1', {
            originalFilePath: '/tmp/old.ts',
            newFilePath: '/tmp/new.ts',
          }),
        );
      });

      expect(screen.getByText('hi')).toBeInTheDocument();
    });
  });

  describe('message:result pipeline', () => {
    it('message:result transitions from Stop to Send button (processing → idle)', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      expect(screen.getByTitle('Stop')).toBeInTheDocument();

      await emitAssistantTurn(claude, 'done');

      expect(await screen.findByTitle('Send')).toBeInTheDocument();
    });

    it('message:result with error shows error message', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');

      await act(async () => {
        await claude.emitSegment(s.resultResumeNotFound({ errors: ['Something failed'] }));
      });

      expect((await screen.findAllByText(/Something failed/)).length).toBeGreaterThan(0);
      expect(await screen.findByTitle('Send')).toBeInTheDocument();
    });

    it('streaming text deltas accumulate and result returns to idle', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');

      await act(async () => {
        await claude.emitSegment(s.textDelta('Hello '));
        await claude.emitSegment(s.textDelta('World'));
      });
      await emitAssistantTurn(claude, 'Hello World');

      expect(await screen.findByTitle('Send')).toBeInTheDocument();
    });

    it('diffRespond with unknown toolId does not crash the component', async () => {
      const { claude } = await renderWithChannel(<ChatView />);
      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.type(textarea, 'go{Enter}');
      await emitAssistantTurn(claude);
      await act(async () => {
        await claude.emitSegment(
          s.controlRequestOpenDiff('diff-gone', {
            originalFilePath: '/tmp/a',
            newFilePath: '/tmp/b',
          }),
        );
        await claude.emitSegment(s.controlCancelRequest('diff-gone'));
      });

      expect(screen.getByText('hi')).toBeInTheDocument();
    });
  });

  describe('/compact slash command', () => {
    it('sends /compact to CLI', async () => {
      const user = userEvent.setup();
      const { claude } = await renderWithChannel(<ChatView />);

      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await user.type(textarea, '/compact');
      await user.click(screen.getByTitle('Send'));

      expect(claude.received('user')).toHaveLength(1);
      expect(claude.received('user')[0]).toMatchObject({
        message: { content: [{ text: '/compact' }] },
      });
    });

    it('sends /compact with argument to CLI', async () => {
      const user = userEvent.setup();
      const { claude } = await renderWithChannel(<ChatView />);

      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await user.type(textarea, '/compact 50');
      await user.click(screen.getByTitle('Send'));

      expect(claude.received('user')).toHaveLength(1);
      expect(claude.received('user')[0]).toMatchObject({
        message: { content: [{ text: '/compact 50' }] },
      });
    });
  });

  describe('/reload-plugins slash command', () => {
    it('selecting /reload-plugins from slash menu does not send chat message to CLI', async () => {
      const { claude } = await renderWithChannel(<ChatView />, {
        initSegment: s.init('sess', { slashCommands: ['reload-plugins'] }),
      });

      const textarea = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      await userEvent.click(textarea);
      await userEvent.keyboard('/');
      const slashSection = await screen.findByRole('group', { name: 'Slash Commands' });
      const reloadItem = within(slashSection).getByText('/reload-plugins');
      await userEvent.click(reloadItem);

      expect(claude.received('user')).toHaveLength(0);
    });
  });
});
