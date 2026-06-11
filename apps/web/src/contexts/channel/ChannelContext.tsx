import { EVENTS, sessionLaunchResponseSchema } from '@code-quest/schemas';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { SpinnerVerb } from '@/components/chat/SpinnerVerb';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ChannelChangeUpdate, ChannelState as ChannelStateType } from '@/types/chat';
import { useAppConfigState } from '../AppInitContext.tsx';
import { useSocket } from '../SocketContext.tsx';
import { ChannelComposeProvider } from './ChannelComposeContext.tsx';
import { buildInitialConfig, ChannelConfigProvider } from './ChannelConfigContext.tsx';
import { ChannelControlProvider } from './ChannelControlContext.tsx';
import { ChannelMessagesProvider } from './ChannelMessagesContext.tsx';
import { ChannelMetaProvider } from './ChannelMetaContext.tsx';
import { ChannelSocketRouterProvider } from './ChannelSocketRouterContext.tsx';
import { MessageVisibilityProvider } from './MessageVisibilityContext.tsx';

// ── ChannelProvider (orchestrator) ──

export type SessionMode = 'new' | 'resume';

type ChannelState =
  | { status: 'connecting' }
  | { status: 'ready' }
  | { status: 'connected' }
  | { status: 'error'; message: string };

export function ChannelProvider({
  channelId,
  children,
  onChange,
  onNewChannel,
  cwd,
  branch,
  mode = 'resume',
  initialState,
}: {
  channelId: string;
  children: ReactNode;
  onChange?: (update: ChannelChangeUpdate) => void;
  onNewChannel?: (cwd: string) => void;
  cwd?: string;
  branch?: string;
  mode?: SessionMode;
  initialState?: Partial<ChannelStateType>;
}): React.JSX.Element {
  const messageQueueRef = useRef<string[]>([]);
  const { socket } = useSocket();
  const { initOptions } = useAppConfigState();

  const [state, setState] = useState<ChannelState>(
    mode === 'new' ? { status: 'connecting' } : { status: 'ready' },
  );
  const spawnedRef = useRef(false);

  function launch() {
    if (!cwd) {
      setState({
        status: 'error',
        message: 'No working directory set. Please select a project first.',
      });
      return;
    }
    spawnedRef.current = true;
    setState({ status: 'connecting' });
    socket.emit(
      EVENTS.session.launch,
      { channelId, cwd, ...(branch ? { branch } : {}) },
      (raw: unknown) => {
        const parsed = sessionLaunchResponseSchema.safeParse(raw);
        if (!parsed.success) {
          setState({ status: 'error', message: 'Failed to connect' });
          return;
        }
        if (!parsed.data.ok) {
          // Pane splits unmount+remount ChannelProvider — the channel already exists on the
          // server, so skip re-launching and fall through to joinSession() instead.
          if (parsed.data.error === `Channel already exists: ${channelId}`) {
            setState({ status: 'ready' });
            return;
          }
          setState({ status: 'error', message: parsed.data.error });
          return;
        }
        setState({ status: 'ready' });
      },
    );
  }

  function handleJoinSettled() {
    setState((prev) => (prev.status === 'error' ? prev : { status: 'connected' }));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: launch is stable; one-shot guarded by spawnedRef.
  useEffect(() => {
    if (mode === 'new' && !spawnedRef.current) launch();
  }, [mode]);

  // ── Content based on state ──
  let content: ReactNode;
  if (state.status === 'connecting' || state.status === 'ready') {
    content = (
      <div className="flex flex-1 items-center justify-center">
        <SpinnerVerb verbs={['Connecting']} />
      </div>
    );
  } else if (state.status === 'error') {
    content = (
      <EmptyState
        icon="⚠"
        message={state.message}
        actionLabel="Retry"
        onAction={() => {
          spawnedRef.current = false;
          launch();
        }}
      />
    );
  } else {
    content = children;
  }

  // ── Always render full provider tree ──
  return (
    <ChannelMetaProvider channelId={channelId} cwd={cwd}>
      <ChannelSocketRouterProvider>
        <ChannelMessagesProvider
          readyToJoin={state.status === 'ready'}
          onChange={onChange}
          onJoinSettled={handleJoinSettled}
          dequeueMessage={() => messageQueueRef.current.shift()}
          messageQueueRef={messageQueueRef}
          initialState={initialState}
        >
          <ChannelControlProvider>
            <ChannelConfigProvider
              initialConfig={buildInitialConfig(initOptions)}
              onNewChannel={onNewChannel}
              onChange={onChange}
            >
              <MessageVisibilityProvider>
                <ChannelComposeProvider>{content}</ChannelComposeProvider>
              </MessageVisibilityProvider>
            </ChannelConfigProvider>
          </ChannelControlProvider>
        </ChannelMessagesProvider>
      </ChannelSocketRouterProvider>
    </ChannelMetaProvider>
  );
}
