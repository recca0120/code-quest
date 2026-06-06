import { relative } from 'node:path';
import parcelWatcher from '@parcel/watcher';
import type {
  FileWatcher,
  MinimalLogger,
  Unsubscribe,
  WatchCallback,
  WatchEvent,
} from './types.ts';

const TYPE_MAP: Record<string, WatchEvent['type']> = {
  create: 'add',
  update: 'change',
  delete: 'unlink',
};

const noopLogger: MinimalLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

export class LocalFileWatcher implements FileWatcher {
  private readonly logger: MinimalLogger;
  private entries = new Map<
    string,
    { subscription: parcelWatcher.AsyncSubscription; subs: Set<WatchCallback> }
  >();

  constructor(logger?: MinimalLogger) {
    this.logger = logger ?? noopLogger;
  }

  subscribe(cwd: string, cb: WatchCallback): Unsubscribe {
    let entry = this.entries.get(cwd);
    if (!entry) {
      entry = this.createEntry(cwd);
      this.entries.set(cwd, entry);
    }
    entry.subs.add(cb);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const e = this.entries.get(cwd);
      if (!e) return;
      e.subs.delete(cb);
      if (e.subs.size === 0) {
        void e.subscription.unsubscribe();
        this.entries.delete(cwd);
      }
    };
  }

  private createEntry(cwd: string): {
    subscription: parcelWatcher.AsyncSubscription;
    subs: Set<WatchCallback>;
  } {
    const subs = new Set<WatchCallback>();
    let resolvedSubscription: parcelWatcher.AsyncSubscription | null = null;

    const subscriptionPromise = parcelWatcher.subscribe(
      cwd,
      (err, events) => {
        if (err) {
          this.logger.error({ err }, '[LocalFileWatcher] watcher error');
          return;
        }
        for (const ev of events) {
          const type = TYPE_MAP[ev.type];
          if (!type) continue;
          const path = relative(cwd, ev.path);
          if (!path) continue;
          const watchEvent: WatchEvent = { type, path };
          for (const sub of subs) {
            try {
              sub(watchEvent);
            } catch (e) {
              this.logger.error({ err: e }, '[LocalFileWatcher] subscriber threw');
            }
          }
        }
      },
      {
        ignore: [
          '**/node_modules/**',
          '**/.git/objects/**',
          '**/.git/logs/**',
          '**/dist/**',
          '**/build/**',
          '**/out/**',
          '**/.next/**',
          '**/.turbo/**',
          '**/.parcel-cache/**',
          '**/*.log',
          '**/.DS_Store',
        ],
      },
    );

    subscriptionPromise
      .then((sub) => {
        resolvedSubscription = sub;
        // If already unsubscribed before promise resolved, clean up immediately.
        if (!this.entries.has(cwd)) {
          void sub.unsubscribe();
        }
      })
      .catch((err: unknown) => {
        this.logger.error({ err }, '[LocalFileWatcher] subscribe failed');
      });

    // Return a proxy subscription that delegates unsubscribe to the resolved one.
    const proxySubscription: parcelWatcher.AsyncSubscription = {
      unsubscribe: async () => {
        if (resolvedSubscription) {
          await resolvedSubscription.unsubscribe();
        }
      },
    };

    return { subscription: proxySubscription, subs };
  }
}
