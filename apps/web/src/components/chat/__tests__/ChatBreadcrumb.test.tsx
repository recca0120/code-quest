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
});
