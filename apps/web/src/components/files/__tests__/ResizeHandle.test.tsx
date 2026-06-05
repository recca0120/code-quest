import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResizeHandle } from '../ResizeHandle.tsx';

describe('ResizeHandle', () => {
  it('renders a div with the expected test id', () => {
    render(<ResizeHandle onResize={vi.fn()} />);
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
  });

  it('calls onResize with clientX on pointer move after pointer down', async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} />);
    const handle = screen.getByTestId('resize-handle');

    await user.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { x: 500, y: 0 } },
      { coords: { x: 400, y: 0 } },
    ]);

    expect(onResize).toHaveBeenCalledWith(400);
  });

  it('does not call onResize on pointer move without prior pointer down', async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} />);
    const handle = screen.getByTestId('resize-handle');

    await user.pointer({ target: handle, coords: { x: 400, y: 0 } });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('stops calling onResize after pointer up', async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} />);
    const handle = screen.getByTestId('resize-handle');

    await user.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { x: 500, y: 0 } },
      { keys: '[/MouseLeft]' },
    ]);
    onResize.mockClear();

    await user.pointer({ coords: { x: 300, y: 0 } });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('accepts a className prop', () => {
    render(<ResizeHandle onResize={vi.fn()} className="custom-class" />);
    expect(screen.getByTestId('resize-handle')).toHaveClass('custom-class');
  });
});
