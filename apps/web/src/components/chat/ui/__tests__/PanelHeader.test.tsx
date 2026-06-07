import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelHeader } from '@/components/chat/ui/PanelHeader';

describe('PanelHeader', () => {
  it('renders the title', () => {
    render(<PanelHeader title="Raw Events" />);
    expect(screen.getByText('Raw Events')).toBeInTheDocument();
  });

  it('renders actions slot on the right', () => {
    render(<PanelHeader title="Terminal" actions={<button type="button">×</button>} />);
    expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
  });

  it('renders with a bottom border for visual separation', () => {
    const { container } = render(<PanelHeader title="Files" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/border-b/);
  });
});
