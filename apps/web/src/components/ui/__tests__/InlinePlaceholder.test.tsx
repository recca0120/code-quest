import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlinePlaceholder } from '../InlinePlaceholder.tsx';

describe('InlinePlaceholder', () => {
  it('renders children text', () => {
    render(<InlinePlaceholder>No changes</InlinePlaceholder>);
    expect(screen.getByText('No changes')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    render(<InlinePlaceholder>No changes</InlinePlaceholder>);
    const el = screen.getByText('No changes');
    expect(el).toHaveClass('text-muted', 'text-xs', 'px-1');
  });

  it('renders as div by default', () => {
    render(<InlinePlaceholder>No changes</InlinePlaceholder>);
    expect(screen.getByText('No changes').tagName).toBe('DIV');
  });
});
