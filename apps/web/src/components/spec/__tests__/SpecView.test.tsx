import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { SpecView } from '../SpecView.tsx';
import { setup } from './spec-test-setup.tsx';

function seedOpenspec(summoner: ReturnType<typeof setup>['summoner']) {
  const openspec = summoner.openspec();
  if (!openspec) throw new Error('FakeOpenspec not wired');
  openspec.setChanges([{ name: 'add-foo', tasks: { done: 1, total: 2 }, status: 'in-progress' }]);
  openspec.setSpecs([{ capability: 'auth' }]);
  openspec.setContent('/repo', 'change', 'add-foo', 'proposal', '# Add Foo proposal');
  openspec.setContent('/repo', 'change', 'add-foo', 'tasks', '- [x] one\n- [ ] two\n');
}

describe('SpecView', () => {
  it('shows friendly empty state with code hint when project has no openspec/ directory', async () => {
    const { summoner, Wrapper } = setup();
    summoner.openspec()?.setListError('no-openspec');
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
    // Hint contains the openspec init command rendered in a <code> element.
    const codeEl = await screen.findByText('openspec init');
    expect(codeEl.tagName).toBe('CODE');
    // Message should NOT carry the command anymore (it's in the hint slot).
    expect(screen.queryByText(/Run `openspec init`/)).toBeNull();
    expect(screen.queryByText(/parse-changes-failed/i)).toBeNull();
  });

  it('shows skeleton placeholder rows before the openspec list resolves', () => {
    const { Wrapper } = setup();
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
    // One skeleton block per Section (Active changes + Specs).
    expect(screen.getAllByRole('status', { name: 'Loading' }).length).toBeGreaterThanOrEqual(2);
  });

  it('renders per-section empty states when openspec dir absent', async () => {
    const { Wrapper } = setup();
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
    expect(await screen.findByText(/no active changes/i)).toBeInTheDocument();
    expect(screen.getByText(/no specs$/i)).toBeInTheDocument();
  });

  it('lists changes with progress and specs', async () => {
    const { summoner, Wrapper } = setup();
    seedOpenspec(summoner);
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });

    expect(await screen.findByText('add-foo')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('renders status footer with change + spec counts when list loaded', async () => {
    const { summoner, Wrapper } = setup();
    seedOpenspec(summoner);
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
    const footer = await screen.findByRole('status', { name: 'pane-status-footer' });
    // 1 change + 1 spec from seedOpenspec
    expect(footer.textContent).toContain('1 change');
    expect(footer.textContent).toContain('1 spec');
  });

  it('does not render status footer while openspec list is loading', () => {
    const { Wrapper } = setup();
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
    expect(screen.queryByRole('status', { name: 'pane-status-footer' })).toBeNull();
  });

  it('clicking a change opens SpecDrawer showing proposal content', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    seedOpenspec(summoner);
    render(<SpecView cwd="/repo" />, { wrapper: Wrapper });

    await user.click(await screen.findByText('add-foo'));
    expect(await screen.findByText(/add foo proposal/i)).toBeInTheDocument();
  });

  describe('+ new action', () => {
    it('clicking + new opens NewChangeDialog', async () => {
      const user = userEvent.setup();
      const { Wrapper } = setup();
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(screen.getByRole('button', { name: /new change/i }));
      expect(
        await screen.findByRole('dialog', { name: /new openspec change/i }),
      ).toBeInTheDocument();
    });

    it('submitting a valid slug calls openspec.changeNew', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(screen.getByRole('button', { name: /new change/i }));
      const input = await screen.findByLabelText(/change name/i);
      await user.type(input, 'add-foo');
      await user.click(screen.getByRole('button', { name: /^create$/i }));
      expect(summoner.openspec()!.changeNewCalls).toEqual([{ cwd: '/repo', name: 'add-foo' }]);
    });

    it('invalid slug shows inline error and does not fire RPC', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(screen.getByRole('button', { name: /new change/i }));
      const input = await screen.findByLabelText(/change name/i);
      await user.type(input, 'BadName');
      await user.click(screen.getByRole('button', { name: /^create$/i }));
      expect(screen.getByText(/lowercase letters, digits/i)).toBeInTheDocument();
      expect(summoner.openspec()!.changeNewCalls).toEqual([]);
    });

    it('server error keeps dialog open and toasts', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.openspec()!.setChangeNewError('change already exists');
      const toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => 'toast-id');
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(screen.getByRole('button', { name: /new change/i }));
      const input = await screen.findByLabelText(/change name/i);
      await user.type(input, 'dup');
      await user.click(screen.getByRole('button', { name: /^create$/i }));
      // Dialog remains (still findable)
      expect(
        await screen.findByRole('dialog', { name: /new openspec change/i }),
      ).toBeInTheDocument();
      // Toast shows the server error
      expect(toastSpy).toHaveBeenCalledWith('Create failed: change already exists');
      toastSpy.mockRestore();
    });
  });

  describe('archive action', () => {
    function seedComplete(summoner: ReturnType<typeof setup>['summoner']) {
      summoner
        .openspec()
        ?.setChanges([{ name: 'all-done', tasks: { done: 3, total: 3 }, status: 'complete' }]);
    }

    it('complete row renders Archive button next to Ready badge', async () => {
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByLabelText('spec-ready-badge-all-done');
      expect(screen.getByRole('button', { name: /archive all-done/i })).toBeInTheDocument();
    });

    it('in-progress row does not render Archive button', async () => {
      const { summoner, Wrapper } = setup();
      seedOpenspec(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('add-foo');
      expect(screen.queryByRole('button', { name: /archive/i })).toBeNull();
    });

    it('clicking Archive opens confirm dialog scoped to that change', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(await screen.findByRole('button', { name: /archive all-done/i }));
      const dialog = await screen.findByRole('dialog', { name: /archive change/i });
      expect(dialog.textContent).toContain('all-done');
    });

    it('Cancel in dialog closes without firing RPC', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(await screen.findByRole('button', { name: /archive all-done/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(summoner.openspec()!.archiveCalls).toEqual([]);
    });

    it('Confirm with default checkbox fires RPC with skipSpecs=false', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(await screen.findByRole('button', { name: /archive all-done/i }));
      await user.click(
        within(await screen.findByRole('dialog', { name: /archive change/i })).getByRole('button', {
          name: /^archive$/i,
        }),
      );
      expect(summoner.openspec()!.archiveCalls).toEqual([
        { cwd: '/repo', name: 'all-done', skipSpecs: false },
      ]);
    });

    it('Archive control is a <button> element, not a [role="button"] span', async () => {
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const archive = await screen.findByRole('button', { name: /archive all-done/i });
      expect(archive.tagName).toBe('BUTTON');
    });

    it('open-modal control and Archive control are siblings, not nested', async () => {
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const archive = await screen.findByRole('button', { name: /archive all-done/i });
      // Archive must NOT be a descendant of the open-modal button
      expect(archive.closest('button')).toBe(archive);
    });

    it('Toggling Skip spec update forwards skipSpecs=true', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      seedComplete(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await user.click(await screen.findByRole('button', { name: /archive all-done/i }));
      await user.click(await screen.findByRole('checkbox', { name: /skip spec update/i }));
      await user.click(
        within(screen.getByRole('dialog', { name: /archive change/i })).getByRole('button', {
          name: /^archive$/i,
        }),
      );
      expect(summoner.openspec()!.archiveCalls).toEqual([
        { cwd: '/repo', name: 'all-done', skipSpecs: true },
      ]);
    });
  });

  describe('F.html visual parity', () => {
    it('change row has a 📋 glyph', async () => {
      const { summoner, Wrapper } = setup();
      seedOpenspec(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const row = await screen.findByLabelText('spec-change-row-add-foo');
      expect(row.textContent).toContain('📋');
    });

    it('spec row has a ▸ glyph', async () => {
      const { summoner, Wrapper } = setup();
      seedOpenspec(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const row = await screen.findByLabelText('spec-capability-row-auth');
      expect(row.textContent).toContain('▸');
    });

    it('task progress renders as a bordered pill (not plain text)', async () => {
      const { summoner, Wrapper } = setup();
      seedOpenspec(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const pill = await screen.findByLabelText('spec-task-pill-add-foo');
      expect(pill.textContent).toBe('1/2');
      expect(pill.className).toMatch(/border/);
      expect(pill.className).toMatch(/font-mono/);
    });

    it('renders a Ready badge when status is complete', async () => {
      const { summoner, Wrapper } = setup();
      summoner
        .openspec()
        ?.setChanges([{ name: 'all-done', tasks: { done: 5, total: 5 }, status: 'complete' }]);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      const badge = await screen.findByLabelText('spec-ready-badge-all-done');
      expect(badge.textContent?.toLowerCase()).toContain('ready');
      expect(badge.className).toMatch(/success/);
    });

    it('no Ready badge when tasks are in progress', async () => {
      const { summoner, Wrapper } = setup();
      seedOpenspec(summoner);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('add-foo');
      expect(screen.queryByLabelText('spec-ready-badge-add-foo')).toBeNull();
    });

    it('no Ready badge when tasks is null (no tasks.md)', async () => {
      const { summoner, Wrapper } = setup();
      summoner.openspec()?.setChanges([{ name: 'no-tasks', tasks: null, status: 'in-progress' }]);
      render(<SpecView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('no-tasks');
      expect(screen.queryByLabelText('spec-ready-badge-no-tasks')).toBeNull();
      expect(screen.queryByLabelText('spec-task-pill-no-tasks')).toBeNull();
    });
  });
});
