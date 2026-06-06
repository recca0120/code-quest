import type { Broadcaster, SnapshotCallback, Unsubscribe } from '@code-quest/broadcaster';
import { REMOTE_METHODS } from '@code-quest/schemas';
import { z } from 'zod';
import { logger } from '../logger.ts';
import type { RemoteRpcWithEvents } from './types.ts';

const watchSnapshotSchema = z.object({
  cwd: z.string(),
  type: z.enum(['files', 'git', 'openspec']),
  data: z.unknown(),
});

export class RemoteBroadcaster implements Broadcaster {
  private readonly rpc: RemoteRpcWithEvents;
  private readonly subscribers = new Map<string, Map<string, SnapshotCallback>>();
  private offSnapshot: Unsubscribe | null = null;
  private offReconnect: Unsubscribe | null = null;

  constructor(rpc: RemoteRpcWithEvents) {
    this.rpc = rpc;
    this.offReconnect = rpc.on('reconnect', () => {
      for (const cwd of this.subscribers.keys()) {
        this.startWatch(cwd);
      }
    });
  }

  subscribe(cwd: string, subscriberId: string, cb: SnapshotCallback): Unsubscribe {
    let cwdSubs = this.subscribers.get(cwd);
    const isFirst = !cwdSubs || cwdSubs.size === 0;

    if (!cwdSubs) {
      cwdSubs = new Map();
      this.subscribers.set(cwd, cwdSubs);
    }
    cwdSubs.set(subscriberId, cb);

    if (isFirst) {
      this.ensureSnapshotListener();
      this.startWatch(cwd);
    }

    return () => {
      const subs = this.subscribers.get(cwd);
      if (!subs) return;
      subs.delete(subscriberId);
      if (subs.size === 0) {
        this.subscribers.delete(cwd);
        this.stopWatch(cwd);
      }
    };
  }

  dispose(): void {
    this.offSnapshot?.();
    this.offSnapshot = null;
    this.offReconnect?.();
    this.offReconnect = null;
    for (const cwd of this.subscribers.keys()) {
      this.stopWatch(cwd);
    }
    this.subscribers.clear();
  }

  private startWatch(cwd: string): void {
    void this.rpc.request(REMOTE_METHODS.watch.start, { cwd }).catch((err) => {
      logger.warn({ err }, 'watch.start failed');
    });
  }

  private stopWatch(cwd: string): void {
    void this.rpc.request(REMOTE_METHODS.watch.stop, { cwd }).catch(() => {});
  }

  private ensureSnapshotListener(): void {
    if (this.offSnapshot) return;
    this.offSnapshot = this.rpc.on(REMOTE_METHODS.watch.snapshot, (...args: unknown[]) => {
      const parsed = watchSnapshotSchema.safeParse(args[0]);
      if (!parsed.success) return;
      const { cwd, type, data } = parsed.data;
      const subs = this.subscribers.get(cwd);
      if (!subs) return;
      for (const cb of subs.values()) {
        cb(type, data);
      }
    });
  }
}
