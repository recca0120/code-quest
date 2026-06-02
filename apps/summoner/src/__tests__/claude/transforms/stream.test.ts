import { segments as s } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { expectName, toClientMessage } from '../helpers.ts';

describe('transform — stream events', () => {
  it('converts content_block_start to stream:block_start', () => {
    const base = JSON.parse(s.contentBlockStart(0, 'thinking'));
    base.event.content_block = { type: 'thinking', thinking: '', signature: '' };
    base.parent_tool_use_id = null;
    const result = toClientMessage(JSON.stringify(base));
    const msg = expectName(result, 'stream:block_start');
    expect(msg.payload.index).toBe(0);
    expect(msg.payload.blockType).toBe('thinking');
    expect(msg.payload.parentToolUseId).toBeUndefined();
  });

  it('converts content_block_start with parentToolUseId', () => {
    const result = toClientMessage(
      s.contentBlockStart(1, 'text', { parentToolUseId: 'toolu_123' }),
    );
    expect(result).toMatchObject({
      name: 'stream:block_start',
      payload: { index: 1, blockType: 'text', parentToolUseId: 'toolu_123' },
    });
  });

  it('converts content_block_start for tool_use block', () => {
    const base = JSON.parse(s.contentBlockStart(2, 'tool_use'));
    base.event.content_block = { type: 'tool_use', id: 'toolu_abc', name: 'Read' };
    const result = toClientMessage(JSON.stringify(base));
    expect(result).toMatchObject({
      name: 'stream:block_start',
      payload: {
        index: 2,
        blockType: 'tool_use',
        contentBlock: { type: 'tool_use', id: 'toolu_abc', name: 'Read' },
      },
    });
  });

  it('converts text_delta to stream:chunk', () => {
    expect(toClientMessage(s.textDelta('hello'))).toMatchObject({
      name: 'stream:chunk',
      payload: { chunk: { kind: 'text', content: 'hello' } },
    });
  });

  it('converts thinking_delta', () => {
    expect(toClientMessage(s.thinkingDelta('hmm'))).toMatchObject({
      name: 'stream:chunk',
      payload: { chunk: { kind: 'thinking', content: 'hmm' } },
    });
  });

  it('passes estimated_tokens from thinking_delta into chunk payload', () => {
    const raw = JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'plan', estimated_tokens: 42 },
      },
      session_id: 'x',
      uuid: 'u',
    });
    expect(toClientMessage(raw)).toMatchObject({
      name: 'stream:chunk',
      payload: { chunk: { kind: 'thinking', content: 'plan', estimatedTokens: 42 } },
    });
  });

  it('omits estimatedTokens when thinking_delta has no estimated_tokens', () => {
    const result = toClientMessage(s.thinkingDelta('hmm'));
    const chunk = (result as { payload: { chunk: Record<string, unknown> } }).payload.chunk;
    expect(chunk.estimatedTokens).toBeUndefined();
  });

  it('converts message_stop to stream:end', () => {
    expect(toClientMessage(s.messageStop())).toMatchObject({ name: 'stream:end', payload: {} });
  });

  it('skips signature_delta', () => {
    expect(toClientMessage(s.signatureDelta('sig'))).toBeNull();
  });

  it('converts message_start to stream:message_start', () => {
    const result = toClientMessage(s.messageStart());
    expect(result).toMatchObject({
      name: 'stream:message_start',
      payload: {
        model: 'claude-opus-4-6',
        usage: { inputTokens: expect.any(Number) },
      },
    });
  });

  it('converts message_delta to stream:message_delta', () => {
    const result = toClientMessage(s.messageDelta({ stopReason: 'tool_use' }));
    expect(result).toMatchObject({
      name: 'stream:message_delta',
      payload: {
        stopReason: 'tool_use',
        usage: { outputTokens: expect.any(Number) },
      },
    });
  });

  it('converts content_block_stop to stream:block_stop', () => {
    const result = toClientMessage(s.contentBlockStop(0));
    expect(result).toMatchObject({
      name: 'stream:block_stop',
      payload: { index: 0 },
    });
  });

  it('converts compaction_delta to stream:compaction', () => {
    const raw = JSON.stringify({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'compaction_delta', content: 'compressed' },
      },
      session_id: 'x',
      uuid: 'u',
    });
    expect(toClientMessage(raw)).toMatchObject({
      name: 'stream:compaction',
      payload: { content: 'compressed' },
    });
  });

  it('content_block_start omits contentBlock when block has only type', () => {
    const base = JSON.parse(s.contentBlockStart(0, 'text'));
    base.event.content_block = { type: 'text' };
    const result = toClientMessage(JSON.stringify(base));
    const msg = expectName(result, 'stream:block_start');
    expect(msg.payload.contentBlock).toBeUndefined();
  });

  it('emits raw:event for unknown stream event type', () => {
    const raw = JSON.stringify({
      type: 'stream_event',
      event: { type: 'some_future_event', data: 42 },
      session_id: 'x',
      uuid: 'u',
    });
    const result = toClientMessage(raw);
    expect(result).toMatchObject({
      name: 'raw:event',
      payload: { rawType: 'unknown_stream_event' },
    });
  });

  it('converts streamlined_text', () => {
    expect(toClientMessage(s.streamlinedText('fast'))).toMatchObject({
      name: 'stream:text',
      payload: { text: 'fast' },
    });
  });

  it('converts streamlined_tool_use_summary', () => {
    expect(toClientMessage(s.streamlinedToolUseSummary('Read 3'))).toMatchObject({
      name: 'stream:tool_summary',
      payload: { toolSummary: 'Read 3' },
    });
  });
});
