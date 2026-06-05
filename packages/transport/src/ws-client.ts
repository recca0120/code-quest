import type { AgentTransport } from '@code-quest/schemas';
import { type Envelope, EnvelopeSchema } from './envelope.ts';

interface WsClientOptions {
  /** First reconnect delay in ms (doubles on each successive failure). Default 500. */
  initialBackoffMs?: number;
  /** Cap for backoff. Default 10_000. */
  maxBackoffMs?: number;
  /** Idle ping interval in ms. Default 25_000. */
  pingIntervalMs?: number;
  /** Outbox cap; oldest message dropped on overflow. Default 100. */
  outboxLimit?: number;
  /** Extra HTTP headers sent on each (re)connect — Node.js native WebSocket only. */
  headers?: Record<string, string>;
}

type EventListener = (data: unknown) => void;
type RequestHandler = (data: unknown) => Promise<unknown>;

interface LifecycleListener {
  onOpen(id: string): void;
  onClose(): void;
}

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

type QueuedEnvelope =
  | { kind: 'event'; event: string; data: unknown }
  | { kind: 'request'; id: string; event: string; data: unknown };

/**
 * WsClient — shared raw WebSocket client (browser and Node.js) speaking the
 * project envelope protocol. Provides connect/disconnect/on/off/emit/request
 * plus onRequest for server-initiated RPC calls.
 *
 * Resilience:
 *   - Outbox queues outgoing envelopes while disconnected, flushes on OPEN.
 *   - Exponential backoff reconnect (500 → 1000 → 2000 → … cap 10s) with jitter.
 *   - Resume envelope sent on each successful (re)open, carrying the highest
 *     received seq so the server (above-transport ResumableSocket) can replay.
 *   - Idle ping every pingIntervalMs to keep proxies from idle-killing.
 */
export class WsClient implements AgentTransport {
  private ws?: WebSocket;
  private outbox: QueuedEnvelope[] = [];
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventListener>>();
  private requestHandlers = new Map<string, RequestHandler>();
  private lastSeq = 0;
  private backoffMs: number;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private explicitlyClosed = false;
  private lifecycle?: LifecycleListener;
  private visibilityHandler?: () => void;
  private readonly opts: Required<Omit<WsClientOptions, 'headers'>> & {
    headers?: Record<string, string>;
  };
  private readonly url: string;

  constructor(url: string, opts: WsClientOptions = {}) {
    this.url = url;
    this.opts = {
      initialBackoffMs: opts.initialBackoffMs ?? 500,
      maxBackoffMs: opts.maxBackoffMs ?? 10_000,
      pingIntervalMs: opts.pingIntervalMs ?? 25_000,
      outboxLimit: opts.outboxLimit ?? 100,
      headers: opts.headers,
    };
    this.backoffMs = this.opts.initialBackoffMs;
    this.bindVisibilityChange();
  }

  connect(): void {
    // Idempotent while a socket is alive. Without this guard, a second
    // connect() would orphan the first WebSocket — its onopen would still
    // fire and write to the stale `this.ws` reference, racing with the new one.
    if (this.ws && this.ws.readyState !== this.ws.CLOSED) return;
    this.explicitlyClosed = false;
    this.openSocket();
  }

  disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.visibilityHandler) {
      doc()?.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    if (this.ws && this.ws.readyState !== this.ws.CLOSED) this.ws.close(1000);
    this.ws = undefined;
    for (const p of this.pending.values()) p.reject(new Error('disconnected'));
    this.pending.clear();
  }

  emit(event: string, data: unknown): void {
    const env: QueuedEnvelope = { kind: 'event', event, data };
    if (this.isOpen()) this.sendNow(this.toEnvelope(env));
    else this.enqueue(env);
  }

  request<T = unknown>(event: string, data: unknown): Promise<T> {
    const id = randomId();
    const queued: QueuedEnvelope = { kind: 'request', id, event, data };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (d: unknown) => void,
        reject,
      });
      if (this.isOpen()) this.sendNow(this.toEnvelope(queued));
      else this.enqueue(queued);
    });
  }

  on(event: string, fn: EventListener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  off(event: string, fn: EventListener): void {
    this.listeners.get(event)?.delete(fn);
  }

  onRequest(event: string, handler: RequestHandler): () => void {
    this.requestHandlers.set(event, handler);
    return () => this.requestHandlers.delete(event);
  }

  /**
   * Subscribe to connection lifecycle. The adapter uses this to surface
   * 'connect' / 'connect_error' events to the socket.io-shaped consumer code.
   */
  setLifecycleListener(listener: LifecycleListener): void {
    this.lifecycle = listener;
  }

  /**
   * Test-only: simulate network-level connection drop. Does NOT set
   * explicitlyClosed, so the reconnect logic kicks in and a fresh WebSocket
   * is created via the configured backoff.
   */
  forceCloseUnderlying(): void {
    if (!this.ws) return;
    if ('terminate' in this.ws && typeof this.ws.terminate === 'function') this.ws.terminate();
    else this.ws.close(4001, 'forced');
  }

  // ── Internals ──

  private async handleIncomingRequest(id: string, event: string, data: unknown): Promise<void> {
    const ws = this.ws;
    if (!this.isOpen()) return;
    const handler = this.requestHandlers.get(event);
    if (!handler) {
      this.sendNow({ kind: 'response', id, ok: false, error: `Unknown method: ${event}` });
      return;
    }
    // Capture ws before await so we don't send a response on a reconnected socket.
    // If ws has changed (disconnect + reconnect), the server's original pending
    // request lives on the old RpcChannel and will be rejected by handleClose().
    try {
      const result = await handler(data);
      if (this.ws === ws && this.isOpen())
        this.sendNow({ kind: 'response', id, ok: true, data: result });
    } catch (err) {
      if (this.ws === ws && this.isOpen())
        this.sendNow({
          kind: 'response',
          id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
    }
  }

  private openSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    // Node.js 21+ (undici) WebSocket accepts { headers } as the second argument
    // and forwards them on the HTTP upgrade request — verified at runtime.
    // The browser WebSocket overload types only string | string[] (protocols),
    // so we cast through that union; browsers ignore unknown object keys.
    const wsOptions = (this.opts.headers ? { headers: this.opts.headers } : undefined) as
      | string[]
      | undefined;
    const ws = new WebSocket(this.url, wsOptions);
    this.ws = ws;
    ws.onopen = () => this.handleOpen();
    ws.onmessage = (ev) => this.handleMessage(ev);
    ws.onclose = (ev) => this.handleClose(ev);
    ws.onerror = () => {
      /* swallow; close will follow */
    };
  }

  private handleOpen(): void {
    this.backoffMs = this.opts.initialBackoffMs;
    // Send resume FIRST so the server replays missed events before our queued
    // outbound work executes against potentially-stale state.
    this.sendNow({ kind: 'resume', lastSeq: this.lastSeq });
    for (const q of this.outbox) {
      this.sendNow(this.toEnvelope(q));
    }
    this.outbox = [];
    this.startPingTimer();
    this.lifecycle?.onOpen(randomId());
  }

  private handleMessage(ev: MessageEvent): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
    } catch {
      console.warn('[WsClient] received non-JSON message', ev.data);
      return;
    }
    const result = EnvelopeSchema.safeParse(parsed);
    if (!result.success) return;
    const env = result.data;

    switch (env.kind) {
      case 'event':
        if (env.seq > this.lastSeq) this.lastSeq = env.seq;
        this.fireListener(env.event, env.data);
        return;
      case 'response': {
        const p = this.pending.get(env.id);
        if (!p) return;
        this.pending.delete(env.id);
        if (env.ok) p.resolve(env.data);
        else p.reject(new Error(env.error ?? 'request failed'));
        return;
      }
      case 'request':
        void this.handleIncomingRequest(env.id, env.event, env.data);
        return;
      case 'pong':
      case 'ping':
      case 'resume':
        return;
    }
  }

  private handleClose(_ev: CloseEvent): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    this.lifecycle?.onClose();
    if (this.explicitlyClosed) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const jitter = 1 + (Math.random() * 0.4 - 0.2);
    const delay = Math.min(this.backoffMs * jitter, this.opts.maxBackoffMs);
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
    this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs);
  }

  /**
   * When the tab becomes visible after being backgrounded, mobile + power-saving
   * scenarios often delay timer firing. Treat visibility return as a hint to
   * reconnect immediately rather than wait out the remaining backoff.
   */
  private bindVisibilityChange(): void {
    if (!doc()) return;
    this.visibilityHandler = () => {
      if (doc()?.visibilityState !== 'visible') return;
      if (this.isOpen() || this.explicitlyClosed) return;
      if (!this.reconnectTimer) return;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      this.backoffMs = this.opts.initialBackoffMs;
      this.openSocket();
    };
    doc()?.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private startPingTimer(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.isOpen()) this.sendNow({ kind: 'ping' });
    }, this.opts.pingIntervalMs);
  }

  private isOpen(): boolean {
    return !!this.ws && this.ws.readyState === this.ws.OPEN;
  }

  private sendNow(env: Envelope): void {
    this.ws?.send(JSON.stringify(env));
  }

  private toEnvelope(q: QueuedEnvelope): Envelope {
    if (q.kind === 'event') {
      // Client→server `seq` is a placeholder (server doesn't read it; spec D9
      // says seq is meaningful only server→client). Schema requires int>=0.
      return { kind: 'event', seq: 0, event: q.event, data: q.data };
    }
    return { kind: 'request', id: q.id, event: q.event, data: q.data };
  }

  private enqueue(q: QueuedEnvelope): void {
    if (this.outbox.length >= this.opts.outboxLimit) {
      const dropped = this.outbox.shift();
      if (dropped?.kind === 'request') {
        const p = this.pending.get(dropped.id);
        if (p) {
          this.pending.delete(dropped.id);
          p.reject(new Error('outbox overflow'));
        }
      }
    }
    this.outbox.push(q);
  }

  private fireListener(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (err) {
        console.warn('[WsClient] listener error', event, err);
      }
    }
  }
}

interface DocumentLike {
  visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

function doc(): DocumentLike | undefined {
  return typeof globalThis !== 'undefined'
    ? (globalThis as { document?: DocumentLike }).document
    : undefined;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
