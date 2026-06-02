import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineAction } from '../InlineAction.tsx';

describe('InlineAction', () => {
  it('renders children as button content', () => {
    render(<InlineAction onClick={() => {}}>Show more</InlineAction>);
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('defaults to default variant (muted base, accent hover)', () => {
    render(<InlineAction onClick={() => {}}>X</InlineAction>);
    expect(screen.getByRole('button').className).toMatch(/text-muted/);
  });

  it('variant="muted" uses muted color with text hover', () => {
    render(
      <InlineAction variant="muted" onClick={() => {}}>
        X
      </InlineAction>,
    );
    expect(screen.getByRole('button').className).toMatch(/text-muted/);
  });

  it('variant="accent" uses accent color', () => {
    render(
      <InlineAction variant="accent" onClick={() => {}}>
        X
      </InlineAction>,
    );
    expect(screen.getByRole('button').className).toMatch(/text-accent/);
  });

  it('variant="danger" uses danger color', () => {
    render(
      <InlineAction variant="danger" onClick={() => {}}>
        X
      </InlineAction>,
    );
    expect(screen.getByRole('button').className).toMatch(/text-danger/);
  });

  it('variant="success" uses success color', () => {
    render(
      <InlineAction variant="success" onClick={() => {}}>
        X
      </InlineAction>,
    );
    expect(screen.getByRole('button').className).toMatch(/text-success/);
  });

  it('forwards onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<InlineAction onClick={onClick}>X</InlineAction>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('merges custom className', () => {
    render(
      <InlineAction className="mt-2 font-medium" onClick={() => {}}>
        X
      </InlineAction>,
    );
    const cls = screen.getByRole('button').className;
    expect(cls).toMatch(/mt-2/);
    expect(cls).toMatch(/font-medium/);
  });

  it('defaults to type="button"', () => {
    render(<InlineAction onClick={() => {}}>X</InlineAction>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
