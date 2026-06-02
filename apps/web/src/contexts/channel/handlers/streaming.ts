import type { ContentBlock } from '@code-quest/schemas';
import type { ChannelState } from '@/types/chat';
import type { AssistantTurn, Block } from '@/types/ui';
import { addMessage } from '@/utils/message';
import type { Payload } from './guard.ts';

// ── Turn helpers ──

export function findStreamingTurn(messages: ChannelState['messages']): AssistantTurn | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type === 'assistant_turn' && m.isStreaming) return m;
  }
  return undefined;
}

function updateTurn(
  state: ChannelState,
  turnId: string,
  updater: (t: AssistantTurn) => AssistantTurn,
): ChannelState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.id === turnId && m.type === 'assistant_turn' ? updater(m) : m,
    ),
  };
}

function findLastBlock(blocks: Block[], blockType: Block['type']): Block | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.type === blockType) return blocks[i];
  }
  return undefined;
}

function updateLastBlock(
  turn: AssistantTurn,
  blockType: Block['type'],
  updater: (b: Block) => Block,
): AssistantTurn {
  const blocks = [...turn.blocks];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block?.type === blockType) {
      blocks[i] = updater(block);
      break;
    }
  }
  return { ...turn, blocks };
}

function updateBlockByToolId(
  turn: AssistantTurn,
  toolId: string,
  updater: (b: Block) => Block,
): AssistantTurn {
  return {
    ...turn,
    blocks: turn.blocks.map((b) => (b.toolId === toolId ? updater(b) : b)),
  };
}

function ensureStreamingTurn(state: ChannelState): { state: ChannelState; turn: AssistantTurn } {
  const existing = findStreamingTurn(state.messages);
  if (existing) return { state, turn: existing };
  const turn: AssistantTurn = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'assistant_turn',
    timestamp: Date.now(),
    blocks: [],
    isStreaming: true,
    content: '',
  };
  return { state: { ...state, messages: [...state.messages, turn] }, turn };
}

// ── Chunk handlers ──

function onTextChunk(state: ChannelState, content: string): ChannelState {
  const { state: s, turn } = ensureStreamingTurn(state);
  const lastText = findLastBlock(turn.blocks, 'text');
  if (lastText) {
    return updateTurn(s, turn.id, (t) => ({
      ...updateLastBlock(t, 'text', (b) => ({ ...b, content: b.content + content })),
      content: t.content + content,
    }));
  }
  return updateTurn(s, turn.id, (t) => ({
    ...t,
    blocks: [...t.blocks, { id: crypto.randomUUID(), type: 'text', content }],
    content: t.content + content,
  }));
}

function onThinkingChunk(
  state: ChannelState,
  content: string,
  estimatedTokens?: number,
): ChannelState {
  const { state: s, turn } = ensureStreamingTurn(state);
  const lastThinking = findLastBlock(turn.blocks, 'thinking');
  if (lastThinking) {
    return updateTurn(s, turn.id, (t) =>
      updateLastBlock(t, 'thinking', (b) => {
        const nextTokens =
          estimatedTokens != null ? (b.estimatedTokens ?? 0) + estimatedTokens : b.estimatedTokens;
        return { ...b, content: b.content + content, estimatedTokens: nextTokens };
      }),
    );
  }
  return updateTurn(s, turn.id, (t) => ({
    ...t,
    blocks: [
      ...t.blocks,
      {
        id: crypto.randomUUID(),
        type: 'thinking',
        content,
        isStreaming: true,
        estimatedTokens,
      },
    ],
  }));
}

function onInputJsonChunk(state: ChannelState, content: string): ChannelState {
  const targetId = state.streamingToolUseId;
  if (!targetId) return state;
  const turn = findStreamingTurn(state.messages);
  if (!turn) return state;
  return updateTurn(state, turn.id, (t: AssistantTurn) =>
    updateBlockByToolId(t, targetId, (b) => ({
      ...b,
      partialInput: (b.partialInput ?? '') + content,
    })),
  );
}

function onCitationsChunk(state: ChannelState, citations: unknown[] | undefined): ChannelState {
  if (!citations?.length) return state;
  // Find last turn (streaming or not) with a text block
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m?.type === 'assistant_turn') {
      const lastText = findLastBlock(m.blocks, 'text');
      if (lastText) {
        return updateTurn(state, m.id, (t) =>
          updateLastBlock(t, 'text', (b) => ({
            ...b,
            citations: [...(b.citations ?? []), ...citations] as typeof b.citations,
          })),
        );
      }
    }
  }
  return state;
}

// ── On handlers ──

