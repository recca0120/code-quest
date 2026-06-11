/**
 * Group 1: TabContext PaneNode tree expansion
 * Tests for PaneContent, PaneNode types, and pane actions:
 * splitPane, closePane, focusPane, updateRatio, setSessionInPane, zoomPane
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { PaneNode } from '@/contexts/TabContext';
import {
  buildSessionPaneLabels,
  type PaneContent,
  TabProvider,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';

// 裸 TabProvider（比照 pane-content-shape）：pane tree 純 client state，
// useLayoutPersistence 的 contexts 是 soft-bound——不需要 socket harness。
function renderWithPanes(ui: ReactElement) {
  const user = userEvent.setup();
  render(<TabProvider>{ui}</TabProvider>);
  return { user };
}

// ── 1.1 Type tests (compile-time) ── `satisfies` 擋各 variant 的 shape drift、
// expectTypeOf 釘死 union 全集（增刪 variant 都過不了 tsc --noEmit）。
// 不留 runtime expects：舊版的 expect(session.type).toBe('session') 等
// 全是字面值複述（恆真），不提供任何行為保護。
describe('PaneContent / PaneNode types (1.1)', () => {
  it('can construct all current PaneContent variants (type-level assertions)', () => {
    const session = { type: 'session', sessionId: 'abc', cwd: '/repo' } satisfies PaneContent;
    const sessionNull = { type: 'session', sessionId: null, cwd: null } satisfies PaneContent;
    const git = { type: 'git', target: { kind: 'fixed', cwd: '/repo' } } satisfies PaneContent;
    const files = { type: 'files', target: { kind: 'fixed', cwd: '/repo' } } satisfies PaneContent;
    const openspec = {
      type: 'openspec',
      target: { kind: 'fixed', cwd: '/repo' },
    } satisfies PaneContent;
    const worktrees = { type: 'worktrees' } satisfies PaneContent;
    expectTypeOf(session).toExtend<PaneContent>();
    expectTypeOf(sessionNull).toExtend<PaneContent>();
    expectTypeOf(git).toExtend<PaneContent>();
    expectTypeOf(files).toExtend<PaneContent>();
    expectTypeOf(openspec).toExtend<PaneContent>();
    expectTypeOf(worktrees).toExtend<PaneContent>();
    expectTypeOf<PaneContent['type']>().toEqualTypeOf<
      'session' | 'git' | 'files' | 'openspec' | 'worktrees'
    >();
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
    expect(newPaneContent).toMatchObject({ type: 'session', sessionId: null, cwd: null });
  });
});

// ── openToolColumn action（標準工作組：picker ⌘1）──
describe('openToolColumn action', () => {
  it('focused leaf 右側建 files/git 直欄：root h-split 0.6、first=原 leaf、second=v-split（files 上 git 下）、focus 留原 leaf', async () => {
    let root: PaneNode | null = null;
    let focusedId: string | null = null;
    let originalLeafId = '';

    function Test() {
      const { paneRoot, focusedPaneId } = usePaneState();
      const { openToolColumn } = usePaneActions();
      root = paneRoot;
      focusedId = focusedPaneId;
      if (paneRoot.type === 'leaf' && !originalLeafId) originalLeafId = paneRoot.id;
      return (
        <button type="button" onClick={() => openToolColumn('/wt')}>
          tool-column
        </button>
      );
    }

    const { user } = renderWithPanes(<Test />);
    await user.click(screen.getByRole('button', { name: 'tool-column' }));

    // cast：root 在 render closure 內賦值，TS 的 CFA 看不見、停在初始 null
    const r = root as PaneNode | null;
    if (!r || r.type !== 'split') throw new Error('root should be an h-split after openToolColumn');
    expect(r.direction).toBe('h');
    expect(r.ratio).toBe(0.6);
    expect(r.first).toMatchObject({ type: 'leaf', id: originalLeafId });

    const column = r.second;
    if (column.type !== 'split') throw new Error('second should be the files/git v-split column');
    expect(column.direction).toBe('v');
    expect(column.first).toMatchObject({
      type: 'leaf',
      content: { type: 'files', target: { kind: 'fixed', cwd: '/wt' } },
    });
    expect(column.second).toMatchObject({
      type: 'leaf',
      content: { type: 'git', target: { kind: 'fixed', cwd: '/wt' } },
    });
    expect(focusedId).toBe(originalLeafId);
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
        <button
          type="button"
          onClick={() => leafId && setSessionInPane(leafId, 'session-abc', null)}
        >
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

describe('buildSessionPaneLabels', () => {
  it('single leaf with session returns "Left pane" for h-split left child', () => {
    const tree: PaneNode = {
      type: 'split',
      id: 's1',
      direction: 'h',
      ratio: 0.5,
      first: { type: 'leaf', id: 'p1', content: { type: 'session', sessionId: 'ch-1', cwd: null } },
      second: { type: 'leaf', id: 'p2', content: { type: 'session', sessionId: null, cwd: null } },
    };
    const labels = buildSessionPaneLabels(tree);
    expect(labels.get('ch-1')).toBe('Left pane');
  });

  it('h-split right child gets "Right pane"', () => {
    const tree: PaneNode = {
      type: 'split',
      id: 's1',
      direction: 'h',
      ratio: 0.5,
      first: { type: 'leaf', id: 'p1', content: { type: 'session', sessionId: null, cwd: null } },
      second: {
        type: 'leaf',
        id: 'p2',
        content: { type: 'session', sessionId: 'ch-2', cwd: null },
      },
    };
    const labels = buildSessionPaneLabels(tree);
    expect(labels.get('ch-2')).toBe('Right pane');
  });

  it('v-split gets "Top pane" and "Bottom pane"', () => {
    const tree: PaneNode = {
      type: 'split',
      id: 's1',
      direction: 'v',
      ratio: 0.5,
      first: {
        type: 'leaf',
        id: 'p1',
        content: { type: 'session', sessionId: 'ch-top', cwd: null },
      },
      second: {
        type: 'leaf',
        id: 'p2',
        content: { type: 'session', sessionId: 'ch-bot', cwd: null },
      },
    };
    const labels = buildSessionPaneLabels(tree);
    expect(labels.get('ch-top')).toBe('Top pane');
    expect(labels.get('ch-bot')).toBe('Bottom pane');
  });

  it('single pane (no split) returns "Pane"', () => {
    const tree: PaneNode = {
      type: 'leaf',
      id: 'p1',
      content: { type: 'session', sessionId: 'ch-1', cwd: null },
    };
    const labels = buildSessionPaneLabels(tree);
    expect(labels.get('ch-1')).toBe('Pane');
  });
});
