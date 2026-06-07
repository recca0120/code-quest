import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { DiffDrawer } from '../DiffDrawer.tsx';

function makeFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    path: 'src/foo.ts',
    added: 1,
    removed: 1,
    isBinary: false,
    lines: [
      { kind: 'hunk', text: '@@ -1,2 +1,2 @@' },
      { kind: 'del', text: '-old line' },
      { kind: 'add', text: '+new line' },
      { kind: 'context', text: ' context' },
    ],
    ...overrides,
  };
}

type DrawerProps = Parameters<typeof DiffDrawer>[0];

function renderDrawer(props: Partial<Extract<DrawerProps, { open: true }>> = {}) {
  const merged = { open: true as const, file: makeFile(), onClose: vi.fn(), ...props };
  return render(<DiffDrawer {...merged} />);
}

describe('DiffDrawer', () => {
  it('does not render when closed', () => {
    render(<DiffDrawer open={false as const} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title with path and diff stats when open', () => {
    renderDrawer({ file: makeFile({ path: 'src/foo.ts', added: 3, removed: 2 }) });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/src\/foo\.ts/);
    expect(dialog.textContent).toMatch(/\+3/);
    expect(dialog.textContent).toMatch(/-2/);
  });

  it('renders diff lines with correct text', () => {
    renderDrawer();
    expect(screen.getByText('-old line')).toBeInTheDocument();
    expect(screen.getByText('+new line')).toBeInTheDocument();
    // Leading-space context line — use regex to bypass whitespace normalisation
    expect(screen.getByText(/context/)).toBeInTheDocument();
  });

  it('renders binary file message instead of lines', () => {
    renderDrawer({ file: makeFile({ isBinary: true, lines: [] }) });
    expect(screen.getByText(/binary file changed/i)).toBeInTheDocument();
  });

  it('shows truncation warning when diff exceeds 5000 lines', () => {
    const manyLines = Array.from({ length: 5001 }, (_, i) => ({
      kind: 'context' as const,
      text: `line ${i}`,
    }));
    renderDrawer({ file: makeFile({ lines: manyLines }) });
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    await userEvent.setup().click(screen.getByTestId('diff-drawer-overlay'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders title with path and Copy path button', () => {
    renderDrawer({ file: makeFile({ path: 'src/foo.ts', added: 3, removed: 2 }) });
    expect(screen.getByRole('button', { name: /copy path/i })).toBeInTheDocument();
  });

  describe('Discard', () => {
    it('is visible and enabled by default when onDiscard is provided', () => {
      renderDrawer({ onDiscard: vi.fn() });
      const btn = screen.getByRole('button', { name: /discard/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });

    it('is disabled when canDiscard is false', () => {
      renderDrawer({ onDiscard: vi.fn(), canDiscard: false });
      expect(screen.getByRole('button', { name: /discard/i })).toBeDisabled();
    });

    it('is not visible when onDiscard is not provided', () => {
      renderDrawer({ onDiscard: undefined });
      expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument();
    });

    it('first click transitions to Confirm? state', async () => {
      renderDrawer({ onDiscard: vi.fn(), canDiscard: true });
      await userEvent.setup().click(screen.getByRole('button', { name: /^discard$/i }));
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    it('second click within window calls onDiscard', async () => {
      const onDiscard = vi.fn();
      renderDrawer({ onDiscard, canDiscard: true });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^discard$/i }));
      await user.click(screen.getByRole('button', { name: /confirm/i }));
      expect(onDiscard).toHaveBeenCalledOnce();
    });
  });
});
