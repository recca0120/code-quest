import { memo } from 'react';
import { type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { guardSplitMinSize } from '../pane-min-size.ts';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';
import type { PaneToolbarCommonProps } from './PaneShell.tsx';
import { SessionPane } from './SessionPane.tsx';
import { FilesPane, GitPane, OpenspecPane } from './tool-panes.tsx';
import { WorktreesPaneContainer } from './WorktreesPaneContainer.tsx';

/**
 * Exhaustive dispatch from PaneContent to named pane components. A switch (not a
 * Record lookup) so TypeScript narrows content per case — and `satisfies never`
 * turns a forgotten case into a compile error when a new pane type is added.
 */
export const PaneLeafBody: React.NamedExoticComponent<{
  node: Extract<PaneNode, { type: 'leaf' }>;
}> = memo(function PaneLeafBody({ node }) {
  const { paneRoot } = usePaneState();
  const { splitPane, closePane, focusPane, zoomPane } = usePaneActions();
  const { onOpenModal } = usePaneEnvironment();

  // 分割（開 picker 選內容，handoff §2）：split 以 paneId 指定目標（單一 dispatch，
  // splitPane 才能同步回傳新 leaf id），成功後 picker target = 新 leaf；
  // min-size guard 拒絕時不分割也不開 picker
  function splitAndPick(direction: 'h' | 'v'): void {
    if (!guardSplitMinSize(node.id, direction)) return;
    const newLeafId = splitPane(direction, node.id);
    if (newLeafId) onOpenModal?.(newLeafId);
  }

  const toolbarProps: PaneToolbarCommonProps = {
    paneId: node.id,
    isOnly: paneRoot.type === 'leaf',
    onSplitH: () => splitAndPick('h'),
    onSplitV: () => splitAndPick('v'),
    onZoom: () => {
      focusPane(node.id);
      zoomPane(node.id);
    },
    onClose: () => closePane(node.id),
  };

  const content = node.content;
  switch (content.type) {
    case 'session':
      return <SessionPane paneId={node.id} content={content} toolbarProps={toolbarProps} />;
    case 'git':
      return <GitPane paneId={node.id} cwd={content.target.cwd} toolbarProps={toolbarProps} />;
    case 'files':
      return <FilesPane paneId={node.id} cwd={content.target.cwd} toolbarProps={toolbarProps} />;
    case 'openspec':
      return <OpenspecPane paneId={node.id} cwd={content.target.cwd} toolbarProps={toolbarProps} />;
    case 'worktrees':
      return <WorktreesPaneContainer toolbarProps={toolbarProps} />;
    default:
      return content satisfies never;
  }
});
