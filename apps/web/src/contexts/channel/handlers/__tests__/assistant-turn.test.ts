import { describe, expect, it } from 'vitest';
import type { ChannelState } from '@/types/chat';
import { initialChannelState } from '@/types/chat';
import type { AssistantTurn, Block } from '@/types/ui';
import { streamingHandlerOn } from '../streaming.ts';

const onMessageStart = streamingHandlerOn['stream:message_start'];
const onBlockStart = streamingHandlerOn['stream:block_start'];
const onChunk = streamingHandlerOn['stream:chunk'];
const onBlockStop = streamingHandlerOn['stream:block_stop'];
const onMessageDelta = streamingHandlerOn['stream:message_delta'];
const onEnd = streamingHandlerOn['stream:end'];
const onAssistant = streamingHandlerOn['message:assistant'];

function lastTurn(state: ChannelState): AssistantTurn {
  const last = state.messages[state.messages.length - 1];
  if (!last || last.type !== 'assistant_turn')
    throw new Error('last message is not assistant_turn');
  return last as AssistantTurn;
}

function lastBlock(state: ChannelState): Block {
  const turn = lastTurn(state);
  return turn.blocks[turn.blocks.length - 1]!;
}

describe('AssistantTurn live streaming lifecycle', () => {
  it('message_start creates an AssistantTurn with isStreaming=true', () => {
    const state = initialChannelState('ch');
    const next = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 1000 },
    });
    expect(next.messages).toHaveLength(1);
    const turn = lastTurn(next);
    expect(turn.type).toBe('assistant_turn');
    expect(turn.model).toBe('claude-opus-4-6');
    expect(turn.messageId).toBe('msg_1');
    expect(turn.isStreaming).toBe(true);
    expect(turn.blocks).toHaveLength(0);
    expect(turn.usage).toMatchObject({ inputTokens: 1000 });
  });

  it('block_start[text] pushes a text block to the turn', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    expect(lastTurn(state).blocks).toHaveLength(1);
    expect(lastBlock(state).type).toBe('text');
    expect(lastBlock(state).content).toBe('');
  });

  it('block_start[thinking] pushes a thinking block', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    expect(lastBlock(state).type).toBe('thinking');
  });

  it('block_start[tool_use] pushes a tool_use block with toolId and name', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    const block = lastBlock(state);
    expect(block.type).toBe('tool_use');
    expect(block.content).toBe('Edit');
    expect(block).toMatchObject({ toolId: 'toolu_1', input: {} });
    expect(state.streamingToolUseId).toBe('toolu_1');
  });

  it('text chunk appends to the text block in the turn', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'text', content: 'Hello ' } });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'text', content: 'world' } });
    expect(lastBlock(state).content).toBe('Hello world');
  });

  it('thinking chunk appends to the thinking block in the turn', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'thinking', content: 'Let me ' } });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'thinking', content: 'think...' } });
    expect(lastBlock(state).content).toBe('Let me think...');
  });

  it('thinking chunk accumulates estimatedTokens', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'thinking', content: 'A', estimatedTokens: 30 },
    });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'thinking', content: 'B', estimatedTokens: 20 },
    });
    expect(lastBlock(state).estimatedTokens).toBe(50);
  });

  it('thinking chunk without estimatedTokens leaves estimatedTokens undefined', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'thinking', content: 'hi' } });
    expect(lastBlock(state).estimatedTokens).toBeUndefined();
  });

  it('input_json chunk appends partialInput to the correct tool_use block', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'input_json', content: '{"file' } });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'input_json', content: '":"a.ts"}' },
    });
    expect(lastBlock(state)).toMatchObject({ partialInput: '{"file":"a.ts"}' });
  });

  it('message_delta updates stopReason and outputTokens on the turn', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onMessageDelta(state, {
      channelId: 'ch',
      stopReason: 'end_turn',
      usage: { outputTokens: 200 },
    });
    const turn = lastTurn(state);
    expect(turn.stopReason).toBe('end_turn');
    expect(turn.usage?.outputTokens).toBe(200);
  });

  it('block_stop clears streamingToolUseId', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    state = onBlockStop(state, { channelId: 'ch', index: 0 });
    expect(state.streamingToolUseId).toBeUndefined();
  });

  it('stream:end sets turn.isStreaming=false', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onEnd(state, { channelId: 'ch' });
    expect(lastTurn(state).isStreaming).toBe(false);
  });

  it('message:assistant patches blocks with complete input and clears partialInput', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'text', content: 'Hello' } });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 1,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'input_json', content: '{"file":"a"}' },
    });
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        { type: 'text', text: 'Hello' },
        {
          type: 'tool_use',
          toolId: 'toolu_1',
          toolName: 'Edit',
          input: { file: 'a.ts', old_string: 'x', new_string: 'y' },
        },
      ],
    } as never);
    const turn = lastTurn(state);
    expect(turn.blocks).toHaveLength(2);
    expect(turn.blocks[0]!.content).toBe('Hello');
    const toolBlock = turn.blocks[1]!;
    expect(toolBlock).toMatchObject({
      toolId: 'toolu_1',
      input: { file: 'a.ts', old_string: 'x', new_string: 'y' },
    });
    expect(toolBlock.partialInput).toBeUndefined();
  });

  it('full lifecycle: message_start → thinking → text → tool_use → deltas → assistant', () => {
    let state = initialChannelState('ch');

    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 500 },
    });

    // thinking block
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'thinking', content: 'I need to...' },
    });
    state = onBlockStop(state, { channelId: 'ch', index: 0 });

    // text block
    state = onBlockStart(state, { channelId: 'ch', index: 1, blockType: 'text' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'text', content: 'Let me edit' } });
    state = onBlockStop(state, { channelId: 'ch', index: 1 });

    // tool_use block
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 2,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'input_json', content: '{"file":"a.ts"}' },
    });
    state = onBlockStop(state, { channelId: 'ch', index: 2 });

    // message_delta
    state = onMessageDelta(state, {
      channelId: 'ch',
      stopReason: 'tool_use',
      usage: { outputTokens: 300 },
    });

    // message:assistant completes
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        { type: 'thinking', thinking: 'I need to...' },
        { type: 'text', text: 'Let me edit' },
        {
          type: 'tool_use',
          toolId: 'toolu_1',
          toolName: 'Edit',
          input: { file: 'a.ts' },
        },
      ],
    } as never);

    // stream end
    state = onEnd(state, { channelId: 'ch' });

    // Should be one AssistantTurn with 3 blocks
    expect(state.messages).toHaveLength(1);
    const turn = lastTurn(state);
    expect(turn.type).toBe('assistant_turn');
    expect(turn.model).toBe('claude-opus-4-6');
    expect(turn.stopReason).toBe('tool_use');
    expect(turn.usage?.outputTokens).toBe(300);
    expect(turn.isStreaming).toBe(false);
    expect(turn.blocks).toHaveLength(3);
    expect(turn.blocks[0]!.type).toBe('thinking');
    expect(turn.blocks[0]!.content).toBe('I need to...');
    expect(turn.blocks[1]!.type).toBe('text');
    expect(turn.blocks[1]!.content).toBe('Let me edit');
    expect(turn.blocks[2]!.type).toBe('tool_use');
    expect(turn.blocks[2]!).toMatchObject({
      toolId: 'toolu_1',
      input: { file: 'a.ts' },
    });
  });
});

