import { useWorkspaceTabActions, useWorkspaceTabState } from '@/contexts/TabContext';

export function WorkspaceTabBar(): React.JSX.Element {
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTabState();
  const { switchWorkspaceTab, removeWorkspaceTab, addWorkspaceTab } = useWorkspaceTabActions();

  return (
    <div
      data-testid="workspace-tab-bar"
      className="flex items-center gap-1 px-2 py-1 border-b border-border overflow-x-auto"
    >
      {workspaceTabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          data-testid="workspace-tab"
          data-active={activeWorkspaceTabId === tab.id || undefined}
          onClick={() => switchWorkspaceTab(tab.id)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded"
        >
          <span>{tab.label ?? `Tab ${index + 1}`}</span>
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
      ))}
      <button
        type="button"
        data-testid="workspace-tab-add"
        onClick={() => addWorkspaceTab()}
        className="px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
      >
        +
      </button>
    </div>
  );
}
