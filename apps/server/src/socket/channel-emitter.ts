import { ERROR_CODES, EVENTS, type SocketCallback, type TypedSocket } from '@code-quest/schemas';
import { errMsg, isRecord } from '@code-quest/utils';
import { logger } from '../logger.ts';
import type { Channel } from './channel.ts';

export const BROADCAST_CHANNEL_ID = '' as const;

function extractPayloadAndCb(args: unknown[]): { payload: unknown; cb?: SocketCallback } {
  const lastArg = args[args.length - 1];
  const hasCb = typeof lastArg === 'function';
  const cb = hasCb ? (lastArg as SocketCallback) : undefined;
  if (hasCb && args.length > 1) return { payload: args[0], cb };
  if (hasCb) return { payload: {}, cb };
  return { payload: args[0] ?? {} };
}

/** Unified handler signature for all events (runner + client). */
export type EmitterHandler = (
  ch: Channel | null,
  payload: unknown,
  socket?: TypedSocket,
  cb?: SocketCallback,
) => void | Promise<void>;

/** Middleware: skip if no channel. */
export function withChannel(
  handler: (ch: Channel, payload: unknown, socket?: TypedSocket, cb?: SocketCallback) => void,
): EmitterHandler {
  return (ch, payload, socket, cb) => {
    if (!ch) return;
    return handler(ch, payload, socket, cb);
  };
}

/** Middleware: if no channel, callback with error instead of skip. */
export function withError(handler: EmitterHandler): EmitterHandler {
  return (ch, payload, socket, cb) => {
    if (!ch) {
      cb?.({ ok: false, error: 'Session not found', code: ERROR_CODES.SESSION_NOT_FOUND });
      return;
    }
    return handler(ch, payload, socket, cb);
  };
}

/** Middleware: require both channel and socket. */
export function withSocket(
  handler: (ch: Channel, socket: TypedSocket, payload: unknown, cb?: SocketCallback) => void,
): EmitterHandler {
  return (ch, payload, socket, cb) => {
    if (!ch || !socket) return;
    return handler(ch, socket, payload, cb);
  };
}

export class ChannelEmitter {
  private eventMap = new Map<string, EmitterHandler[]>();

  // ── Socket tracking ──
  private channelSockets = new Map<string, Set<TypedSocket>>();
  private socketChannels = new Map<string, Set<string>>();
  private socketRefs = new Map<string, TypedSocket>();
  private readonly connectionCallbacks: Array<(socket: TypedSocket) => void> = [];

  // ── Subscribe ──

  on(name: string, handler: EmitterHandler): void {
    const handlers = this.eventMap.get(name) ?? [];
    handlers.push(handler);
    this.eventMap.set(name, handlers);
  }

  /** Register a callback that fires once per new socket connection. */
  onConnect(cb: (socket: TypedSocket) => void): void {
    this.connectionCallbacks.push(cb);
  }

  // ── Dispatch ──

  /** Dispatch event to all subscribers. Async handler errors are caught and logged. */
  dispatch(
    event: string,
    ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    cb?: SocketCallback,
  ): Promise<void> | void {
    const handlers = this.eventMap.get(event);
    if (!handlers) return;
    const promises: Promise<void>[] = [];
    for (const h of handlers) {
      const result = h(ch, payload, socket, cb);
      if (result instanceof Promise) {
        promises.push(
          result.catch((err) => {
            logger.error({ err, event }, 'Unhandled error in async handler');
            cb?.({ ok: false, error: errMsg(err) });
          }),
        );
      }
    }
    if (promises.length > 0) {
      return Promise.all(promises).then(() => {});
    }
  }

  /**
   * Dispatch a runner client_message.
   * Auto-broadcasts to channel sockets (except session:init).
   */
  dispatchRunnerMessage(ch: Channel, event: string, payload: unknown): void {
    if (event !== EVENTS.session.init) {
      const data: Record<string, unknown> = isRecord(payload) ? payload : {};
      this.emit(ch.channelId, event, { channelId: ch.channelId, ...data });
    }
    this.dispatch(event, ch, payload);
  }

