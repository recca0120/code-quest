import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClickableRowOverlay } from '../ClickableRowOverlay.tsx';

describe('ClickableRowOverlay', () => {
  it('renders a button with aria-label', () => {
    render(<ClickableRowOverlay aria-label="Open worktree" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open worktree' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<ClickableRowOverlay aria-label="Open" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has absolute inset-0 class to cover entire row', () => {
    render(<ClickableRowOverlay aria-label="Open" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('absolute', 'inset-0');
  });

  it('has type="button"', () => {
    render(<ClickableRowOverlay aria-label="Open" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
