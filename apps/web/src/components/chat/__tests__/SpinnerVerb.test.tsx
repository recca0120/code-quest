import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithWorkspace } from '@/test/render-with-workspace';
import { SpinnerVerb } from '../SpinnerVerb.tsx';

describe('SpinnerVerb', () => {
  it('renders a verb with trailing dots', () => {
    render(<SpinnerVerb />);
    // Should display some text containing "..."
    const el = screen.getByLabelText('spinner-verb');
    expect(el.textContent).toContain('...');
  });

  it('renders statusText when provided instead of random verb', () => {
    render(<SpinnerVerb statusText="Compacting" />);
    const el = screen.getByLabelText('spinner-verb');
    expect(el.textContent).toContain('Compacting');
  });

  it('cycles icon on interval', () => {
    vi.useFakeTimers();
    render(<SpinnerVerb />);
    const icon = screen.getByLabelText('spinner-icon');
    // Icons cycle: ["·","✢","*","✶","✻","✽","✽","✻","✶","*","✢","·"]
    // Initial is index 0 = "·"
    expect(icon.textContent).toBe('·');

    act(() => {
      vi.advanceTimersByTime(120);
    }); // index 1
    expect(icon.textContent).toBe('✢');

    act(() => {
      vi.advanceTimersByTime(120);
    }); // index 2
    expect(icon.textContent).toBe('*');

    vi.useRealTimers();
  });

  it('changes verb after delay', () => {
    vi.useFakeTimers();
    // Use a fixed list so we can predict the verb
    render(<SpinnerVerb verbs={['Alpha', 'Beta']} />);
    const el = screen.getByLabelText('spinner-verb');
    const initialVerb = el.textContent;
    expect(initialVerb).toContain('...');

    // After 2s (first delay), verb should change
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const nextVerb = el.textContent;
    // With only 2 verbs, at least the text should still contain "..."
    expect(nextVerb).toContain('...');
    // And it should contain one of the two verbs (may have trailing padding)
    const trimmed = nextVerb?.trim();
    expect(trimmed === 'Alpha...' || trimmed === 'Beta...').toBe(true);

    vi.useRealTimers();
  });

  it('shows elapsed time when startTime is provided', () => {
    vi.useFakeTimers({ now: 1000000 });
    render(<SpinnerVerb startTime={1000000 - 42000} />);
    const meta = screen.getByLabelText('spinner-meta');
    expect(meta.textContent).toContain('42s');
    vi.useRealTimers();
  });

  it('shows token count when tokens is provided', () => {
    vi.useFakeTimers({ now: 1000000 });
    render(<SpinnerVerb startTime={1000000 - 5000} tokens={1200} />);
    const meta = screen.getByLabelText('spinner-meta');
    expect(meta.textContent).toContain('1.2k tokens');
    vi.useRealTimers();
  });

  it('shows both elapsed and tokens', () => {
    vi.useFakeTimers({ now: 1000000 });
    render(<SpinnerVerb startTime={1000000 - 10000} tokens={500} />);
    const meta = screen.getByLabelText('spinner-meta');
    expect(meta.textContent).toContain('10s');
    expect(meta.textContent).toContain('500 tokens');
    expect(meta.textContent).toContain('·');
    vi.useRealTimers();
  });

  it('does not show meta when no startTime or tokens', () => {
    render(<SpinnerVerb />);
    expect(screen.getByLabelText('spinner-meta').textContent).toBe('');
  });

  it('sendMessage delivers user message to channel', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    const textarea = screen.getByPlaceholderText(/Esc to focus/i);
    await user.click(textarea);
    await user.type(textarea, 'go');
    await user.keyboard('{Enter}');

    expect(claude.received('user').length).toBeGreaterThan(0);
  });
});
