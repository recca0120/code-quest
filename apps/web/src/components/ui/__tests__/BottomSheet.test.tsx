import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet, BottomSheetItem } from '../BottomSheet.tsx';

describe('BottomSheet', () => {
  it('renders children when open', () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <BottomSheetItem onClick={() => {}}>Do something</BottomSheetItem>
      </BottomSheet>,
    );
    expect(screen.getByText('Do something')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <BottomSheet open={false} onClose={() => {}}>
        <BottomSheetItem onClick={() => {}}>Hidden</BottomSheetItem>
      </BottomSheet>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <BottomSheet open onClose={() => {}} title="Worktree actions">
        <BottomSheetItem onClick={() => {}}>Item</BottomSheetItem>
      </BottomSheet>,
    );
    expect(screen.getByText('Worktree actions')).toBeInTheDocument();
  });

  it('calls onClose when Escape pressed', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <BottomSheetItem onClick={() => {}}>Item</BottomSheetItem>
      </BottomSheet>,
    );
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <BottomSheetItem onClick={() => {}}>Item</BottomSheetItem>
      </BottomSheet>,
    );
    await userEvent.setup().click(document.querySelector('.bg-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('BottomSheetItem', () => {
  it('fires onClick callback when item button is clicked', async () => {
    const onClick = vi.fn();
    render(
      <BottomSheet open onClose={() => {}}>
        <BottomSheetItem onClick={onClick}>Action</BottomSheetItem>
      </BottomSheet>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Action' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies danger text for destructive variant', () => {
    render(
      <BottomSheet open onClose={() => {}}>
        <BottomSheetItem onClick={() => {}} variant="destructive">
          Delete
        </BottomSheetItem>
      </BottomSheet>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('text-danger');
  });
});
