import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommitComposer } from '../CommitComposer.tsx';

describe('CommitComposer', () => {
  it('starts collapsed — shows expand button, not the subject input', () => {
    render(<CommitComposer onCommit={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Subject')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /commit message/i })).toBeInTheDocument();
  });

  it('expands and focuses subject when expand button is clicked', async () => {
    const user = userEvent.setup();
    render(<CommitComposer onCommit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /commit message/i }));
    expect(screen.getByPlaceholderText('Subject')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Subject')).toHaveFocus();
  });

  it('submits when Cmd+Enter is pressed in the body textarea', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<CommitComposer onCommit={onCommit} />);
    await user.click(screen.getByRole('button', { name: /commit message/i }));
    await user.type(screen.getByPlaceholderText('Subject'), 'my subject');
    await user.type(screen.getByPlaceholderText('Body (optional)'), 'my body');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(onCommit).toHaveBeenCalledWith('my subject\n\nmy body');
  });

  it('does NOT steal focus on parent re-render while user types in body', async () => {
    const user = userEvent.setup();
    function Parent({ count }: { count: number }) {
      // Simulate the real-world parent re-render driver: useGitStatus emits
      // on every git:dirty event and forwards a fresh `count` prop.
      return <CommitComposer onCommit={vi.fn()} count={count} />;
    }
    const { rerender } = render(<Parent count={1} />);
    // Open the composer first
    await user.click(screen.getByRole('button', { name: /commit message/i }));
    const body = screen.getByPlaceholderText('Body (optional)');
    await user.click(body);
    fireEvent.change(body, { target: { value: 'partial typing' } });
    expect(body).toHaveFocus();

    rerender(<Parent count={2} />);

    // Without the fix, ref callback re-fires focus on subject every render.
    expect(body).toHaveFocus();
  });
});
