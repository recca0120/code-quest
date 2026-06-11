import { useState } from 'react';
import {
  collectSessionsInPaneTree,
  firstPaneCwd,
  useTabState,
  useWorkspaceTab,
  type WorkspaceTab,
} from '@/contexts/TabContext';
import { useSessionManager } from './SessionManagerContext';
import { useWorktreeLookup, type WorktreeIdentity } from './useAvailableWorktrees';

const BUSY_STATUSES = new Set(['processing', 'busy', 'cancelling']);

/** tab 預設命名（handoff: Tab 命名）：第一個 pane 的 worktree 名，去 feat/ 等前綴。
 * 使用者命名過（tab.label 存在）永遠優先——預設名只在 render 時推導、不寫入 state。 */
function deriveTabLabel(
  tab: WorkspaceTab,
  lookup: Map<string, WorktreeIdentity>,
  index: number,
): string {
  if (tab.label) return tab.label;
  const cwd = firstPaneCwd(tab.paneRoot);
  if (cwd) {
    const identity = lookup.get(cwd);
    const source = identity?.branch ?? identity?.name ?? cwd;
    const segments = source.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last;
  }
  return `Tab ${index + 1}`;
}

interface WorkspaceTabBarProps {
  onOpenSettings?: () => void;
  onAddProject?: () => void;
}

export function WorkspaceTabBar({
  onOpenSettings,
  onAddProject,
}: WorkspaceTabBarProps = {}): React.JSX.Element {
  const {
    workspaceTabs,
    activeWorkspaceTabId,
    switchWorkspaceTab,
    removeWorkspaceTab,
    addWorkspaceTab,
    renameWorkspaceTab,
  } = useWorkspaceTab();
  const { tabs } = useTabState();
  const lookup = useWorktreeLookup();
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { open: openSessionManager } = useSessionManager();

  return (
    <div
      data-testid="workspace-tab-bar"
      role="tablist"
      aria-label="workspace tabs"
      // 底線用 tabbar-hairline-b（inset shadow）+ pb-px 取代 border-b：active tab 的
      // after 蓋線留在 padding-box 內不被裁切，且 overflow-x-auto 保持 tabs 多時可捲
      className="flex items-center gap-1 px-2.5 pb-px tabbar-hairline-b overflow-x-auto bg-surface h-(--tabbar-h) shrink-0"
    >
      {/* logo（handoff §1：18px 圓角方塊＋名稱 13px/700） */}
      <span className="flex items-center gap-1.5 mr-2 shrink-0 select-none" aria-hidden="true">
        <span className="flex items-center justify-center size-4.5 rounded-(--radius-chip) bg-accent text-selected-text text-2xs font-bold">
          ⚔
        </span>
        <span className="text-xs font-bold text-bright hidden md:inline">Code Quest</span>
      </span>
      {workspaceTabs.map((tab, index) => {
        const sessionIds = collectSessionsInPaneTree(tab.paneRoot);
        const isBusy = [...sessionIds].some(
          (id) => tabs[id] && BUSY_STATUSES.has(tabs[id].tabStatus),
        );
        const isActive = activeWorkspaceTabId === tab.id;
        const label = deriveTabLabel(tab, lookup, index);
        return (
          // role=tab 的 div（非 button）：tab 內含 label/close 等真 button，button 不可巢狀
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            data-testid="workspace-tab"
            data-active={isActive || undefined}
            data-busy={isBusy || undefined}
            onClick={() => switchWorkspaceTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target === e.currentTarget) switchWorkspaceTab(tab.id);
            }}
            // gap-2(8px) 近似 design 的 7px（無 scale；compact density 下恰為 7px）；
            // active 的 after = 2px bg-bg 蓋線，接縫蓋掉 bar 底線（design .tx-tab.active::after）
            className={`flex items-center gap-2 px-3 text-xs whitespace-nowrap rounded-t-lg h-(--tab-h) self-end border border-b-0 cursor-pointer ${
              isActive
                ? 'bg-bg border-border text-bright relative after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-bg'
                : 'border-transparent text-muted hover:bg-surface-hover'
            }`}
          >
            <span
              aria-hidden="true"
              className={`font-mono text-2xs ${isActive ? 'text-accent font-bold' : 'text-subtle'}`}
            >
              {index + 1}
            </span>
            {isBusy && (
              <span
                aria-hidden="true"
                className="size-(--busy-dot-size) rounded-full bg-accent animate-busy-pulse"
                data-testid="workspace-tab-busy-dot"
              />
            )}
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
              // 單擊冒泡到 tab 切換；雙擊進 rename
              <button
                type="button"
                data-testid="workspace-tab-label"
                className="bg-transparent"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenamingTabId(tab.id);
                  setRenameValue(label);
                }}
              >
                {label}
              </button>
            )}
            <button
              type="button"
              aria-label="close tab"
              onClick={(e) => {
                e.stopPropagation();
                removeWorkspaceTab(tab.id);
              }}
              className="ml-0.5 text-subtle hover:text-text"
            >
              ×
            </button>
          </div>
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
      <span
        aria-hidden="true"
        className="font-mono text-2xs text-muted bg-bg border border-border rounded px-1.5 py-0.5"
        title="Pane picker (⌘K)"
      >
        ⌘K
      </span>
      {onAddProject && (
        <button
          type="button"
          aria-label="Add project"
          onClick={onAddProject}
          className="px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
          title="Add project"
        >
          + Project
        </button>
      )}
      {onOpenSettings && (
        <button
          type="button"
          aria-label="Settings"
          onClick={onOpenSettings}
          className="px-2 py-0.5 text-xs opacity-60 hover:opacity-100"
          title="Settings"
        >
          ⚙
        </button>
      )}
    </div>
  );
}
