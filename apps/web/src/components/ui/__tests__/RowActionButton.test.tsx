import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RowActionButton } from '../RowActionButton.tsx';

describe('RowActionButton', () => {
  it('renders children', () => {
    render(<RowActionButton aria-label="test">×</RowActionButton>);
    expect(screen.getByRole('button', { name: 'test' })).toHaveTextContent('×');
  });

  it('has type="button"', () => {
    render(<RowActionButton aria-label="test">×</RowActionButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(
      <RowActionButton aria-label="test" onClick={onClick}>
        ×
      </RowActionButton>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('stops propagation when clicked', async () => {
    const parentClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test-only wrapper to verify stopPropagation
      // biome-ignore lint/a11y/useKeyWithClickEvents: test-only wrapper
      <div onClick={parentClick}>
        <RowActionButton aria-label="test">×</RowActionButton>
      </div>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <RowActionButton aria-label="test" className="custom-cls">
        ×
      </RowActionButton>,
    );
    expect(screen.getByRole('button')).toHaveClass('custom-cls');
  });
});
