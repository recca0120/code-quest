import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button.tsx';

describe('Button', () => {
  it('renders provided children as the button label', () => {
    render(<Button>Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Submit' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/transition-all/);
  });

  it('defaults to variant="primary" with accent background', () => {
    render(<Button>X</Button>);
    const el = screen.getByRole('button');
    expect(el.className).toMatch(/bg-accent/);
  });

  it('variant="secondary" uses border + muted text', () => {
    render(<Button variant="secondary">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/border/);
  });

  it('variant="danger" uses danger token', () => {
    render(<Button variant="danger">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-danger/);
  });

  it('variant="ghost" has no border/bg until hover', () => {
    render(<Button variant="ghost">X</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).not.toMatch(/bg-accent/);
    expect(cls).toMatch(/hover:/);
  });

  it('size="sm" uses smaller padding', () => {
    render(<Button size="sm">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/py-1/);
  });

  it('forwards onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('honors disabled', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('defaults to type="button" (not submit)', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts type="submit"', () => {
    render(<Button type="submit">X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('variant="success" uses success token', () => {
    render(<Button variant="success">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-success/);
  });

  it('variant="warning" uses warning token', () => {
    render(<Button variant="warning">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-warning/);
  });

  it('variant="info" uses button token', () => {
    render(<Button variant="info">X</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-button/);
  });
});
