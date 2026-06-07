import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaneSection } from '../PaneSection.tsx';

describe('PaneSection', () => {
  it('renders the title as an h4 heading', () => {
    render(<PaneSection title="Changes">content</PaneSection>);
    expect(screen.getByRole('heading', { level: 4, name: 'Changes' })).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <PaneSection title="Specs">
        <span>list</span>
      </PaneSection>,
    );
    expect(screen.getByText('list')).toBeInTheDocument();
  });

  it('renders scope badge when provided', () => {
    render(
      <PaneSection title="Active changes" scope="worktree">
        content
      </PaneSection>,
    );
    expect(screen.getByText('(worktree)')).toBeInTheDocument();
  });

  it('renders action slot when provided', () => {
    render(
      <PaneSection title="Changes" action={<button type="button">+ new</button>}>
        content
      </PaneSection>,
    );
    expect(screen.getByRole('button', { name: '+ new' })).toBeInTheDocument();
  });

  it('adds border-b class when bordered prop is set', () => {
    const { container } = render(
      <PaneSection title="Changes" bordered>
        content
      </PaneSection>,
    );
    expect(container.firstChild).toHaveClass('border-b');
  });

  it('does not add border-b class by default', () => {
    const { container } = render(<PaneSection title="Actions">content</PaneSection>);
    expect(container.firstChild).not.toHaveClass('border-b');
  });
});
