import { randomUUID } from 'node:crypto';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { SocketCallback, TransportHandle, TypedSocket } from '@code-quest/schemas';
import { type Logger, NOOP_LOGGER } from '@code-quest/utils';
import { type Envelope, PONG_JSON, parseEnvelope } from './envelope.ts';
import { Pipeline } from './pipeline.ts';
import { RESUME_EVENT, RpcChannel } from './rpc-channel.ts';
import type { AcceptCallback, RpcSocket, WsAdapter } from './types.ts';

export interface ConnectionContext {
  req?: IncomingMessage;
  socket?: RpcSocket;
  headers?: Record<string, string>;
  terminate?(): Promise<void>;
  transformSocket?(typed: TypedSocket): TypedSocket;
  [key: string]: unknown;
}

export type Middleware = (
  context: ConnectionContext,
  next: () => Promise<void>,
) => void | Promise<void>;

export type ConnectionHandler = (socket: TypedSocket, context: ConnectionContext) => void;

interface Route {
  path: string;
  middleware: Middleware[];
  handler: ConnectionHandler;
}

interface SocketMeta {
  nextSeq: number;
  listeners: Map<string, Set<(...args: unknown[]) => void>>;
}

export class WsTransport {
  private readonly adapter: WsAdapter;
  private readonly logger: Logger;
  private readonly routes: Route[] = [];
  private readonly connectionListeners = new Set<(socket: TypedSocket) => void>();
  private readonly meta = new WeakMap<RpcSocket, SocketMeta>();

  constructor(adapter: WsAdapter, logger?: Logger) {
    this.adapter = adapter;
    this.logger = logger ?? NOOP_LOGGER;
  }

  route(path: string, middleware: Middleware[], handler: ConnectionHandler): this {
    this.routes.push({ path, middleware, handler });
    return this;
  }

  async connect(
    url: string,
    middleware: Middleware[],
  ): Promise<{ rpc: RpcChannel; close: () => void }> {
    const context: ConnectionContext = { headers: {} };

    const pipeline = new Pipeline(middleware);
    await pipeline.run(
      context,
      async () => {
        const rpcSocket = await this.adapter.createSocket(url, { headers: context.headers });
        context.socket = rpcSocket;
      },
      () =>
        new Promise<void>((resolve) => {
          if (!context.socket) {
            resolve();
            return;
          }
          context.socket.onClose(() => resolve());
        }),
    );

    if (!context.socket) {
      throw new Error('Connection rejected by middleware');
    }

    const rpc = new RpcChannel(context.socket);

    const close = () => {
      context.socket?.close();
    };

    return { rpc, close };
  }

  attach(httpServer: HttpServer): TransportHandle {
    this.adapter.attach(httpServer, (req, rawSocket, _head, accept) => {
      const path = req.url?.split('?')[0];
      const route = this.routes.find((r) => r.path === path);
      if (!route) return;
      this.runMiddleware(req, rawSocket, route, accept);
    });

    return {
      onConnection: (cb: (socket: TypedSocket) => void) => {
        this.connectionListeners.add(cb);
        return () => this.connectionListeners.delete(cb);
      },
      close: () => this.adapter.close(),
    };
  }

  private runMiddleware(
    req: IncomingMessage,
    rawSocket: Duplex,
    route: Route,
    accept: AcceptCallback,
  ): void {
    const context: ConnectionContext = { req };
    let accepted = false;

    const pipeline = new Pipeline(route.middleware);
    const core = (): Promise<void> =>
      new Promise<void>((resolve) => {
        accepted = true;
        accept((rpcSocket) => {
          context.socket = rpcSocket;
          this.acceptConnection(rpcSocket, context, route);
          resolve();
        });
      });

    const terminateFactory = () =>
      new Promise<void>((resolve) => {
        if (!context.socket) {
          resolve();
          return;
        }
        context.socket.onClose(() => resolve());
      });

    pipeline.run(context, core, terminateFactory).then(
      () => {
        if (!accepted) {
          rawSocket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          rawSocket.destroy();
        }
      },
      (err) => {
        this.logger.warn('middleware pipeline error', err);
        rawSocket.destroy();
      },
    );
  }

  private acceptConnection(rpcSocket: RpcSocket, context: ConnectionContext, route: Route): void {
    const meta: SocketMeta = {
      nextSeq: 0,
      listeners: new Map(),
    };
    this.meta.set(rpcSocket, meta);

    const id = randomUUID();
    let typed = this.makeTypedSocket(rpcSocket, id, meta);
    if (context.transformSocket) typed = context.transformSocket(typed);

    this.setupSocketListeners(rpcSocket, meta);

    try {
      route.handler(typed, context);
    } catch (err) {
      this.logger.warn('onConnection handler threw', err);
    }

    for (const cb of this.connectionListeners) {
      try {
        cb(typed);
      } catch (err) {
        this.logger.warn('onConnection listener threw', err);
      }
    }
  }

  private makeTypedSocket(rpcSocket: RpcSocket, id: string, meta: SocketMeta): TypedSocket {
    return {
      id,
      emit: (event: string, ...args: unknown[]) => {
        if (rpcSocket.readyState !== rpcSocket.OPEN) return;
        const seq = ++meta.nextSeq;
        const env: Envelope = { kind: 'event', seq, event, data: args[0] };
        rpcSocket.send(JSON.stringify(env));
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        let set = meta.listeners.get(event);
        if (!set) {
          set = new Set();
          meta.listeners.set(event, set);
        }
        set.add(listener);
      },
    };
  }

  private setupSocketListeners(rpcSocket: RpcSocket, meta: SocketMeta): void {
    rpcSocket.onMessage((raw) => {
      this.handleMessage(rpcSocket, raw, meta);
    });
    rpcSocket.onClose(() => {
      this.fireLocalEvent(meta, 'disconnect');
      this.meta.delete(rpcSocket);
    });
    rpcSocket.onError((err) => {
      this.logger.warn('ws socket error', err);
    });
  }

  private handleMessage(rpcSocket: RpcSocket, raw: string, meta: SocketMeta): void {
    const env = parseEnvelope(raw);
    if (!env) return;

    switch (env.kind) {
      case 'ping':
        if (rpcSocket.readyState === rpcSocket.OPEN) rpcSocket.send(PONG_JSON);
        return;
      case 'pong':
        return;
      case 'resume':
        this.fireLocalEvent(meta, RESUME_EVENT, { lastSeq: env.lastSeq });
        return;
      case 'event':
        this.fireLocalEvent(meta, env.event, env.data);
        return;
      case 'request': {
        const cb: SocketCallback = (cbResult) => {
          if (rpcSocket.readyState !== rpcSocket.OPEN) return;
          const response: Envelope = { kind: 'response', id: env.id, ok: true, data: cbResult };
          rpcSocket.send(JSON.stringify(response));
        };
        this.fireLocalEvent(meta, env.event, env.data, cb);
        return;
      }
      case 'response':
        return;
    }
  }

  private fireLocalEvent(
    meta: SocketMeta,
    event: string,
    payload?: unknown,
    cb?: SocketCallback,
  ): void {
    const set = meta.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        if (cb) fn(payload, cb);
        else if (payload !== undefined) fn(payload);
        else fn();
      } catch (err) {
        this.logger.warn('ws listener threw', event, err);
      }
    }
  }
}
