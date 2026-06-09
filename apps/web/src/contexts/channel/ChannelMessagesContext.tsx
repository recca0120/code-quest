import {
  EVENTS,
  type ForkConversationResponse,
  type FsSearchResponse,
  type PlanCommentData,
  type PluginReloadResult,
  type RawEventsResponse,
  type RewindResult,
  type RpcResult,
  type SideQuestionResult,
  type TerminalGetContentsResponse,
} from '@code-quest/schemas';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { createBtwFeature } from '@/features/btw/btw-feature';
import { createClearFeature } from '@/features/clear/clear-feature';
import { createCompactFeature } from '@/features/compact/compact-feature';
import { createNewConversationFeature } from '@/features/new-conversation/new-conversation-feature';
import { createRecapFeature } from '@/features/recap/recap-feature';
import { createReloadPluginsFeature } from '@/features/reload-plugins/reload-plugins-feature';
import { createResumeFeature } from '@/features/resume/resume-feature';
import { createRewindFeature } from '@/features/rewind/rewind-feature';
import { createUsageFeature } from '@/features/usage/usage-feature';
import { createFeatureRegistry, type FeatureRegistry } from '@/lib/feature-registry';
import type { TypedSocket } from '@/socket/client';
import { useChannelsStore } from '@/stores/channels-store.ts';
import type { ChannelChangeUpdate, ChannelState } from '@/types/chat';
import { initialChannelState } from '@/types/chat';
import { msg, systemMessage } from '@/utils/message';
import { useSession } from '../SessionContext.tsx';
import { useSocket } from '../SocketContext.tsx';
import { useChannelId, useChannelMeta } from './ChannelMetaContext.tsx';
import { useChannelSocketRouter } from './ChannelSocketRouterContext.tsx';
import { FeatureRegistryContext } from './FeatureRegistryContext.tsx';
import { createFileActions } from './handlers/file.ts';
import type { Payload } from './handlers/guard.ts';
import { messageHandlers, replayHandlers } from './handlers/handler-sets.ts';
import { applyHistoryBatch, shouldApplyBatch } from './handlers/history.ts';
import { parseJoinResponse } from './handlers/join.ts';
import { createMessageActions } from './handlers/message.ts';
import { type EffectContext, notificationHandlerEffects } from './handlers/notification.ts';
import { createPlanActions } from './handlers/plan.ts';
import { createSessionActions, onSessionClosed, onSessionStatus } from './handlers/session.ts';
import { resetStreaming } from './handlers/streaming.ts';

const resetStreamingEvents = new Set<string>([
  EVENTS.system.compact_boundary,
  EVENTS.error.message,
  EVENTS.stream.text,
  EVENTS.stream.tool_summary,
]);

type SetChannelState = (fn: (prev: ChannelState) => ChannelState) => void;

export interface ChannelActionsValue {
  setChannelState: SetChannelState;
  sendMessage: (message: string) => void;
  abort: () => void;
  kill: () => void;
  clearMessages: () => void;
  clearModifiedFiles: () => void;
  removeModifiedFile: (path: string) => void;
  addSystemMessage: (type: string, content: string) => void;
  addPlanComment: (comment: PlanCommentData) => void;
  clearPlanComments: () => void;
  fetchRawEvents: () => Promise<RawEventsResponse>;
  subscribeRawEvents: (cb: (evt: unknown) => void) => () => void;
  searchFiles: (pattern: string) => Promise<FsSearchResponse>;
  getTerminalContents: () => Promise<TerminalGetContentsResponse>;
  openClaudeTerminal: () => Promise<RpcResult<{ channelId: string }>>;
  forkSession: (messageId: string) => Promise<ForkConversationResponse>;
  rewindToMessage: (userMessageId: string) => Promise<RpcResult<RewindResult>>;
  askSideQuestion: (question: string) => Promise<RpcResult<SideQuestionResult>>;
  reloadPlugins: () => Promise<PluginReloadResult>;
}