describe('Real CLI event sequence: per-block message:assistant', () => {
  it('multiple message:assistant (one per block) stay in one turn', () => {
    let state = initialChannelState('ch');

    // message_start
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 500 },
    });

    // thinking block
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'thinking' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'thinking', content: 'hmm' } });
    // CLI sends message:assistant with just thinking
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'thinking', thinking: 'hmm' }],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 0 });

    // text block
    state = onBlockStart(state, { channelId: 'ch', index: 1, blockType: 'text' });
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'text', content: 'Hello' } });
    // CLI sends message:assistant with just text
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'text', text: 'Hello' }],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 1 });

    // tool_use block
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 2,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'input_json', content: '{"file":"a.ts"}' },
    });
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'tool_use', toolId: 'toolu_1', toolName: 'Edit', input: { file: 'a.ts' } }],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 2 });

    // message_delta + message_stop
    state = onMessageDelta(state, {
      channelId: 'ch',
      stopReason: 'tool_use',
      usage: { outputTokens: 200 },
    });
    state = onEnd(state, { channelId: 'ch' });

    // Should be ONE turn with 3 blocks, NOT 3 separate turns
    expect(state.messages).toHaveLength(1);
    const turn = lastTurn(state);
    expect(turn.blocks).toHaveLength(3);
    expect(turn.blocks[0]!.type).toBe('thinking');
    expect(turn.blocks[1]!.type).toBe('text');
    expect(turn.blocks[2]!.type).toBe('tool_use');
    expect(turn.isStreaming).toBe(false);
  });

  it('block_stop clears thinking isStreaming', () => {
    let state = initialChannelState('ch');
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_1',
      usage: { inputTokens: 100 },
    });
    // thinkingChunk auto-creates block with meta.isStreaming=true
    state = onChunk(state, { channelId: 'ch', chunk: { kind: 'thinking', content: 'hmm' } });

    expect(lastBlock(state).isStreaming).toBe(true);

    state = onBlockStop(state, { channelId: 'ch', index: 0 });

    expect(lastTurn(state).blocks[0]!.isStreaming).toBeUndefined();
  });
});

