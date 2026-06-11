import { memo } from 'react';
import { type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { guardSplitMinSize } from '../pane-min-size.ts';
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
  const { splitPane, closePane, focusPane, swapPane } = usePaneActions();

  const toolbarProps: PaneToolbarCommonProps = {
    paneId: node.id,
    isOnly: paneRoot.type === 'leaf',
    onSplitH: () => {
      if (!guardSplitMinSize(node.id, 'h')) return;
      focusPane(node.id);
      splitPane('h');
    },
    onSplitV: () => {
      if (!guardSplitMinSize(node.id, 'v')) return;
      focusPane(node.id);
      splitPane('v');
    },
    onClose: () => closePane(node.id),
    onSwap: (sourceId) => swapPane(sourceId, node.id),
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
