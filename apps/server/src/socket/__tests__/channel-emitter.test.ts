import { ClaudeAdapter, ProcessRunner } from '@code-quest/summoner';
import { createFakeSocket, FakeProcessProvider } from '@code-quest/test-kit';
import { describe, expect, it, vi } from 'vitest';
import { Channel } from '../channel.ts';
import { ChannelEmitter } from '../channel-emitter.ts';

function makeChannel(channelId = 'ch-1'): Channel {
  const runner = new ProcessRunner({
    adapter: new ClaudeAdapter(),
    processProvider: new FakeProcessProvider(),
  });
  return new Channel(runner, channelId, 'claude', '/test/cwd');
}

describe('ChannelEmitter', () => {
  describe('on / dispatch', () => {
    it('dispatches to registered handler by event name', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('message:result', handler);

      const ch = makeChannel();
      emitter.dispatch('message:result', ch, { some: 'data' });

      expect(handler).toHaveBeenCalledWith(ch, { some: 'data' }, undefined, undefined);
    });

    it('does not dispatch unregistered event names', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('message:result', handler);

      emitter.dispatch('session:init', makeChannel(), {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers for the same event', () => {
      const emitter = new ChannelEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('message:result', handler1);
      emitter.on('message:result', handler2);

      const ch = makeChannel();
      emitter.dispatch('message:result', ch, { some: 'data' });

      expect(handler1).toHaveBeenCalledWith(ch, { some: 'data' }, undefined, undefined);
      expect(handler2).toHaveBeenCalledWith(ch, { some: 'data' }, undefined, undefined);
    });
  });

  describe('async handler error safety', () => {
    it('catches errors from async handlers without unhandled rejection', async () => {
      const emitter = new ChannelEmitter();
      const error = new Error('async boom');
      emitter.on('test:event', async () => {
        throw error;
      });

      const ch = makeChannel();
      await emitter.dispatch('test:event', ch, {});

      // setImmediate runs after pending microtasks/rejections are flushed
      await new Promise((r) => setImmediate(r));
    });

    it('calls cb with error response when async handler throws and cb is provided', async () => {
      const emitter = new ChannelEmitter();
      emitter.on('test:event', async () => {
        throw new Error('handler boom');
      });

      const cb = vi.fn();
      const ch = makeChannel();
      emitter.dispatch('test:event', ch, {}, undefined, cb);

      await new Promise((r) => setImmediate(r));

      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'handler boom' });
    });

    it('does not call cb when async handler succeeds', async () => {
      const emitter = new ChannelEmitter();
      emitter.on('test:event', async () => {});

      const cb = vi.fn();
      const ch = makeChannel();
      emitter.dispatch('test:event', ch, {}, undefined, cb);

      await new Promise((r) => setImmediate(r));

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('channel:exit dispatch', () => {
    it('dispatches to all exit handlers', () => {
      const emitter = new ChannelEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('channel:exit', handler1);
      emitter.on('channel:exit', handler2);

      const ch = makeChannel();
      emitter.dispatch('channel:exit', ch, { code: 0 });

      expect(handler1).toHaveBeenCalledWith(ch, { code: 0 }, undefined, undefined);
      expect(handler2).toHaveBeenCalledWith(ch, { code: 0 }, undefined, undefined);
    });
  });

  describe('broadcastAll', () => {
    it('fans out to every tracked socket via per-socket emit', async () => {
      const emitter = new ChannelEmitter();
      const fakeA = createFakeSocket();
      const fakeB = createFakeSocket();
      emitter.addSocketToChannel('ch-1', fakeA.serverSocket);
      emitter.addSocketToChannel('ch-2', fakeB.serverSocket);

      const receivedA = vi.fn();
      const receivedB = vi.fn();
      fakeA.on('system:announcement', receivedA);
      fakeB.on('system:announcement', receivedB);

      emitter.broadcastAll('system:announcement', { msg: 'hello' });
      await Promise.resolve();

      expect(receivedA).toHaveBeenCalledWith({ msg: 'hello' });
      expect(receivedB).toHaveBeenCalledWith({ msg: 'hello' });
    });

    it('does not double-send when a socket joined multiple channels', async () => {
      const emitter = new ChannelEmitter();
      const fake = createFakeSocket();
      emitter.addSocketToChannel('ch-1', fake.serverSocket);
      emitter.addSocketToChannel('ch-2', fake.serverSocket);

      const received = vi.fn();
      fake.on('e', received);

      emitter.broadcastAll('e', { x: 1 });
      await Promise.resolve();

      expect(received).toHaveBeenCalledTimes(1);
      expect(received).toHaveBeenCalledWith({ x: 1 });
    });

    it('is a no-op when no sockets are tracked', () => {
      const emitter = new ChannelEmitter();
      expect(() => emitter.broadcastAll('e', {})).not.toThrow();
    });
  });

  describe('handleConnection', () => {
    it('dispatches handler when channelId is a valid string', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('chat:send', handler);

      const ch = makeChannel('ch-1');
      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, (id) => (id === 'ch-1' ? ch : undefined));

      fake.emit('chat:send', { channelId: 'ch-1', message: 'hello' });

      expect(handler).toHaveBeenCalledWith(
        ch,
        { channelId: 'ch-1', message: 'hello' },
        fake.serverSocket,
        undefined,
      );
    });

    it('does not call resolveChannel when channelId is null', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('chat:send', handler);

      const resolveChannel = vi.fn(() => undefined);
      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, resolveChannel);

      fake.emit('chat:send', { channelId: null, message: 'hello' });

      expect(resolveChannel).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        null,
        { channelId: null, message: 'hello' },
        fake.serverSocket,
        undefined,
      );
    });

    it('does not call resolveChannel when channelId is undefined', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('chat:send', handler);

      const resolveChannel = vi.fn(() => undefined);
      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, resolveChannel);

      fake.emit('chat:send', { channelId: undefined, message: 'hello' });

      expect(resolveChannel).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        null,
        { channelId: undefined, message: 'hello' },
        fake.serverSocket,
        undefined,
      );
    });

    it('does not call resolveChannel when channelId is missing from payload', () => {
      const emitter = new ChannelEmitter();
      const handler = vi.fn();
      emitter.on('chat:send', handler);

      const resolveChannel = vi.fn(() => undefined);
      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, resolveChannel);

      fake.emit('chat:send', { message: 'hello' });

      expect(resolveChannel).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        null,
        { message: 'hello' },
        fake.serverSocket,
        undefined,
      );
    });
  });

  describe('onConnect', () => {
    it('fires callback with the socket when a new connection is handled', () => {
      const emitter = new ChannelEmitter();
      const cb = vi.fn();
      emitter.onConnect(cb);

      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, () => undefined);

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(fake.serverSocket);
    });

    it('fires multiple registered callbacks in order', () => {
      const emitter = new ChannelEmitter();
      const order: number[] = [];
      emitter.onConnect(() => order.push(1));
      emitter.onConnect(() => order.push(2));

      const fake = createFakeSocket();
      emitter.handleConnection(fake.serverSocket, () => undefined);

      expect(order).toEqual([1, 2]);
    });
  });

  describe('reattachSocket / expireSocket (reconnect support)', () => {
    it('reattachSocket re-adds socket to all previously joined channels', async () => {
      const emitter = new ChannelEmitter();
      const fake1 = createFakeSocket();
      emitter.addSocketToChannel('ch-1', fake1.serverSocket);
      emitter.addSocketToChannel('ch-2', fake1.serverSocket);
      emitter.removeSocketFromAll(fake1.serverSocket.id);

      const fake2 = createFakeSocket();
      emitter.reattachSocket(fake2.serverSocket, fake1.serverSocket.id);

      const received = vi.fn();
      fake2.on('ping', received);

      emitter.emit('ch-1', 'ping', {});
      emitter.emit('ch-2', 'ping', {});
      await Promise.resolve();

      expect(received).toHaveBeenCalledTimes(2);
    });

    it('reattachSocket is a no-op when previousSocketId has no stored channels', async () => {
      const emitter = new ChannelEmitter();
      const fake = createFakeSocket();
      expect(() => emitter.reattachSocket(fake.serverSocket, 's-unknown')).not.toThrow();

      const received = vi.fn();
      fake.on('ping', received);
      emitter.emit('ch-1', 'ping', {});
      await Promise.resolve();

      expect(received).not.toHaveBeenCalled();
    });

    it('removeSocketFromAll preserves socketChannels entry for potential reconnect', async () => {
      const emitter = new ChannelEmitter();
      const fake1 = createFakeSocket();
      emitter.addSocketToChannel('ch-1', fake1.serverSocket);
      emitter.removeSocketFromAll(fake1.serverSocket.id);

      const fake2 = createFakeSocket();
      emitter.reattachSocket(fake2.serverSocket, fake1.serverSocket.id);

      const received = vi.fn();
      fake2.on('ping', received);
      emitter.emit('ch-1', 'ping', {});
      await Promise.resolve();

      expect(received).toHaveBeenCalledTimes(1);
    });

    it('expireSocket cleans up socketChannels so reattach no longer works', async () => {
      const emitter = new ChannelEmitter();
      const fake1 = createFakeSocket();
      emitter.addSocketToChannel('ch-1', fake1.serverSocket);
      emitter.removeSocketFromAll(fake1.serverSocket.id);
      emitter.expireSocket(fake1.serverSocket.id);

      const fake2 = createFakeSocket();
      emitter.reattachSocket(fake2.serverSocket, fake1.serverSocket.id);

      const received = vi.fn();
      fake2.on('ping', received);
      emitter.emit('ch-1', 'ping', {});
      await Promise.resolve();

      expect(received).not.toHaveBeenCalled();
    });
  });
});
