/**
 * Tool Pane Header T.4–T.5
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GitPane } from '@/components/workspace/ToolPanes';
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

const availableCwds = ['/project/main', '/project/feature'];

// T.4: Tool Pane header shows emoji + cwd switcher
describe('ToolPaneHeader (T.4) header shows emoji and cwd switcher', () => {
  it('GitPane shows 🌿 Git title', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableCwds={availableCwds} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('tool-pane-header')).toHaveTextContent('🌿 Git');
  });

  it('shows current cwd basename in header', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableCwds={availableCwds} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('tool-pane-header')).toHaveTextContent('main');
  });

  it('shows dropdown toggle button (▾)', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableCwds={availableCwds} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /cwd switcher/i })).toBeInTheDocument();
  });

  it('clicking ▾ shows available cwds in dropdown', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableCwds={availableCwds} paneId="p1" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /cwd switcher/i }));
    const dropdown = screen.getByTestId('cwd-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent('main');
    expect(dropdown).toHaveTextContent('feature');
  });
});

// T.5: selecting a cwd in the dropdown updates the pane content
describe('ToolPaneHeader (T.5) cwd switcher updates pane cwd', () => {
  it('clicking a cwd option updates the pane content cwd', async () => {
    const user = userEvent.setup();
    let cwdInPane = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf' && paneRoot.content.type === 'git') {
        cwdInPane = paneRoot.content.cwd;
      }
      return null;
    }

    function GitPaneWithRealId() {
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : 'p1';
      return <GitPane cwd="/project/main" availableCwds={availableCwds} paneId={leafId} />;
    }

    render(
      <Wrapper>
        <Setup />
        <GitPaneWithRealId />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /cwd switcher/i }));
    await user.click(screen.getByRole('button', { name: 'feature' }));
    expect(cwdInPane).toBe('/project/feature');
  });
});
