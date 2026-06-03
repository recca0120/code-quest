import type { WorktreeInfo } from '@code-quest/git';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useNavigationState } from '@/contexts/NavigationContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { setupMatchMedia } from '@/test/fake-match-media';
import { WorktreeChildList } from '../WorktreeChildList.tsx';

const worktrees: WorktreeInfo[] = [
  { name: 'main', path: '/repo', branch: 'main' },
  { name: 'feat-x', path: '/repo/.claude/worktrees/feat-x', branch: 'feat/x' },
];

function makeWrapper() {
  const wrapper = createTestWrapper();
  if (!wrapper.summoner.claude().hasInitSegments) wrapper.summoner.claude().prepareInit();
  wrapper.summoner.git()!.setProjectRoot('/repo');
  return wrapper;
}

describe('WorktreeChildList', () => {
  it('renders worktree rows', () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
      </Wrapper>,
    );
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('feat/x')).toBeInTheDocument();
  });

  it('renders [+] Open new chat button for each worktree', () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
      </Wrapper>,
    );
    expect(screen.getAllByLabelText('Open new chat')).toHaveLength(2);
  });

  it('[+] and [⋯] buttons are always visible on mobile (no hover required)', () => {
    setupMatchMedia(375);
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    const moreBtn = screen.getByLabelText('More actions');
    const newChatBtn = screen.getByLabelText('Open new chat');
    // bare opacity-0 (without breakpoint prefix) makes button invisible on mobile
    expect(moreBtn.className).not.toMatch(/(?<![:\w])opacity-0/);
    expect(newChatBtn.className).not.toMatch(/(?<![:\w])opacity-0/);
  });

  it('shows BottomSheet on mobile when [⋯] clicked', async () => {
    setupMatchMedia(375); // mobile
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    const moreBtn = screen.getByLabelText('More actions');
    await userEvent.setup({ pointerEventsCheck: 0 }).click(moreBtn);
    expect(await screen.findByText('Open in new chat')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('shows session row for active session in worktree', async () => {
    const { Wrapper, summoner } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    act(() => {
      summoner.claude().pushSessionState('sess-1', 'idle', { projectRoot: '/repo', cwd: '/repo' });
    });
    // Session without title falls back to first 8 chars of channelId
    expect(await screen.findByLabelText('Session: sess-1')).toBeInTheDocument();
  });

  it('clicking session row triggers requestActivateChannel via NavigationContext', async () => {
    const { Wrapper, summoner } = makeWrapper();

    let capturedPending: { channelId: string; cwd: string } | null = null;
    function NavSpy() {
      const state = useNavigationState();
      capturedPending = state.pendingActivateChannel;
      return null;
    }

    render(
      <Wrapper>
        <NavSpy />
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );

    act(() => {
      summoner.claude().pushSessionState('sess-1', 'idle', { projectRoot: '/repo', cwd: '/repo' });
    });

    const sessionBtn = await screen.findByLabelText('Session: sess-1');
    await userEvent.setup().click(sessionBtn);

    expect(capturedPending).toMatchObject({ channelId: 'sess-1' });
  });

  it('clicking worktree session uses projectRoot (not worktree cwd) for activation', async () => {
    const { Wrapper, summoner } = makeWrapper();

    let capturedPending: { channelId: string; cwd: string } | null = null;
    function NavSpy() {
      const state = useNavigationState();
      capturedPending = state.pendingActivateChannel;
      return null;
    }

    render(
      <Wrapper>
        <NavSpy />
        <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
      </Wrapper>,
    );

    // Session belongs to a worktree (cwd = worktree path, NOT project root)
    act(() => {
      summoner.claude().pushSessionState('sess-wt', 'idle', {
        projectRoot: '/repo',
        cwd: '/repo/.claude/worktrees/feat-x',
      });
    });

    const sessionBtn = await screen.findByLabelText('Session: sess-wt');
    await userEvent.setup().click(sessionBtn);

    // Must pass projectRoot, not worktree cwd, so TabProvider can match
    expect(capturedPending).toMatchObject({ channelId: 'sess-wt', cwd: '/repo' });
  });

  it('shows dropdown on desktop when [⋯] clicked', async () => {
    setupMatchMedia(1280); // desktop
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    const moreBtn = screen.getByLabelText('More actions');
    await userEvent.setup({ pointerEventsCheck: 0 }).click(moreBtn);
    expect(await screen.findByRole('menuitem', { name: /open in new chat/i })).toBeInTheDocument();
  });

  it('shows "Open past session…" in desktop dropdown', async () => {
    setupMatchMedia(1280);
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByLabelText('More actions'));
    expect(await screen.findByRole('menuitem', { name: /open past session/i })).toBeInTheDocument();
  });

  it('shows "Open past session…" in mobile BottomSheet', async () => {
    setupMatchMedia(375);
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByLabelText('More actions'));
    expect(await screen.findByText('Open past session…')).toBeInTheDocument();
  });

  it('shows "Switch branch…" in desktop dropdown', async () => {
    setupMatchMedia(1280);
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByLabelText('More actions'));
    expect(await screen.findByRole('menuitem', { name: /switch branch/i })).toBeInTheDocument();
  });

  it('shows "Switch branch…" in mobile BottomSheet', async () => {
    setupMatchMedia(375);
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
      </Wrapper>,
    );
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByLabelText('More actions'));
    expect(await screen.findByText('Switch branch…')).toBeInTheDocument();
  });
});
