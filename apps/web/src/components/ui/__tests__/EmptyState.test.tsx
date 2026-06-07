import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders message and action button', () => {
    render(
      <EmptyState
        icon="📁"
        message="No projects yet"
        actionLabel="Add Project"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('Add Project')).toBeInTheDocument();
  });

  it('calls onAction when button clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<EmptyState message="Empty" actionLabel="Do it" onAction={onAction} />);
    await user.click(screen.getByText('Do it'));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders without action button when actionLabel/onAction are omitted', () => {
    render(<EmptyState message="No matches" />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders hint slot below message when provided', () => {
    render(<EmptyState message="No openspec/ directory" hint={<code>openspec init</code>} />);
    expect(screen.getByText('No openspec/ directory')).toBeInTheDocument();
    expect(screen.getByText('openspec init').tagName).toBe('CODE');
  });

  it('constrains the message width with max-w-xs', () => {
    render(<EmptyState message="A very long single-line message that should wrap" />);
    const msg = screen.getByText(/very long single-line/);
    expect(msg.className).toMatch(/max-w-xs/);
  });
});
