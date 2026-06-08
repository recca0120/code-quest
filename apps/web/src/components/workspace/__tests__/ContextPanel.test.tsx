/**
 * Context Panel E.1–E.5
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PaneHeader } from '@/components/workspace/PaneHeader';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// E.1: PaneHeader shows [📁][🌿][📋] toolbar when session cwd is available
describe('ContextPanel (E.1) PaneHeader shows context toolbar', () => {
  it('shows Files, Git, Spec toolbar icons when cwd is provided', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/project" />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /Files/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Git/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spec/i })).toBeInTheDocument();
  });

  it('does not show toolbar when cwd is not provided', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="p1" />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /Files/i })).not.toBeInTheDocument();
  });
});

// E.2: clicking toolbar icon expands context panel
describe('ContextPanel (E.2) clicking icon expands context panel', () => {
  it('clicking Files icon shows context panel', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/project" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(screen.getByTestId('context-panel')).toBeInTheDocument();
  });

  it('clicking Git icon shows context panel with git tab active', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/project" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Git/i }));
    const panel = screen.getByTestId('context-panel');
    expect(panel).toHaveAttribute('data-active-tool', 'git');
  });
});

// E.3: context panel cwd follows from props
describe('ContextPanel (E.3) context panel cwd follows session', () => {
  it('context panel shows the cwd from the session', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/my/project" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(screen.getByTestId('context-panel')).toHaveAttribute('data-cwd', '/my/project');
  });
});

// E.4: clicking same icon again collapses context panel
describe('ContextPanel (E.4) clicking same icon collapses panel', () => {
  it('clicking same icon again closes the context panel', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/project" />
      </Wrapper>,
    );
    const filesBtn = screen.getByRole('button', { name: 'Files' });
    await user.click(filesBtn);
    expect(screen.getByTestId('context-panel')).toBeInTheDocument();
    await user.click(filesBtn);
    expect(screen.queryByTestId('context-panel')).not.toBeInTheDocument();
  });
});

// E.5: context panel has tabs for Files / Git / Spec
describe('ContextPanel (E.5) context panel has tab navigation', () => {
  it('switching tabs in context panel changes the active tool', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PaneHeader paneId="p1" cwd="/project" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'Files' }));
    const panel = screen.getByTestId('context-panel');
    expect(panel).toHaveAttribute('data-active-tool', 'files');

    // Click Git tab inside the context panel (not the header toolbar Git button)
    await user.click(screen.getByTestId('context-tab-git'));
    expect(panel).toHaveAttribute('data-active-tool', 'git');
  });
});