describe('Sub-agent (parentToolUseId) creates separate turn, not patched into main', () => {
  it('message:assistant with parentToolUseId creates new turn even when main is streaming', () => {
    let state = initialChannelState('ch');

    // Main turn streaming
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_main',
      usage: { inputTokens: 500 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'text', content: 'Refactoring done.' },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 1,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_agent', name: 'Task' },
    });

    // Sub-agent message:assistant arrives with parentToolUseId
    state = onAssistant(state, {
      channelId: 'ch',
      parentToolUseId: 'toolu_agent',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_sub_bash',
          toolName: 'Bash',
          input: { command: 'vitest run' },
        },
      ],
    } as never);

    // Main turn should still have its original blocks (text + Task tool_use)
    const mainTurn = state.messages[0] as AssistantTurn;
    expect(mainTurn.type).toBe('assistant_turn');
    expect(mainTurn.blocks).toHaveLength(2);
    expect(mainTurn.blocks[0]!.type).toBe('text');
    expect(mainTurn.blocks[1]!.type).toBe('tool_use');
    expect(mainTurn.blocks[1]!.content).toBe('Task');

    // Sub-agent turn should be a separate message with parentToolUseId
    expect(state.messages).toHaveLength(2);
    const subTurn = state.messages[1] as AssistantTurn;
    expect(subTurn.type).toBe('assistant_turn');
    expect(subTurn.parentToolUseId).toBe('toolu_agent');
    expect(subTurn.blocks).toHaveLength(1);
    expect(subTurn.blocks[0]!.type).toBe('tool_use');
    expect(subTurn.blocks[0]!.content).toBe('Bash');
  });

  it('message:assistant without parentToolUseId patches the streaming turn', () => {
    let state = initialChannelState('ch');

    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_main',
      usage: { inputTokens: 500 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_1', name: 'Edit' },
    });

    // Main-line message:assistant (no parentToolUseId) patches the streaming turn
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'tool_use', toolId: 'toolu_1', toolName: 'Edit', input: { file: 'a.ts' } }],
    } as never);

    expect(state.messages).toHaveLength(1);
    const turn = state.messages[0] as AssistantTurn;
    expect(turn.blocks[0]!).toMatchObject({ input: { file: 'a.ts' } });
  });
});

describe('AssistantTurn replay (message:assistant without streaming)', () => {
  it('creates a complete AssistantTurn when no streaming turn exists', () => {
    const state = initialChannelState('ch');
    const next = onAssistant(state, {
      channelId: 'ch',
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: 'Done' },
        {
          type: 'tool_use',
          toolId: 'toolu_1',
          toolName: 'Bash',
          input: { command: 'ls' },
        },
      ],
    } as never);

    expect(next.messages).toHaveLength(1);
    const turn = lastTurn(next);
    expect(turn.type).toBe('assistant_turn');
    expect(turn.isStreaming).toBe(false);
    expect(turn.blocks).toHaveLength(3);
    expect(turn.blocks[0]!.type).toBe('thinking');
    expect(turn.blocks[0]!.content).toBe('hmm');
    expect(turn.blocks[1]!.type).toBe('text');
    expect(turn.blocks[1]!.content).toBe('Done');
    expect(turn.blocks[2]!.type).toBe('tool_use');
    expect(turn.blocks[2]!.content).toBe('Bash');
    expect(turn.blocks[2]!).toMatchObject({ toolId: 'toolu_1', input: { command: 'ls' } });
  });
});

