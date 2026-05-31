export interface WatchEvent {
  type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';
  path: string;
}

export type WatchCallback = (event: WatchEvent) => void;
export type Unsubscribe = () => void;

export interface FileWatcher {
  subscribe(cwd: string, cb: WatchCallback): Unsubscribe;
}

export interface MinimalLogger {
  debug(obj: object, msg: string): void;
  warn(msg: string): void;
  error(obj: object, msg: string): void;
}
