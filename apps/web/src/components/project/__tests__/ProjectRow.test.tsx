import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { ProjectRow } from '../ProjectRow.tsx';

// Use the default /repo path so FakeGit._initializedRepos recognises it
const PROJECT = {
  cwd: '/repo',
  name: 'app',
  pinned: false,
  lastOpenedAt: new Date().toISOString(),
};

// Pre-populate git listing so WorktreeChildList renders immediately (no socket round-trip)
vi.mock('@/contexts/GitContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/GitContext')>();
  return {
    ...actual,
    useGitState: vi.fn(() => ({ listing: { [PROJECT.cwd]: [] } })),
  };
});

function setup() {
  const { Wrapper, summoner } = createTestWrapper();
  if (!summoner.claude().hasInitSegments) summoner.claude().prepareInit();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { Wrapper, user };
}

beforeEach(() => {
  // Reset expanded state between tests
  usePreferencesStore.setState({ expandedProjects: [] });
});

describe('ProjectRow — expand/collapse behaviour', () => {
  it('clicking project card when collapsed → expands worktree list', async () => {
    const { Wrapper, user } = setup();
    render(
      <Wrapper>
        <ProjectRow project={PROJECT} active={false} onSelect={() => {}} />
      </Wrapper>,
    );

    // collapsed initially — no WorktreeChildList
    expect(screen.queryByText('+ New worktree…')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^app$/i }));

    // expanded — WorktreeChildList renders
    expect(await screen.findByText('+ New worktree…')).toBeInTheDocument();
  });

  it('clicking project card when already expanded → stays expanded (does NOT collapse)', async () => {
    const { Wrapper, user } = setup();
    // Start expanded
    usePreferencesStore.setState({ expandedProjects: [PROJECT.cwd] });

    render(
      <Wrapper>
        <ProjectRow project={PROJECT} active={false} onSelect={() => {}} />
      </Wrapper>,
    );

    // expanded — list visible
    expect(await screen.findByText('+ New worktree…')).toBeInTheDocument();

    // click project card again
    await user.click(screen.getByRole('button', { name: /^app$/i }));

    // still expanded
    expect(screen.getByText('+ New worktree…')).toBeInTheDocument();
  });

  it('clicking chevron when expanded → collapses the list', async () => {
    const { Wrapper, user } = setup();
    usePreferencesStore.setState({ expandedProjects: [PROJECT.cwd] });

    render(
      <Wrapper>
        <ProjectRow project={PROJECT} active={false} onSelect={() => {}} />
      </Wrapper>,
    );

    expect(await screen.findByText('+ New worktree…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse app/i }));

    expect(screen.queryByText('+ New worktree…')).not.toBeInTheDocument();
  });

  it('clicking chevron when collapsed → expands the list', async () => {
    const { Wrapper, user } = setup();

    render(
      <Wrapper>
        <ProjectRow project={PROJECT} active={false} onSelect={() => {}} />
      </Wrapper>,
    );

    expect(screen.queryByText('+ New worktree…')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand app/i }));

    expect(await screen.findByText('+ New worktree…')).toBeInTheDocument();
  });

  it('clicking project card calls onSelect', async () => {
    const { Wrapper, user } = setup();
    const onSelect = vi.fn();

    render(
      <Wrapper>
        <ProjectRow project={PROJECT} active={false} onSelect={onSelect} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /^app$/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});
