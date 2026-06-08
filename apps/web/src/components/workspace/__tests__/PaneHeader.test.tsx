/**
 * Group 3: PaneHeader component tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaneHeader } from '@/components/workspace/PaneHeader';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// 3.1: session pane header shows branch · title
describe('PaneHeader (3.1) session pane shows branch and title', () => {
  it('displays branch symbol and title', () => {
    render(
      <Wrapper>
        <PaneHeader branch="feat/my-feature" title="Task A" paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByText(/feat\/my-feature/)).toBeInTheDocument();
    expect(screen.getByText(/Task A/)).toBeInTheDocument();
  });

  it('displays · separator between branch and title', () => {
    render(
      <Wrapper>
        <PaneHeader branch="main" title="Task A" paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header').textContent).toMatch(/main\s*·\s*Task A/);
  });
});

// 3.2: empty pane header shows nothing — spec says "header 顯示空白或「Pick a session」提示文字", NOT "Empty"
describe('PaneHeader (3.2) empty pane header', () => {
  it('does NOT show "Empty" text when no session is assigned', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header')).toBeInTheDocument();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  });
});

// 3.3: split horizontal button calls splitPane('h')
describe('PaneHeader (3.3) split horizontal button', () => {
  it('split-h button triggers splitPane h', async () => {
    const user = userEvent.setup();
    let splitDirection: string | null = null;

    function Spy() {
      const { splitPane } = usePaneActions();
      return (
        <PaneHeader
          paneId="p1"
          onSplitH={() => {
            splitDirection = 'h';
            splitPane('h');
          }}
        />
      );
    }

    render(
      <Wrapper>
        <Spy />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('pane-split-h'));
    expect(splitDirection).toBe('h');
  });
});

// 3.4: split vertical button calls splitPane('v')
describe('PaneHeader (3.4) split vertical button', () => {
  it('split-v button triggers splitPane v', async () => {
    const user = userEvent.setup();
    let splitDirection: string | null = null;

    function Spy() {
      const { splitPane } = usePaneActions();
      return (
        <PaneHeader
          paneId="p1"
          onSplitV={() => {
            splitDirection = 'v';
            splitPane('v');
          }}
        />
      );
    }

    render(
      <Wrapper>
        <Spy />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('pane-split-v'));
    expect(splitDirection).toBe('v');
  });
});

// 3.5: close button calls closePane; disabled when only pane
describe('PaneHeader (3.5) close button', () => {
  it('close button triggers closePane', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <PaneHeader paneId="p1" onClose={onClose} isOnly={false} />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('pane-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close button is disabled when only pane', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="p1" isOnly={true} />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-close')).toBeDisabled();
  });
});

// 3.6: focused pane shows accent border via data-focused attribute
describe('PaneHeader (3.6) focused pane accent', () => {
  it('has data-focused when paneId matches focusedPaneId', async () => {
    const user = userEvent.setup();

    function Test() {
      const { focusPane } = usePaneActions();
      return (
        <>
          <PaneHeader paneId="p1" />
          <button type="button" onClick={() => focusPane('p1')}>
            focus
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header')).not.toHaveAttribute('data-focused');
    await user.click(screen.getByRole('button', { name: 'focus' }));
    expect(screen.getByTestId('pane-header')).toHaveAttribute('data-focused');
  });
});

// 3.7: zoomed pane shows zoom indicator
describe('PaneHeader (3.7) zoom indicator', () => {
  it('shows zoom indicator when pane is zoomed', async () => {
    const user = userEvent.setup();

    function Test() {
      const { zoomPane } = usePaneActions();
      return (
        <>
          <PaneHeader paneId="p1" />
          <button type="button" onClick={() => zoomPane('p1')}>
            zoom
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    expect(screen.queryByTestId('pane-zoomed-indicator')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'zoom' }));
    expect(screen.getByTestId('pane-zoomed-indicator')).toBeInTheDocument();
  });
});
