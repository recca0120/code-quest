import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDrawerActionsOptional } from '@/contexts/DrawerContext';
import { useProjectState } from '@/contexts/ProjectContext';
import {
  type PaneContent,
  type RailState,
  usePaneActions,
  useTabState,
} from '@/contexts/TabContext';
import { RightPane } from '../RightPane.tsx';
import { TabContent } from '../TabContent.tsx';
import { useWorktreeLookup } from '../useAvailableWorktrees.ts';
import { PaneDock } from './PaneDock.tsx';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';
import { PaneShell, type PaneToolbarCommonProps } from './PaneShell.tsx';

/** handoff 定案：新 chat 預設展開側欄 */
const DEFAULT_RAIL: RailState = { open: true, tab: 'files' };
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
  const { projects, activeProjectCwd } = useProjectState();
  const { setContentInPane, splitPaneAndSetContent } = usePaneActions();
  const openDrawer = useDrawerActionsOptional()?.openDrawer;

  const rail = content.rail ?? DEFAULT_RAIL;
  const railRef = useRef(rail);
  railRef.current = rail;
  const setRail = (next: RailState) => setContentInPane(paneId, { ...content, rail: next });
  const setRailRef = useRef(setRail);
  setRailRef.current = setRail;

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

  const meta = content.sessionId ? tabs[content.sessionId] : null;

  if (!content.sessionId || !meta) {
    const hintWorktree = content.cwd ? lookup.get(content.cwd) : undefined;
    const hint = hintWorktree
      ? `Last: ${hintWorktree.projectName} ⎇ ${hintWorktree.branch ?? hintWorktree.name}`
      : undefined;
    return (
      <PaneShell toolbarProps={toolbarProps} scrollable={false}>
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

  // Per-session identity: meta.projectCwd（建立時寫入）→ cwd 反查 lookup → activeProject fallback
  const sessionProjectCwd =
    meta.projectCwd ?? (meta.cwd ? lookup.get(meta.cwd)?.projectCwd : undefined);
  const projectName =
    projects.find((p) => p.cwd === (sessionProjectCwd ?? activeProjectCwd))?.name ?? '';

  return (
    <PaneShell
      toolbarProps={{ ...toolbarProps, branch: meta.branch, title: meta.title }}
      scrollable={false}
    >
      <div ref={bodyRef} className="flex flex-col h-full min-h-0">
        <div className="flex-1 min-h-0">
          <TabContent
            channelId={content.sessionId}
            cwd={meta.cwd}
            branch={meta.branch}
            title={meta.title}
            projectName={projectName}
            mode={meta.mode}
            onToggleLeft={env.onToggleLeft}
            onToggleRight={meta.cwd ? () => setRail({ ...rail, open: !rail.open }) : undefined}
            onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
            rightPane={
              rail.open && meta.cwd ? (
                <RightPane
                  cwd={meta.cwd}
                  activeTab={rail.tab}
                  onTabChange={(tab) => setRail({ ...rail, tab })}
                  onCollapse={() => setRail({ ...rail, open: false })}
                  onOpenDrawer={openDrawer}
                  onPromote={(c) => splitPaneAndSetContent('h', c)}
                />
              ) : undefined
            }
          />
        </div>
        {!rail.open && meta.cwd && <PaneDock onOpen={(tab) => setRail({ open: true, tab })} />}
      </div>
    </PaneShell>
  );
}
