import { usePaneActions } from '@/contexts/TabContext';

interface SessionInfo {
  channelId: string;
  title?: string;
}

interface EmptyPanePickerProps {
  paneId: string;
  sessions: SessionInfo[];
  onNewSession?: () => void;
}

export function EmptyPanePicker({
  paneId,
  sessions,
  onNewSession,
}: EmptyPanePickerProps): React.JSX.Element {
  const { setSessionInPane, focusPane } = usePaneActions();

  function handleSelect(channelId: string) {
    setSessionInPane(paneId, channelId);
    focusPane(paneId);
  }

  return (
    <div
      data-testid="empty-pane-picker"
      className="flex flex-col items-center justify-center gap-2 p-4 h-full"
    >
      <p className="text-sm text-muted-foreground">Pick a session</p>
      <div className="flex flex-col gap-1 w-full max-w-xs">
        {sessions.map((s) => (
          <button
            key={s.channelId}
            type="button"
            onClick={() => handleSelect(s.channelId)}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent"
          >
            {s.title ?? s.channelId}
          </button>
        ))}
        {onNewSession && (
          <button
            type="button"
            onClick={onNewSession}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground"
          >
            + New session
          </button>
        )}
      </div>
    </div>
  );
}
