import {
  type Broadcaster,
  FilesDataSource,
  GitDataSource,
  LocalBroadcaster,
  OpenspecDataSource,
} from '@code-quest/broadcaster';
import { LocalFileWatcher } from '@code-quest/file-watcher';
import type { Filesystem } from '@code-quest/filesystem';
import { LocalFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import { LocalGit } from '@code-quest/git';
import { LocalOpenspec } from '@code-quest/openspec';
import type { ProcessProvider } from '@code-quest/schemas';
import type { RemoteConfig as Config } from './config.ts';
import { ChildProcessProvider } from './transports/child-process.ts';

export class Token<T> {
  declare readonly _phantom: T;
  readonly symbol: symbol;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
    this.symbol = Symbol(name);
  }
}

export class Container {
  private readonly map = new Map<symbol, unknown>();

  bind<T>(token: Token<T>, value: T): this {
    this.map.set(token.symbol, value);
    return this;
  }

  get<T>(token: Token<T>): T {
    const v = this.map.get(token.symbol);
    if (v === undefined) throw new Error(`No binding for ${token.name}`);
    return v as T;
  }
}

export const TOKENS: {
  Filesystem: Token<Filesystem>;
  Git: Token<Git>;
  ProcessProvider: Token<ProcessProvider>;
  Broadcaster: Token<Broadcaster>;
} = {
  Filesystem: new Token<Filesystem>('Filesystem'),
  Git: new Token<Git>('Git'),
  ProcessProvider: new Token<ProcessProvider>('ProcessProvider'),
  Broadcaster: new Token<Broadcaster>('Broadcaster'),
};

export function createContainer(config: Config): Container {
  const processProvider = new ChildProcessProvider();
  const filesystem = new RootGuardFilesystem(new LocalFilesystem(), config.fsRoots);
  const git = new LocalGit();
  const watchService = new LocalFileWatcher();
  const openspec = new LocalOpenspec(filesystem, processProvider);

  const broadcaster = new LocalBroadcaster()
    .add('files', (cwd) => new FilesDataSource(cwd, watchService, filesystem))
    .add('git', (cwd) => new GitDataSource(cwd, watchService, git))
    .add('openspec', (cwd) => new OpenspecDataSource(cwd, watchService, openspec));

  return new Container()
    .bind(TOKENS.ProcessProvider, processProvider)
    .bind(TOKENS.Filesystem, filesystem)
    .bind(TOKENS.Git, git)
    .bind(TOKENS.Broadcaster, broadcaster);
}
