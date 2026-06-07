import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContentPreviewDialog } from '../ContentPreviewDialog.tsx';

describe('ContentPreviewDialog', () => {
  it('renders title', () => {
    render(<ContentPreviewDialog content="test" title="My Preview" onClose={vi.fn()} />);
    expect(screen.getByText('My Preview')).toBeInTheDocument();
  });

  it('renders content', () => {
    render(<ContentPreviewDialog content="Hello world" onClose={vi.fn()} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<ContentPreviewDialog content="test" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders without title', () => {
    render(<ContentPreviewDialog content="no title" onClose={vi.fn()} />);
    expect(screen.getByText('no title')).toBeInTheDocument();
  });

  it('renders markdown content when no diffs provided', () => {
    render(<ContentPreviewDialog content="# Heading" onClose={vi.fn()} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
  });

  it('renders DiffViewer for each diff entry when diffs provided', () => {
    const diffs = [
      { filePath: 'src/foo.ts', oldContent: 'old foo', newContent: 'new foo' },
      { filePath: 'src/bar.ts', oldContent: 'old bar', newContent: 'new bar' },
    ];
    render(<ContentPreviewDialog content="" diffs={diffs} onClose={vi.fn()} />);
    const filenames = screen.getAllByRole('region', { name: 'diff-filename' });
    expect(filenames).toHaveLength(2);
  });

  it('shows file paths in diff headers', () => {
    const diffs = [{ filePath: 'src/hello.ts', oldContent: 'a', newContent: 'b' }];
    render(<ContentPreviewDialog content="" diffs={diffs} onClose={vi.fn()} />);
    expect(screen.getByText('src/hello.ts')).toBeInTheDocument();
  });

  it('renders as modal overlay', () => {
    render(<ContentPreviewDialog content="test" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    const { baseElement } = render(<ContentPreviewDialog content="test" onClose={onClose} />);
    const overlay = baseElement.querySelector('[data-state="open"][aria-hidden="true"]');
    if (!overlay) throw new Error('overlay not found');
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    render(<ContentPreviewDialog content="test" onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