const ChannelActionsContext = createContext<ChannelActionsValue | null>(null);

export function useChannelMessages(): ChannelActionsValue {
  const actions = useContext(ChannelActionsContext);
  if (!actions) throw new Error('useChannelMessages must be used within a ChannelMessagesProvider');
  return actions;
}

function buildMessagesActions(ctx: {
  socket: TypedSocket;
  channelId: string;
  cwd?: string;
  setChannelState: SetChannelState;
  statusRef: RefObject<string>;
  messageQueueRef: RefObject<string[]>;
  registry: FeatureRegistry;
}): ChannelActionsValue {
  const { socket, channelId, cwd, setChannelState, statusRef, messageQueueRef, registry } = ctx;
  const sessionActions = createSessionActions({ socket, channelId });
  const messageActions = createMessageActions({
    socket,
    channelId,
    setChannelState,
    statusRef,
    messageQueueRef,
  });
  const clearMessages = () => setChannelState((prev) => ({ ...prev, messages: [] }));
  const clearModifiedFiles = () => setChannelState((prev) => ({ ...prev, modifiedFiles: {} }));
  registry.register(createBtwFeature({ askSideQuestion: sessionActions.askSideQuestion }));
  registry.register(createReloadPluginsFeature(() => sessionActions.reloadPlugins()));
  registry.register(
    createUsageFeature({
      emitRefreshUsage: () => socket.emit(EVENTS.settings.refresh_usage, { channelId }),
      channelId,
    }),
  );
  registry.register(createRewindFeature(channelId));
  registry.register(
    createClearFeature({
      clearMessages,
      clearModifiedFiles,
      sendMessage: (m) => messageActions.sendMessage(m),
    }),
  );
  registry.register(
    createNewConversationFeature({ sendMessage: (m) => messageActions.sendMessage(m) }),
  );
  registry.register(createResumeFeature(channelId));
  registry.register(createCompactFeature((m) => messageActions.sendMessage(m)));
  registry.register(
    createRecapFeature({
      askSideQuestion: sessionActions.askSideQuestion,
      appendMessage: messageActions.appendMessage,
    }),
  );
  const sendMessage = (message: string) => {
    const feature = registry.findSlashCommand(message);
    if (feature?.slash) {
      feature.slash.invoke(message);
      return;
    }
    messageActions.sendMessage(message);
  };
  return {
    setChannelState,
    ...messageActions,
    sendMessage,
    ...sessionActions,
    ...createFileActions({ socket, channelId, cwd }),
    ...createPlanActions({ setChannelState }),
    addSystemMessage: (type: string, content: string) =>
      setChannelState((prev) => ({
        ...prev,
        messages: [...prev.messages, systemMessage(type, content)],
      })),
    clearMessages,
    clearModifiedFiles,
    removeModifiedFile: (path: string) =>
      setChannelState((prev) => {
        const { [path]: _, ...rest } = prev.modifiedFiles;
        return { ...prev, modifiedFiles: rest };
      }),
  };
}

function useTitleFromFirstMessage(
  messages: ChannelState['messages'],
  onChangeRef: RefObject<((update: ChannelChangeUpdate) => void) | undefined>,
): void {
  const titleSetRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: onChangeRef.current is a stable ref, not a reactive dep
  useEffect(() => {
    if (titleSetRef.current) return;
    const firstUserMsg = messages.find((m) => m.role === 'user' && m.type === 'text');
    if (firstUserMsg) {
      titleSetRef.current = true;
      onChangeRef.current?.({ title: firstUserMsg.content.slice(0, 30) });
    }
  }, [messages]);
}

