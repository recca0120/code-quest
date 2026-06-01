import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCommandPaletteActions, useCommandPaletteState } from '@/contexts/CommandPaletteContext';
import { defaultEnabledTypes } from '@/contexts/channel/MessageVisibilityContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { createColorThemeFeature } from '@/features/color-theme/color-theme-feature';
import { createDensityFeature } from '@/features/density/density-feature';
import { createFilterFeatures } from '@/features/filters/create-filter-features';
import { createFontSizeFeature } from '@/features/font-size/font-size-feature';
import { createAddProjectFeature } from '@/features/global-actions/add-project-feature';
import { createOpenSettingsFeature } from '@/features/global-actions/open-settings-feature';
import { createSwitchProjectFeatures } from '@/features/global-actions/switch-project-feature';
import type { Feature, PaletteTab } from '@/lib/feature';
import { useChannelsStore } from '@/stores/channels-store';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import type { Message } from '@/types/ui';
import { cn } from '@/utils/cn';
import { isMessageVisible } from '@/utils/isMessageVisible';
import { messagePreview } from '@/utils/message-preview';
import { SearchField } from '../ui/SearchField.tsx';
import { flatFilteredFeatures, PaletteCommandList } from './PaletteCommandList.tsx';
import { PaletteEmpty } from './PaletteEmpty.tsx';
import { PaletteMessageList } from './PaletteMessageList.tsx';
import { paletteMessageResults } from './palette-message-results.ts';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'actions', label: 'Actions' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const isPaletteTab = (t: TabId): t is PaletteTab => t !== 'messages';

