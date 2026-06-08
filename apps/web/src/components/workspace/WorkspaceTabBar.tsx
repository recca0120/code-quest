import { useState } from 'react';
import { collectSessionsInPaneTree, useTabState, useWorkspaceTab } from '@/contexts/TabContext';
import { useSessionManager } from './SessionManagerContext';

const BUSY_STATUSES = new Set(['processing', 'busy', 'cancelling']);

export function WorkspaceTabBar(): React.JSX.Element {
  const {
    workspaceTabs,
    activeWorkspaceTabId,
    switchWorkspaceTab,
    removeWorkspaceTab,
    addWorkspaceTab,
    renameWorkspaceTab,
  } = useWorkspaceTab();
  const { tabs } = useTabState();
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { open: openSessionManager } = useSessionManager();

  return (
    <div
      data-testid="workspace-tab-bar"
      className="flex items-center gap-1 px-2 py-1 border-b border-border overflow-x-auto"
    >
      {workspaceTabs.map((tab, index) => {
        const sessionIds = collectSessionsInPaneTree(tab.paneRoot);
        const isBusy = [...sessionIds].some(
          (id) => tabs[id] && BUSY_STATUSES.has(tabs[id].tabStatus),
        );
        return (
          <button
            key={tab.id}
            type="button"
            data-testid="workspace-tab"
            data-active={activeWorkspaceTabId === tab.id || undefined}
            data-busy={isBusy || undefined}
            onClick={() => switchWorkspaceTab(tab.id)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded"
          >
            {isBusy && <span aria-hidden="true">●</span>}
            {renamingTabId === tab.id ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  renameWorkspaceTab(tab.id, renameValue);
                  setRenamingTabId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameWorkspaceTab(tab.id, renameValue);
                    setRenamingTabId(null);
                  } else if (e.key === 'Escape') {
                    setRenamingTabId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none w-20 text-xs"
              />
            ) : (
              <button
                type="button"
                aria-label={`rename tab ${tab.label ?? `Tab ${index + 1}`}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingTabId(tab.id);
                  setRenameValue(tab.label ?? `Tab ${index + 1}`);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent"
              >
                {tab.label ?? `Tab ${index + 1}`}
              </button>
            )}
            <button
              type="button"
              aria-label="close tab"
              onClick={(e) => {
                e.stopPropagation();
                removeWorkspaceTab(tab.id);
              }}
              className="ml-1 opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </button>
        );
      })}
      <button
        type="button"
        data-testid="workspace-tab-add"
        onClick={() => addWorkspaceTab()}
        className="px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Open session manager"
        onClick={openSessionManager}
        className="ml-auto px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
        title="Session Manager (⌘⇧M)"
      >
        ⊞
      </button>
    </div>
  );
}
