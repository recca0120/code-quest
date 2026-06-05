import type { Envelope } from '@code-quest/transport/browser';
import { WsClient } from '@code-quest/transport/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockWebSocket } from '@/test/mock-websocket';

/**
 * Unit tests for WsClient — drives a synthetic MockWebSocket so the focus
 * stays on protocol behaviour (reconnect, outbox, request-response, resume).
 * End-to-end tests against the real ws server live in
 * apps/server/src/socket/__tests__/ws-transport.test.ts and a future
 * Group 10 integration drill.
 */
describe('WsClient', () => {
  let originalWS: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWS = globalThis.WebSocket;
    MockWebSocket.reset();
    globalThis.WebSocket = MockWebSocket as unknown as typeof globalThis.WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWS;
    vi.useRealTimers();
  });

  function makeClient() {
    return new WsClient('ws://x/ws');
  }

  describe('connect + emit', () => {
    it('opens a WebSocket on connect()', () => {
      const c = makeClient();
      c.connect();
      expect(MockWebSocket.last()).toBeDefined();
      expect(MockWebSocket.last()?.url).toBe('ws://x/ws');
    });

    it('connect() is idempotent while a socket is alive (no orphan WebSocket)', () => {
      const c = makeClient();
      c.connect();
      const first = MockWebSocket.last()!;

      c.connect();

      expect(MockWebSocket.created()).toBe(1);
      expect(MockWebSocket.last()).toBe(first);
    });

    it('connect() reopens after disconnect()', () => {
      const c = makeClient();
      c.connect();
      MockWebSocket.last()!.acceptOpen();
      c.disconnect();
      MockWebSocket.last()!.acceptClose(1000);

      c.connect();

      expect(MockWebSocket.created()).toBe(2);
    });

    it('emit() sends an event envelope after open', () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      c.emit('chat:send', { text: 'hi' });

      const env = ws.lastSentEnvelope() as Envelope;
      expect(env).toMatchObject({ kind: 'event', event: 'chat:send', data: { text: 'hi' } });
    });
  });

  describe('on / off', () => {
    it('on(event, fn) fires when matching event envelope arrives', () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      const fn = vi.fn();
      c.on('hello', fn);
      ws.deliverEnvelope({ kind: 'event', seq: 1, event: 'hello', data: { x: 1 } });

      expect(fn).toHaveBeenCalledWith({ x: 1 });
    });

    it('off(event, fn) stops further fires', () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();
      const fn = vi.fn();
      c.on('hello', fn);
      c.off('hello', fn);

      ws.deliverEnvelope({ kind: 'event', seq: 1, event: 'hello', data: {} });

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('request / response', () => {
    it('request resolves with data when matching response arrives', async () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      const p = c.request('echo', { x: 1 });
      const sent = ws.lastSentEnvelope() as Envelope;
      expect(sent).toMatchObject({ kind: 'request', event: 'echo', data: { x: 1 } });
      const reqId = (sent as { id: string }).id;

      ws.deliverEnvelope({ kind: 'response', id: reqId, ok: true, data: { y: 2 } });

      await expect(p).resolves.toEqual({ y: 2 });
    });

    it('request rejects when ok=false', async () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();
      const p = c.request('boom', {});
      const sent = ws.lastSentEnvelope() as Envelope;
      const reqId = (sent as { id: string }).id;

      ws.deliverEnvelope({ kind: 'response', id: reqId, ok: false, error: 'oops' });

      await expect(p).rejects.toThrow('oops');
    });

    it('disconnect() rejects all pending requests so callers stop hanging', async () => {
      const c = makeClient();
      c.connect();
      MockWebSocket.last()!.acceptOpen();

      const p1 = c.request('a', {});
      const p2 = c.request('b', {});
      c.disconnect();

      await expect(p1).rejects.toThrow(/disconnect/);
      await expect(p2).rejects.toThrow(/disconnect/);
    });
  });

  describe('outbox / reconnect', () => {
    it('emits while disconnected are queued and flushed after open', () => {
      const c = makeClient();
      c.emit('chat:send', { text: 'queued1' });
      c.emit('chat:send', { text: 'queued2' });
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      const sent = ws.allSentEnvelopes();
      const events = sent.filter((e) => (e as { kind: string }).kind === 'event');
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ data: { text: 'queued1' } });
      expect(events[1]).toMatchObject({ data: { text: 'queued2' } });
    });

    it('on open, sends a resume envelope with current lastSeq', () => {
      vi.useFakeTimers();
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();
      ws.deliverEnvelope({ kind: 'event', seq: 5, event: 'x', data: {} });
      ws.acceptClose(1006);

      vi.advanceTimersByTime(2000);
      const ws2 = MockWebSocket.last()!;
      expect(ws2).not.toBe(ws);
      ws2.acceptOpen();

      const first = ws2.allSentEnvelopes()[0];
      expect(first).toEqual({ kind: 'resume', lastSeq: 5 });
    });

    it('on close fires reconnect attempts with exponential backoff', () => {
      vi.useFakeTimers();
      // Pin jitter to its midpoint so the schedule is deterministic.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();
      ws.acceptClose(1006);

      // First retry at ~500ms
      vi.advanceTimersByTime(600);
      expect(MockWebSocket.created()).toBe(2);

      // Second close → ~1000ms
      MockWebSocket.last()!.acceptClose(1006);
      vi.advanceTimersByTime(1100);
      expect(MockWebSocket.created()).toBe(3);
    });

    it('visibilitychange to visible cancels pending backoff and retries within 50 ms', () => {
      vi.useFakeTimers();
      const c = makeClient();
      c.connect();
      MockWebSocket.last()!.acceptOpen();
      MockWebSocket.last()!.acceptClose(1006);

      // In backoff: 500ms not yet elapsed.
      vi.advanceTimersByTime(100);
      expect(MockWebSocket.created()).toBe(1);

      // Tab becomes visible → immediate reconnect, ignoring remaining backoff.
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      vi.advanceTimersByTime(50);
      expect(MockWebSocket.created()).toBe(2);
    });
  });

  describe('invalid messages', () => {
    it('logs a warning when a non-JSON message is received', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      ws.deliverRaw('not-valid-json');

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('onRequest (server-initiated RPC)', () => {
    it('sends response on same socket that received the request', async () => {
      const c = makeClient();
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();

      c.onRequest('ping', async () => ({ pong: true }));
      ws.deliverEnvelope({ kind: 'request', id: 'r1', event: 'ping', data: {} });
      await Promise.resolve();

      const reply = ws
        .allSentEnvelopes()
        .find(
          (e) => (e as { kind: string }).kind === 'response' && (e as { id: string }).id === 'r1',
        );
      expect(reply).toMatchObject({ kind: 'response', id: 'r1', ok: true, data: { pong: true } });
    });

    it('does not send response on new socket when connection changed during handler', async () => {
      vi.useFakeTimers();
      const c = makeClient();
      c.connect();
      const ws1 = MockWebSocket.last()!;
      ws1.acceptOpen();

      let resolve!: () => void;
      c.onRequest(
        'slow',
        () =>
          new Promise<unknown>((r) => {
            resolve = () => r({ done: true });
          }),
      );

      ws1.deliverEnvelope({ kind: 'request', id: 'r2', event: 'slow', data: {} });

      // Simulate disconnect + reconnect before handler finishes
      ws1.acceptClose(1006);
      vi.advanceTimersByTime(600);
      const ws2 = MockWebSocket.last()!;
      expect(ws2).not.toBe(ws1);
      ws2.acceptOpen();

      // Handler finishes now — should NOT send response on ws2 (wrong connection)
      resolve();
      await Promise.resolve();
      await Promise.resolve();

      const ws2Responses = ws2
        .allSentEnvelopes()
        .filter(
          (e) => (e as { kind: string }).kind === 'response' && (e as { id?: string }).id === 'r2',
        );
      expect(ws2Responses).toHaveLength(0);
    });
  });

  describe('ping', () => {
    it('client sends a ping envelope after heartbeat interval of idle', () => {
      vi.useFakeTimers();
      const c = new WsClient('ws://x/ws', { pingIntervalMs: 1000 });
      c.connect();
      const ws = MockWebSocket.last()!;
      ws.acceptOpen();
      ws.clearSent();

      vi.advanceTimersByTime(1100);

      const sent = ws.allSentEnvelopes();
      expect(sent.some((e) => (e as { kind: string }).kind === 'ping')).toBe(true);
    });
  });
});
