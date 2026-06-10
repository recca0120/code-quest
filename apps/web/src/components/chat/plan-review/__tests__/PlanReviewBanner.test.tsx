import type { PlanCommentData } from '@code-quest/schemas';
import { segments as s } from '@code-quest/test-kit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { ChannelProvider, useChannelMessages } from '@/contexts/channel';
import { PluginProvider } from '@/contexts/PluginContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { PlanReviewBanner } from '../PlanReviewBanner.tsx';

function PlanCommentSetter({ comments }: { comments: PlanCommentData[] }) {
  const { addPlanComment } = useChannelMessages();
  React.useEffect(() => {
    for (const c of comments) addPlanComment(c);
  }, [comments, addPlanComment]);
  return null;
}

async function renderInChannel(ui: ReactElement, opts?: { planComments?: PlanCommentData[] }) {
  const summoner = createFakeSummoner();
  const channelId = crypto.randomUUID();
  const result = render(ui, {
    wrapper: ({ children }) => (
      <SocketProvider socket={summoner.socket}>
        <AppConfigProvider>
          <SessionProvider>
            <PluginProvider>
              <TabProvider
                initialState={{
                  tabs: { [channelId]: { tabStatus: 'idle', mode: 'resume' } },
                  activeTabId: channelId,
                }}
              >
                <ChannelProvider channelId={channelId}>
                  {opts?.planComments && <PlanCommentSetter comments={opts.planComments} />}
                  {children}
                </ChannelProvider>
              </TabProvider>
            </PluginProvider>
          </SessionProvider>
        </AppConfigProvider>
      </SocketProvider>
    ),
  });
  await act(async () => {
    await summoner.claude().initialize(s.init('sess-1'), { launch: { channelId } });
  });
  return { summoner, channelId, ...result };
}

describe('PlanReviewBanner default state', () => {
  it('shows Approve Plan and Continue Planning buttons', async () => {
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue planning/i })).toBeInTheDocument();
  });

  it('does not show feedback textarea in default state', async () => {
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText(/add feedback/i)).not.toBeInTheDocument();
  });

  it('renders plan markdown when input.plan is present', async () => {
    await renderInChannel(
      <PlanReviewBanner
        pending={{
          requestId: 'r1',
          subtype: 'exit_plan_mode',
          input: { plan: '# My Plan\n\nSome **bold** text' },
        }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText('My Plan')).toBeInTheDocument();
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });
});

describe('PlanReviewBanner — Approve Plan', () => {
  it('calls onRespond with allow when Approve Plan is clicked', async () => {
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode', input: {} }}
        onRespond={onRespond}
      />,
    );
    await user.click(screen.getByRole('button', { name: /approve plan/i }));
    expect(onRespond).toHaveBeenCalledWith({ behavior: 'allow', updatedInput: {} });
  });

  it('does not include userFeedback when no planComments', async () => {
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode', input: {} }}
        onRespond={onRespond}
      />,
    );
    await user.click(screen.getByRole('button', { name: /approve plan/i }));
    expect(onRespond.mock.calls[0]![0].userFeedback).toBeUndefined();
  });

  it('includes userFeedback from planComments', async () => {
    const comments: PlanCommentData[] = [
      { id: '1', selectedText: 'step 1', comment: 'needs more detail', sectionHeading: '' },
    ];
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode', input: { plan: '# Plan' } }}
        onRespond={onRespond}
      />,
      { planComments: comments },
    );
    await user.click(screen.getByRole('button', { name: /approve plan/i }));
    expect(onRespond).toHaveBeenCalledWith({
      behavior: 'allow',
      updatedInput: { plan: '# Plan' },
      userFeedback: '[On "step 1"]: needs more detail',
    });
  });

  it('clears planComments after approving', async () => {
    const comments: PlanCommentData[] = [
      { id: '1', selectedText: 'some text', comment: 'my comment', sectionHeading: '' },
    ];
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode', input: { plan: '# Plan' } }}
        onRespond={onRespond}
      />,
      { planComments: comments },
    );
    expect(screen.getByText(/1 comment/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /approve plan/i }));
    await waitFor(() => {
      expect(screen.queryByText(/comment/i)).not.toBeInTheDocument();
    });
  });
});

describe('PlanReviewBanner — Continue Planning expand/collapse', () => {
  it('shows textarea and Send Feedback + Cancel after clicking Continue Planning', async () => {
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue planning/i }));
    expect(screen.getByPlaceholderText(/add feedback/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue planning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve plan/i })).not.toBeInTheDocument();
  });

  it('Cancel hides textarea and restores default buttons', async () => {
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue planning/i }));
    await user.type(screen.getByPlaceholderText(/add feedback/i), 'some text');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/add feedback/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue planning/i })).toBeInTheDocument();
  });

  it('Send Feedback submits deny with typed message', async () => {
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={onRespond}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue planning/i }));
    await user.type(screen.getByPlaceholderText(/add feedback/i), 'Please add tests');
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(onRespond).toHaveBeenCalledWith({
      behavior: 'deny',
      message: 'Please add tests',
      interrupt: false,
    });
  });

  it('Send Feedback with empty textarea uses default message', async () => {
    const onRespond = vi.fn();
    const user = userEvent.setup();
    await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={onRespond}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue planning/i }));
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(onRespond).toHaveBeenCalledWith({
      behavior: 'deny',
      message: 'User chose to stay in plan mode and continue planning',
      interrupt: false,
    });
  });
});

describe('PlanReviewBanner — state reset on new request', () => {
  it('resets feedbackOpen and comment when requestId changes', async () => {
    const user = userEvent.setup();
    const { rerender } = await renderInChannel(
      <PlanReviewBanner
        pending={{ requestId: 'r1', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /continue planning/i }));
    await user.type(screen.getByPlaceholderText(/add feedback/i), 'some feedback');

    rerender(
      <PlanReviewBanner
        pending={{ requestId: 'r2', subtype: 'exit_plan_mode' }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText(/add feedback/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeInTheDocument();
  });
});
