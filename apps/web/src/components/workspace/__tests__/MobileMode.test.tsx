/**
 * Mobile Degradation M.1–M.3
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { Pane } from '@/components/workspace/Pane';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function mockMobile(isMobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: isMobile ? query.includes('max-width') : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

function KbWrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>
        <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
      </TabProvider>
    </SocketProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// M.1: useMobileMode returns true on small screen
describe('MobileMode (M.1) useMobileMode hook', () => {
  it('returns true when viewport matches max-width: 767px', async () => {
    mockMobile(true);
    const { useMobileMode } = await import('@/components/workspace/useMobileMode');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useMobileMode());
    expect(result.current).toBe(true);
  });

  it('returns false on large screen', async () => {
    mockMobile(false);
    const { useMobileMode } = await import('@/components/workspace/useMobileMode');
    const { renderHook } = await import('@testing-library/react');
    const { result } = renderHook(() => useMobileMode());
    expect(result.current).toBe(false);
  });
});

// M.2: PaneHeader hides split buttons on mobile
describe('MobileMode (M.2) PaneHeader hides split buttons on mobile', () => {
  it('shows split buttons on desktop', () => {
    mockMobile(false);
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" isOnly={false} onSplitH={() => {}} onSplitV={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-split-h')).toBeInTheDocument();
    expect(screen.getByTestId('pane-split-v')).toBeInTheDocument();
  });

  it('hides split buttons on mobile', () => {
    mockMobile(true);
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" isOnly={false} onSplitH={() => {}} onSplitV={() => {}} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('pane-split-h')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pane-split-v')).not.toBeInTheDocument();
  });
});

// M.3: ⌘\ and ⌘- are no-op on mobile
describe('MobileMode (M.3) keyboard split shortcuts no-op on mobile', () => {
  it('⌘\\ does not split on mobile', async () => {
    mockMobile(true);
    const user = userEvent.setup();
    let paneType = '';

    function Probe() {
      const { paneRoot } = usePaneState();
      paneType = paneRoot.type;
      return null;
    }

    render(
      <KbWrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </KbWrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}\\{/Meta}');
    expect(paneType).toBe('leaf');
  });

  it('⌘- does not split on mobile', async () => {
    mockMobile(true);
    const user = userEvent.setup();
    let paneType = '';

    function Probe() {
      const { paneRoot } = usePaneState();
      paneType = paneRoot.type;
      return null;
    }

    render(
      <KbWrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </KbWrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}-{/Meta}');
    expect(paneType).toBe('leaf');
  });
});
