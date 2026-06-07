import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionButton } from '../ActionButton.tsx';

describe('ActionButton', () => {
  it('renders children as button content', () => {
    render(<ActionButton onClick={async () => {}}>Save</ActionButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows spinner and disables while pending', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );

    render(<ActionButton onClick={onClick}>Go</ActionButton>);
    const btn = screen.getByRole('button', { name: 'Go' });

    await user.click(btn);
    expect(btn).toBeDisabled();
    expect(screen.getByRole('status', { name: 'spinner' })).toBeInTheDocument();

    resolve();
    await vi.waitFor(() => expect(btn).not.toBeDisabled());
  });

  it('deduplicates concurrent clicks', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );

    render(<ActionButton onClick={onClick}>Go</ActionButton>);
    const btn = screen.getByRole('button', { name: 'Go' });

    await user.click(btn);
    await user.click(btn);

    resolve();
    await vi.waitFor(() => expect(btn).not.toBeDisabled());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('logs error when onClick rejects', async () => {
    const user = userEvent.setup();
    const error = new Error('boom');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ActionButton onClick={() => Promise.reject(error)}>Go</ActionButton>);

    await user.click(screen.getByRole('button', { name: 'Go' }));
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(error));

    spy.mockRestore();
  });

  it('passes variant and size to underlying Button', () => {
    render(
      <ActionButton onClick={async () => {}} variant="danger" size="sm">
        Delete
      </ActionButton>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toMatch(/bg-danger/);
    expect(btn.className).toMatch(/py-1/);
  });
});