describe('cross-turn tool_use patch', () => {
  it('late per-block assistant patches tool_use in previous turn, not streaming turn', () => {
    let state = initialChannelState('ch');

    // Turn A: Bash(git commit) + Edit
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_A',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_bash', name: 'Bash' },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 2,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_edit', name: 'Edit' },
    });
    state = onEnd(state, { channelId: 'ch' });

    // Turn B: streaming text + Grep
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_B',
      usage: { inputTokens: 200 },
    });
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'text', content: 'Now checking...' },
    });

    // Late per-block assistant for Turn A's Bash arrives during Turn B streaming
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_bash',
          toolName: 'Bash',
          input: { command: 'git commit -m "fix"' },
        },
      ],
    } as never);

    // Turn A: Bash should be patched
    const turnA = state.messages[0] as AssistantTurn;
    expect(turnA.blocks).toHaveLength(2);
    expect(turnA.blocks[0]!).toMatchObject({
      toolId: 'toolu_bash',
      input: { command: 'git commit -m "fix"' },
    });

    // Turn B: should NOT have duplicate Bash
    const turnB = state.messages[1] as AssistantTurn;
    expect(turnB.blocks).toHaveLength(1);
    expect(turnB.blocks[0]!.type).toBe('text');
  });

  it('late assistant after all turns finalized patches correct turn, no new turn created', () => {
    let state = initialChannelState('ch');

    // Turn A with Edit
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_A',
      usage: { inputTokens: 100 },
    });
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 0,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_edit', name: 'Edit' },
    });
    state = onEnd(state, { channelId: 'ch' });

    // No streaming turn — late assistant for Turn A
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_edit',
          toolName: 'Edit',
          input: { file_path: '/a.ts', old_string: 'x', new_string: 'y' },
        },
      ],
    } as never);

    // Should be 1 turn (patched), not 2 turns
    expect(state.messages).toHaveLength(1);
    const turn = state.messages[0] as AssistantTurn;
    expect(turn.blocks[0]!).toMatchObject({
      toolId: 'toolu_edit',
      input: { file_path: '/a.ts' },
    });
  });
});

