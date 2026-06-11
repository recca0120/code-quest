import { ClipboardDocumentListIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import * as Tabs from '@radix-ui/react-tabs';
import { useState } from 'react';
import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import type { PaneContent, RailTab } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { tabTrigger } from '../ui/_tokens.ts';

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
  /** ⊞ 把目前分頁升級成獨立 pane（同 cwd） */
  onPromote?: (content: PaneContent) => void;
  initialTab?: RailTab;
  onMention?: (path: string) => void;
}

/** rail 分頁 → pane descriptor（registry 同型；'spec' 對應 'openspec' leaf） */
function railTabContent(tab: RailTab, cwd: string): PaneContent {
  const type = tab === 'spec' ? 'openspec' : tab;
  return { type, target: { kind: 'fixed', cwd } };
}

const TRIGGER_BASE = cn(
  tabTrigger,
  'flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs outline-none',
);

export function RightPane({
  cwd,
  activeTab,
  onTabChange,
  onCollapse,
  onOpenDrawer,
  onPromote,
  initialTab = 'files',
  onMention,
}: RightPaneProps): React.JSX.Element {
  const [uncontrolled, setUncontrolled] = useState<RailTab>(initialTab);
  const active = activeTab ?? uncontrolled;
  const [mounted, setMounted] = useState<ReadonlySet<RailTab>>(() => new Set([active]));

  function handleTabChange(value: string) {
    const next = value as RailTab;
    if (activeTab === undefined) setUncontrolled(next);
    onTabChange?.(next);
    setMounted((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
  }

  return (
    <Tabs.Root
      value={active}
      onValueChange={handleTabChange}
      className="flex flex-col h-full bg-surface"
    >
      <Tabs.List className="flex items-center border-b border-border">
        {RAIL_TABS.map(({ key, label, icon }) => (
          <Tabs.Trigger key={key} value={key} className={TRIGGER_BASE}>
            {icon}
            <span>{label}</span>
          </Tabs.Trigger>
        ))}
        {onOpenDrawer && (
          <button
            type="button"
            aria-label="open in drawer"
            title="以 drawer 檢視完整內容"
            onClick={() => onOpenDrawer(railTabContent(active, cwd))}
            className="px-1.5 h-9 text-subtle hover:text-text"
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
            className="px-1.5 h-9 text-subtle hover:text-text"
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
      {onPromote && (
        <div className="flex items-center gap-2 px-2 py-1 border-t border-border-subtle shrink-0">
          <button
            type="button"
            aria-label="promote rail to pane"
            onClick={() => onPromote(railTabContent(active, cwd))}
            className="font-mono text-2xs text-subtle hover:text-text"
          >
            ⊞ 升級成 pane
          </button>
          <span className="ml-auto font-mono text-2xs text-dim hidden lg:inline">
            ⤢ 開 drawer 看完整內容
          </span>
        </div>
      )}
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
