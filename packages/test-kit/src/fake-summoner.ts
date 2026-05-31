/* biome-ignore-all lint/suspicious/noExplicitAny: test harness uses type assertions */

import type { FakeOpenspec, FakePluginCli } from '@code-quest/summoner/test';
import { FakeClaude } from './fake-claude.ts';
import type { FakeFilesystem } from './fake-filesystem.ts';
import type { FakeGit } from './fake-git.ts';
import type { FakeProcessProvider } from './fake-process-provider.ts';
import type { FakeSocket } from './fake-socket.ts';

/**
 * FakeSummoner — one window/connection.
 *
 * Holds its own socket, lazy-creates Claude on first call to claude().
 * No container dependency — summoner layer doesn't know about DI.
 */
export class FakeSummoner {
  private readonly _socket: FakeSocket;
  private readonly _provider: FakeProcessProvider;
  private readonly _filesystem: FakeFilesystem;
  private readonly _git?: FakeGit;
  private readonly _openspec?: FakeOpenspec;
  private readonly _pluginCli?: FakePluginCli;
  private readonly _recordedEvents: Array<{ event: string; payload: any }> = [];
  private readonly _sentEvents: Array<{ event: string; payload: any }> = [];
  private _claude?: FakeClaude;

  private readonly _heldEmits = new Map<string, { cb: (...args: unknown[]) => void } | null>();
  private _origClientEmit!: (event: string, ...args: unknown[]) => FakeSocket;

  constructor(server: ServerConnector) {
    const conn = server.connect();
    this._socket = conn.socket;
    this._provider = conn.provider;
    this._filesystem = conn.filesystem;
    if ('git' in conn) this._git = conn.git;
    if ('openspec' in conn) this._openspec = conn.openspec;
    if ('pluginCli' in conn) this._pluginCli = conn.pluginCli;

    // Auto-record all server → client events
    const { serverSocket } = this._socket;
    const origServerEmit = serverSocket.emit.bind(serverSocket);
    serverSocket.emit = (event: string, ...args: unknown[]) => {
      this._recordedEvents.push({ event, payload: args[0] });
      return origServerEmit(event, ...args);
    };

    // Auto-record all client → server emits + holdEmit interception.
    this._origClientEmit = this._socket.emit.bind(this._socket);
    this._socket.emit = (event: string, ...args: unknown[]) => {
      this._sentEvents.push({ event, payload: args[0] });

      if (this._heldEmits.has(event) && this._heldEmits.get(event) === null) {
        return this._interceptHeldEmit(event, args);
      }

      return this._origClientEmit(event, ...args);
    };
  }

  private _interceptHeldEmit(event: string, args: unknown[]) {
    const lastArg = args[args.length - 1];
    const rest = args.slice(0, -1);
    const cb = typeof lastArg === 'function' ? (lastArg as (...a: unknown[]) => void) : null;
    const argsForServer = cb ? rest : args;
    if (cb) {
      this._origClientEmit(event, ...argsForServer, (ack: unknown) => {
        this._heldEmits.set(event, { cb: () => cb(ack) });
      });
    } else {
      this._origClientEmit(event, ...args);
    }
    return this._socket;
  }

  /** Get the FakeFilesystem. */
  filesystem(): FakeFilesystem {
    return this._filesystem;
  }

  /** Get the FakeGit (only available when connected to a server with Git). */
  git(): FakeGit | undefined {
    return this._git;
  }

  /** Get the FakeOpenspec. */
  openspec(): FakeOpenspec | undefined {
    return this._openspec;
  }

  /** Get the FakePluginCli (only when wired by server FakeServer). */
  pluginCli(): FakePluginCli | undefined {
    return this._pluginCli;
  }

  /** Lazy Claude — created on first call. */
  claude(): FakeClaude {
    if (!this._claude) {
      this._claude = new FakeClaude({
        socket: this._socket,
        provider: this._provider,
      });
    }
    return this._claude;
  }

  /** Send socket event to server. */
  async send<T = void>(event: string, payload?: unknown): Promise<T> {
    return this.claude().send<T>(event, payload);
  }

  private _queryEvents(store: Array<{ event: string; payload: any }>, eventName?: string): any {
    if (!eventName) return store;
    return store.filter((e) => e.event === eventName).map((e) => e.payload);
  }

  /** Query recorded server → client events. */
  receivedEvents(): Array<{ event: string; payload: any }>;
  receivedEvents(eventName: string): any[];
  receivedEvents(eventName?: string): any {
    return this._queryEvents(this._recordedEvents, eventName);
  }

  /** Query client → server emits (mirror of `events()`). Use to assert which
   *  RPC calls the React layer made — preferred over monkey-patching
   *  `socket.emit` in individual tests. */
  sentEvents(): Array<{ event: string; payload: any }>;
  sentEvents(eventName: string): any[];
  sentEvents(eventName?: string): any {
    return this._queryEvents(this._sentEvents, eventName);
  }

  /** Hold the next emit of a specific event — the server handler runs but the
   *  callback is captured. Call `release()` on the returned handle to deliver
   *  the ACK to the client. Only the first matching emit is held; subsequent
   *  emits of the same event pass through normally. */
  holdEmit(eventName: string): { release: () => void } {
    this._heldEmits.set(eventName, null);
    return {
      release: () => {
        const held = this._heldEmits.get(eventName);
        this._heldEmits.delete(eventName);
        held?.cb();
      },
    };
  }

  /** Subscribe to server events with callback (for timing-sensitive checks). */
  on(event: string, fn: (...args: any[]) => void): void {
    this._socket.on(event, fn);
  }

  disconnect(): void {
    this._socket.disconnect();
  }

  get connected(): boolean {
    return this._socket.connected;
  }

  /** Access socket for React SocketProvider injection. */
  get socket(): FakeSocket {
    return this._socket;
  }
}

/** Interface for server-like objects that can create window connections. */
export interface ServerConnector {
  connect(): {
    socket: FakeSocket;
    provider: FakeProcessProvider;
    filesystem: FakeFilesystem;
    git?: FakeGit;
    openspec?: FakeOpenspec;
    pluginCli?: FakePluginCli;
  };
}

/** Create a FakeSummoner from a server connector. */
export function createFakeSummoner(server: ServerConnector): FakeSummoner {
  return new FakeSummoner(server);
}