export function ChannelMessagesProvider({
  readyToJoin,
  initialState,
  onChange,
  onJoinSettled,
  dequeueMessage,
  messageQueueRef,
  children,
}: {
  readyToJoin: boolean;
  initialState?: Partial<ChannelState>;
  onChange?: (update: ChannelChangeUpdate) => void;
  onJoinSettled?: () => void;
  dequeueMessage: () => string | undefined;
  messageQueueRef: RefObject<string[]>;
  children: ReactNode;
}): React.JSX.Element {
  const channelId = useChannelId();
  const { cwd } = useChannelMeta();
  const { socket } = useSocket();

  // ── Feature registry ──
  const registryRef = useRef(createFeatureRegistry());
  const registry = registryRef.current;

  // ── Channel state from global channels store ──
  // Keep a local ref as the source of truth before the store is initialized,
  // so we never call store.setState during the render phase (which causes React warning).
  const initialStateRef = useRef<ChannelState>(
    useChannelsStore.getState().channels.get(channelId) ??
      ({ ...initialChannelState(channelId), ...initialState } as ChannelState),
  );

  // Write the initial state into the store after mount, outside the render phase.
  useLayoutEffect(() => {
    if (!useChannelsStore.getState().channels.get(channelId)) {
      useChannelsStore.getState().setChannelState(channelId, () => initialStateRef.current);
    }
  }, [channelId]);

  const channelState =
    useChannelsStore((s) => s.channels.get(channelId)) ?? initialStateRef.current;

  const setChannelState: SetChannelState = useCallback(
    (action) => {
      useChannelsStore.getState().setChannelState(channelId, action);
    },
    [channelId],
  );

  // ── Refs ──
  const dequeueMessageRef = useRef(dequeueMessage);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    dequeueMessageRef.current = dequeueMessage;
    onChangeRef.current = onChange;
  });

  const joinedRef = useRef(false);
  const historyReplayIdRef = useRef<string | null>(null);

  function recordJoinError(errorContent: string) {
    joinedRef.current = true;
    onJoinSettled?.();
    setChannelState((prev) => ({
      ...prev,
      messages: [...prev.messages, msg({ role: 'system', type: 'error', content: errorContent })],
    }));
  }

  function onJoinSuccess(snapshot: { state: string }) {
    setChannelState((prev) => ({
      ...prev,
      status: snapshot.state === 'busy' ? ('busy' as const) : ('idle' as const),
    }));
    joinedRef.current = true;
    onJoinSettled?.();
  }

  function joinSession() {
    socket.emit(EVENTS.session.join, { channelId }, (raw: unknown) => {
      const result = parseJoinResponse(raw);
      if (!result.ok) {
        recordJoinError(result.error);
        return;
      }
      onJoinSuccess({ state: result.state });
    });
  }

  function onSessionStates(payload: Payload<'session:states'>) {
    if (!joinedRef.current) return;
    const match = payload.sessions.find((s) => s.channelId === channelId);
    if (!match) return;
    setChannelState((prev) => {
      if (
        prev.status === 'processing' ||
        prev.status === 'cancelling' ||
        prev.status === 'disconnected'
      )
        return prev;
      const next =
        match.state === 'busy'
          ? ('busy' as const)
          : match.state === 'exited'
            ? ('disconnected' as const)
            : ('idle' as const);
      return prev.status === next ? prev : { ...prev, status: next };
    });
  }

  const router = useChannelSocketRouter();
  const { subscribeSessionStates } = useSession();

  // ── Join session (gated on readyToJoin) ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: joinSession uses channelId+socket which are in deps
  useEffect(() => {
    if (!readyToJoin) return;
    joinedRef.current = false;
    historyReplayIdRef.current = null;
    joinSession();
  }, [channelId, readyToJoin, socket]);

  // ── Cross-window status sync ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: onSessionStates uses channelId which is in deps
  useEffect(() => {
    return subscribeSessionStates(onSessionStates);
  }, [channelId, socket, subscribeSessionStates]);

  // ── Status change callback ──
  useEffect(() => {
    onChangeRef.current?.({ status: channelState.status });
  }, [channelState.status]);

  useTitleFromFirstMessage(channelState.messages, onChangeRef);

  // ── Auto-wiring: state handlers + effect handlers ──
  useEffect(() => {
    if (!socket) return;
    return router.register<ChannelState, EffectContext>(messageHandlers, setChannelState, {
      skipGuard: new Set(['disconnect']),
      beforeUpdate(event) {
        if (resetStreamingEvents.has(event)) {
          setChannelState((s) => {
            if (!s.isTextStreaming && !s.isThinkingStreaming && !s.wasStreamedViaDelta) return s;
            return { ...s, ...resetStreaming };
          });
        }
      },
      sideEffects: { handlers: notificationHandlerEffects, ctx: { socket, channelId } },
    });
  }, [channelId, socket, router, setChannelState]);

  // ── Special: session lifecycle events (excluded from messageHandlers to prevent replay) ──
  useEffect(() => {
    if (!socket) return;
    const off1 = router.on(EVENTS.session.closed, (p) =>
      setChannelState((s) => onSessionClosed(s, p)),
    );
    const off2 = router.on(EVENTS.session.status, (p) =>
      setChannelState((s) => onSessionStatus(s, p)),
    );
    return () => {
      off1();
      off2();
    };
  }, [socket, router, setChannelState]);

  // Uses socket.on directly: this event has no channelId, so the router would discard it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: joinSession uses socket+channelId already in deps; setChannelState and onJoinSettled are stable
  useEffect(() => {
    if (!socket) return;
    function onRefreshRequired() {
      setChannelState((prev) => ({ ...prev, messages: [] }));
      joinedRef.current = false;
      historyReplayIdRef.current = null;
      joinSession();
    }
    socket.on(EVENTS.state.refresh_required, onRefreshRequired);
    return () => {
      socket.off(EVENTS.state.refresh_required, onRefreshRequired);
    };
  }, [socket]);

  // ── Special: message:result dequeue side-effect ──
  useEffect(() => {
    if (!socket) return;
    return router.on(EVENTS.message.result, () => {
      const next = dequeueMessageRef.current();
      if (!next) return;
      socket.emit(EVENTS.chat.send, { channelId, message: next });
      setChannelState((prev) => ({ ...prev, status: 'processing' as const }));
    });
  }, [channelId, socket, router, setChannelState]);

  // ── session:history: replay stored events through live handlers ──
  useEffect(() => {
    if (!socket) return;
    return router.on(EVENTS.session.history, (payload) => {
      const isFirstBatch = historyReplayIdRef.current === null;
      if (!shouldApplyBatch(historyReplayIdRef, payload.replayId)) return;
      setChannelState((prev) => {
        // Skip first batch if live events already arrived (socket was already watching the channel).
        // Subsequent batches of the same replay are always applied.
        if (isFirstBatch && prev.messages.length > 0) return prev;
        return applyHistoryBatch(prev, payload.events, replayHandlers);
      });
    });
  }, [socket, router, setChannelState]);

  // ── Ref for status used in actions ──
  const statusRef = useRef(channelState.status);
  useLayoutEffect(() => {
    statusRef.current = channelState.status;
  });

  // ── Actions (rebuilt when socket/channelId/cwd change) ──
  const actions = useMemo<ChannelActionsValue>(
    () =>
      buildMessagesActions({
        socket,
        channelId,
        cwd,
        setChannelState,
        statusRef,
        messageQueueRef,
        registry,
      }),
    [socket, channelId, cwd, messageQueueRef, registry, setChannelState],
  );

  // ── Cleanup channel on unmount ──
  useEffect(() => {
    return () => useChannelsStore.getState().removeChannel(channelId);
  }, [channelId]);

  return (
    <FeatureRegistryContext.Provider value={registry}>
      <ChannelActionsContext.Provider value={actions}>{children}</ChannelActionsContext.Provider>
    </FeatureRegistryContext.Provider>
  );
}
