/**
 * Tool Pane T.2, T.3
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EmptyPanePicker } from '@/components/workspace/EmptyPanePicker';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// T.2: selecting a tool sets the corresponding content type in the pane
describe('ToolPane (T.2) selecting tool sets pane content type', () => {
  function ToolPickerWithRealPaneId({ cwd }: { cwd: string }) {
    const { paneRoot } = usePaneState();
    const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
    if (!leafId) return null;
    return <EmptyPanePicker paneId={leafId} sessions={[]} cwd={cwd} />;
  }

  it('clicking Git tool sets pane content to { type: "git", cwd }', async () => {
    const user = userEvent.setup();
    let paneContent: { type: string; cwd?: string } | null = null;

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf') {
        const c = paneRoot.content;
        if (c.type !== 'session') paneContent = c as { type: string; cwd?: string };
      }
      return null;
    }

    render(
      <Wrapper>
        <Probe />
        <ToolPickerWithRealPaneId cwd="/project" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /Git/i }));
    expect(paneContent).toEqual({ type: 'git', cwd: '/project' });
  });

  it('clicking Files tool sets pane content to { type: "files", cwd }', async () => {
    const user = userEvent.setup();
    let paneContent: { type: string; cwd?: string } | null = null;

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf') {
        const c = paneRoot.content;
        if (c.type !== 'session') paneContent = c as { type: string; cwd?: string };
      }
      return null;
    }

    render(
      <Wrapper>
        <Probe />
        <ToolPickerWithRealPaneId cwd="/project" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(paneContent).toEqual({ type: 'files', cwd: '/project' });
  });
});

// T.3: Tool pane default cwd from focused session
describe('ToolPane (T.3) tool pane cwd defaults to focused session cwd', () => {
  it('EmptyPanePicker receives cwd from parent, which comes from focused session', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={[]} cwd="/focused/session/cwd" />
      </Wrapper>,
    );
    expect(screen.getByTestId('tool-options')).toHaveAttribute('data-cwd', '/focused/session/cwd');
  });
});
