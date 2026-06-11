import { ClipboardDocumentListIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import * as Tabs from '@radix-ui/react-tabs';
import { useState } from 'react';
import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import type { PaneContent, RailTab } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { tabTrigger } from '../ui/_tokens.ts';
import { usePaneToolCounts } from './usePaneToolCounts.ts';

interface TabSpec {
  key: RailTab;
  label: string;
  icon: React.ReactNode;
}

/** rail 三分頁的單一資料源——RightPane 分頁與 PaneDock chips 共用。 */
export const RAIL_TABS: TabSpec[] = [
  { key: 'files', label: 'Files', icon: <DocumentTextIcon className="w-4 h-4" /> },
  { key: 'git', label: 'Git', icon: <span aria-hidden>⎇</span> },
  { key: 'spec', label: 'Spec', icon: <ClipboardDocumentListIcon className="w-4 h-4" /> },
];

interface RightPaneProps {
  cwd: string;
  /** 受控分頁（rail persist）；未提供時退回 uncontrolled */
  activeTab?: RailTab;
  onTabChange?: (tab: RailTab) => void;
  /** ⇥ 收合（rail → dock）；未提供時不顯示收合鈕 */
  onCollapse?: () => void;
  /** ⤢ 以 drawer 檢視目前分頁完整內容 */
  onOpenDrawer?: (content: PaneContent) => void;
  /** ⊞ 把目前分頁升級成獨立 pane（同 cwd）；rail 內 ⌘⏎ 同義（spec SHALL） */
  onPromote?: (content: PaneContent) => void;
  /** rail persist 寬（px）；拖把手期間由外層以 local state 覆寫 */
  width?: number;
  /** 拖寬把手 pointermove（local 即時反映，不寫 persist） */
  onWidthDrag?: (width: number) => void;
  /** 拖寬把手 pointerup（寫 persist）；未提供時不顯示把手 */
  onWidthCommit?: (width: number) => void;
  initialTab?: RailTab;
  onMention?: (path: string) => void;
}

/** rail 分頁 → pane descriptor（registry 同型；'spec' 對應 'openspec' leaf） */
export function railTabContent(tab: RailTab, cwd: string): PaneContent {
  const type = tab === 'spec' ? 'openspec' : tab;
  return { type, target: { kind: 'fixed', cwd } };
}

/** rail 寬 clamp（拖寬把手）：下限 180、上限 560（pane寬-360 的簡化定案） */
const RAIL_MIN_W = 180;
const RAIL_MAX_W = 560;
/** 預設 rail 寬——與 App.css `--rail-w` token 同值（拖曳起點的基準） */
const RAIL_DEFAULT_W = 218;

function clampRailWidth(width: number): number {
  return Math.min(RAIL_MAX_W, Math.max(RAIL_MIN_W, width));
}

const TRIGGER_BASE = cn(
  tabTrigger,
  'flex-1 h-8 inline-flex items-center justify-center gap-1 text-[length:var(--text-label)] outline-none min-w-0',
);

export function RightPane({
  cwd,
  activeTab,
  onTabChange,
  onCollapse,
  onOpenDrawer,
  onPromote,
  width,
  onWidthDrag,
  onWidthCommit,
  initialTab = 'files',
  onMention,
}: RightPaneProps): React.JSX.Element {
  const [uncontrolled, setUncontrolled] = useState<RailTab>(initialTab);
  const active = activeTab ?? uncontrolled;
  const [mounted, setMounted] = useState<ReadonlySet<RailTab>>(() => new Set([active]));
  // 分頁 count 徽章（handoff §3：files·N／git·N／spec·N）——與 dock chips 同一 hook
  const counts = usePaneToolCounts(cwd);

  function handleTabChange(value: string) {
    const next = value as RailTab;
    if (activeTab === undefined) setUncontrolled(next);
    onTabChange?.(next);
    setMounted((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
  }

  // ⌘⏎ 升級成 pane（spec SHALL）：焦點在 rail 區內即生效，與 ⊞ 鈕同義
  function handleKeyDown(e: React.KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onPromote) {
      e.preventDefault();
      onPromote(railTabContent(active, cwd));
    }
  }

  // 左緣拖寬把手（仿 DrawerHost grabber）：move 走 local state、up 才 commit persist
  function handleGrabberDown(e: React.PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = width ?? RAIL_DEFAULT_W;
    let latest = startW;
    function onMove(ev: PointerEvent): void {
      latest = clampRailWidth(startW + (startX - ev.clientX));
      onWidthDrag?.(latest);
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onWidthCommit?.(latest);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <Tabs.Root
      value={active}
      onValueChange={handleTabChange}
      onKeyDown={handleKeyDown}
      className="relative flex flex-col h-full bg-surface"
    >
      {onWidthCommit && (
        // resize 把手——6px 熱區＋中央把手條（仿 DrawerHost grabber）
        <div
          data-testid="rail-grabber"
          onPointerDown={handleGrabberDown}
          className="group absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 flex items-center justify-center z-10"
        >
          <span className="w-(--drawer-grab-bar-w) h-11 rounded-full bg-text-dim group-hover:bg-accent" />
        </div>
      )}
      <Tabs.List className="flex items-center border-b border-border-subtle">
        {RAIL_TABS.map(({ key, label, icon }) => (
          <Tabs.Trigger key={key} value={key} className={TRIGGER_BASE}>
            {icon}
            <span>
              {label}
              {(counts[key] ?? 0) > 0 && (
                <span
                  data-testid={`rail-tab-count-${key}`}
                  className="font-mono text-[length:var(--text-count)] text-subtle"
                >
                  ·{counts[key]}
                </span>
              )}
            </span>
          </Tabs.Trigger>
        ))}
        {onOpenDrawer && (
          <button
            type="button"
            aria-label="open in drawer"
            title="以 drawer 檢視完整內容"
            onClick={() => onOpenDrawer(railTabContent(active, cwd))}
            className="px-1 h-8 text-subtle hover:text-text shrink-0"
          >
            ⤢
          </button>
        )}
        {onCollapse && (
          <button
            type="button"
            aria-label="collapse rail"
            title="收合側欄"
            onClick={onCollapse}
            className="px-1 h-8 text-subtle hover:text-text shrink-0"
          >
            ⇥
          </button>
        )}
      </Tabs.List>
      <section aria-label="right-pane-body" className="flex-1 min-h-0 flex flex-col" data-cwd={cwd}>
        <TabContent value="files" active={active === 'files'}>
          {(mounted.has('files') || active === 'files') && (
            <FilesView cwd={cwd} onMention={onMention} />
          )}
        </TabContent>
        <TabContent value="git" active={active === 'git'}>
          {(mounted.has('git') || active === 'git') && <GitView cwd={cwd} />}
        </TabContent>
        <TabContent value="spec" active={active === 'spec'}>
          {(mounted.has('spec') || active === 'spec') && <SpecView cwd={cwd} />}
        </TabContent>
      </section>
      <div className="flex items-center gap-2 px-2 py-1 border-t border-border-subtle shrink-0 whitespace-nowrap overflow-hidden font-mono text-2xs text-dim">
        <span>⤢ 點項目開 drawer</span>
        {onPromote && (
          <button
            type="button"
            aria-label="promote rail to pane"
            onClick={() => onPromote(railTabContent(active, cwd))}
            className="text-subtle hover:text-text"
            title="把目前分頁開成獨立 pane"
          >
            ⌘⏎ 升級成 pane
          </button>
        )}
      </div>
    </Tabs.Root>
  );
}

function TabContent({
  value,
  active,
  children,
}: {
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Content
      value={value}
      forceMount
      hidden={!active}
      className={active ? 'contents' : undefined}
    >
      {children}
    </Tabs.Content>
  );
}
