import { describe, expect, it, vi } from 'vitest';
import { Transfer } from '../transfer.ts';
import type { SessionData, SessionReader, SessionWriter } from '../types.ts';

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
    const reader: SessionReader = { read: vi.fn(async () => data) };
    const writer: SessionWriter = { write: vi.fn(async () => {}) };

    await new Transfer(reader, writer).run('sess-1');

    expect(reader.read).toHaveBeenCalledWith('sess-1');
    expect(writer.write).toHaveBeenCalledWith('sess-1', data);
  });

  it('propagates reader error', async () => {
    const reader: SessionReader = {
      read: vi.fn(async () => {
        throw new Error('read failed');
      }),
    };
    const writer: SessionWriter = { write: vi.fn(async () => {}) };

    await expect(new Transfer(reader, writer).run('sess-1')).rejects.toThrow('read failed');
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('propagates writer error', async () => {
    const reader: SessionReader = { read: vi.fn(async () => makeSessionData()) };
    const writer: SessionWriter = {
      write: vi.fn(async () => {
        throw new Error('write failed');
      }),
    };

    await expect(new Transfer(reader, writer).run('sess-1')).rejects.toThrow('write failed');
  });
});
