import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Content as PaneContent, Toolbar as PaneToolbar } from '@/components/workspace/panes/Pane';
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
describe('PaneToolbar (3.1) session pane shows branch and title', () => {
  it('displays branch symbol and title', () => {
    render(
      <Wrapper>
        <PaneToolbar branch="feat/my-feature" title="Task A" paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByText(/feat\/my-feature/)).toBeInTheDocument();
    expect(screen.getByText(/Task A/)).toBeInTheDocument();
  });

  // handoff §2 組成順序：標題→meta（⎇ branch），無「·」分隔
  it('renders title before ⎇ branch meta without · separator', () => {
    render(
      <Wrapper>
        <PaneToolbar branch="main" title="Task A" paneId="p1" />
      </Wrapper>,
    );
    const text = screen.getByTestId('pane-header').textContent ?? '';
    expect(text).toMatch(/Task A\s*⎇\s*main/);
    expect(text).not.toContain('·');
  });

  // handoff §2：session pane header 顯示類型 icon（chat ✦）
  it('renders the typeIcon glyph before the title', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" title="Task A" typeIcon="✦" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header').textContent).toMatch(/✦\s*Task A/);
  });
});

// 3.2: empty pane header shows nothing
describe('PaneToolbar (3.2) empty pane header', () => {
  it('does NOT show "Empty" text when no session is assigned', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header')).toBeInTheDocument();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  });
});

// 3.3: split horizontal button calls splitPane('h')
describe('PaneToolbar (3.3) split horizontal button', () => {
  it('split-h button triggers splitPane h', async () => {
    const user = userEvent.setup();
    let splitDirection: string | null = null;

    function Spy() {
      const { splitPane } = usePaneActions();
      return (
        <PaneToolbar
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
describe('PaneToolbar (3.4) split vertical button', () => {
  it('split-v button triggers splitPane v', async () => {
    const user = userEvent.setup();
    let splitDirection: string | null = null;

    function Spy() {
      const { splitPane } = usePaneActions();
      return (
        <PaneToolbar
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
describe('PaneToolbar (3.5) close button', () => {
  it('close button triggers closePane', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <PaneToolbar paneId="p1" onClose={onClose} isOnly={false} />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('pane-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('close button is disabled when only pane', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" isOnly={true} />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-close')).toBeDisabled();
  });
});

// 3.6: focused pane shows accent border via data-focused attribute
describe('PaneToolbar (3.6) focused pane accent', () => {
  it('has data-focused when paneId matches focusedPaneId', async () => {
    const user = userEvent.setup();

    function Test() {
      const { focusPane } = usePaneActions();
      return (
        <>
          <PaneToolbar paneId="p1" />
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

// TG.1: PaneToolbar 不再有 tool icon
describe('PaneToolbar (TG.1) no tool icons', () => {
  it('does not render Files/Git/Spec tool buttons', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" cwd="/test" />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /Files/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Git/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Spec/i })).not.toBeInTheDocument();
  });
});

// handoff §2 動作列：⤢ zoom 鈕（desktop；mobile 與 split 鈕一致不顯示）
describe('PaneToolbar zoom button', () => {
  it('zoom button triggers onZoom', async () => {
    const user = userEvent.setup();
    const onZoom = vi.fn();

    render(
      <Wrapper>
        <PaneToolbar paneId="p1" onZoom={onZoom} />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('pane-zoom'));
    expect(onZoom).toHaveBeenCalledOnce();
  });
});

// 3.7: zoomed pane shows zoom indicator
describe('PaneToolbar (3.7) zoom indicator', () => {
  it('shows zoom indicator when pane is zoomed', async () => {
    const user = userEvent.setup();

    function Test() {
      const { zoomPane } = usePaneActions();
      return (
        <>
          <PaneToolbar paneId="p1" />
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

// new: PaneToolbar renders children slot
describe('PaneToolbar children slot', () => {
  it('renders custom children alongside default controls', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1">
          <span data-testid="custom-tool">custom</span>
        </PaneToolbar>
      </Wrapper>,
    );
    expect(screen.getByTestId('custom-tool')).toBeInTheDocument();
    expect(screen.getByTestId('pane-split-h')).toBeInTheDocument();
  });

  it('renders only default controls when no children', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" />
      </Wrapper>,
    );
    expect(screen.queryByTestId('custom-tool')).not.toBeInTheDocument();
    expect(screen.getByTestId('pane-split-h')).toBeInTheDocument();
  });
});

// PaneContent
describe('PaneContent', () => {
  it('renders children', () => {
    render(
      <Wrapper>
        <PaneContent>
          <span data-testid="inner">content</span>
        </PaneContent>
      </Wrapper>,
    );
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });
});
