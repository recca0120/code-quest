import { type ReactNode, useEffect } from 'react';
import { usePaneActions, usePaneState } from '@/contexts/TabContext';

export function PaneZoomProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { focusedPaneId, zoomedPaneId } = usePaneState();
  const { zoomPane } = usePaneActions();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        if (zoomedPaneId !== null) {
          zoomPane(null);
        } else if (focusedPaneId) {
          zoomPane(focusedPaneId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPaneId, zoomedPaneId, zoomPane]);

  return <>{children}</>;
}
