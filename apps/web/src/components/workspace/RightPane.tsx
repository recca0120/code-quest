import { ClipboardDocumentListIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import * as Tabs from '@radix-ui/react-tabs';
import { useState } from 'react';
import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import { cn } from '@/utils/cn';
import { tabTrigger } from '../ui/_tokens.ts';

type TabKind = 'files' | 'git' | 'spec';

interface TabSpec {
  key: TabKind;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabSpec[] = [
  { key: 'files', label: 'Files', icon: <DocumentTextIcon className="w-4 h-4" /> },
  { key: 'git', label: 'Git', icon: <span aria-hidden>⎇</span> },
  { key: 'spec', label: 'Spec', icon: <ClipboardDocumentListIcon className="w-4 h-4" /> },
];

interface RightPaneProps {
  cwd: string;
  initialTab?: TabKind;
  onMention?: (path: string) => void;
}

const TRIGGER_BASE = cn(
  tabTrigger,
  'flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs outline-none',
);

export function RightPane({
  cwd,
  initialTab = 'files',
  onMention,
}: RightPaneProps): React.JSX.Element {
  const [active, setActive] = useState<TabKind>(initialTab);
  const [mounted, setMounted] = useState<ReadonlySet<TabKind>>(() => new Set([initialTab]));

  function handleTabChange(value: string) {
    const next = value as TabKind;
    setActive(next);
    setMounted((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
  }

  const handleMention = onMention ?? (() => {});

  return (
    <Tabs.Root
      value={active}
      onValueChange={handleTabChange}
      className="flex flex-col h-full bg-surface"
    >
      <Tabs.List className="flex border-b border-border">
        {TABS.map(({ key, label, icon }) => (
          <Tabs.Trigger key={key} value={key} className={TRIGGER_BASE}>
            {icon}
            <span>{label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <section aria-label="right-pane-body" className="flex-1 min-h-0 flex flex-col" data-cwd={cwd}>
        <TabContent value="files" active={active === 'files'}>
          {mounted.has('files') && <FilesView cwd={cwd} onMention={handleMention} />}
        </TabContent>
        <TabContent value="git" active={active === 'git'}>
          {mounted.has('git') && <GitView cwd={cwd} />}
        </TabContent>
        <TabContent value="spec" active={active === 'spec'}>
          {mounted.has('spec') && <SpecView cwd={cwd} />}
        </TabContent>
      </section>
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
