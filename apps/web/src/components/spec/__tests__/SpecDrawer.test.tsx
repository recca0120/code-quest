import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { FsProvidersWrapper } from '@/test/wrap-fs-providers';
import { SpecDrawer } from '../SpecDrawer.tsx';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FsProvidersWrapper socket={summoner.socket}>
        {children}
        <Toaster />
      </FsProvidersWrapper>
    );
  }
  return { summoner, Wrapper };
}

type DrawerProps = Parameters<typeof SpecDrawer>[0];

function renderDrawer(
  props: Partial<DrawerProps> = {},
  wrapper: React.ComponentType<{ children: ReactNode }>,
) {
  return render(
    <SpecDrawer
      open={true}
      cwd="/repo"
      kind="change"
      name="add-foo"
      onClose={() => {}}
      {...props}
    />,
    { wrapper },
  );
}

describe('SpecDrawer', () => {
  it('does not render when open=false', () => {
    const { Wrapper } = setup();
    renderDrawer({ open: false }, Wrapper);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title with kind and name', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    renderDrawer({}, Wrapper);
    expect(await screen.findByText(/change.*add-foo/i)).toBeInTheDocument();
  });

  it('shows loading state before content arrives', () => {
    const { Wrapper } = setup();
    renderDrawer({}, Wrapper);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders proposal content for kind=change', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Add Foo');
    renderDrawer({}, Wrapper);
    expect(await screen.findByRole('heading', { name: /add foo/i })).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    const { Wrapper } = setup();
    // no content set → fake returns error
    renderDrawer({}, Wrapper);
    expect(await screen.findByText(/error|not found|invalid/i)).toBeInTheDocument();
  });

  it('shows tab bar (Proposal/Design/Tasks) for kind=change', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    renderDrawer({}, Wrapper);
    await screen.findByRole('heading', { name: /proposal/i });
    expect(screen.getByRole('tab', { name: /proposal/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /design/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tasks/i })).toBeInTheDocument();
  });

  it('does not show tab bar for kind=spec (single tab)', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'spec', 'auth', 'spec', '# Auth spec');
    renderDrawer({ kind: 'spec', name: 'auth' }, Wrapper);
    expect(await screen.findByRole('heading', { name: /auth spec/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('switching tabs fetches new content', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'design', '# Design');
    renderDrawer({}, Wrapper);
    await screen.findByRole('heading', { name: /proposal/i });

    await user.click(screen.getByRole('tab', { name: /design/i }));
    expect(await screen.findByRole('heading', { name: /design/i })).toBeInTheDocument();
  });

  it('tasks tab renders TaskChecklist instead of markdown', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    summoner
      .openspec()
      ?.setContent('/repo', 'change', 'add-foo', 'tasks', '- [x] done\n- [ ] todo\n');
    renderDrawer({}, Wrapper);
    await screen.findByRole('heading', { name: /proposal/i });

    await user.click(screen.getByRole('tab', { name: /tasks/i }));
    expect((await screen.findAllByRole('checkbox')).length).toBeGreaterThan(0);
  });

  it('changing name resets to first tab', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'design', '# Design');
    summoner.openspec()?.setContent('/repo', 'change', 'rename-bar', 'proposal', '# Bar proposal');

    const { rerender } = renderDrawer({}, Wrapper);
    await screen.findByRole('heading', { name: /proposal/i });

    // switch to design tab
    await user.click(screen.getByRole('tab', { name: /design/i }));
    await screen.findByRole('heading', { name: /design/i });

    // open a different item
    rerender(
      <FsProvidersWrapper socket={summoner.socket}>
        <SpecDrawer open={true} cwd="/repo" kind="change" name="rename-bar" onClose={() => {}} />
        <Toaster />
      </FsProvidersWrapper>,
    );
    expect(await screen.findByRole('heading', { name: /bar proposal/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /proposal/i })).toHaveAttribute('data-state', 'active');
  });

  it('calls onClose when Escape is pressed', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setContent('/repo', 'change', 'add-foo', 'proposal', '# Proposal');
    const onClose = vi.fn();
    renderDrawer({ onClose }, Wrapper);
    await screen.findByRole('heading', { name: /proposal/i });
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
