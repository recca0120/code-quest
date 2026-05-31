import { relative } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type {
  FileWatcher,
  MinimalLogger,
  Unsubscribe,
  WatchCallback,
  WatchEvent,
} from './types.ts';

const IGNORES = [
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.git[/\\]objects([/\\]|$)/,
  /(^|[/\\])\.git[/\\]logs([/\\]|$)/,
  /(^|[/\\])dist([/\\]|$)/,
  /(^|[/\\])build([/\\]|$)/,
  /(^|[/\\])out([/\\]|$)/,
  /(^|[/\\])\.next([/\\]|$)/,
  /(^|[/\\])\.turbo([/\\]|$)/,
  /(^|[/\\])\.parcel-cache([/\\]|$)/,
  /\.log$/,
  /(^|[/\\])\.DS_Store$/,
];

const CHOKIDAR_OPTS = {
  ignored: IGNORES,
  ignoreInitial: true,
  persistent: true,
  followSymlinks: false,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
};

const noopLogger: MinimalLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const { code } = err as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

export class LocalFileWatcher implements FileWatcher {
  private readonly logger: MinimalLogger;
  private entries = new Map<string, { watcher: FSWatcher; subs: Set<WatchCallback> }>();
  private inotifyWarned = false;

  constructor(logger?: MinimalLogger) {
    this.logger = logger ?? noopLogger;
  }

  subscribe(cwd: string, cb: WatchCallback): Unsubscribe {
    let entry = this.entries.get(cwd);
    if (!entry) {
      entry = this.createWatcherEntry(cwd);
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
        void e.watcher.close();
        this.entries.delete(cwd);
      }
    };
  }

  private createWatcherEntry(cwd: string): { watcher: FSWatcher; subs: Set<WatchCallback> } {
    const watcher = chokidar.watch(cwd, CHOKIDAR_OPTS);
    const entry = { watcher, subs: new Set<WatchCallback>() };
    watcher.on('all', (type, path) => {
      if (type === 'ready' || type === 'error') return;
      const rel = relative(cwd, path);
      if (!rel) return;
      const event: WatchEvent = { type: type as WatchEvent['type'], path: rel };
      for (const sub of entry.subs) {
        try {
          sub(event);
        } catch (err) {
          this.logger.error({ err }, '[LocalFileWatcher] subscriber threw');
        }
      }
    });
    watcher.on('error', (err: unknown) => {
      const code = errorCode(err);
      if (code === 'ENOSPC' && !this.inotifyWarned) {
        this.inotifyWarned = true;
        this.logger.warn(
          '[LocalFileWatcher] inotify watch limit reached. ' +
            'Increase with: sudo sysctl -n fs.inotify.max_user_watches=524288',
        );
        return;
      }
      this.logger.error({ err }, '[LocalFileWatcher] watcher error');
    });
    return entry;
  }
}
