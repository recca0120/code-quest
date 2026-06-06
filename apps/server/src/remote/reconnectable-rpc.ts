import { logger } from '../logger.ts';
import type { RemoteRpcWithEvents } from './types.ts';

/**
 * Stable event bus that survives summoner WS reconnects.
 * Listeners registered via on() persist across replace() calls —
 * they are re-wired to each new underlying RpcChannel automatically.
 */
export class ReconnectableRpc implements RemoteRpcWithEvents {
  private current: RemoteRpcWithEvents | null = null;
  private readonly persistentListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private currentUnsubscribers: Array<() => void> = [];

  get connected(): boolean {
    return this.current !== null;
  }

  replace(rpc: RemoteRpcWithEvents): void {
    for (const unsub of this.currentUnsubscribers) unsub();
    this.currentUnsubscribers = [];
    this.current = rpc;
    logger.info('Remote summoner connected');
    for (const fn of this.persistentListeners.get('reconnect') ?? []) fn();

    for (const [event, fns] of this.persistentListeners) {
      for (const fn of fns) {
        this.currentUnsubscribers.push(rpc.on(event, fn));
      }
    }

    this.currentUnsubscribers.push(
      rpc.on('disconnect', () => {
        if (this.current === rpc) {
          logger.info('Remote summoner disconnected');
          this.current = null;
          for (const unsub of this.currentUnsubscribers) unsub();
          this.currentUnsubscribers = [];
        }
      }),
    );
  }

  destroy(): void {
    for (const unsub of this.currentUnsubscribers) unsub();
    this.currentUnsubscribers = [];
    this.persistentListeners.clear();
    this.current = null;
  }

  request<R = unknown>(method: string, params: unknown): Promise<R> {
    if (!this.current) return Promise.reject(new Error('No remote summoner connected'));
    return this.current.request(method, params);
  }

  on(event: string, fn: (...args: unknown[]) => void): () => void {
    let set = this.persistentListeners.get(event);
    if (!set) {
      set = new Set();
      this.persistentListeners.set(event, set);
    }
    set.add(fn);

    let unsub: (() => void) | null = null;
    if (this.current) {
      unsub = this.current.on(event, fn);
      this.currentUnsubscribers.push(unsub);
    }

    return () => {
      this.persistentListeners.get(event)?.delete(fn);
      unsub?.();
    };
  }
}
