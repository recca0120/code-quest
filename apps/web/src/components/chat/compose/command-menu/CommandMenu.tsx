import * as Popover from '@radix-ui/react-popover';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MenuSection } from '@/components/chat/ui/MenuSection';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { SlashCommandIcon } from '@/components/ui/Icons.tsx';
import { useChannelCompose, useChannelConfig } from '@/contexts/channel';
import { useFeatureRegistry } from '@/contexts/channel/FeatureRegistryContext';
import { cn } from '@/utils/cn';
import { findModel, getEffortLevels, isThinkingActive } from '@/utils/model-utils';
import { buildLocalFeatures } from './build-local-features.ts';
import { buildMenuItems } from './build-menu-items.ts';
import { computeMenuLayout } from './menu-layout.ts';
import { dispatchSelectedItem, isNavKey, navigateItems } from './menu-navigation.ts';
import type { MenuItem } from './menu-types.ts';
import { slashPaletteState } from './slash-palette-state.ts';

interface CommandMenuProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMcpStatus?: () => void;
  onToggleMcp?: () => void;
  onManagePlugins?: () => void;
  onAttachFile?: () => void;
  docsUrl?: string;
}

export function CommandMenu({
  containerRef,
  onMcpStatus,
  onToggleMcp,
  onManagePlugins,
  onAttachFile,
  docsUrl,
}: CommandMenuProps): React.JSX.Element {
  const {
    model,
    availableModels,
    effort,
    thinkingLevel,
    fastModeState,
    slashCommands,
    setEffort: onSetEffort,
    setThinkingLevel: onSetThinkingLevel,
    setFastMode,
  } = useChannelConfig();
  const compose = useChannelCompose();
  const registry = useFeatureRegistry();

  const models = availableModels ?? [];
  const currentModel = model ?? null;
  const modelEntry = (currentModel ? findModel(currentModel, models) : undefined) ?? models[0];
  const modelLabel = modelEntry?.label ?? modelEntry?.displayName ?? currentModel ?? 'Default';

  const supportsFastMode = modelEntry?.supportsFastMode ?? false;
  const effortLevels = getEffortLevels(modelEntry);
  const isThinkingOn = isThinkingActive(thinkingLevel);

  const localFeatures = buildLocalFeatures({
    modelLabel,
    onAttachFile,
    onMcpStatus,
    onToggleMcp,
    onManagePlugins,
    docsUrl,
    effort,
    effortLevels,
    onSetEffort,
    isThinkingOn,
    onSetThinkingLevel,
    supportsFastMode,
    fastModeState,
    setFastMode,
    slashFilter: compose.slashFilter,
    registry,
  });

  const externalOpen = compose.slashFilter != null;
  const externalFilter = compose.slashFilter ?? '';

  const [buttonOpen, setButtonOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const effectiveFilter = externalOpen ? externalFilter : filter;

  const handleDismiss = () => {
    setButtonOpen(false);
    setFilter('');
    compose.dismissSlash();
  };

  useEffect(() => {
    if (buttonOpen && !externalOpen) {
      queueMicrotask(() => filterRef.current?.focus());
    }
  }, [buttonOpen, externalOpen]);

  const flatItemsRef = useRef<MenuItem[]>([]);
  const insertSlashCommandRef = useRef(compose.insertSlashCommand);
  const executeSlashCommandRef = useRef(compose.executeSlashCommand);
  const hasTextBeforeSlashRef = useRef(compose.hasTextBeforeSlash);
  useLayoutEffect(() => {
    insertSlashCommandRef.current = compose.insertSlashCommand;
    executeSlashCommandRef.current = compose.executeSlashCommand;
    hasTextBeforeSlashRef.current = compose.hasTextBeforeSlash;
  });

  useEffect(() => {
    if (activeId !== null) {
      activeItemRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
  }, [activeId]);

  const closeSilent = () => {
    setButtonOpen(false);
    setFilter('');
    setActiveId(null);
    compose.closeSlash();
  };
  const close = () => {
    closeSilent();
    compose.focusTextarea();
  };
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });

  const dismissItem = (item: MenuItem) => {
    const behavior = item.dismissBehavior ?? 'close';
    if (behavior === 'close') close();
    else if (behavior === 'closeSilent') closeSilent();
  };

  const selectItem = (item: MenuItem) => {
    item.onClick?.();
    dismissItem(item);
  };

  function handleNavigateAndSelect(
    key: string,
    items: MenuItem[],
    opts: {
      insertSlash: (text: string) => void;
      executeSlash: (label: string) => void;
      shouldInsert: boolean;
      close: () => void;
    },
  ) {
    setActiveId((prev) => {
      const { newActiveId, shouldSelect } = navigateItems(key, items, prev);
      if (shouldSelect) {
        const item = items.find((i) => i.id === newActiveId);
        if (item) dispatchSelectedItem(item, key, { ...opts, selectItem });
      }
      return newActiveId;
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleNavigateAndSelect stable via React Compiler
  useEffect(() => {
    if (!externalOpen) return;
    const handleNavKey = (e: KeyboardEvent) => {
      const items = flatItemsRef.current;
      if (!isNavKey(e.key)) return;
      if (items.length === 0) return;
      e.preventDefault();
      handleNavigateAndSelect(e.key, items, {
        insertSlash: (t) => insertSlashCommandRef.current(t),
        executeSlash: (l) => executeSlashCommandRef.current(l),
        shouldInsert: hasTextBeforeSlashRef.current,
        close: () => closeRef.current(),
      });
    };
    document.addEventListener('keydown', handleNavKey);
    return () => document.removeEventListener('keydown', handleNavKey);
  }, [externalOpen]);

  const sections = buildMenuItems({
    slashCommands,
    registry,
    localFeatures,
    compose: { executeSlashCommand: compose.executeSlashCommand },
  });
  const layout = computeMenuLayout(sections, effectiveFilter);
  const {
    context: filteredContext,
    model: filteredModel,
    customize: filteredCustomize,
    slash: filteredSlash,
    settings: filteredSettings,
    support: filteredSupport,
    modelVisible: modelSectionVisible,
    flatItems,
    hasPrev,
  } = layout;
  const f = effectiveFilter.toLowerCase();
  const paletteExternallyVisible = externalOpen && !/\s/.test(effectiveFilter);

  useLayoutEffect(() => {
    flatItemsRef.current = flatItems;
    slashPaletteState.itemsCount = paletteExternallyVisible ? flatItems.length : 0;
  });

  const flatItemIds = flatItems.map((i) => i.id);
  const firstItemId = flatItemIds[0] ?? null;
  const flatItemIdKey = flatItemIds.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: flatItemIdKey is stable key for flatItemIds
  useEffect(() => {
    if (!f) {
      setActiveId(null);
      return;
    }
    setActiveId((prev) => {
      if (!firstItemId) return null;
      if (prev && flatItemIds.includes(prev)) return prev;
      return firstItemId;
    });
  }, [f, flatItemIdKey, firstItemId]);

  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDismiss();
      setActiveId(null);
      compose.focusTextarea();
      return;
    }
    if (!isNavKey(e.key)) return;
    e.preventDefault();
    handleNavigateAndSelect(e.key, flatItems, {
      insertSlash: (t) => compose.insertSlashCommand(t),
      executeSlash: (l) => compose.executeSlashCommand(l),
      shouldInsert: false,
      close,
    });
  };

  const popoverVisible = buttonOpen || paletteExternallyVisible;

  return (
    <Popover.Root open={popoverVisible}>
      <Popover.Anchor virtualRef={containerRef as React.RefObject<Element>} />
      <IconButton
        ref={anchorRef}
        title="Show command menu (/)"
        aria-label="Show command menu (/)"
        onClick={(e) => {
          e.stopPropagation();
          setButtonOpen((v) => !v);
        }}
      >
        <SlashCommandIcon className="w-5 h-5" />
      </IconButton>

      {popoverVisible && (
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          avoidCollisions={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) {
              e.preventDefault();
              return;
            }
            handleDismiss();
          }}
          onFocusOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleDismiss();
            compose.focusTextarea();
          }}
          role="menu"
          className="bg-surface border border-border rounded-lg shadow-floating z-modal text-xs max-h-[50vh] overflow-hidden animate-slide-up"
          style={{ width: 'var(--radix-popper-anchor-width)' }}
        >
          <div className={cn(externalOpen ? 'pt-1' : 'p-1')}>
            {!externalOpen && (
              <input
                ref={filterRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={handleFilterKeyDown}
                placeholder="Filter actions..."
                className="w-full bg-input text-text placeholder:text-muted outline-none rounded px-3 py-2 text-sm"
              />
            )}
          </div>
          <div className="overflow-y-auto overflow-x-hidden pb-2 max-h-[calc(50vh-44px)] flex flex-col gap-0.5">
            {flatItems.length === 0 ? (
              <div className="px-3 py-2 text-center text-muted text-sm">No matching commands</div>
            ) : (
              [
                { label: 'Context', items: filteredContext, isFirst: true, visible: true },
                {
                  label: 'Model',
                  items: filteredModel,
                  isFirst: !hasPrev.model,
                  visible: modelSectionVisible,
                },
                {
                  label: 'Customize',
                  items: filteredCustomize,
                  isFirst: !hasPrev.customize,
                  visible: true,
                },
                {
                  label: 'Slash Commands',
                  items: filteredSlash,
                  isFirst: !hasPrev.slash,
                  visible: true,
                },
                {
                  label: 'Settings',
                  items: filteredSettings,
                  isFirst: !hasPrev.settings,
                  visible: true,
                },
                {
                  label: 'Support',
                  items: filteredSupport,
                  isFirst: !hasPrev.support,
                  visible: true,
                },
              ]
                .filter((s) => s.visible)
                .map((s) => (
                  <MenuSection
                    key={s.label}
                    label={s.label}
                    items={s.items}
                    activeId={activeId}
                    activeItemRef={activeItemRef}
                    onHover={setActiveId}
                    onSelect={selectItem}
                    isFirst={s.isFirst}
                  />
                ))
            )}
          </div>
        </Popover.Content>
      )}
    </Popover.Root>
  );
}
