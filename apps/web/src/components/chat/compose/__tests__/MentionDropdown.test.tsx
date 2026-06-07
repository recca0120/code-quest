import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MentionDropdown } from '../MentionDropdown.tsx';

function createBaseProps() {
  return {
    mentionQuery: '',
    filteredSuggestions: [],
    searchStatus: 'done' as const,
    selectedIndex: 0,
    hasFileSearch: true,
    onSelectMention: vi.fn(),
  };
}
const baseProps = createBaseProps();

describe('MentionDropdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders file item with icon + name + directory path', () => {
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[{ path: 'src/utils/helpers.ts', name: 'helpers.ts', type: 'file' }]}
      />,
    );
    expect(screen.getByText('helpers.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils/')).toBeInTheDocument();
    // SVG icon should be present
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders directory item with icon + full path', () => {
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[{ path: 'src/utils/', name: 'utils', type: 'directory' }]}
      />,
    );
    expect(screen.getByText('src/utils/')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('file item does not show directory path when path equals name', () => {
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[{ path: 'README.md', name: 'README.md', type: 'file' }]}
      />,
    );
    expect(screen.getByText('README.md')).toBeInTheDocument();
    // No directory path element
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });

  it('click directory calls onSelectMention with navigateInto=true', async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(
      <MentionDropdown
        {...props}
        fileResults={[{ path: 'src/', name: 'src', type: 'directory' }]}
      />,
    );
    await user.click(screen.getByText('src/'));
    expect(props.onSelectMention).toHaveBeenCalledWith('@src/', true);
  });

  it('click file calls onSelectMention with navigateInto=false or undefined', async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(
      <MentionDropdown
        {...props}
        fileResults={[{ path: 'README.md', name: 'README.md', type: 'file' }]}
      />,
    );
    await user.click(screen.getByText('README.md'));
    expect(props.onSelectMention).toHaveBeenCalledWith('@README.md', false);
  });

  it('click directory calls onSelectMention — caller should trigger new search', async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    // Simulate: after navigateInto, caller updates fileResults with new directory contents
    const { rerender } = render(
      <MentionDropdown
        {...props}
        fileResults={[
          { path: 'src/', name: 'src', type: 'directory' },
          { path: 'package.json', name: 'package.json', type: 'file' },
        ]}
      />,
    );

    // Click directory
    await user.click(screen.getByText('src/'));
    expect(props.onSelectMention).toHaveBeenCalledWith('@src/', true);

    // Simulate caller re-rendering with new directory contents
    rerender(
      <MentionDropdown
        {...props}
        mentionQuery="src/"
        fileResults={[
          { path: 'src/socket/', name: 'socket', type: 'directory' },
          { path: 'src/services/', name: 'services', type: 'directory' },
          { path: 'src/config.ts', name: 'config.ts', type: 'file' },
        ]}
      />,
    );

    // New directory contents should be visible
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(screen.getByText('config.ts')).toBeInTheDocument();
    // Old entries should be gone
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();
  });

  it('navigateInto=true keeps dropdown open for new search', async () => {
    const user = userEvent.setup();
    let lastSuggestion = '';
    let lastNavigate = false;
    const onSelect = (s: string, n: boolean) => {
      lastSuggestion = s;
      lastNavigate = n;
    };

    const { rerender } = render(
      <MentionDropdown
        {...baseProps}
        onSelectMention={onSelect}
        fileResults={[{ path: 'src/', name: 'src', type: 'directory' }]}
      />,
    );

    // Click directory — navigateInto should be true
    await user.click(screen.getByRole('option'));
    expect(lastSuggestion).toBe('@src/');
    expect(lastNavigate).toBe(true);

    // Dropdown should still be rendered (caller decides to keep it open and pass new results)
    rerender(
      <MentionDropdown
        {...baseProps}
        onSelectMention={onSelect}
        mentionQuery="src/"
        fileResults={[{ path: 'src/config.ts', name: 'config.ts', type: 'file' }]}
      />,
    );
    expect(screen.getByText('config.ts')).toBeInTheDocument();
  });

  it('each file option has a unique id', () => {
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[
          { path: 'a.ts', name: 'a.ts', type: 'file' },
          { path: 'b.ts', name: 'b.ts', type: 'file' },
        ]}
      />,
    );
    const options = screen.getAllByRole('option');
    const ids = options.map((o) => o.id).filter(Boolean);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2); // all unique
  });

  it('CJK filenames with same extension get unique ids (index-based)', () => {
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[
          { path: '說明.md', name: '說明.md', type: 'file' },
          { path: '介紹.md', name: '介紹.md', type: 'file' },
          { path: '文件.md', name: '文件.md', type: 'file' },
        ]}
      />,
    );
    const options = screen.getAllByRole('option');
    const ids = options.map((o) => o.id).filter(Boolean);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3); // all unique despite same slug
  });

  it('active option id matches selectedIndex', () => {
    render(
      <MentionDropdown
        {...baseProps}
        selectedIndex={1}
        fileResults={[
          { path: 'a.ts', name: 'a.ts', type: 'file' },
          { path: 'b.ts', name: 'b.ts', type: 'file' },
        ]}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options[1]!.id).toBeTruthy();
    // The listbox should expose the active option id
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
  });

  it('hover changes active item', async () => {
    const user = userEvent.setup();
    const onHover = vi.fn();
    render(
      <MentionDropdown
        {...baseProps}
        fileResults={[
          { path: 'a.ts', name: 'a.ts', type: 'file' },
          { path: 'b.ts', name: 'b.ts', type: 'file' },
        ]}
        onHover={onHover}
      />,
    );
    await user.hover(screen.getByText('b.ts'));
    expect(onHover).toHaveBeenCalledWith(1);
  });
});
