/**
 * Group 10: GlobalBar tests
 * GlobalBar replaces WorkspaceTopbar + left sidebar.
 * Contains: project switcher, [+] new session (worktree picker), [🔍] search, [⚙] settings.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GlobalBar } from '@/components/workspace/GlobalBar';

const PROJECTS = [
  { cwd: '/projects/app', name: 'app' },
  { cwd: '/projects/other', name: 'other' },
];

const ALL_WORKTREES = {
  '/projects/app': [
    { path: '/projects/app', branch: 'main', name: 'main' },
    { path: '/projects/app-feat', branch: 'feat-x', name: 'feat-x' },
  ],
  '/projects/other': [{ path: '/projects/other', branch: 'main', name: 'main' }],
};

function setup(overrides: Partial<React.ComponentProps<typeof GlobalBar>> = {}) {
  const props: React.ComponentProps<typeof GlobalBar> = {
    projects: PROJECTS,
    activeProjectCwd: '/projects/app',
    allWorktrees: ALL_WORKTREES,
    onSelectProject: vi.fn(),
    onAddProject: vi.fn(),
    onNewSession: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<GlobalBar {...props} />);
  return { user, props };
}

// 10.1: shows active project name
describe('GlobalBar (10.1) active project name', () => {
  it('displays the active project name', () => {
    setup();
    expect(screen.getByRole('button', { name: /app/ })).toBeInTheDocument();
  });
});

// 10.2: project switcher dropdown
describe('GlobalBar (10.2) project switcher dropdown', () => {
  it('clicking project name opens dropdown with all projects', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /app/ }));
    const dropdown = screen.getByRole('menu');
    expect(within(dropdown).getByText('app')).toBeInTheDocument();
    expect(within(dropdown).getByText('other')).toBeInTheDocument();
  });

  it('active project is marked with checkmark', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /app/ }));
    const dropdown = screen.getByRole('menu');
    const activeItem = within(dropdown).getByRole('menuitem', { name: /app/ });
    expect(activeItem).toHaveAttribute('data-active');
  });
});

// 10.3: selecting project
describe('GlobalBar (10.3) select project', () => {
  it('clicking a project item calls onSelectProject', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: /app/ }));
    await user.click(screen.getByRole('menuitem', { name: /other/ }));
    expect(props.onSelectProject).toHaveBeenCalledWith('/projects/other');
  });
});

// 10.4: add project entry
describe('GlobalBar (10.4) add project', () => {
  it('dropdown has Add project entry', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: /app/ }));
    await user.click(screen.getByRole('menuitem', { name: /Add project/ }));
    expect(props.onAddProject).toHaveBeenCalled();
  });
});

// 10.5: [+] opens worktree quick picker
describe('GlobalBar (10.5) new session picker', () => {
  it('[+] button opens worktree quick picker listing worktrees from all projects', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'New session' }));
    const picker = screen.getByRole('menu', { name: /new session/i });
    expect(within(picker).getAllByText('main')).toHaveLength(2); // app/main + other/main
    expect(within(picker).getByText('feat-x')).toBeInTheDocument();
  });

  it('[+] picker groups worktrees by project with project name header', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'New session' }));
    const picker = screen.getByRole('menu', { name: /new session/i });
    expect(within(picker).getByText('app')).toBeInTheDocument();
    expect(within(picker).getByText('other')).toBeInTheDocument();
  });

  it('[+] works when no active project — shows all projects worktrees', async () => {
    const { user } = setup({ activeProjectCwd: null });
    await user.click(screen.getByRole('button', { name: 'New session' }));
    const picker = screen.getByRole('menu', { name: /new session/i });
    expect(within(picker).getByText('feat-x')).toBeInTheDocument();
  });
});

// 10.6: selecting worktree calls onNewSession
describe('GlobalBar (10.6) new session in worktree', () => {
  it('selecting a worktree calls onNewSession with that cwd', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'New session' }));
    await user.click(screen.getByRole('menuitem', { name: /feat-x/ }));
    expect(props.onNewSession).toHaveBeenCalledWith('/projects/app-feat');
  });
});

// 10.7: search button
describe('GlobalBar (10.7) search', () => {
  it('[🔍] calls onOpenSearch', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(props.onOpenSearch).toHaveBeenCalled();
  });
});

// 10.8: settings button
describe('GlobalBar (10.8) settings', () => {
  it('[⚙] calls onOpenSettings', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(props.onOpenSettings).toHaveBeenCalled();
  });
});
