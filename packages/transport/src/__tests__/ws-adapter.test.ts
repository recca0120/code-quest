import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { wsAdapter } from '../adapters/node-ws-adapter.ts';

describe('wsAdapter — createSocket', () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;

  beforeEach(async () => {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
    await new Promise<void>((r) => httpServer.listen(0, r));
  });

  afterEach(async () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    httpServer.closeAllConnections();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });

  function url(): string {
    const { port } = httpServer.address() as AddressInfo;
    return `ws://127.0.0.1:${port}`;
  }

  it('resolves with RpcSocket on successful connection', async () => {
    const adapter = wsAdapter();
    const socket = await adapter.createSocket(url());
    expect(socket.readyState).toBe(socket.OPEN);
    socket.close();
  });

  it('rejects when server is unreachable', async () => {
    const adapter = wsAdapter();
    await expect(adapter.createSocket('ws://127.0.0.1:1')).rejects.toThrow();
  });

  it('does not crash on post-connect server-initiated close', async () => {
    wss.on('connection', (ws) => {
      ws.terminate();
    });

    const adapter = wsAdapter();
    const socket = await adapter.createSocket(url());

    const closed = vi.fn();
    socket.onClose(closed);
    await vi.waitFor(() => expect(closed).toHaveBeenCalled());
  });

  it('post-connect error does not reject the already-resolved promise', async () => {
    let serverWs: import('ws').WebSocket | undefined;
    wss.on('connection', (ws) => {
      serverWs = ws;
    });

    const adapter = wsAdapter();
    const socket = await adapter.createSocket(url());

    const errorHandler = vi.fn();
    socket.onError(errorHandler);

    serverWs!.terminate();

    const closed = vi.fn();
    socket.onClose(closed);
    await vi.waitFor(() => expect(closed).toHaveBeenCalled());

    // The post-connect error must not propagate to the initial connect promise;
    // any error surfaced through onError is handled by the caller's error handler,
    // not as an unhandled rejection from connect().
    expect(errorHandler).not.toHaveBeenCalled();
  });
});
