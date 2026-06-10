import 'reflect-metadata';
import {
  FilesDataSource,
  GitDataSource,
  LocalBroadcaster,
  OpenspecDataSource,
} from '@code-quest/broadcaster';
import { type DiffFile, LocalDiffFile } from '@code-quest/diff-file';
import { type FileWatcher, LocalFileWatcher } from '@code-quest/file-watcher';
import type { Filesystem } from '@code-quest/filesystem';
import { LocalFilesystem, RemoteFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import { LocalGit, RemoteGit } from '@code-quest/git';
import { LocalOpenspec, type Openspec } from '@code-quest/openspec';
import type { ProcessProvider } from '@code-quest/schemas';
import {
  ChildProcessProvider,
  ClaudeAdapter,
  LocalPluginCli,
  type PluginCliService,
  ProcessRunner,
} from '@code-quest/summoner';
import { Container } from 'inversify';
import { config } from './config.ts';
import type { DatabaseEntry } from './db/create-database.ts';
import { createDatabase, type DrizzleDatabase } from './db/sqlite-client.ts';
import { logger } from './logger.ts';
import { RemoteProcessProvider } from './remote/process-provider.ts';
import type { ReconnectableRpc } from './remote/reconnectable-rpc.ts';
import { RemoteBroadcaster } from './remote/remote-broadcaster.ts';
import { CompositeProjectStore } from './services/composite-project-store.ts';
import { CompositeRawDeltaStore } from './services/composite-raw-delta-repository.ts';
import { CompositeRawEventStore } from './services/composite-raw-event-repository.ts';
import { CompositeSessionStore } from './services/composite-session-store.ts';
import { CompositeSettingsStore } from './services/composite-settings-store.ts';
import { DrizzleRawDeltaStore } from './services/drizzle-raw-delta-repository.ts';
import { DrizzleRawEventStore } from './services/drizzle-raw-event-repository.ts';
import { DrizzleSessionStore } from './services/drizzle-session-store.ts';
import { DrizzleSettingsStore } from './services/drizzle-settings-store.ts';
import { ProjectAutoUpserter } from './services/project-auto-upserter.ts';
import { DrizzleProjectStore, type ProjectStore } from './services/project-store.ts';
import type { RawDeltaRepository } from './services/raw-delta-repository.ts';
import type { RawEventRepository } from './services/raw-event-repository.ts';
import { RawEventStore } from './services/raw-event-store.ts';
import type { SessionStore } from './services/session-store.ts';
import type { SettingsStore } from './services/settings-store.ts';
import { UsageTracker } from './services/usage-tracker.ts';
import { ChannelEmitter } from './socket/channel-emitter.ts';
import { ChannelManager, type SessionLookup } from './socket/channel-manager.ts';
import { SessionHistory } from './socket/handlers/session/history.ts';
import { LayoutStore } from './socket/layout-store.ts';
import { RawRecorder } from './socket/raw-recorder.ts';
import { SocketServer } from './socket/server.ts';
import { type RunnerFactory, TYPES } from './types.ts';

export interface StoreConfig {
  databases: DatabaseEntry[];
}

export interface ContainerOptions {
  processProvider?: ProcessProvider;
  storeConfig: StoreConfig;
  watchService?: FileWatcher;
  historyBatchSize?: number;
  autoMode?: boolean;
  remoteRpc?: ReconnectableRpc;
  fsRoots?: string[];
  rawEvents?: { writeDeltas?: boolean; readDeltas?: boolean };
}

export function createContainer(options: ContainerOptions): Container {
  const container = new Container();
  const remoteRpc = options.remoteRpc;

  if (remoteRpc) {
    container
      .bind<ProcessProvider>(TYPES.ProcessProvider)
      .toConstantValue(new RemoteProcessProvider(remoteRpc));
  } else if (options.processProvider) {
    container.bind<ProcessProvider>(TYPES.ProcessProvider).toConstantValue(options.processProvider);
  }

  const adapter = new ClaudeAdapter();
  const runnerFactory: RunnerFactory = {
    create: (opts, spawnOptions) =>
      new ProcessRunner({
        adapter,
        processProvider: container.isBound(TYPES.ProcessProvider)
          ? container.get<ProcessProvider>(TYPES.ProcessProvider)
          : undefined,
        args: opts,
        spawnOptions,
      }),
    command: adapter.command,
  };
  container.bind<RunnerFactory>(TYPES.RunnerFactory).toConstantValue(runnerFactory);

  const { databases } = options.storeConfig;
  if (databases.length === 0) {
    throw new Error('At least one database must be configured in StoreConfig.databases.');
  }
  const sqliteEntry = databases.find((d) => d.type === 'sqlite');
  const db = sqliteEntry?.db ?? createDatabase(':memory:');
  container.bind<DrizzleDatabase>(TYPES.Database).toConstantValue(db);

  const readDeltas = options.rawEvents?.readDeltas ?? config.rawEvents.readDeltas;
  const writeDeltas = options.rawEvents?.writeDeltas ?? config.rawEvents.writeDeltas;
  const autoMode = options.autoMode ?? config.autoMode;

  const { eventStores, deltaStores, sessionStores, settingsStores } = buildStores(databases, {
    readDeltas,
  });

  const lowEventStore = pickOrComposite(eventStores, (s) => new CompositeRawEventStore(s));
  const lowDeltaStore = pickOrComposite(deltaStores, (s) => new CompositeRawDeltaStore(s));

  const rawEventService = new RawEventStore(lowEventStore, lowDeltaStore);
  container.bind<RawEventStore>(TYPES.RawEventStore).toConstantValue(rawEventService);

  const sessionStore = pickOrComposite(sessionStores, (s) => new CompositeSessionStore(s));
  container.bind<SessionStore>(TYPES.SessionStore).toConstantValue(sessionStore);

  const projectStores = buildProjectStores(databases);
  const projectStore = pickOrComposite(projectStores, (s) => new CompositeProjectStore(s));
  container.bind<ProjectStore>(TYPES.ProjectStore).toConstantValue(projectStore);

  const settingsStore = pickOrComposite(settingsStores, (s) => new CompositeSettingsStore(s));
  container.bind<SettingsStore>(TYPES.SettingsStore).toConstantValue(settingsStore);

  const rawRecorder = new RawRecorder(rawEventService, writeDeltas);
  const emitter = new ChannelEmitter();
  // Circular wiring between ChannelManager and SessionHistory via lazy lookup —
  // neither is invoked during construction, so the forward-reference is safe.
  let sessionHistory: SessionHistory;
  const sessionLookup: SessionLookup = {
    resolveSessionId: (channelId) => sessionHistory.resolveSessionId(channelId),
    resolveCwdAndProjectRoot: async (channelId, sessionId) => {
      const row = await sessionStore.getById(sessionId);
      if (!row?.cwd) {
        // L2 territory: legacy rows with null cwd exist until the DB migration runs.
        logger.error({ channelId }, 'no recorded cwd');
        throw new Error(`Channel ${channelId} has no recorded cwd`);
      }
      return { cwd: row.cwd, projectRoot: row.projectRoot ?? row.cwd };
    },
  };
  const watchService: FileWatcher = options.watchService ?? new LocalFileWatcher();
  container.bind<FileWatcher>(TYPES.FileWatcher).toConstantValue(watchService);
  if (remoteRpc) {
    bindRemoteSnapshotBroadcasters(container, remoteRpc);
  } else {
    bindSnapshotBroadcasters(container, watchService);
  }
  const channelManager = new ChannelManager(
    runnerFactory,
    adapter,
    rawRecorder,
    emitter,
    sessionLookup,
  );
  sessionHistory = new SessionHistory(
    rawEventService,
    sessionStore,
    adapter,
    channelManager,
    options.historyBatchSize,
  );
  container.bind<ChannelManager>(TYPES.ChannelManager).toConstantValue(channelManager);
  container.bind<SessionHistory>(TYPES.SessionHistory).toConstantValue(sessionHistory);
  container.bind<ChannelEmitter>(TYPES.ChannelEventRouter).toConstantValue(emitter);
  container.bind<LayoutStore>(TYPES.LayoutStore).toConstantValue(new LayoutStore());

  // ProjectAutoUpserter — bridges session lifecycle → project entity (Direction C).
  // Constructed after emitter so it can broadcast updates.
  const projectAutoUpserter = new ProjectAutoUpserter(projectStore, emitter);
  container
    .bind<ProjectAutoUpserter>(TYPES.ProjectAutoUpserter)
    .toConstantValue(projectAutoUpserter);

  container.bind<boolean>(TYPES.AutoMode).toConstantValue(autoMode);
  container.bind<UsageTracker>(TYPES.UsageTracker).to(UsageTracker).inSingletonScope();
  container.bind<SocketServer>(TYPES.SocketServer).to(SocketServer).inSingletonScope();
  bindServices(container, remoteRpc, options.fsRoots ?? []);

  return container;
}

function bindServices(
  container: Container,
  remoteRpc: ReconnectableRpc | undefined,
  fsRoots: string[],
): void {
  if (remoteRpc) {
    container.bind(TYPES.Filesystem).toConstantValue(new RemoteFilesystem(remoteRpc));
    container.bind<Git>(TYPES.Git).toConstantValue(new RemoteGit(remoteRpc));
  } else {
    container
      .bind(TYPES.Filesystem)
      .toConstantValue(new RootGuardFilesystem(new LocalFilesystem(), fsRoots));
    container.bind<Git>(TYPES.Git).toConstantValue(new LocalGit());
  }
  container.bind<PluginCliService>(TYPES.PluginCliService).toConstantValue(new LocalPluginCli());
  container.bind<DiffFile>(TYPES.DiffFile).toConstantValue(new LocalDiffFile());
  const openspecProcess = container.isBound(TYPES.ProcessProvider)
    ? container.get<ProcessProvider>(TYPES.ProcessProvider)
    : new ChildProcessProvider();
  container
    .bind<Openspec>(TYPES.Openspec)
    .toConstantValue(
      new LocalOpenspec(container.get<Filesystem>(TYPES.Filesystem), openspecProcess),
    );
}

function pickOrComposite<T>(stores: T[], makeComposite: (stores: T[]) => T): T {
  return stores.length === 1 ? (stores[0] as T) : makeComposite(stores);
}

function bindRemoteSnapshotBroadcasters(container: Container, remoteRpc: ReconnectableRpc): void {
  container.bind(TYPES.Broadcaster).toConstantValue(new RemoteBroadcaster(remoteRpc));
}

function bindSnapshotBroadcasters(container: Container, watchService: FileWatcher): void {
  const broadcaster = new LocalBroadcaster()
    .add('files', (cwd) => {
      const fs = container.get<Filesystem>(TYPES.Filesystem);
      return new FilesDataSource(cwd, watchService, fs);
    })
    .add('git', (cwd) => {
      const git = container.get<Git>(TYPES.Git);
      return new GitDataSource(cwd, watchService, git);
    })
    .add('openspec', (cwd) => {
      const openspec = container.get<Openspec>(TYPES.Openspec);
      return new OpenspecDataSource(cwd, watchService, openspec);
    });
  container.bind(TYPES.Broadcaster).toConstantValue(broadcaster);
}

function buildStores(
  databases: DatabaseEntry[],
  flags: { readDeltas: boolean } = { readDeltas: false },
): {
  eventStores: RawEventRepository[];
  deltaStores: RawDeltaRepository[];
  sessionStores: SessionStore[];
  settingsStores: SettingsStore[];
} {
  const eventStores: RawEventRepository[] = [];
  const deltaStores: RawDeltaRepository[] = [];
  const sessionStores: SessionStore[] = [];
  const settingsStores: SettingsStore[] = [];

  for (const { db, schema } of databases) {
    const deltaTableForRead = flags.readDeltas ? schema.rawDeltas : undefined;
    eventStores.push(new DrizzleRawEventStore(db, schema.rawEvents, deltaTableForRead));
    deltaStores.push(new DrizzleRawDeltaStore(db, schema.rawDeltas));
    sessionStores.push(new DrizzleSessionStore(db, schema.sessions));
    settingsStores.push(new DrizzleSettingsStore(db, schema.settings));
  }

  return { eventStores, deltaStores, sessionStores, settingsStores };
}

function buildProjectStores(databases: DatabaseEntry[]): ProjectStore[] {
  return databases.map(({ db, schema }) => new DrizzleProjectStore(db, schema.projects));
}