  // ── Emit (broadcast to sockets) ──

  emit(channelId: string, event: string, ...args: unknown[]): void {
    const sockets = this.channelSockets.get(channelId);
    if (!sockets) return;
    for (const sock of sockets) {
      sock.emit(event, ...args);
    }
  }

  emitToOthers(
    channelId: string,
    excludeSocketId: string,
    event: string,
    ...args: unknown[]
  ): void {
    const sockets = this.channelSockets.get(channelId);
    if (!sockets) return;
    for (const sock of sockets) {
      if (sock.id !== excludeSocketId) {
        sock.emit(event, ...args);
      }
    }
  }

  // ── Socket tracking ──

  addSocketToChannel(channelId: string, socket: TypedSocket): void {
    let sockets = this.channelSockets.get(channelId);
    if (!sockets) {
      sockets = new Set();
      this.channelSockets.set(channelId, sockets);
    }
    sockets.add(socket);
    this.socketRefs.set(socket.id, socket);

    let channelIds = this.socketChannels.get(socket.id);
    if (!channelIds) {
      channelIds = new Set();
      this.socketChannels.set(socket.id, channelIds);
    }
    channelIds.add(channelId);
  }

  removeSocketFromAll(socketId: string): Set<string> | undefined {
    const channelIds = this.socketChannels.get(socketId);
    const socket = this.socketRefs.get(socketId);
    if (channelIds && socket) {
      for (const channelId of channelIds) {
        this.channelSockets.get(channelId)?.delete(socket);
      }
    }

    // Keep socketChannels entry so reattachSocket can restore channels on reconnect.
    // expireSocket() removes it when the TTL truly expires.
    this.socketRefs.delete(socketId);
    return channelIds;
  }

  reattachSocket(newSocket: TypedSocket, previousSocketId: string): void {
    const channelIds = this.socketChannels.get(previousSocketId);
    if (!channelIds) return;
    this.socketChannels.delete(previousSocketId);
    for (const channelId of channelIds) {
      this.addSocketToChannel(channelId, newSocket);
    }
  }

  expireSocket(socketId: string): void {
    this.socketChannels.delete(socketId);
  }

  getSocketCount(channelId: string): number {
    return this.channelSockets.get(channelId)?.size ?? 0;
  }

  // ── Connection handling ──

  handleConnection(
    socket: TypedSocket,
    resolveChannel: (channelId: string) => Channel | undefined,
  ): void {
    // Register the socket in the global ref map so broadcastAll reaches every
    // connected peer — even ones that have not (yet) joined a channel.
    this.socketRefs.set(socket.id, socket);
    for (const cb of this.connectionCallbacks) cb(socket);

    // Wire client socket events for emitter.on subscribers only.
    // NOTE: handlers must be registered (emitter.on) before connections are accepted.
    for (const event of this.eventMap.keys()) {
      socket.on(event, (...args: unknown[]) => {
        const { payload, cb } = extractPayloadAndCb(args);
        const channelId =
          isRecord(payload) && typeof payload.channelId === 'string' && payload.channelId
            ? payload.channelId
            : undefined;
        const ch = channelId ? (resolveChannel(channelId) ?? null) : null;
        return this.dispatch(event, ch, payload, socket, cb);
      });
    }

    socket.on('disconnect', () => {
      this.removeSocketFromAll(socket.id);
    });
  }

  // ── Global broadcast ──

  /**
   * Fan out an event to every tracked socket.
   *
   * Iterates `socketRefs` (the unique-by-id registry) so each connection
   * receives the message exactly once even if it joined multiple channels.
   * Transport-agnostic: works across any combination of attached transports
   * (socket.io, ws, future) since they all produce TypedSockets.
   */
  broadcastAll(event: string, ...args: unknown[]): void {
    for (const sock of this.socketRefs.values()) {
      sock.emit(event, ...args);
    }
  }
}
