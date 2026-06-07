import { segments as s } from '@code-quest/test-kit';
import { act, render, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { emitAssistantTurn, sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';
import { AccountUsageDialog } from '../AccountUsageDialog.tsx';
import { usageOpenSignal } from '../usage-feature.ts';

afterEach(() => {
  usageOpenSignal.setOpen(false);
});

async function setupWithTurn() {
  const result = await renderWithWorkspace();
  const project = await result.addProject();
  await project.launchSession();
  await sendUserMessage(result.user, 'hello');
  await emitAssistantTurn(result.claude);
  return result;
}

async function openUsageDialog(user: UserEvent) {
  const textarea = screen.getByPlaceholderText(/Esc to focus/i);
  await act(async () => {
    textarea.focus();
  });
  await user.type(textarea, '/usage');
  const usageItem = await screen.findByText(/Account & usage/i);
  await user.click(usageItem);
  return screen.findByRole('dialog', { name: /account & usage/i });
}

describe('AccountUsageDialog', () => {
  it('renders after rate limit event', async () => {
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user, 'hello');
    await act(async () => {
      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(
        s.rateLimitEvent({ status: 'ok', rateLimitType: 'five_hour', resetsAt }),
      );
      await claude.emitSegment(s.result());
    });

    // Rate limit message rendered
    expect(screen.getByText(/Rate limit:/i)).toBeInTheDocument();
  });

  it('assistant message renders after init', async () => {
    await setupWithTurn();

    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('handles rate limit event when dialog is closed', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user);
    await act(async () => {
      await claude.emitSegment(s.assistant('ok'));
      await claude.emitSegment(s.rateLimitEvent({ status: 'rate_limited' }));
      await claude.emitSegment(s.result());
    });

    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('dialog opens and shows quota section', async () => {
    const { user } = await setupWithTurn();

    const dialog = await openUsageDialog(user);
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Quota/)).toBeInTheDocument();
  });

  it('rate_limit data appears in dialog after event', async () => {
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user, 'hello');
    await act(async () => {
      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(
        s.rateLimitEvent({ status: 'ok', rateLimitType: 'five_hour', resetsAt }),
      );
      await claude.emitSegment(s.result());
    });

    const dialog = await openUsageDialog(user);
    // Should show session usage data
    expect(within(dialog).queryAllByText(/Session|5hr|resets/i).length).toBeGreaterThan(0);
  });

  it('dialog closes when close button clicked', async () => {
    const { user } = await setupWithTurn();

    const dialog = await openUsageDialog(user);
    const closeBtn = within(dialog).getByLabelText('close');
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog', { name: /account & usage/i })).not.toBeInTheDocument();
  });

  it('chat input is visible after init', async () => {
    const { addProject: addProj } = await renderWithWorkspace();
    const proj = await addProj();
    await proj.launchSession();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('shows context breakdown when opening usage dialog', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    const channelId = await project.launchSession();

    await sendUserMessage(user, 'hello');
    await emitAssistantTurn(claude);

    await act(async () => {
      claude.pushServerEvent('settings:usage', {
        channelId,
        contextUsage: {
          categories: [
            { name: 'System prompt', tokens: 6000, color: 'promptBorder' },
            { name: 'Messages', tokens: 4000, color: 'purple' },
            { name: 'Free space', tokens: 190000, color: 'promptBorder' },
          ],
          totalTokens: 10000,
          maxTokens: 200000,
          percentage: 5,
        },
        usage: {},
      });
    });

    const dialog = await openUsageDialog(user);
    expect(within(dialog).getByText(/System prompt/)).toBeInTheDocument();

    expect(within(dialog).getByText(/6\.0k/)).toBeInTheDocument();
    expect(within(dialog).getByText(/5% used/)).toBeInTheDocument();
  });

  it('shows session cost from result stats', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user, 'hello');
    await act(async () => {
      await claude.emitSegment(s.assistant('hi'));
      await claude.emitSegment(s.result({ costUsd: 1.23, durationMs: 5000 }));
    });

    const dialog = await openUsageDialog(user);
    expect(within(dialog).getByText(/\$1\.23/)).toBeInTheDocument();
  });

  it('shows manage link when authMethod is claudeai', () => {
    render(
      <AccountUsageDialog
        open={true}
        onClose={() => {}}
        authMethod="claudeai"
        usage={{ five_hour: { utilization: 0.3 } }}
      />,
    );
    expect(screen.getByText('Manage usage on claude.ai')).toBeInTheDocument();
  });

  it('hides manage link when authMethod is not claudeai', () => {
    render(
      <AccountUsageDialog
        open={true}
        onClose={() => {}}
        authMethod="api-key"
        usage={{ five_hour: { utilization: 0.3 } }}
      />,
    );
    expect(screen.queryByText('Manage usage on claude.ai')).not.toBeInTheDocument();
  });

  it('shows unavailable message for non-claudeai auth without usage data', () => {
    render(<AccountUsageDialog open={true} onClose={() => {}} authMethod="api-key" />);
    expect(
      screen.getByText('Usage tracking is only available for Claude AI subscribers.'),
    ).toBeInTheDocument();
  });

  it('shows loading when claudeai auth but no usage data yet', () => {
    render(<AccountUsageDialog open={true} onClose={() => {}} authMethod="claudeai" />);
    expect(screen.getByText(/Loading usage data/)).toBeInTheDocument();
  });
});