function onStreamChunk(state: ChannelState, p: Payload<'stream:chunk'>): ChannelState {
  const { chunk } = p;
  switch (chunk.kind) {
    case 'text':
      return onTextChunk(state, chunk.content);
    case 'thinking':
      return onThinkingChunk(state, chunk.content, chunk.estimatedTokens);
    case 'input_json':
      return onInputJsonChunk(state, chunk.content);
    case 'citations':
      return onCitationsChunk(state, chunk.citations);
    default:
      return state;
  }
}

function onStreamEnd(state: ChannelState, _p: Payload<'stream:end'>): ChannelState {
  const turn = findStreamingTurn(state.messages);
  if (!turn) return state;
  return updateTurn(state, turn.id, (t) => ({ ...t, isStreaming: false }));
}

function onMessageStart(state: ChannelState, p: Payload<'stream:message_start'>): ChannelState {
  const turn: AssistantTurn = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'assistant_turn',
    timestamp: Date.now(),
    model: p.model,
    messageId: p.messageId,
    blocks: [],
    usage: {
      inputTokens: p.usage.inputTokens,
      outputTokens: 0,
      ...(p.usage.cacheCreationInputTokens
        ? { cacheCreationInputTokens: p.usage.cacheCreationInputTokens }
        : {}),
      ...(p.usage.cacheReadInputTokens
        ? { cacheReadInputTokens: p.usage.cacheReadInputTokens }
        : {}),
    },
    isStreaming: true,
    content: '',
  };
  return { ...state, messages: [...state.messages, turn] };
}

function onMessageDelta(state: ChannelState, p: Payload<'stream:message_delta'>): ChannelState {
  const turn = findStreamingTurn(state.messages);
  if (!turn) return state;
  return updateTurn(state, turn.id, (t) => ({
    ...t,
    stopReason: p.stopReason ?? undefined,
    usage: {
      ...t.usage,
      inputTokens: t.usage?.inputTokens ?? 0,
      outputTokens: p.usage.outputTokens,
    },
  }));
}

function onBlockStart(state: ChannelState, p: Payload<'stream:block_start'>): ChannelState {
  const { state: s, turn } = ensureStreamingTurn(state);

  if (p.blockType === 'tool_use' && p.contentBlock) {
    const toolId = p.contentBlock.id as string | undefined;
    const toolName = p.contentBlock.name as string | undefined;
    if (!toolId) return s;
    const block: Block = {
      id: crypto.randomUUID(),
      type: 'tool_use',
      content: toolName ?? 'Unknown',
      toolId,
      input: {},
      parentToolUseId: p.parentToolUseId,
    };
    return {
      ...updateTurn(s, turn.id, (t) => ({ ...t, blocks: [...t.blocks, block] })),
      streamingToolUseId: toolId,
    };
  }

  const blockType: Block['type'] = p.blockType === 'thinking' ? 'thinking' : 'text';
  const block: Block = {
    id: crypto.randomUUID(),
    type: blockType,
    content: '',
  };
  return updateTurn(s, turn.id, (t) => ({ ...t, blocks: [...t.blocks, block] }));
}

function onBlockStop(state: ChannelState, _p: Payload<'stream:block_stop'>): ChannelState {
  const turn = findStreamingTurn(state.messages);
  if (turn) {
    const hasStreamingThinking = turn.blocks.some((b) => b.type === 'thinking' && b.isStreaming);
    if (hasStreamingThinking) {
      return {
        ...updateTurn(state, turn.id, (t) => ({
          ...t,
          blocks: t.blocks.map((b) =>
            b.type === 'thinking' && b.isStreaming ? { ...b, isStreaming: undefined } : b,
          ),
        })),
        streamingToolUseId: undefined,
      };
    }
  }
  return { ...state, streamingToolUseId: undefined };
}

function onCompaction(state: ChannelState, p: Payload<'stream:compaction'>): ChannelState {
  return addMessage(state, { role: 'system', type: 'compact_boundary', content: p.content });
}

// ── message:assistant handler ──

function contentBlockToBlock(block: ContentBlock, parentToolUseId?: string): Block | null {
  switch (block.type) {
    case 'text':
      return { id: crypto.randomUUID(), type: 'text', content: block.text };
    case 'thinking':
      return { id: crypto.randomUUID(), type: 'thinking', content: block.thinking };
    case 'tool_use':
      return {
        id: crypto.randomUUID(),
        type: 'tool_use',
        content: block.toolName ?? 'Unknown',
        toolId: block.toolId,
        input: block.input as Record<string, unknown>,
        ...(block.model ? { model: block.model } : {}),
        parentToolUseId,
      };
    default:
      return null;
  }
}

