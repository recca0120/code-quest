import type {
  ForkConversationResponse,
  PluginReloadResult,
  RawEventsResponse,
  RewindResult,
  RpcResult,
  SideQuestionResult,
} from '@code-quest/schemas';
import { EVENTS } from '@code-quest/schemas';
import { isRecord } from '@code-quest/utils';
import type { TypedSocket } from '@/socket/client';
import { rpc } from '@/socket/rpc';
import type { ChannelState } from '@/types/chat';
import { msg } from '@/utils/message';
import type { Payload } from './guard.ts';

// ── On handlers ──

export function onSessionStatus(state: ChannelState, p: Payload<'session:status'>): ChannelState {
  return { ...state, statusText: p.status || null };
}

function onDisconnect(state: ChannelState): ChannelState {
  return { ...state, status: 'disconnected' };
}

export function onSessionClosed(state: ChannelState, p: Payload<'session:closed'>): ChannelState {
  const messages = state.messages.map((m) => {
    if (m.type !== 'assistant_turn') return m;
    const hasPartial = m.blocks.some((b) => b.type === 'tool_use' && b.partialInput !== undefined);
    if (!hasPartial) return m;
    return {
      ...m,
      blocks: m.blocks.map((b) =>
        b.type === 'tool_use' && b.partialInput !== undefined
          ? { ...b, partialInput: undefined }
          : b,
      ),
    };
  });
  return {
    ...state,
    messages: [
      ...messages,
      ...(p.error ? [msg({ role: 'system', type: 'error', content: p.error })] : []),
      msg({ role: 'system', type: 'error', content: 'CLI session has ended.' }),
    ],
    status: 'disconnected',
  };
}

// ── Handler map ──

export const sessionHandlerOn: {
  'session:status': typeof onSessionStatus;
  'session:closed': typeof onSessionClosed;
  disconnect: typeof onDisconnect;
} = {
  'session:status': onSessionStatus,
  'session:closed': onSessionClosed,
  disconnect: onDisconnect,
} satisfies Record<string, (state: ChannelState, payload: never) => ChannelState>;

// ── Actions (emit) ──

export function createSessionActions({
  socket,
  channelId,
}: {
  socket: TypedSocket;
  channelId: string;
}): {
  fetchRawEvents: () => Promise<RawEventsResponse>;
  subscribeRawEvents: (cb: (evt: unknown) => void) => () => void;
  forkSession: (messageId: string) => Promise<ForkConversationResponse>;
  rewindToMessage: (userMessageId: string) => Promise<RpcResult<RewindResult>>;
  askSideQuestion: (question: string) => Promise<RpcResult<SideQuestionResult>>;
  reloadPlugins: () => Promise<PluginReloadResult>;
} {
  function fetchRawEvents(): Promise<RawEventsResponse> {
    return rpc(socket, EVENTS.session.raw_events, { channelId });
  }

  function subscribeRawEvents(cb: (evt: unknown) => void): () => void {
    const handler = (eventName: string, ...args: unknown[]) => {
      const payload = isRecord(args[0]) ? args[0] : undefined;
      if (payload?.channelId && payload.channelId !== channelId) return;
      cb({ type: eventName, ...(payload ?? {}) });
    };
    socket.onAny(handler);
    return () => socket.offAny(handler);
  }

  function forkSession(messageId: string): Promise<ForkConversationResponse> {
    return rpc(socket, EVENTS.session.fork, {
      forkedFromChannelId: channelId,
      resumeSessionAt: messageId,
      newChannelId: crypto.randomUUID(),
    });
  }

  function rewindToMessage(userMessageId: string): Promise<RpcResult<RewindResult>> {
    return rpc(socket, EVENTS.chat.rewind_code, { channelId, userMessageId });
  }

  function askSideQuestion(question: string): Promise<RpcResult<SideQuestionResult>> {
    return rpc(socket, EVENTS.chat.ask_side_question, { channelId, question });
  }

  function reloadPlugins(): Promise<PluginReloadResult> {
    return rpc(socket, EVENTS.plugin.reload, { channelId });
  }

  return {
    fetchRawEvents,
    subscribeRawEvents,
    forkSession,
    rewindToMessage,
    askSideQuestion,
    reloadPlugins,
  };
}
