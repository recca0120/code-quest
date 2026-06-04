import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useNavigationState } from '@/contexts/NavigationContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { WorktreeSessionList } from '../WorktreeSessionList.tsx';

function makeWrapper() {
  const wrapper = createTestWrapper();
  if (!wrapper.summoner.claude().hasInitSegments) wrapper.summoner.claude().prepareInit();
  return wrapper;
}

describe('WorktreeSessionList', () => {
  it('renders session rows by title', async () => {
    const { Wrapper, summoner } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeSessionList worktreePath="/repo" projectCwd="/repo" />
      </Wrapper>,
    );
    act(() => {
      summoner.claude().pushSessionState('sess-1', 'idle', { projectRoot: '/repo', cwd: '/repo' });
    });
    expect(await screen.findByLabelText('Session: sess-1')).toBeInTheDocument();
  });

  it('does not show exited sessions', async () => {
    const { Wrapper, summoner } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeSessionList worktreePath="/repo" projectCwd="/repo" />
      </Wrapper>,
    );
    act(() => {
      summoner
        .claude()
        .pushSessionState('sess-gone', 'exited', { projectRoot: '/repo', cwd: '/repo' });
    });
    // Wait briefly then confirm it never appeared
    await waitFor(() =>
      expect(screen.queryByLabelText('Session: sess-gone')).not.toBeInTheDocument(),
    );
  });

  it('session rows have no active highlight (sidebar is nav-only, not state display)', () => {
    const { Wrapper, summoner } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeSessionList worktreePath="/repo" projectCwd="/repo" />
      </Wrapper>,
    );
    act(() => {
      summoner.claude().pushSessionState('sess-1', 'idle', { projectRoot: '/repo', cwd: '/repo' });
    });
    // No row should carry aria-current (highlight not shown from outside TabProvider)
    expect(screen.queryByRole('button', { current: true })).not.toBeInTheDocument();
  });

  it('clicking session calls requestActivateChannel with projectRoot', async () => {
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
        <WorktreeSessionList worktreePath="/repo/.claude/worktrees/feat-x" projectCwd="/repo" />
      </Wrapper>,
    );

    act(() => {
      summoner.claude().pushSessionState('sess-wt', 'idle', {
        projectRoot: '/repo',
        cwd: '/repo/.claude/worktrees/feat-x',
      });
    });

    await userEvent.setup().click(await screen.findByLabelText('Session: sess-wt'));
    expect(capturedPending).toMatchObject({ channelId: 'sess-wt', cwd: '/repo' });
  });

  it('clicking × removes session from list after server marks it exited', async () => {
    const { Wrapper, summoner } = makeWrapper();
    render(
      <Wrapper>
        <WorktreeSessionList worktreePath="/repo" projectCwd="/repo" />
      </Wrapper>,
    );
    act(() => {
      summoner.claude().pushSessionState('sess-1', 'idle', { projectRoot: '/repo', cwd: '/repo' });
    });
    await screen.findByLabelText('Session: sess-1');

    // Close: session should disappear from list (server marks it exited)
    await userEvent.setup().click(screen.getByLabelText('Close session: sess-1'));

    act(() => {
      summoner
        .claude()
        .pushSessionState('sess-1', 'exited', { projectRoot: '/repo', cwd: '/repo' });
    });

    await waitFor(() => expect(screen.queryByLabelText('Session: sess-1')).not.toBeInTheDocument());
  });
});
