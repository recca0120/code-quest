/**
 * Mobile Gap Fixes — TDD
 *
 * Gap-M: Mobile 強制單 pane — 非 focused pane 在 mobile 時應隱藏
 * Gap-C: SessionBar overflow — maxVisible 必須動態計算並傳入
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaneTree } from '@/components/workspace/PaneTree';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

// Structural tests only — leaf bodies are irrelevant (and heavy)
vi.mock('@/components/workspace/panes/PaneLeafBody', () => ({
  PaneLeafBody: () => null,
}));

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

afterEach(() => vi.restoreAllMocks());

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gap-M: Mobile 時非 focused pane 應被隱藏（強制單 pane 顯示）
// ─────────────────────────────────────────────────────────────────────
describe('Gap-M: Mobile forces single pane display', () => {
  it('on mobile, non-focused pane leaf has hidden attribute after split + focus', async () => {
    mockMobile(true);

    let firstPaneId = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, focusPane } = usePaneActions();

      if (paneRoot.type === 'split' && paneRoot.first.type === 'leaf') {
        firstPaneId = paneRoot.first.id;
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => firstPaneId && focusPane(firstPaneId)}>
            focus-first
          </button>
        </>
      );
    }

    const user = userEvent.setup();
    const { container } = render(
      <Wrapper>
        <Setup />
        <PaneTree />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    await user.click(screen.getByRole('button', { name: 'focus-first' }));

    // Solo rendering: only the focused leaf is in the DOM — the split wrapper,
    // divider and the other leaf are not rendered at all (it fills the area)
    const leaves = container.querySelectorAll('[data-testid="split-pane-leaf"]');
    expect(leaves.length).toBe(1);
    expect(container.querySelector('[data-testid="pane-divider"]')).toBeNull();
  });

  it('on desktop, both pane leaves are visible after split', async () => {
    mockMobile(false);

    function Setup() {
      const { splitPane } = usePaneActions();
      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    const user = userEvent.setup();
    const { container } = render(
      <Wrapper>
        <Setup />
        <PaneTree />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));

    const leaves = container.querySelectorAll('[data-testid="split-pane-leaf"]');
    expect(leaves.length).toBe(2);
    const hiddenLeaves = [...leaves].filter((el) => el.hasAttribute('hidden'));
    expect(hiddenLeaves.length).toBe(0);
  });

  it('on mobile, switching focus makes the other pane hidden', async () => {
    mockMobile(true);

    let firstId = '';
    let secondId = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, focusPane } = usePaneActions();

      if (paneRoot.type === 'split') {
        firstId = paneRoot.first.type === 'leaf' ? paneRoot.first.id : '';
        secondId = paneRoot.second.type === 'leaf' ? paneRoot.second.id : '';
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => firstId && focusPane(firstId)}>
            focus-first
          </button>
          <button type="button" onClick={() => secondId && focusPane(secondId)}>
            focus-second
          </button>
        </>
      );
    }

    const user = userEvent.setup();
    const { container } = render(
      <Wrapper>
        <Setup />
        <PaneTree />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    await user.click(screen.getByRole('button', { name: 'focus-first' }));

    const leaves = () => [...container.querySelectorAll('[data-testid="split-pane-leaf"]')];

    // first is focused → only first rendered (solo)
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]).toHaveAttribute('data-pane-id', firstId);

    // switch focus to second → only second rendered
    await user.click(screen.getByRole('button', { name: 'focus-second' }));
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]).toHaveAttribute('data-pane-id', secondId);
  });
});