describe('Replay scenario: local_bash git commit (from DB seq 1099-1197)', () => {
  // Replay = no stream events, only message:assistant + system + user(tool_result)
  // This simulates the exact event sequence from the DB for the "Refactoring done" → "Done! Commit" section

  function applySystemEvent(
    state: ChannelState,
    handler: (s: ChannelState, p: never) => ChannelState,
    payload: Record<string, unknown>,
  ): ChannelState {
    return handler(state, { channelId: 'ch', ...payload } as never);
  }

  it('replay: text + Bash(vitest) + task_started + tool_result produces correct state', async () => {
    const { taskHandlerOn } = await import('../task.ts');
    const onTaskStarted = taskHandlerOn['task:started'];
    const onTaskNotification = taskHandlerOn['task:notification'];

    let state = initialChannelState('ch');

    // seq 1099: ASSISTANT text
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'text', text: 'Refactoring done. Let me verify tests:' }],
    } as never);

    // seq 1106: ASSISTANT Bash (vitest run)
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_vitest',
          toolName: 'Bash',
          input: { command: 'cd apps/teasaren && npx vitest run' },
        },
      ],
    } as never);

    // seq 1136: ASSISTANT text
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'text',
          text: '兩邊 ProductDetail 測試全過（teasaren 22 + ganyuan 17）',
        },
      ],
    } as never);

    // seq 1145: ASSISTANT Bash (vitest run again)
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_vitest2',
          toolName: 'Bash',
          input: { command: 'cd apps/teasaren && npx vitest run 2>&1 | grep Tests' },
        },
      ],
    } as never);

    // seq 1149: TASK_START local_bash for vitest2
    state = applySystemEvent(state, onTaskStarted as never, {
      description: 'cd apps/teasaren && npx vitest run',
      taskType: 'local_bash',
      toolUseId: 'toolu_vitest2',
    });

    // seq 1150: TASK_NOTIF completed
    state = applySystemEvent(state, onTaskNotification as never, {
      taskId: 'task_1',
      toolUseId: 'toolu_vitest2',
      status: 'completed',
    });

    // seq 1166: ASSISTANT text
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'text', text: 'Now check for z-[ remaining:' }],
    } as never);

    // seq 1167: ASSISTANT Bash (git commit)
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_gitcommit',
          toolName: 'Bash',
          input: { command: 'git add ... && git commit -m "refactor"' },
        },
      ],
    } as never);

    // seq 1171: TASK_START local_bash for git commit
    state = applySystemEvent(state, onTaskStarted as never, {
      description: 'git add ... && git commit -m "refactor"',
      taskType: 'local_bash',
      toolUseId: 'toolu_gitcommit',
    });

    // seq 1172: TASK_NOTIF completed
    state = applySystemEvent(state, onTaskNotification as never, {
      taskId: 'task_2',
      toolUseId: 'toolu_gitcommit',
      status: 'completed',
    });

    // seq 1191: ASSISTANT text (Done!)
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'text', text: 'Done! Commit `0137833` 通過 biome + typecheck。' }],
    } as never);

    const assistantTurns = state.messages.filter((m) => m.type === 'assistant_turn');
    const taskStartedMsgs = state.messages.filter((m) => m.type === 'task_started');

    // 有 toolUseId 的 task_started 不建獨立系統訊息，只 patch tool_use block
    expect(taskStartedMsgs.length).toBe(0);

    // 每個 per-block message:assistant 在 replay 時建獨立 turn
    expect(assistantTurns.length).toBe(7); // text, Bash, text, Bash, text, Bash, text

    // git commit 的 command 在 assistant_turn 裡
    const gitCommitTurn = assistantTurns.find((t) =>
      (t as AssistantTurn).blocks.some((b) => b.toolId === 'toolu_gitcommit'),
    ) as AssistantTurn;
    expect(gitCommitTurn).toBeDefined();
    // task status now in state.tasks, not block.meta
    expect(state.tasks.get('toolu_gitcommit')?.status).toBe('completed');

    // 不再有獨立的 task_started 系統訊息
    expect(taskStartedMsgs).toHaveLength(0);
  });

  it('live: text + Bash(git commit) with delta + task_started + tool_result', async () => {
    const { taskHandlerOn } = await import('../task.ts');
    const onTaskStarted = taskHandlerOn['task:started'];
    const onTaskNotification = taskHandlerOn['task:notification'];

    let state = initialChannelState('ch');

    // Turn A: message_start → text block → Bash block → per-block assistants → message_stop
    state = onMessageStart(state, {
      channelId: 'ch',
      model: 'claude-opus-4-6',
      messageId: 'msg_A',
      usage: { inputTokens: 500 },
    });

    // text block
    state = onBlockStart(state, { channelId: 'ch', index: 0, blockType: 'text' });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'text', content: 'Now check for z-[ remaining:' },
    });
    state = onAssistant(state, {
      channelId: 'ch',
      content: [{ type: 'text', text: 'Now check for z-[ remaining:' }],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 0 });

    // Bash block (git commit)
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 1,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_gitcommit', name: 'Bash' },
    });
    state = onChunk(state, {
      channelId: 'ch',
      chunk: { kind: 'input_json', content: '{"command":"git add && commit"}' },
    });
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        {
          type: 'tool_use',
          toolId: 'toolu_gitcommit',
          toolName: 'Bash',
          input: { command: 'git add && commit' },
        },
      ],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 1 });

    // Grep block
    state = onBlockStart(state, {
      channelId: 'ch',
      index: 2,
      blockType: 'tool_use',
      contentBlock: { type: 'tool_use', id: 'toolu_grep', name: 'Grep' },
    });
    state = onAssistant(state, {
      channelId: 'ch',
      content: [
        { type: 'tool_use', toolId: 'toolu_grep', toolName: 'Grep', input: { pattern: 'z-\\[' } },
      ],
    } as never);
    state = onBlockStop(state, { channelId: 'ch', index: 2 });

    state = onMessageDelta(state, {
      channelId: 'ch',
      stopReason: 'tool_use',
      usage: { outputTokens: 300 },
    });
    state = onEnd(state, { channelId: 'ch' });

    // task_started for git commit
    state = onTaskStarted(state, {
      channelId: 'ch',
      description: 'git add && commit',
      taskType: 'local_bash',
      toolUseId: 'toolu_gitcommit',
    } as never);

    // task_notification completed
    state = onTaskNotification(state, {
      channelId: 'ch',
      taskId: 'task_1',
      toolUseId: 'toolu_gitcommit',
      status: 'completed',
    } as never);

    // === Verify live state ===

    // Should be 1 turn (+ task_started system messages)
    const turns = state.messages.filter((m) => m.type === 'assistant_turn');
    const taskMsgs = state.messages.filter((m) => m.type === 'task_started');

    // 1 turn with 3 blocks: text + Bash + Grep
    expect(turns).toHaveLength(1);
    const turn = turns[0] as AssistantTurn;
    expect(turn.blocks).toHaveLength(3);
    expect(turn.blocks[0]!.type).toBe('text');
    expect(turn.blocks[1]!.type).toBe('tool_use');
    expect(turn.blocks[1]!.content).toBe('Bash');
    expect(turn.blocks[2]!.type).toBe('tool_use');
    expect(turn.blocks[2]!.content).toBe('Grep');

    // task status in state.tasks, not block.meta
    expect(state.tasks.get('toolu_gitcommit')?.status).toBe('completed');
    expect(state.tasks.get('toolu_gitcommit')?.taskType).toBe('local_bash');

    // 有 toolUseId 時不建獨立系統訊息
    expect(taskMsgs).toHaveLength(0);
  });
});
