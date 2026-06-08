import { firstLeafId, usePaneActions, usePaneState, useTabState } from '@/contexts/TabContext';

interface SessionManagerProps {
  onClose: () => void;
}

export function SessionManager({ onClose }: SessionManagerProps): React.JSX.Element {
  const { tabs } = useTabState();
  const { focusedPaneId, paneRoot } = usePaneState();
  const { setSessionInPane, focusPane } = usePaneActions();

  function handleSelect(sessionId: string): void {
    const targetId = focusedPaneId ?? firstLeafId(paneRoot);
    if (targetId) {
      setSessionInPane(targetId, sessionId);
      focusPane(targetId);
    }
    onClose();
  }

  return (
    <div
      data-testid="session-manager"
      role="dialog"
      aria-modal="true"
      aria-label="Session Manager"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close session manager"
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border rounded-lg p-4 w-96 max-h-96 overflow-y-auto">
        <div className="text-sm font-semibold mb-3">Sessions</div>
        {Object.entries(tabs).map(([id, meta]) => (
          <button
            key={id}
            type="button"
            data-testid={`session-manager-item-${id}`}
            onClick={() => handleSelect(id)}
            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
          >
            <span className="opacity-60">{meta.tabStatus === 'processing' ? '●' : '○'}</span>
            <span className="truncate">{meta.cwd ?? id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
