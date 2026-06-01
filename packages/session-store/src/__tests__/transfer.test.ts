import { describe, expect, it } from 'vitest';
import { MemoryReader } from '../reader/memory-reader.ts';
import { Transfer } from '../transfer.ts';
import type { SessionData } from '../types.ts';
import { MemoryWriter } from '../writer/memory-writer.ts';

function makeSessionData(): SessionData {
  return {
    events: [],
    record: {
      id: 'sess-1',
      channelId: 'ch',
      provider: 'anthropic',
      command: 'claude',
      args: '',
      cwd: '/tmp',
      projectRoot: '/tmp',
      mode: 'auto',
      role: 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

describe('Transfer', () => {
  it('reads from reader and writes to writer with same sessionId', async () => {
    const data = makeSessionData();
    const reader = new MemoryReader(new Map([['sess-1', data]]));
    const writer = new MemoryWriter();

    await new Transfer(reader, writer).run('sess-1');

    expect(writer.data.get('sess-1')).toEqual(data);
  });

  it('propagates reader error', async () => {
    const reader: MemoryReader = new MemoryReader(new Map());
    const writer = new MemoryWriter();
    // MemoryReader returns default for unknown session — simulate error via subclass
    const throwingReader = {
      async read(): Promise<SessionData> {
        throw new Error('read failed');
      },
    };

    await expect(new Transfer(throwingReader, writer).run('sess-1')).rejects.toThrow('read failed');
    expect(writer.data.size).toBe(0);
  });

  it('propagates writer error', async () => {
    const data = makeSessionData();
    const reader = new MemoryReader(new Map([['sess-1', data]]));
    const throwingWriter = {
      async write(): Promise<void> {
        throw new Error('write failed');
      },
    };

    await expect(new Transfer(reader, throwingWriter).run('sess-1')).rejects.toThrow(
      'write failed',
    );
  });
});
