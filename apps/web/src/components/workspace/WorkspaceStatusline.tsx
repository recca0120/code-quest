import {
  collectSessionsInPaneTree,
  firstPaneCwd,
  paneCwd,
  usePaneState,
  useTabState,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { WORKSPACE_SHORTCUT_HINTS } from './KeyboardShortcutsProvider';
import { useWorktreeLookup } from './useAvailableWorktrees';

const BUSY_STATUSES = new Set(['processing', 'busy', 'cancelling']);

/**
 * 底部狀態列（handoff §1）：
 * 左＝focused pane 的 `project ⎇ branch`（lookup 反查 focused leaf cwd）；
 * 右＝快捷鍵提示（與 KeyboardShortcutsProvider 單一來源）＋ N busy 聚合。
 * SessionBar 移除後，這裡與 tab busy 燈共同承接 busy 可見性。
 */
export function WorkspaceStatusline(): React.JSX.Element {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { tabs } = useTabState();
  const { workspaceTabs } = useWorkspaceTab();
  const lookup = useWorktreeLookup();

  const cwd = (focusedPaneId ? paneCwd(paneRoot, focusedPaneId) : null) ?? firstPaneCwd(paneRoot);
  const identity = cwd ? lookup.get(cwd) : undefined;
  const projectName = identity?.projectName ?? (cwd ? cwd.split('/').filter(Boolean).pop() : null);
  const branch = identity?.branch ?? identity?.name;

  const busyCount = workspaceTabs.reduce((count, tab) => {
    for (const id of collectSessionsInPaneTree(tab.paneRoot)) {
      if (tabs[id] && BUSY_STATUSES.has(tabs[id].tabStatus)) count += 1;
    }
    return count;
  }, 0);

  return (
    <div
      data-testid="workspace-statusline"
      className="flex items-center gap-3 px-3 border-t border-border bg-surface h-(--statusline-h) shrink-0 font-mono text-2xs text-muted whitespace-nowrap overflow-hidden"
    >
      {projectName && (
        <span data-testid="statusline-context" className="flex items-center gap-1.5">
          <span className="text-accent font-semibold">{projectName}</span>
          {branch && <span>⎇ {branch}</span>}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        {WORKSPACE_SHORTCUT_HINTS.map((hint) => (
          // md(768) 起才顯桌面快捷鍵提示：640–767 視為 mobile 段
          <span key={hint.keys} className="hidden md:inline text-subtle">
            <b className="text-muted font-semibold">{hint.keys}</b> {hint.label}
          </span>
        ))}
        {busyCount > 0 && (
          <span data-testid="statusline-busy" className="flex items-center gap-1 text-accent">
            {/* 尺寸接 --busy-dot-size＝6px；design 自身 5/6 不一致（statusline 5px、tab 6px），
                5px 無 scale/token，統一取 6px */}
            <span
              aria-hidden="true"
              className="size-(--busy-dot-size) rounded-full bg-accent animate-busy-pulse"
            />
            {busyCount} busy
          </span>
        )}
      </span>
    </div>
  );
}
