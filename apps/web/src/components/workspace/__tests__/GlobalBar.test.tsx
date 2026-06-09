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
function setup(overrides: Partial<React.ComponentProps<typeof GlobalBar>> = {}) {
  const props: React.ComponentProps<typeof GlobalBar> = {
    projects: PROJECTS,
    activeProjectCwd: '/projects/app',
    onSelectProject: vi.fn(),
    onAddProject: vi.fn(),
    onOpenModal: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<GlobalBar {...props} />);
  return { user, props };
}

// S.1: GlobalBar [☰] sidebar toggle
describe('GlobalBar (S.1) sidebar toggle', () => {
  it('[☰] button calls onToggleSidebar', async () => {
    const onToggleSidebar = vi.fn();
    const { user } = setup({ onToggleSidebar });
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(onToggleSidebar).toHaveBeenCalled();
  });

  it('does not render [☰] button when onToggleSidebar is not provided', () => {
    setup();
    expect(screen.queryByRole('button', { name: /toggle sidebar/i })).not.toBeInTheDocument();
  });
});

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

// W.1: GlobalBar [+] opens Modal via onOpenModal callback
describe('GlobalBar (W.1) [+] opens modal', () => {
  it('[+] button calls onOpenModal when provided', async () => {
    const onOpenModal = vi.fn();
    const { user } = setup({ onOpenModal });
    await user.click(screen.getByRole('button', { name: 'New session' }));
    expect(onOpenModal).toHaveBeenCalled();
  });

  it('[+] button does not open dropdown picker when onOpenModal is provided', async () => {
    const onOpenModal = vi.fn();
    const { user } = setup({ onOpenModal });
    await user.click(screen.getByRole('button', { name: 'New session' }));
    expect(screen.queryByRole('menu', { name: /new session/i })).not.toBeInTheDocument();
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
