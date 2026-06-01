import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@/types/ui';
import { PaletteMessageList } from '../PaletteMessageList.tsx';
import { paletteMessageResults } from '../palette-message-results.ts';

const msg = (id: string, content: string): Message => ({
  id,
  role: 'user',
  timestamp: Number(id) * 1000,
  type: 'text',
  content,
});

function renderList(
  props: Partial<React.ComponentProps<typeof PaletteMessageList>> & {
    messages?: Message[];
    recentCount?: number;
    searchLimit?: number;
  } = {},
) {
  const { messages = [], recentCount, searchLimit, ...rest } = props;
  const query = rest.query ?? '';
  const results =
    rest.results ??
    paletteMessageResults(messages, query, {
      recentCount,
      searchLimit,
      sourceLabels: rest.sourceLabels,
    });
  const defaults = {
    results,
    query,
    activeIdx: 0,
    onActiveChange: vi.fn(),
    onJumpTo: vi.fn(),
    onClose: vi.fn(),
  };
  return render(<PaletteMessageList {...defaults} {...rest} />);
}

describe('PaletteMessageList', () => {
  it('renders recent N messages when query is empty (default recentCount=8)', () => {
    const messages = Array.from({ length: 10 }, (_, i) => msg(String(i + 1), `msg ${i + 1}`));
    renderList({ messages });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8);
    // should show LAST 8 (id 3..10)
    expect(buttons[0]).toHaveTextContent('msg 3');
    expect(buttons[7]).toHaveTextContent('msg 10');
  });

  it('honours custom recentCount', () => {
    const messages = Array.from({ length: 10 }, (_, i) => msg(String(i + 1), `msg ${i + 1}`));
    renderList({ messages, recentCount: 3 });
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('filters by query (case-insensitive) up to searchLimit', () => {
    const messages = [msg('1', 'Hello World'), msg('2', 'Goodbye'), msg('3', 'Hello Again')];
    renderList({ messages, query: 'hello' });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('Hello World');
    expect(buttons[1]).toHaveTextContent('Hello Again');
  });

  it('renders <mark> highlight for matched substring', () => {
    renderList({ messages: [msg('1', 'Hello World')], query: 'world' });
    const mark = screen.getByText('World');
    expect(mark.tagName).toBe('MARK');
  });

  it('click on a row fires onJumpTo then onClose', async () => {
    const onJumpTo = vi.fn();
    const onClose = vi.fn();
    renderList({
      messages: [msg('1', 'Hello')],
      onJumpTo,
      onClose,
    });
    await userEvent.click(screen.getByRole('button'));
    expect(onJumpTo).toHaveBeenCalledWith('1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hover fires onActiveChange with row index', async () => {
    const onActiveChange = vi.fn();
    renderList({
      messages: [msg('1', 'A'), msg('2', 'B'), msg('3', 'C')],
      onActiveChange,
    });
    await userEvent.hover(screen.getAllByRole('button')[1]!);
    expect(onActiveChange).toHaveBeenCalledWith(1);
  });

  it('marks active row with data-active attribute', () => {
    renderList({
      messages: [msg('1', 'A'), msg('2', 'B')],
      activeIdx: 1,
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('data-active');
    expect(buttons[1]).toHaveAttribute('data-active');
  });

  it('returns null when no messages to render', () => {
    const { container } = renderList({ messages: [] });
    expect(container.firstChild).toBeNull();
  });

  it('renders Messages section header when showHeader is true', () => {
    renderList({ messages: [msg('1', 'A')], showHeader: true });
    expect(screen.getByText(/messages/i)).toBeInTheDocument();
  });

  it('does not render section header by default', () => {
    renderList({ messages: [msg('1', 'A')] });
    expect(screen.queryByText(/messages/i)).toBeNull();
  });

  it('inserts section header when source changes between adjacent messages', () => {
    const sourceLabels = new Map([
      ['1', 'proj-A / abc12345'],
      ['2', 'proj-A / abc12345'],
      ['3', 'proj-B / def67890'],
    ]);
    renderList({ messages: [msg('1', 'A'), msg('2', 'B'), msg('3', 'C')], sourceLabels });
    expect(screen.getByText('proj-A / abc12345')).toBeInTheDocument();
    expect(screen.getByText('proj-B / def67890')).toBeInTheDocument();
  });

  it('does not insert section headers when sourceLabels is not provided', () => {
    renderList({ messages: [msg('1', 'A'), msg('2', 'B')] });
    expect(screen.queryByRole('heading', { level: 3, name: 'source-header' })).toBeNull();
  });

  it('renders only one section header for consecutive messages from the same source', () => {
    const sourceLabels = new Map([
      ['1', 'proj-A / abc12345'],
      ['2', 'proj-A / abc12345'],
    ]);
    renderList({ messages: [msg('1', 'A'), msg('2', 'B')], sourceLabels });
    const headers = screen.getAllByRole('heading', { level: 3, name: 'source-header' });
    expect(headers).toHaveLength(1);
    expect(headers[0]).toHaveTextContent('proj-A / abc12345');
  });

  it('source headers use prominent variant (border-b)', () => {
    const sourceLabels = new Map([['1', 'proj-A / abc12345']]);
    renderList({ messages: [msg('1', 'A')], sourceLabels });
    const header = screen.getByRole('heading', { level: 3, name: 'source-header' });
    expect(header.className).toMatch(/border-b/);
    expect(header.className).toMatch(/text-muted/);
  });

  it('section headers do not affect button count (keyboard nav unbroken)', () => {
    const sourceLabels = new Map([
      ['1', 'proj-A / abc12345'],
      ['2', 'proj-B / def67890'],
    ]);
    renderList({ messages: [msg('1', 'A'), msg('2', 'B')], sourceLabels });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
