import type { FileWatcher } from '@code-quest/file-watcher';
import type { DataSourceLike, Unsubscribe } from './types.ts';

export const GIT_META_RE: RegExp = /^\.git\/(HEAD|index|packed-refs|refs\/.*)$/;

export abstract class DataSource<T> implements DataSourceLike<T> {
  protected readonly cwd: string;
  private readonly callbacks = new Set<() => void>();
  private readonly unsub: Unsubscribe;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    cwd: string,
    watchService: FileWatcher,
    filter: (path: string) => boolean,
    debounceMs = 80,
  ) {
    this.cwd = cwd;
    this.unsub = watchService.subscribe(cwd, (ev) => {
      if (!filter(ev.path)) return;
      if (debounceMs === 0) {
        for (const cb of this.callbacks) cb();
        return;
      }
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        for (const cb of this.callbacks) cb();
      }, debounceMs);
    });
  }

  abstract read(): Promise<T>;

  onChange(cb: () => void): Unsubscribe {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.unsub();
  }
}
