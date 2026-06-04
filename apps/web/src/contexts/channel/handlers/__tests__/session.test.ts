import { describe, expect, it } from 'vitest';
import { initialChannelState } from '@/types/chat';
import type { AssistantTurn, Block } from '@/types/ui';
import { onSessionClosed } from '../session.ts';

function makeToolUseBlock(partialInput?: string): Block {
  return {
    id: 'block-1',
    type: 'tool_use',
    toolId: 'toolu_1',
    content: 'Edit',
    ...(partialInput !== undefined ? { partialInput } : {}),
  };
}

function makeAssistantTurn(blocks: Block[]): AssistantTurn {
  return {
    id: 'turn-1',
    role: 'assistant',
    type: 'assistant_turn',
    timestamp: 0,
    content: '',
    blocks,
  };
}

describe('onSessionClosed', () => {
  it('clears partialInput on tool_use blocks', () => {
    const state = {
      ...initialChannelState('ch'),
      messages: [makeAssistantTurn([makeToolUseBlock('{"old_string": "foo",')]) as never],
    };

    const result = onSessionClosed(state, { channelId: 'ch' });

    const turn = result.messages.find((m) => m.type === 'assistant_turn') as
      | AssistantTurn
      | undefined;
    const block = turn?.blocks?.find((b) => b.type === 'tool_use');
    expect(block?.partialInput).toBeUndefined();
  });

  it('does not affect tool_use blocks that already have no partialInput', () => {
    const state = {
      ...initialChannelState('ch'),
      messages: [makeAssistantTurn([makeToolUseBlock()]) as never],
    };

    const result = onSessionClosed(state, { channelId: 'ch' });

    const turn = result.messages.find((m) => m.type === 'assistant_turn') as
      | AssistantTurn
      | undefined;
    const block = turn?.blocks?.find((b) => b.type === 'tool_use');
    expect(block?.partialInput).toBeUndefined();
    expect(block?.content).toBe('Edit');
  });

  it('sets status to disconnected and appends session-ended message', () => {
    const state = initialChannelState('ch');
    const result = onSessionClosed(state, { channelId: 'ch' });

    expect(result.status).toBe('disconnected');
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg?.type).toBe('error');
    expect((lastMsg as { content?: string }).content).toMatch(/CLI session has ended/);
  });
});
