import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type Middleware, RpcChannel, WsTransport, wsAdapter } from '@code-quest/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WebSocket, WebSocketServer } from 'ws';

function wrapWsForRpc(ws: WebSocket) {
  return {
    send: (data: string) => ws.send(data),
    onMessage: (fn: (data: string) => void) =>
      ws.on('message', (raw: Buffer) => fn(raw.toString())),
    onClose: (fn: () => void) => ws.on('close', fn),
  };
}

describe('WsTransport.connect() client mode', () => {
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

  it('connects and returns an RpcChannel that can request/respond', async () => {
    wss.on('connection', (ws) => {
      const serverRpc = new RpcChannel(wrapWsForRpc(ws));
      serverRpc.onRequest('echo', async (data) => data);
    });

    const transport = new WsTransport(wsAdapter());
    const { rpc, close } = await transport.connect(url(), []);

    const result = await rpc.request('echo', { msg: 'hi' });
    expect(result).toEqual({ msg: 'hi' });

    close();
  });

  it('runs middleware in onion order', async () => {
    wss.on('connection', () => {});

    const order: string[] = [];

    const mw: Middleware = async (_context, next) => {
      order.push('before');
      await next();
      order.push('after');
    };

    const transport = new WsTransport(wsAdapter());
    const { close } = await transport.connect(url(), [mw]);

    expect(order).toEqual(['before', 'after']);
    close();
  });

  it('middleware can set headers via context', async () => {
    let receivedAuth: string | undefined;
    wss.on('connection', (_ws, req) => {
      receivedAuth = req.headers.authorization;
    });

    const tokenMiddleware: Middleware = async (context, next) => {
      context.headers = {
        ...(context.headers as Record<string, string>),
        Authorization: 'Bearer secret',
      };
      await next();
    };

    const transport = new WsTransport(wsAdapter());
    const { close } = await transport.connect(url(), [tokenMiddleware]);

    await vi.waitFor(() => expect(receivedAuth).toBe('Bearer secret'));
    close();
  });

  it('not calling next() in middleware rejects the connection', async () => {
    const rejectMiddleware: Middleware = async () => {
      // don't call next
    };

    const transport = new WsTransport(wsAdapter());
    await expect(transport.connect(url(), [rejectMiddleware])).rejects.toThrow('rejected');
  });

  it('middleware can access context.socket after connect', async () => {
    wss.on('connection', () => {});

    let socketAvailable = false;
    const checkSocket: Middleware = async (context, next) => {
      await next();
      socketAvailable = context.socket !== undefined;
    };

    const transport = new WsTransport(wsAdapter());
    const { close } = await transport.connect(url(), [checkSocket]);

    expect(socketAvailable).toBe(true);
    close();
  });
});
