import { ChatBubbleLeftRightIcon, RectangleGroupIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useDrawerActionsOptional } from '@/contexts/DrawerContext';
import {
  type PaneContent,
  type RailState,
  usePaneActions,
  useTabState,
} from '@/contexts/TabContext';
import { formatWorktreeLabel } from '../pane-label';
import { PANE_TYPE_REGISTRY } from '../pane-registry';
import { RightPane } from '../RightPane.tsx';
import { TabContent } from '../TabContent.tsx';
import { useWorktreeLookup } from '../useAvailableWorktrees.ts';
import { PaneDock } from './PaneDock.tsx';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';
import { PaneShell, type PaneToolbarCommonProps } from './PaneShell.tsx';

/** handoff 定案：新 chat 預設展開側欄 */
const DEFAULT_RAIL: RailState = { open: true, tab: 'files' };
/** session pane 的類型 icon ＝ registry 的 chat entry（✦，handoff §2） */
const CHAT_TYPE_ICON = PANE_TYPE_REGISTRY.find((entry) => entry.key === 'chat')?.icon;
/** pane 寬低於此值自動收合 rail 成 dock（handoff §3） */
const RAIL_AUTO_COLLAPSE_PX = 720;

type SessionContent = Extract<PaneContent, { type: 'session' }>;

/**
 * Liveness is a render-time concern: meta present → TabContent (mode:'resume'
 * rebind, never spawns); absent → EmptyPane with a restore hint resolved from
 * content.cwd against the live worktree listing (never persisted — stale-proof).
 * Both transitions are automatic (self-heal) because they only depend on tabs.
 */
export function SessionPane({
  paneId,
  content,
  toolbarProps,
}: {
  paneId: string;
  content: SessionContent;
  toolbarProps: PaneToolbarCommonProps;
}): React.JSX.Element {
  const { tabs } = useTabState();
  const env = usePaneEnvironment();
  const lookup = useWorktreeLookup();
  const { setContentInPane, splitPaneAndSetContent } = usePaneActions();
  const openDrawer = useDrawerActionsOptional()?.openDrawer;

  const rail = content.rail ?? DEFAULT_RAIL;
  const railRef = useRef(rail);
  railRef.current = rail;
  const setRail = (next: RailState) => setContentInPane(paneId, { ...content, rail: next });
  const setRailRef = useRef(setRail);
  setRailRef.current = setRail;
  // 拖寬把手期間的 local 寬度（pointermove 即時反映）；pointerup 才寫 persist
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const railWidth = dragWidth ?? rail.width;

  // pane 太窄自動收合（觀察 pane 元素，非 window）；恢復寬度不自動展開。
  // jsdom 無 layout——RO 不觸發（或不存在），預設展開行為不受影響。
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0 && width < RAIL_AUTO_COLLAPSE_PX && railRef.current.open) {
        setRailRef.current({ ...railRef.current, open: false });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const meta = content.channelId ? tabs[content.channelId] : null;

  if (!content.channelId || !meta) {
    const hintWorktree = content.cwd ? lookup.get(content.cwd) : undefined;
    const hint = hintWorktree
      ? `Last: ${hintWorktree.projectName} ⎇ ${formatWorktreeLabel(hintWorktree)}`
      : undefined;
    return (
      <PaneShell toolbarProps={{ ...toolbarProps, typeIcon: CHAT_TYPE_ICON }} scrollable={false}>
        <EmptyState
          data-testid="empty-pane"
          icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
          message="Empty pane"
          hint={hint}
          actionLabel="New Session"
          onAction={
            env.onOpenModal
              ? () => env.onOpenModal?.(paneId)
              : () => env.onNewTab({ targetPaneId: paneId })
          }
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell
      toolbarProps={{
        ...toolbarProps,
        branch: meta.branch,
        title: meta.title,
        typeIcon: CHAT_TYPE_ICON,
      }}
      scrollable={false}
      tools={
        // 單一 pane header（chat-pane-header-unification）：breadcrumb 的按鈕上移
        meta.cwd ? (
          <IconButton
            variant="plain"
            aria-label="Toggle right pane"
            onClick={() => setRail({ ...rail, open: !rail.open })}
            className="w-6 h-6 text-muted hover:text-text hover:bg-hover-tint"
          >
            <RectangleGroupIcon className="w-3.5 h-3.5" />
          </IconButton>
        ) : undefined
      }
    >
      <div ref={bodyRef} className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-h-0 flex flex-col">
            <TabContent
              channelId={content.channelId}
              cwd={meta.cwd}
              branch={meta.branch}
              mode={meta.mode}
              onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
            />
          </div>
          {rail.open && meta.cwd && (
            <div
              data-testid="chat-rail-wrapper"
              className="w-(--rail-w) shrink-0 border-l border-border-subtle overflow-y-auto"
              style={railWidth !== undefined ? { width: railWidth } : undefined}
            >
              <RightPane
                cwd={meta.cwd}
                activeTab={rail.tab}
                onTabChange={(tab) => setRail({ ...rail, tab })}
                onCollapse={() => setRail({ ...rail, open: false })}
                onOpenDrawer={openDrawer}
                onPromote={(c) => splitPaneAndSetContent('h', c)}
                width={railWidth}
                onWidthDrag={setDragWidth}
                onWidthCommit={(w) => {
                  setDragWidth(null);
                  setRail({ ...rail, width: w });
                }}
              />
            </div>
          )}
        </div>
        {!rail.open && meta.cwd && (
          <PaneDock
            cwd={meta.cwd}
            activeTab={rail.tab}
            onOpen={(tab) => setRail({ ...rail, open: true, tab })}
            onPromote={(c) => splitPaneAndSetContent('h', c)}
          />
        )}
      </div>
    </PaneShell>
  );
}
