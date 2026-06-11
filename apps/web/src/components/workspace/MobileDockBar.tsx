import { usePaneActions, usePaneState } from '@/contexts/TabContext';
import { PANE_TYPE_REGISTRY } from './pane-registry';
import { useWorktreeLookup } from './useAvailableWorktrees';
import { useMobileMode } from './useMobileMode';

export function MobileDockBar(): React.JSX.Element | null {
  const isMobile = useMobileMode();
  const { focusedPaneId } = usePaneState();
  const { setContentInPane } = usePaneActions();
  const lookup = useWorktreeLookup();

  if (!isMobile) return null;

  const focusedCwd = (() => {
    if (!focusedPaneId) return undefined;
    for (const [cwd] of lookup) return cwd;
    return undefined;
  })();

  const chips = PANE_TYPE_REGISTRY.filter((e) => e.key !== 'chat');

  return (
    <div
      data-testid="mobile-dock-bar"
      className="fixed inset-x-0 bottom-0 z-sticky flex items-center gap-2 px-3 bg-surface border-t border-border h-(--hit-dock-chip) pb-(--safe-bottom)"
    >
      {chips.map((entry) => (
        <button
          key={entry.key}
          type="button"
          data-testid={`mobile-dock-chip-${entry.key}`}
          onClick={() => {
            if (focusedPaneId && focusedCwd) {
              setContentInPane(focusedPaneId, entry.makeContent(focusedCwd));
            }
          }}
          className="flex items-center gap-1 px-2.5 h-7 text-[length:var(--text-label)] rounded-full border border-border bg-bg hover:bg-hover-tint"
        >
          <span>{entry.icon}</span>
          <span>{entry.label}</span>
        </button>
      ))}
      <span className="ml-auto font-mono text-2xs text-dim whitespace-nowrap">左右滑切 pane</span>
    </div>
  );
}
