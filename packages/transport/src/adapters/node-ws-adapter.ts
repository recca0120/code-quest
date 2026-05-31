import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { AcceptCallback, CreateSocketOptions, RpcSocket, WsAdapter } from '../types.ts';

export function toRpcSocket(ws: WebSocket): RpcSocket {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    onMessage: (fn) =>
      ws.on('message', (raw) => fn(typeof raw === 'string' ? raw : raw.toString())),
    onClose: (fn) => ws.on('close', fn),
    onError: (fn) => ws.on('error', fn),
    ping: () => ws.ping(),
    onPong: (fn) => ws.on('pong', fn),
    get readyState() {
      return ws.readyState;
    },
    get OPEN() {
      return ws.OPEN;
    },
  };
}

export function wsAdapter(): WsAdapter {
  let wss: WebSocketServer | undefined;
  let httpServer: HttpServer | undefined;
  let upgradeHandler: ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | undefined;

  return {
    attach(server, onUpgrade) {
      httpServer = server;
      wss = new WebSocketServer({ noServer: true });
      const localWss = wss;

      upgradeHandler = (req, socket, head) => {
        const accept: AcceptCallback = (onSocket) => {
          localWss.handleUpgrade(req, socket, head, (ws) => {
            onSocket(toRpcSocket(ws));
          });
        };
        onUpgrade(req, socket, head, accept);
      };

      server.on('upgrade', upgradeHandler);
    },

    createSocket(url: string, options?: CreateSocketOptions): Promise<RpcSocket> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url, { headers: options?.headers });
        let settled = false;
        let userErrorHandler: ((err: Error) => void) | undefined;
        // Single error handler prevents unhandled error events from
        // crashing the process (required for bun compatibility).
        ws.on('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
            return;
          }
          userErrorHandler?.(err);
        });
        ws.once('open', () => {
          settled = true;
          const rpc = toRpcSocket(ws);
          resolve({
            ...rpc,
            onError: (fn) => {
              userErrorHandler = fn;
            },
          });
        });
      });
    },

    async close() {
      if (httpServer && upgradeHandler) {
        httpServer.off('upgrade', upgradeHandler);
        upgradeHandler = undefined;
      }
      if (wss) {
        for (const ws of wss.clients) ws.terminate();
        await new Promise<void>((resolve) => wss?.close(() => resolve()));
        wss = undefined;
      }
    },
  };
}