function patchToolUseAcrossTurns(
  state: ChannelState,
  content: ContentBlock[],
): { state: ChannelState; patchedToolIds: Set<string> } {
  const patchedToolIds = new Set<string>();
  let s = state;
  for (const c of content) {
    if (c.type !== 'tool_use') continue;
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i];
      if (m?.type !== 'assistant_turn') continue;
      const idx = m.blocks.findIndex((b) => b.type === 'tool_use' && b.toolId === c.toolId);
      if (idx < 0) continue;
      patchedToolIds.add(c.toolId);
      s = updateTurn(s, m.id, (t) => ({
        ...t,
        blocks: t.blocks.map((b, bi) =>
          bi === idx
            ? {
                ...b,
                input: c.input as Record<string, unknown>,
                partialInput: undefined,
                ...(c.model ? { model: c.model } : {}),
              }
            : b,
        ),
      }));
      break;
    }
  }
  return { state: s, patchedToolIds };
}

function livePath(
  state: ChannelState,
  turn: AssistantTurn,
  content: ContentBlock[],
  patchedToolIds: Set<string>,
  parentToolUseId: string | undefined,
): ChannelState {
  return updateTurn(state, turn.id, (t) => {
    const hasText = t.blocks.some((b) => b.type === 'text');
    const hasThinking = t.blocks.some((b) => b.type === 'thinking');
    const newBlocks: Block[] = [];
    for (const c of content) {
      if (c.type === 'text' && !hasText) {
        newBlocks.push({ id: crypto.randomUUID(), type: 'text', content: c.text });
      }
      if (c.type === 'thinking' && !hasThinking) {
        newBlocks.push({ id: crypto.randomUUID(), type: 'thinking', content: c.thinking });
      }
      if (c.type === 'tool_use' && !patchedToolIds.has(c.toolId)) {
        const block = contentBlockToBlock(c, parentToolUseId);
        if (block) newBlocks.push(block);
      }
    }
    if (newBlocks.length === 0) return t;
    const finalBlocks = [...t.blocks, ...newBlocks];
    const textContent = finalBlocks
      .filter((b) => b.type === 'text')
      .map((b) => b.content)
      .join('\n');
    return { ...t, blocks: finalBlocks, content: textContent };
  });
}

function replayPath(
  state: ChannelState,
  content: ContentBlock[],
  patchedToolIds: Set<string>,
  parentToolUseId: string | undefined,
): ChannelState {
  const remaining = content.filter((c) => c.type !== 'tool_use' || !patchedToolIds.has(c.toolId));
  if (remaining.length === 0 && patchedToolIds.size > 0) return state;

  const blocks = remaining
    .map((c) => contentBlockToBlock(c, parentToolUseId))
    .filter((b): b is Block => b !== null);

  const textContent = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.content)
    .join('\n');

  const newTurn: AssistantTurn = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'assistant_turn',
    timestamp: Date.now(),
    blocks,
    isStreaming: false,
    content: textContent,
    parentToolUseId,
  };
  return { ...state, messages: [...state.messages, newTurn] };
}

function onMessageAssistantHandler(
  state: ChannelState,
  p: Payload<'message:assistant'>,
): ChannelState {
  const { state: crossPatched, patchedToolIds } = patchToolUseAcrossTurns(state, p.content);
  const turn = p.parentToolUseId ? undefined : findStreamingTurn(crossPatched.messages);
  if (turn) return livePath(crossPatched, turn, p.content, patchedToolIds, p.parentToolUseId);
  return replayPath(crossPatched, p.content, patchedToolIds, p.parentToolUseId);
}

export const resetStreaming = {
  isTextStreaming: false,
  isThinkingStreaming: false,
  wasStreamedViaDelta: false,
};

export const streamingHandlerOn: {
  'stream:chunk': typeof onStreamChunk;
  'stream:end': typeof onStreamEnd;
  'stream:block_start': typeof onBlockStart;
  'stream:message_start': typeof onMessageStart;
  'stream:message_delta': typeof onMessageDelta;
  'stream:block_stop': typeof onBlockStop;
  'stream:compaction': typeof onCompaction;
  'message:assistant': typeof onMessageAssistantHandler;
} = {
  'stream:chunk': onStreamChunk,
  'stream:end': onStreamEnd,
  'stream:block_start': onBlockStart,
  'stream:message_start': onMessageStart,
  'stream:message_delta': onMessageDelta,
  'stream:block_stop': onBlockStop,
  'stream:compaction': onCompaction,
  'message:assistant': onMessageAssistantHandler,
} satisfies Record<string, (state: ChannelState, payload: never) => ChannelState>;
