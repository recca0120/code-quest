import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../PdfViewer.tsx', () => ({
  PdfViewer: ({ data }: { data: string }) => <div>pdf:{data}</div>,
}));

import type { PreviewState } from '../PreviewDrawer.tsx';
import { PreviewDrawer } from '../PreviewDrawer.tsx';

function renderDrawer(
  state: PreviewState,
  props: Partial<Parameters<typeof PreviewDrawer>[0]> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <PreviewDrawer open={true} title="test.txt" state={state} onClose={onClose} {...props} />,
  );
}

describe('PreviewDrawer', () => {
  it('does not render when closed', () => {
    render(
      <PreviewDrawer open={false} title="test.txt" state={{ kind: 'loading' }} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title when open', () => {
    renderDrawer({ kind: 'loading' });
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    renderDrawer({ kind: 'loading' }, { onClose });
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    renderDrawer({ kind: 'loading' }, { onClose });
    await userEvent.setup().click(screen.getByTestId('preview-drawer-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders loading state', () => {
    renderDrawer({ kind: 'loading' });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    renderDrawer({ kind: 'error', message: 'File not found' });
    expect(screen.getByText('File not found')).toBeInTheDocument();
  });

  it('renders plain text content with line numbers', () => {
    renderDrawer({ kind: 'ready', content: 'hello world', contentType: 'text/plain' });
    expect(screen.getByText('hello world')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('uses a virtualised structure for plain text files (items are absolutely positioned)', () => {
    renderDrawer({ kind: 'ready', content: 'line1\nline2\nline3', contentType: 'text/plain' });

    const scroller = screen.getByTestId('line-table-scroll');
    // tanstack virtual wraps items in a position:relative container
    const inner = scroller.firstElementChild as HTMLElement;
    expect(inner?.style.position).toBe('relative');
    // each row is absolutely positioned
    const row = scroller.querySelector('[style*="position: absolute"]');
    expect(row).toBeInTheDocument();
  });

  it('renders PDF via PdfViewer', async () => {
    renderDrawer({ kind: 'pdf', data: '%PDF-fake' });
    expect(await screen.findByText('pdf:%PDF-fake')).toBeInTheDocument();
  });

  it('renders image as <img> with base64 src', () => {
    renderDrawer({ kind: 'image', src: 'data:image/png;base64,abc', contentType: 'image/png' });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
  });

  it('renders markdown as HTML by default', () => {
    renderDrawer({ kind: 'ready', content: '# Hello World', contentType: 'text/markdown' });
    expect(screen.getByRole('heading', { name: /hello world/i })).toBeInTheDocument();
  });

  it('shows Preview/Raw toggle for markdown and switches modes', async () => {
    const user = userEvent.setup();
    renderDrawer({ kind: 'ready', content: '# Hello World', contentType: 'text/markdown' });

    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raw/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /raw/i }));
    expect(screen.queryByRole('heading', { name: /hello world/i })).not.toBeInTheDocument();
    expect(document.body.textContent).toContain('# Hello World');
  });

  it('does not show toggle for non-markdown files', () => {
    renderDrawer({ kind: 'ready', content: 'export {}', contentType: 'application/typescript' });
    expect(screen.queryByRole('button', { name: /^preview$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^raw$/i })).not.toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    renderDrawer({ kind: 'loading' }, { actions: <button type="button">Mention</button> });
    expect(screen.getByRole('button', { name: /mention/i })).toBeInTheDocument();
  });

  it('renders no footer when actions not provided', () => {
    renderDrawer({ kind: 'loading' });
    expect(screen.queryByTestId('drawer-footer')).not.toBeInTheDocument();
  });

  it('resets viewMode to preview when drawer reopens', async () => {
    const user = userEvent.setup();
    const mdState = { kind: 'ready' as const, content: '# Hello', contentType: 'text/markdown' };
    const { rerender } = renderDrawer(mdState);

    // switch to raw
    await user.click(screen.getByRole('button', { name: /raw/i }));
    expect(screen.queryByRole('heading', { name: /hello/i })).not.toBeInTheDocument();

    // close and reopen
    rerender(<PreviewDrawer open={false} title="a.md" state={mdState} onClose={vi.fn()} />);
    rerender(<PreviewDrawer open={true} title="a.md" state={mdState} onClose={vi.fn()} />);

    // should be back to preview
    expect(screen.getByRole('heading', { name: /hello/i })).toBeInTheDocument();
  });

  describe('resize handle', () => {
    let handle: HTMLElement;
    let content: HTMLElement;
    const originalInnerWidth = window.innerWidth;

    beforeEach(async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
      renderDrawer({ kind: 'loading' });
      handle = screen.getByTestId('resize-handle');
      content = screen.getByRole('dialog');
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('shows resize handle when drawer is open', () => {
      expect(handle).toBeInTheDocument();
    });

    it('dragging resize handle changes drawer width', async () => {
      const user = userEvent.setup();
      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { x: 528, y: 0 } },
        { coords: { x: 400, y: 0 } },
        { keys: '[/MouseLeft]' },
      ]);
      // width = innerWidth - clientX = 1200 - 400 = 800
      expect(content).toHaveStyle({ width: '800px' });
    });

    it('width respects minimum constraint (320px)', async () => {
      const user = userEvent.setup();
      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { x: 528, y: 0 } },
        { coords: { x: 1100, y: 0 } },
        { keys: '[/MouseLeft]' },
      ]);
      expect(Number.parseInt(content.style.width, 10)).toBeGreaterThanOrEqual(320);
    });

    it('width respects maximum constraint (80% viewport)', async () => {
      const user = userEvent.setup();
      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { x: 528, y: 0 } },
        { coords: { x: 0, y: 0 } },
        { keys: '[/MouseLeft]' },
      ]);
      expect(Number.parseInt(content.style.width, 10)).toBeLessThanOrEqual(960);
    });
  });
});
