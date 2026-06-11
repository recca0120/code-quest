import { useState } from 'react';
import {
  leafIdsInOrder,
  usePaneActions,
  usePaneState,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { useMobileMode } from './useMobileMode';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

interface MobileTopBarProps {
  onOpenWall?: () => void;
}

export function MobileTopBar({ onOpenWall }: MobileTopBarProps): React.JSX.Element | null {
  const isMobile = useMobileMode();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { focusPane } = usePaneActions();
  const { workspaceTabs, activeWorkspaceTabId, switchWorkspaceTab } = useWorkspaceTab();
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);

  if (!isMobile) return null;

  const leaves = leafIdsInOrder(paneRoot);
  const activeTab = workspaceTabs.find((t) => t.id === activeWorkspaceTabId);
  const activeIdx = activeTab ? workspaceTabs.indexOf(activeTab) : 0;
  const tabLabel = activeTab?.label ?? `Tab ${activeIdx + 1}`;

  return (
    <div
      data-testid="mobile-topbar"
      className="sticky top-0 z-sticky flex items-center gap-2 h-11 px-3 bg-surface border-b border-border shrink-0"
    >
      {/* Tab dropdown */}
      <div className="relative">
        <button
          type="button"
          data-testid="mobile-topbar-tab-dropdown"
          onClick={() => setTabDropdownOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-text truncate max-w-24"
        >
          <span className="truncate">{tabLabel}</span>
          <span className="text-subtle">▾</span>
        </button>
        {tabDropdownOpen && (
          <div
            data-testid="mobile-topbar-tab-list"
            className="absolute top-full left-0 mt-1 z-popover bg-popover border border-border rounded shadow-md py-1 min-w-32"
          >
            {workspaceTabs.map((wt, idx) => (
              <button
                key={wt.id}
                type="button"
                onClick={() => {
                  switchWorkspaceTab(wt.id);
                  setTabDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-hover-tint ${
                  wt.id === activeWorkspaceTabId ? 'text-accent font-semibold' : ''
                }`}
              >
                {wt.id === activeWorkspaceTabId ? '✓ ' : ''}
                {wt.label ?? `Tab ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pane dots */}
      <div className="flex items-center gap-1 flex-1 justify-center">
        {leaves.map((id, idx) => {
          const isActive = focusedPaneId === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`mobile-pane-dot-${id}`}
              data-pane-id={id}
              data-active={isActive || undefined}
              onClick={() => focusPane(id)}
              className={`text-[length:var(--text-pane-dot)] font-mono leading-none ${
                isActive ? 'text-accent' : 'text-subtle'
              }`}
            >
              {CIRCLED[idx] ?? idx + 1}
            </button>
          );
        })}
      </div>

      {/* ⊞ wall toggle */}
      <button
        type="button"
        data-testid="mobile-topbar-wall-toggle"
        aria-label="open pane switcher"
        onClick={onOpenWall}
        className="text-sm text-muted hover:text-text"
      >
        ⊞
      </button>
    </div>
  );
}
