import { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';
import { ErrorFallback } from './components/ui/ErrorFallback.tsx';
import { RemoteStatusBanner } from './components/ui/RemoteStatusBanner.tsx';
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout.tsx';
import { AppInitProvider } from './contexts/AppInitContext.tsx';
import { FsProvider } from './contexts/FsContext.tsx';
import { GitProvider } from './contexts/GitContext.tsx';
import { NavigationProvider } from './contexts/NavigationContext.tsx';
import { OpenspecProvider } from './contexts/OpenspecContext.tsx';
import { PluginProvider } from './contexts/PluginContext.tsx';
import { ProjectProvider } from './contexts/ProjectContext.tsx';
import { SessionProvider } from './contexts/SessionContext.tsx';
import { SocketProvider } from './contexts/SocketContext.tsx';
import { useEffectiveColorTheme } from './hooks/useEffectiveColorTheme.ts';
import { createSocket, type TypedSocket } from './socket/client.ts';
import { usePreferencesStore } from './stores/usePreferencesStore.ts';
import './App.css';

export function App(): React.JSX.Element {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const effectiveColorTheme = useEffectiveColorTheme();
  const fontSize = usePreferencesStore((s) => s.fontSize);
  const density = usePreferencesStore((s) => s.density);

  useEffect(() => {
    let cancelled = false;
    let resolved: TypedSocket | null = null;
    const result = createSocket();
    if (result instanceof Promise) {
      result.then((s) => {
        resolved = s;
        if (!cancelled) setSocket(s);
        else s.disconnect();
      });
    } else {
      resolved = result;
      setSocket(result);
    }
    return () => {
      cancelled = true;
      resolved?.disconnect();
    };
  }, []);

  useEffect(() => {
    const ds = document.documentElement.dataset;
    ds.theme = effectiveColorTheme;
    ds.font = fontSize;
    ds.density = density;
  }, [effectiveColorTheme, fontSize, density]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg text-text">
      <Toaster position="top-right" richColors />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        {socket && (
          <SocketProvider socket={socket}>
            <RemoteStatusBanner socket={socket} />
            <AppInitProvider>
              <SessionProvider>
                <PluginProvider>
                  <ProjectProvider>
                    <NavigationProvider>
                      <GitProvider>
                        <FsProvider>
                          <OpenspecProvider>
                            <WorkspaceLayout />
                          </OpenspecProvider>
                        </FsProvider>
                      </GitProvider>
                    </NavigationProvider>
                  </ProjectProvider>
                </PluginProvider>
              </SessionProvider>
            </AppInitProvider>
          </SocketProvider>
        )}
      </ErrorBoundary>
    </div>
  );
}
