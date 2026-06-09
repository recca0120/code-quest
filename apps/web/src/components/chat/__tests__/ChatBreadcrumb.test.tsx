import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatBreadcrumb } from '../ChatBreadcrumb.tsx';

describe('ChatBreadcrumb', () => {
  it('shows project / branch / title when all provided', () => {
    render(
      <ChatBreadcrumb projectName="cc-office" branch="feat/ui" sessionTitle="Redesign sidebar" />,
    );
    expect(screen.getByText('cc-office')).toBeInTheDocument();
    expect(screen.getByText('⎇ feat/ui')).toBeInTheDocument();
    expect(screen.getByText('Redesign sidebar')).toBeInTheDocument();
  });

  it('omits branch section when branch not provided', () => {
    render(<ChatBreadcrumb projectName="cc-office" sessionTitle="New chat" />);
    expect(screen.queryByText(/⎇/)).not.toBeInTheDocument();
    expect(screen.getByText('New chat')).toBeInTheDocument();
  });

  it('calls onToggleLeft when left button clicked', async () => {
    const onToggleLeft = vi.fn();
    render(<ChatBreadcrumb onToggleLeft={onToggleLeft} />);
    await userEvent.setup().click(screen.getByLabelText('Toggle left sidebar'));
    expect(onToggleLeft).toHaveBeenCalled();
  });

  it('renders actions slot inside the header bar', () => {
    render(<ChatBreadcrumb actions={<button type="button">history</button>} />);
    expect(screen.getByRole('button', { name: 'history' })).toBeInTheDocument();
  });

  // TG.2–3: onToggleRight prop
  it('renders Toggle right pane button when onToggleRight is provided', () => {
    render(<ChatBreadcrumb onToggleRight={vi.fn()} />);
    expect(screen.getByRole('button', { name: /toggle right pane/i })).toBeInTheDocument();
  });

  it('does not render Toggle right pane button when onToggleRight is not provided', () => {
    render(<ChatBreadcrumb />);
    expect(screen.queryByRole('button', { name: /toggle right pane/i })).not.toBeInTheDocument();
  });

  it('calls onToggleRight when toggle button is clicked', async () => {
    const onToggleRight = vi.fn();
    render(<ChatBreadcrumb onToggleRight={onToggleRight} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(onToggleRight).toHaveBeenCalledOnce();
  });
});