export function CommandPalette(): React.ReactNode {
  const { open, defaultTab, paletteActions } = useCommandPaletteState();
  const { closePalette, jumpTo } = useCommandPaletteActions();
  const channels = useChannelsStore((s) => s.channels);
  const visibilityTypes = usePreferencesStore((s) => s.enabledTypes);
  const { projects, activeProjectCwd } = useProjectState();
  const { setActiveProject } = useProjectActions();

  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  const setColorTheme = usePreferencesStore((s) => s.setColorTheme);
  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const fontSize = usePreferencesStore((s) => s.fontSize);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>(TABS[0].id);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const enabledTypes = useMemo(
    () => (visibilityTypes !== null ? new Set(visibilityTypes) : defaultEnabledTypes()),
    [visibilityTypes],
  );

  const allMessages = useMemo(() => {
    const result: Array<{ channelId: string; message: Message }> = [];
    for (const [channelId, entry] of channels) {
      for (const message of entry.messages) {
        const hasContent =
          message.content.length > 0 ||
          (message.type === 'assistant_turn' &&
            (message as import('@/types/ui').AssistantTurn).blocks.length > 0);
        if (hasContent && isMessageVisible(message, enabledTypes)) {
          result.push({ channelId, message });
        }
      }
    }
    return result;
  }, [channels, enabledTypes]);

  const visibleMessages = useMemo(() => allMessages.map((e) => e.message), [allMessages]);

  const channelByMessageId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of allMessages) {
      map.set(entry.message.id, entry.channelId);
    }
    return map;
  }, [allMessages]);

  const sourceLabels = useMemo(() => {
    if (channels.size <= 1) return undefined;
    const map = new Map<string, string>();
    for (const [channelId, entry] of channels) {
      const label = channelId.slice(0, 8);
      for (const message of entry.messages) {
        map.set(message.id, label);
      }
    }
    return map;
  }, [channels]);

  const setStoreEnabledTypes = usePreferencesStore((s) => s.setEnabledTypes);
  const toggleType = useCallback(
    (type: string) => {
      const current = usePreferencesStore.getState().enabledTypes;
      const base = current !== null ? new Set(current) : defaultEnabledTypes();
      if (base.has(type)) base.delete(type);
      else base.add(type);
      setStoreEnabledTypes([...base]);
    },
    [setStoreEnabledTypes],
  );

  const latestByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const msg of visibleMessages) map.set(msg.type, messagePreview(msg));
    return map;
  }, [visibleMessages]);

  const wrapClose = useCallback(
    (fn?: () => void) => () => {
      closePalette();
      fn?.();
    },
    [closePalette],
  );

  const onSelectProject = useCallback(
    (cwd: string) => {
      closePalette();
      setActiveProject(cwd);
    },
    [closePalette, setActiveProject],
  );

  const paletteFeatures = useMemo<Feature[]>(
    () => [
      ...createFilterFeatures({
        enabledTypes,
        unknownTypes: new Set(),
        toggleType,
        latestByType,
      }),
      ...createSwitchProjectFeatures({
        projects: projects.map((p) => ({ cwd: p.cwd, label: p.name })),
        activeCwd: activeProjectCwd,
        onSelect: onSelectProject,
      }),
      createAddProjectFeature({ onAdd: wrapClose(paletteActions.onAddProject) }),
      createOpenSettingsFeature({ onOpen: wrapClose(paletteActions.onOpenSettings) }),
      createColorThemeFeature({ colorTheme, setColorTheme }),
      createDensityFeature({ density, setDensity }),
      createFontSizeFeature({ fontSize, setFontSize }),
    ],
    [
      enabledTypes,
      toggleType,
      latestByType,
      projects,
      activeProjectCwd,
      onSelectProject,
      wrapClose,
      paletteActions,
      colorTheme,
      setColorTheme,
      density,
      setDensity,
      fontSize,
      setFontSize,
    ],
  );

  const q = query.trim().toLowerCase();
  const messageResults = paletteMessageResults(visibleMessages, query);

  const featuresInActiveTab = isPaletteTab(activeTab)
    ? paletteFeatures.filter((f) => (f.tabs ?? ['all']).includes(activeTab))
    : [];
  const filteredFeatures = isPaletteTab(activeTab)
    ? flatFilteredFeatures(featuresInActiveTab, query)
    : [];
  const hasFeatureMatch = filteredFeatures.length > 0;

  const showMessages = activeTab === 'messages' || activeTab === 'all';
  const messageCount = showMessages ? messageResults.length : 0;
  const totalItems = messageCount + filteredFeatures.length;

  const messageActiveIdx = activeIdx < messageCount ? activeIdx : -1;
  const featureNavIdx = activeIdx - messageCount;
  const activeFeatureId = featureNavIdx >= 0 ? (filteredFeatures[featureNavIdx]?.id ?? null) : null;

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setActiveTab(defaultTab === 'messages' ? 'messages' : TABS[0].id);
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open, defaultTab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset idx when query or tab changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query, activeTab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to active item when activeIdx changes
  useEffect(() => {
    const active = document.querySelector('[data-active]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePalette();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closePalette]);

  function handleJumpTo(messageId: string): void {
    const channelId = channelByMessageId.get(messageId);
    if (channelId) jumpTo(channelId, messageId);
    closePalette();
  }

  function handleKey(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (messageActiveIdx >= 0 && messageResults[messageActiveIdx]) {
        handleJumpTo(messageResults[messageActiveIdx].id);
      } else if (featureNavIdx >= 0 && filteredFeatures[featureNavIdx]) {
        filteredFeatures[featureNavIdx].execute();
      }
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-palette flex items-center max-md:justify-center md:items-start md:justify-center md:pt-[10vh] p-3 bg-overlay backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closePalette();
      }}
    >
      <section
        aria-label="command-palette-dialog"
        className={cn(
          'flex flex-col overflow-hidden',
          'w-full max-h-[80vh] rounded-lg',
          'md:max-w-[calc(100vw-48px)] md:h-[70vh]',
          'lg:w-160',
          'border border-floating-border floating-popover-lg',
        )}
      >
        <div role="tablist" className="flex border-b border-floating-border-subtle shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-colors',
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-subtle',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <SearchField
          value={query}
          onChange={setQuery}
          onKeyDown={handleKey}
          placeholder="Search messages or type a command…"
          inputRef={inputRef}
        />

        <div className="overflow-y-auto flex-1">
          {showMessages && (
            <PaletteMessageList
              results={messageResults}
              query={query}
              activeIdx={messageActiveIdx}
              onActiveChange={setActiveIdx}
              onJumpTo={handleJumpTo}
              onClose={closePalette}
              showHeader={activeTab === 'all'}
              listRef={listRef}
              sourceLabels={sourceLabels}
            />
          )}
          {isPaletteTab(activeTab) && (
            <PaletteCommandList
              features={featuresInActiveTab}
              query={query}
              activeId={activeFeatureId}
              onActiveChange={(id) => {
                const idx = filteredFeatures.findIndex((f) => f.id === id);
                if (idx >= 0) setActiveIdx(messageCount + idx);
              }}
            />
          )}
          {messageResults.length === 0 && (activeTab === 'messages' || (q && !hasFeatureMatch)) && (
            <PaletteEmpty query={query} />
          )}
        </div>

        <div className="border-t border-floating-border-subtle px-4 py-1.5 flex gap-4 shrink-0">
          <span className="text-xs font-mono text-faint tracking-wider">
            {q
              ? `${messageResults.length} result${messageResults.length === 1 ? '' : 's'}`
              : `${visibleMessages.length} messages`}
          </span>
          <span className="text-xs font-mono text-faint tracking-wider ml-auto">
            ↑↓ navigate · ↵ jump · esc close
          </span>
        </div>
      </section>
    </div>
  );
}
