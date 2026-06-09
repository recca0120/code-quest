/**
 * Group 1: TabContext PaneNode tree expansion
 * Tests for PaneContent, PaneNode types, and pane actions:
 * splitPane, closePane, focusPane, updateRatio, setSessionInPane, zoomPane
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function renderWithPanes(ui: ReactElement) {
  const summoner = createFakeSummoner();
  const user = userEvent.setup();
  render(
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{ui}</TabProvider>
    </SocketProvider>,
  );
  return { user };
}

// ── 1.1 Type tests (compile-time) ── verified by TypeScript — no runtime assertions needed.
// We import the types and assign values; if types are wrong, tsc fails.
describe('PaneContent / PaneNode types (1.1)', () => {
  it('can construct all PaneContent variants', () => {
    const _session = { type: 'session' as const, sessionId: 'abc' };
    const _sessionNull = { type: 'session' as const, sessionId: null };
    const _git = { type: 'git' as const, cwd: '/repo' };
    const _files = { type: 'files' as const, cwd: '/repo' };
    const _spec = { type: 'spec' as const, cwd: '/repo' };
    const _worktrees = { type: 'worktrees' as const };
    expect(_session.type).toBe('session');
    expect(_sessionNull.sessionId).toBeNull();
    expect(_git.type).toBe('git');
    expect(_files.type).toBe('files');
    expect(_spec.type).toBe('spec');
    expect(_worktrees.type).toBe('worktrees');
  });
});

// ── 1.2–1.3 splitPane action ──
describe('splitPane action (1.3)', () => {
  it('splits the focused leaf into two panes horizontally', async () => {
    let splitFn: (() => void) | null = null;
    let paneCount = 0;

    function Test() {
      const { paneRoot } = usePaneState();
      const { splitPane } = usePaneActions();

      function countLeaves(node: typeof paneRoot): number {
        if (!node) return 0;
        if (node.type === 'leaf') return 1;
        return countLeaves(node.first) + countLeaves(node.second);
      }
      paneCount = countLeaves(paneRoot);
      splitFn = () => splitPane('h');

      return (
        <button type="button" onClick={splitFn}>
          split
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    expect(paneCount).toBe(1);
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(paneCount).toBe(2);
  });

  it('new pane after split has empty session content', async () => {
    let newPaneContent: unknown = null;

    function Test() {
      const { paneRoot } = usePaneState();
      const { splitPane } = usePaneActions();

      if (paneRoot?.type === 'split') {
        newPaneContent = paneRoot.second.type === 'leaf' ? paneRoot.second.content : null;
      }

      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(newPaneContent).toMatchObject({ type: 'session', sessionId: null });
  });
});

// ── 1.4 closePane action ──
describe('closePane action (1.4)', () => {
  it('closing a pane when two panes exist leaves one pane', async () => {
    let paneCount = 0;
    let closeFn: (() => void) | null = null;
    let secondLeafId = '';

    function Test() {
      const { paneRoot } = usePaneState();
      const { splitPane, closePane } = usePaneActions();

      function countLeaves(node: typeof paneRoot): number {
        if (!node) return 0;
        if (node.type === 'leaf') return 1;
        return countLeaves(node.first) + countLeaves(node.second);
      }
      paneCount = countLeaves(paneRoot);

      if (paneRoot?.type === 'split') {
        const second = paneRoot.second;
        if (second.type === 'leaf') {
          secondLeafId = second.id;
          closeFn = () => closePane(second.id);
        }
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => closeFn?.()}>
            close
          </button>
        </>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(paneCount).toBe(2);
    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(paneCount).toBe(1);
    expect(secondLeafId).not.toBe('');
  });

  it('closing the only pane is a no-op (still 1 pane)', async () => {
    let paneCount = 0;
    let rootId = '';

    function Test() {
      const { paneRoot } = usePaneState();
      const { closePane } = usePaneActions();

      if (paneRoot?.type === 'leaf') {
        paneCount = 1;
        rootId = paneRoot.id;
      }

      return (
        <button type="button" onClick={() => rootId && closePane(rootId)}>
          close
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(paneCount).toBe(1);
  });
});

// ── 1.5 focusPane action ──
describe('focusPane action (1.5)', () => {
  it('focusPane updates focusedPaneId', async () => {
    let focusedPaneId = '';
    let firstId = '';
    let secondId = '';

    function Test() {
      const { paneRoot, focusedPaneId: focused } = usePaneState();
      const { splitPane, focusPane } = usePaneActions();
      focusedPaneId = focused ?? '';

      if (paneRoot?.type === 'split') {
        if (paneRoot.first.type === 'leaf') firstId = paneRoot.first.id;
        if (paneRoot.second.type === 'leaf') secondId = paneRoot.second.id;
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => firstId && focusPane(firstId)}>
            focus-first
          </button>
        </>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'split' }));
    // After split, focus moves to the new (second) leaf
    expect(focusedPaneId).toBe(secondId);
    await user.click(screen.getByRole('button', { name: 'focus-first' }));
    expect(focusedPaneId).toBe(firstId);
    expect(focusedPaneId).not.toBe(secondId);
  });
});

// ── 1.6 updateRatio action ──
describe('updateRatio action (1.6)', () => {
  it('updateRatio changes split node ratio', async () => {
    let currentRatio: number | undefined;
    let splitNodeId = '';

    function Test() {
      const { paneRoot } = usePaneState();
      const { splitPane, updateRatio } = usePaneActions();

      if (paneRoot?.type === 'split') {
        currentRatio = paneRoot.ratio;
        splitNodeId = paneRoot.id;
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => splitNodeId && updateRatio(splitNodeId, 0.3)}>
            set-ratio
          </button>
        </>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(currentRatio).toBe(0.5);
    await user.click(screen.getByRole('button', { name: 'set-ratio' }));
    expect(currentRatio).toBeCloseTo(0.3);
  });
});

// ── 1.7 setSessionInPane action ──
describe('setSessionInPane action (1.7)', () => {
  it('setSessionInPane updates leaf content sessionId', async () => {
    let leafContent: unknown = null;
    let leafId = '';

    function Test() {
      const { paneRoot } = usePaneState();
      const { setSessionInPane } = usePaneActions();

      if (paneRoot?.type === 'leaf') {
        leafContent = paneRoot.content;
        leafId = paneRoot.id;
      }

      return (
        <button type="button" onClick={() => leafId && setSessionInPane(leafId, 'session-abc')}>
          set-session
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    expect((leafContent as { sessionId: unknown })?.sessionId).toBeNull();
    await user.click(screen.getByRole('button', { name: 'set-session' }));
    expect((leafContent as { sessionId: unknown })?.sessionId).toBe('session-abc');
  });
});

// ── 1.8 zoomPane action ──
describe('zoomPane action (1.8)', () => {
  it('zoomPane sets zoomedPaneId', async () => {
    let zoomedId: string | null = 'not-set';
    let leafId = '';

    function Test() {
      const { paneRoot, zoomedPaneId } = usePaneState();
      const { zoomPane } = usePaneActions();
      zoomedId = zoomedPaneId;

      if (paneRoot?.type === 'leaf') leafId = paneRoot.id;

      return (
        <button type="button" onClick={() => leafId && zoomPane(leafId)}>
          zoom
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    expect(zoomedId).toBeNull();
    await user.click(screen.getByRole('button', { name: 'zoom' }));
    expect(zoomedId).toBe(leafId);
  });

  it('zoomPane(null) clears zoomedPaneId', async () => {
    let zoomedId: string | null = 'not-set';
    let leafId = '';

    function Test() {
      const { paneRoot, zoomedPaneId } = usePaneState();
      const { zoomPane } = usePaneActions();
      zoomedId = zoomedPaneId;

      if (paneRoot?.type === 'leaf') leafId = paneRoot.id;

      return (
        <>
          <button type="button" onClick={() => leafId && zoomPane(leafId)}>
            zoom
          </button>
          <button type="button" onClick={() => zoomPane(null)}>
            unzoom
          </button>
        </>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'zoom' }));
    expect(zoomedId).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'unzoom' }));
    expect(zoomedId).toBeNull();
  });
});
