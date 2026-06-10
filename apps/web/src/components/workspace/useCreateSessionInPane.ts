/**
 * Create+place as one operation（worktree-centric D6，remove-session-bar 前置）：
 * 建立 session 並保證它「可見地」落入 pane——空 pane 填入、占用則 split、
 * focused 是 tool pane 也不吞。Cmd+T、pendingSession 管線、Navigation intent
 * 消費全部走這一條，session 永遠不會掉進隱形 pool（幽靈 session 終結）。
 */
import { useCallback } from 'react';
import {
  findPaneBySession,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabActions,
} from '@/contexts/TabContext';

type PaneLeafNode = Extract<PaneNode, { type: 'leaf' }>;

function findLeafBy(node: PaneNode, pred: (leaf: PaneLeafNode) => boolean): PaneLeafNode | null {
  if (node.type === 'leaf') return pred(node) ? node : null;
  return findLeafBy(node.first, pred) ?? findLeafBy(node.second, pred);
}

function isEmptySessionLeaf(leaf: PaneLeafNode): boolean {
  return leaf.content.type === 'session' && leaf.content.sessionId === null;
}

function isSessionLeaf(leaf: PaneLeafNode): boolean {
  return leaf.content.type === 'session';
}

export interface CreateSessionOpts {
  cwd?: string;
  projectCwd?: string;
  branch?: string;
  targetPaneId?: string;
}

export function useCreateSessionInPane(): {
  createSessionInPane: (opts?: CreateSessionOpts) => { channelId: string };
  placeExistingSession: (channelId: string, cwd: string | null) => void;
} {
  const { createNewTab } = useTabActions();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { setSessionInPane, focusPane, splitPaneAndAssign } = usePaneActions();

  /** 指派一個（已存在的）session 到 pane：目標 → 空 leaf → split。 */
  const place = useCallback(
    (channelId: string, cwd: string | null, targetPaneId?: string | null) => {
      const byId = targetPaneId ? findLeafBy(paneRoot, (l) => l.id === targetPaneId) : null;
      const target =
        byId && isSessionLeaf(byId)
          ? byId
          : (findLeafBy(paneRoot, isEmptySessionLeaf) ?? findLeafBy(paneRoot, isSessionLeaf));
      if (target && target.content.type === 'session' && target.content.sessionId === null) {
        setSessionInPane(target.id, channelId, cwd);
        focusPane(target.id);
      } else {
        // Occupied or no session leaf at all — split and assign to a new leaf
        splitPaneAndAssign('h', channelId, cwd);
      }
    },
    [paneRoot, setSessionInPane, focusPane, splitPaneAndAssign],
  );

  const createSessionInPane = useCallback(
    (opts?: CreateSessionOpts) => {
      const { channelId, cwd } = createNewTab(opts);
      place(channelId, cwd, opts?.targetPaneId ?? focusedPaneId);
      return { channelId };
    },
    [createNewTab, place, focusedPaneId],
  );

  const placeExistingSession = useCallback(
    (channelId: string, cwd: string | null) => {
      const existingPaneId = findPaneBySession(paneRoot, channelId);
      if (existingPaneId) {
        focusPane(existingPaneId);
        return;
      }
      place(channelId, cwd, focusedPaneId);
    },
    [paneRoot, focusPane, place, focusedPaneId],
  );

  return { createSessionInPane, placeExistingSession };
}
