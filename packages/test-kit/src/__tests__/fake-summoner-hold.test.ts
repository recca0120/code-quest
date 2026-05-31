import {
  createFakeSocket,
  FakeFilesystem,
  FakeProcessProvider,
  FakeSummoner,
} from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';

function createTestSummoner() {
  const socket = createFakeSocket();
  const provider = new FakeProcessProvider();
  const server = {
    connect: () => ({
      socket,
      provider,
      filesystem: new FakeFilesystem(),
    }),
  };
  return new FakeSummoner(server);
}

describe('FakeSummoner.holdEmit', () => {
  it('holds the callback and release fires it', () => {
    const summoner = createTestSummoner();
    const results: string[] = [];

    summoner.socket.serverSocket.on('test:ping', (payload: unknown, cb: unknown) => {
      if (typeof cb === 'function') cb({ ok: true, data: payload });
    });

    const held = summoner.holdEmit('test:ping');

    summoner.socket.emit('test:ping', { msg: 'hello' }, (ack: unknown) => {
      results.push(JSON.stringify(ack));
    });

    expect(results).toEqual([]);

    held.release();

    expect(results).toEqual([JSON.stringify({ ok: true, data: { msg: 'hello' } })]);
  });

  it('only holds the first matching emit, subsequent emits pass through', () => {
    const summoner = createTestSummoner();
    const results: string[] = [];

    summoner.socket.serverSocket.on('test:ping', (_: unknown, cb: unknown) => {
      if (typeof cb === 'function') cb('ack');
    });

    const held = summoner.holdEmit('test:ping');

    summoner.socket.emit('test:ping', {}, (ack: unknown) => results.push(`first:${ack}`));
    summoner.socket.emit('test:ping', {}, (ack: unknown) => results.push(`second:${ack}`));

    expect(results).toEqual(['second:ack']);

    held.release();

    expect(results).toEqual(['second:ack', 'first:ack']);
  });

  it('does not affect other events', () => {
    const summoner = createTestSummoner();
    const results: string[] = [];

    summoner.socket.serverSocket.on('test:ping', (_: unknown, cb: unknown) => {
      if (typeof cb === 'function') cb('ping-ack');
    });
    summoner.socket.serverSocket.on('test:other', (_: unknown, cb: unknown) => {
      if (typeof cb === 'function') cb('other-ack');
    });

    summoner.holdEmit('test:ping');

    summoner.socket.emit('test:other', {}, (ack: unknown) => results.push(`other:${ack}`));
    summoner.socket.emit('test:ping', {}, (ack: unknown) => results.push(`ping:${ack}`));

    expect(results).toEqual(['other:other-ack']);
  });
});
