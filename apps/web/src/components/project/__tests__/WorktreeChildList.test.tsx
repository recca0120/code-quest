import type { WorktreeInfo } from '@code-quest/git';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigationActions, useNavigationState } from '@/contexts/NavigationContext';
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

  describe.each([
    [1280, (label: RegExp) => screen.findByRole('menuitem', { name: label })] as const,
    [375, (label: RegExp) => screen.findByText(label)] as const,
  ])('at viewport %i', (width, findItem) => {
    beforeEach(() => {
      setupMatchMedia(width);
      const { Wrapper } = makeWrapper();
      render(
        <Wrapper>
          <WorktreeChildList worktrees={[worktrees[0]!]} projectCwd="/repo" />
        </Wrapper>,
      );
    });

    it('shows "Open past session…"', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByLabelText('More actions'));
      expect(await findItem(/open past session/i)).toBeInTheDocument();
    });

    it('shows "Switch branch…"', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByLabelText('More actions'));
      expect(await findItem(/switch branch/i)).toBeInTheDocument();
    });
  });

  describe('navigation memory', () => {
    it('clicking worktree row records lastWorktreeByProject', async () => {
      const { Wrapper } = makeWrapper();
      let state: ReturnType<typeof useNavigationState> | null = null;
      function NavSpy() {
        state = useNavigationState();
        return null;
      }
      render(
        <Wrapper>
          <NavSpy />
          <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
        </Wrapper>,
      );
      await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByLabelText('Open worktree feat/x'));
      expect(state!.lastWorktreeByProject['/repo']).toBe('/repo/.claude/worktrees/feat-x');
    });

    it('clicking worktree row with remembered tab restores it via requestActivateChannel', async () => {
      const { Wrapper } = makeWrapper();
      let actions: ReturnType<typeof useNavigationActions> | null = null;
      let state: ReturnType<typeof useNavigationState> | null = null;
      function NavSpy() {
        state = useNavigationState();
        actions = useNavigationActions();
        return null;
      }
      render(
        <Wrapper>
          <NavSpy />
          <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
        </Wrapper>,
      );
      // record a previous tab for feat-x worktree
      act(() => actions!.recordLastTab('/repo/.claude/worktrees/feat-x', 'ch-remembered'));

      await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByLabelText('Open worktree feat/x'));
      expect(state!.pendingActivateChannel).toMatchObject({
        cwd: '/repo',
        channelId: 'ch-remembered',
      });
    });

    it('clicking worktree row with no remembered tab does not trigger requestActivateChannel', async () => {
      const { Wrapper } = makeWrapper();
      let state: ReturnType<typeof useNavigationState> | null = null;
      function NavSpy() {
        state = useNavigationState();
        return null;
      }
      render(
        <Wrapper>
          <NavSpy />
          <WorktreeChildList worktrees={worktrees} projectCwd="/repo" />
        </Wrapper>,
      );
      await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByLabelText('Open worktree feat/x'));
      expect(state!.pendingActivateChannel).toBeNull();
    });
  });
});
